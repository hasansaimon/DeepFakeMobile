import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { jobsTable, modelsTable, facesetsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "crypto";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { upscaleMedia } from "../lib/upscale";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const VIDEO_LIMITS: Record<string, { maxSeconds: number; label: string }> = {
  swap_video_small: { maxSeconds: 10, label: "first 10 seconds" },
  swap_video_medium: { maxSeconds: 90, label: "first 90 seconds" },
  swap_video_large: { maxSeconds: 300, label: "first 5 minutes" },
};

const CreateJobBody = z.object({
  type: z.enum([
    "train_online",
    "train_device",
    "swap_video_small",
    "swap_video_medium",
    "swap_video_large",
    "swap_image",
    "upscale",
  ]),
  modelId: z.string().uuid().optional(),
  facesetId: z.string().uuid().optional(),
  inputStorageKey: z.string().optional(),
  size: z.enum(["small", "medium", "large"]).optional(),
  iterations: z.number().int().min(250).max(6500).optional(),
  upscaleFactor: z.number().int().min(2).max(4).optional(),
});

async function runUpscaleJob(jobId: string, inputStorageKey: string, factor: number) {
  try {
    await db
      .update(jobsTable)
      .set({ status: "processing", progressPercent: 10, updatedAt: new Date() })
      .where(eq(jobsTable.id, jobId));

    const inputFile = await objectStorageService.getObjectEntityFile(inputStorageKey);
    const [inputBuffer] = await inputFile.download();
    const [metadata] = await inputFile.getMetadata();
    const mimeType = (metadata.contentType as string) || "image/jpeg";

    await db
      .update(jobsTable)
      .set({ progressPercent: 40, updatedAt: new Date() })
      .where(eq(jobsTable.id, jobId));

    const { buffer: outputBuffer, mimeType: outputMimeType } = await upscaleMedia(
      inputBuffer,
      mimeType,
      factor,
    );

    await db
      .update(jobsTable)
      .set({ progressPercent: 80, updatedAt: new Date() })
      .where(eq(jobsTable.id, jobId));

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const putRes = await fetch(uploadURL, {
      method: "PUT",
      headers: { "Content-Type": outputMimeType },
      body: outputBuffer,
    });
    if (!putRes.ok) {
      throw new Error(`Failed to upload upscaled output (status ${putRes.status})`);
    }
    const outputStorageKey = objectStorageService.normalizeObjectEntityPath(uploadURL);

    await db
      .update(jobsTable)
      .set({
        status: "completed",
        progressPercent: 100,
        outputStorageKey,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(jobsTable.id, jobId));
  } catch (error) {
    const message =
      error instanceof ObjectNotFoundError
        ? "Input file not found"
        : error instanceof Error
          ? error.message
          : "Upscale failed";
    await db
      .update(jobsTable)
      .set({ status: "failed", errorMessage: message, updatedAt: new Date() })
      .where(eq(jobsTable.id, jobId));
  }
}

router.get("/jobs", async (req, res) => {
  const { status, type } = req.query;
  const jobs = await db.select().from(jobsTable).orderBy(desc(jobsTable.createdAt));
  let filtered = jobs;
  if (status) filtered = filtered.filter((j) => j.status === status);
  if (type) filtered = filtered.filter((j) => j.type === type);
  res.json({ jobs: filtered });
});

router.post("/jobs", async (req, res) => {
  const body = CreateJobBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input", details: body.error.issues });
    return;
  }

  if (body.data.modelId) {
    const [model] = await db
      .select()
      .from(modelsTable)
      .where(eq(modelsTable.id, body.data.modelId));
    if (!model) {
      res.status(404).json({ error: "Model not found" });
      return;
    }
  }

  if (body.data.facesetId) {
    const [faceset] = await db
      .select()
      .from(facesetsTable)
      .where(eq(facesetsTable.id, body.data.facesetId));
    if (!faceset) {
      res.status(404).json({ error: "Faceset not found" });
      return;
    }
  }

  if (
    body.data.type.startsWith("swap_") &&
    body.data.type !== "swap_image" &&
    !body.data.inputStorageKey
  ) {
    res.status(400).json({ error: "inputStorageKey is required for video swap jobs" });
    return;
  }

  if (body.data.type === "upscale" && !body.data.inputStorageKey) {
    res.status(400).json({ error: "inputStorageKey is required for upscale jobs" });
    return;
  }

  const jobSize =
    body.data.size ??
    (body.data.type === "swap_video_small"
      ? "small"
      : body.data.type === "swap_video_medium"
        ? "medium"
        : body.data.type === "swap_video_large"
          ? "large"
          : undefined);

  const [job] = await db
    .insert(jobsTable)
    .values({
      id: randomUUID(),
      type: body.data.type,
      status: "draft",
      modelId: body.data.modelId ?? null,
      facesetId: body.data.facesetId ?? null,
      inputStorageKey: body.data.inputStorageKey ?? null,
      size: jobSize ?? null,
      iterations: body.data.iterations ?? null,
      upscaleFactor: body.data.type === "upscale" ? (body.data.upscaleFactor ?? 2) : null,
    })
    .returning();

  res.status(201).json({ job, videoLimit: VIDEO_LIMITS[body.data.type] ?? null });
});

router.get("/jobs/:id", async (req, res) => {
  const [job] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, req.params.id));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({ job });
});

