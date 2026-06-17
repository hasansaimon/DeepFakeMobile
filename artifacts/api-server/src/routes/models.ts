import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  modelsTable,
  modelFacesTable,
  facesetsTable,
} from "@workspace/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "crypto";

const router: IRouter = Router();

const CreateModelBody = z.object({
  name: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[a-zA-Z0-9 _-]+$/, "Names can only contain letters and numbers"),
  description: z.string().max(500).optional(),
  facesetId: z.string().uuid().optional(),
  resolution: z.enum(["128", "256"]).default("128"),
  targetIterations: z.number().int().min(250).max(6500).default(500),
});

const AddModelFaceBody = z.object({
  storageKey: z.string().min(1),
  originalName: z.string().optional(),
});

router.get("/models", async (_req, res) => {
  const models = await db
    .select()
    .from(modelsTable)
    .orderBy(desc(modelsTable.createdAt));
  res.json({ models });
});

router.post("/models", async (req, res) => {
  const body = CreateModelBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input", details: body.error.issues });
    return;
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
  const [model] = await db
    .insert(modelsTable)
    .values({
      id: randomUUID(),
      name: body.data.name,
      description: body.data.description ?? null,
      facesetId: body.data.facesetId ?? null,
      resolution: body.data.resolution,
      targetIterations: body.data.targetIterations,
      status: "untrained",
    })
    .returning();
  res.status(201).json({ model });
});

router.get("/models/:id", async (req, res) => {
  const [model] = await db
    .select()
    .from(modelsTable)
    .where(eq(modelsTable.id, req.params.id));
  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }
  const faces = await db
    .select()
    .from(modelFacesTable)
    .where(eq(modelFacesTable.modelId, req.params.id))
    .orderBy(desc(modelFacesTable.createdAt));
  res.json({ model, faces });
});

router.patch("/models/:id", async (req, res) => {
  const body = CreateModelBody.partial().safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input", details: body.error.issues });
    return;
  }
  const [existing] = await db
    .select()
    .from(modelsTable)
    .where(eq(modelsTable.id, req.params.id));
  if (!existing) {
    res.status(404).json({ error: "Model not found" });
    return;
  }
  if (
    body.data.facesetId &&
    body.data.facesetId !== existing.facesetId
  ) {
    const [faceset] = await db
      .select()
      .from(facesetsTable)
      .where(eq(facesetsTable.id, body.data.facesetId));
    if (!faceset) {
      res.status(404).json({ error: "Faceset not found" });
      return;
    }
  }
  const [updated] = await db
    .update(modelsTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(eq(modelsTable.id, req.params.id))
    .returning();
  res.json({ model: updated });
});

router.delete("/models/:id", async (req, res) => {
  const [deleted] = await db
    .delete(modelsTable)
    .where(eq(modelsTable.id, req.params.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Model not found" });
    return;
  }
  res.json({ success: true });
});

router.post("/models/:id/faces", async (req, res) => {
  const [model] = await db
    .select()
    .from(modelsTable)
    .where(eq(modelsTable.id, req.params.id));
  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }
  const body = AddModelFaceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input", details: body.error.issues });
    return;
  }
  const [face] = await db
    .insert(modelFacesTable)
    .values({
      id: randomUUID(),
      modelId: req.params.id,
      storageKey: body.data.storageKey,
      originalName: body.data.originalName ?? null,
    })
    .returning();
  const [faceCount] = await db
    .select({ count: count() })
    .from(modelFacesTable)
    .where(eq(modelFacesTable.modelId, req.params.id));
  await db
    .update(modelsTable)
    .set({ faceCount: faceCount.count, updatedAt: new Date() })
    .where(eq(modelsTable.id, req.params.id));
  res.status(201).json({ face });
});

router.delete("/models/:id/faces/:faceId", async (req, res) => {
  const [deleted] = await db
    .delete(modelFacesTable)
    .where(eq(modelFacesTable.id, req.params.faceId))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Face not found" });
    return;
  }
  const [faceCount] = await db
    .select({ count: count() })
    .from(modelFacesTable)
    .where(eq(modelFacesTable.modelId, req.params.id));
  await db
    .update(modelsTable)
    .set({ faceCount: faceCount.count, updatedAt: new Date() })
    .where(eq(modelsTable.id, req.params.id));
  res.json({ success: true });
});

router.post("/models/:id/train", async (req, res) => {
  const TrainBody = z.object({
    iterations: z.number().int().min(250).max(6500).optional(),
    saveInterval: z.number().int().min(100).max(1000).optional(),
    batchSize: z.number().int().min(1).max(8).optional(),
  });
  const body = TrainBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input", details: body.error.issues });
    return;
  }
  const [model] = await db
    .select()
    .from(modelsTable)
    .where(eq(modelsTable.id, req.params.id));
  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }
  if (model.status === "training") {
    res.status(409).json({ error: "Model is already training" });
    return;
  }
  const [faceCount] = await db
    .select({ count: count() })
    .from(modelFacesTable)
    .where(eq(modelFacesTable.modelId, req.params.id));
  if (faceCount.count === 0 && !model.facesetId) {
    res
      .status(400)
      .json({
        error:
          "Model has no faces. Please add faces or attach a faceset before training.",
      });
    return;
  }
  const targetIterations =
    body.data.iterations ?? model.targetIterations;
  await db
    .update(modelsTable)
    .set({
      status: "queued",
      targetIterations,
      updatedAt: new Date(),
    })
    .where(eq(modelsTable.id, req.params.id));
  res.json({
    message: "Training job queued",
    modelId: req.params.id,
    targetIterations,
    batchSize: body.data.batchSize ?? 4,
    saveInterval: body.data.saveInterval ?? 500,
  });
});

router.post("/models/:id/progress", async (req, res) => {
  const ProgressBody = z.object({
    iterations: z.number().int().min(0),
    status: z.enum(["training", "ready", "failed"]),
    checkpointKey: z.string().optional(),
    errorMessage: z.string().optional(),
  });
  const body = ProgressBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input", details: body.error.issues });
    return;
  }
  const updateData: Record<string, unknown> = {
    iterations: body.data.iterations,
    status: body.data.status,
    updatedAt: new Date(),
  };
  if (body.data.checkpointKey) {
    updateData.checkpointKey = body.data.checkpointKey;
  }
  if (body.data.status === "ready") {
    updateData.trainedAt = new Date();
  }
  const [updated] = await db
    .update(modelsTable)
    .set(updateData)
    .where(eq(modelsTable.id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Model not found" });
    return;
  }
  res.json({ model: updated });
});

export default router;