router.post("/jobs/:id/submit", async (req, res) => {
  const [job] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, req.params.id));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (job.status !== "draft") {
    res.status(409).json({ error: `Cannot submit a job with status: ${job.status}` });
    return;
  }
  const [updated] = await db
    .update(jobsTable)
    .set({ status: "queued", updatedAt: new Date() })
    .where(eq(jobsTable.id, req.params.id))
    .returning();

  if (job.type === "upscale" && job.inputStorageKey) {
    void runUpscaleJob(job.id, job.inputStorageKey, job.upscaleFactor ?? 2);
  }

  res.json({
    job: updated,
    message:
      job.type === "upscale"
        ? "Upscale job started and processing in the background."
        : "Job submitted to queue. You can monitor progress in the Jobs tab.",
  });
});

router.post("/jobs/:id/cancel", async (req, res) => {
  const [job] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, req.params.id));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (job.status === "completed" || job.status === "cancelled") {
    res.status(409).json({ error: `Job is already ${job.status}` });
    return;
  }
  const [updated] = await db
    .update(jobsTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(jobsTable.id, req.params.id))
    .returning();
  res.json({ job: updated, message: "Job cancelled" });
});

router.delete("/jobs/:id", async (req, res) => {
  const [job] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, req.params.id));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  await db.delete(jobsTable).where(eq(jobsTable.id, req.params.id));
  res.json({ success: true });
});

router.patch("/jobs/:id/progress", async (req, res) => {
  const ProgressBody = z.object({
    status: z.enum(["processing", "completed", "failed"]),
    progressPercent: z.number().int().min(0).max(100).optional(),
    outputStorageKey: z.string().optional(),
    errorMessage: z.string().optional(),
  });
  const body = ProgressBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input", details: body.error.issues });
    return;
  }
  const updateData: Record<string, unknown> = {
    status: body.data.status,
    updatedAt: new Date(),
  };
  if (body.data.progressPercent !== undefined) {
    updateData.progressPercent = body.data.progressPercent;
  }
  if (body.data.outputStorageKey) {
    updateData.outputStorageKey = body.data.outputStorageKey;
  }
  if (body.data.errorMessage) {
    updateData.errorMessage = body.data.errorMessage;
  }
  if (body.data.status === "completed") {
    updateData.completedAt = new Date();
    updateData.progressPercent = 100;
  }
  const [updated] = await db
    .update(jobsTable)
    .set(updateData)
    .where(eq(jobsTable.id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({ job: updated });
});

export default router;
