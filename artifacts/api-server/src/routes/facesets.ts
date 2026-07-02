import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  facesetsTable,
  facesetImagesTable,
  extractedFacesTable,
} from "@workspace/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { z } from "zod";
import { randomUUID } from "crypto";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { extractVideoFrames } from "../lib/videoFrames";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const ExtractVideoFramesBody = z.object({
  objectPath: z.string().startsWith("/objects/"),
  maxFrames: z.number().int().min(1).max(60).default(20),
  intervalSeconds: z.number().min(0.5).max(10).default(2),
});

const CreateFacesetBody = z.object({
  name: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[a-zA-Z0-9 _-]+$/, "Names can only contain letters and numbers"),
  description: z.string().max(500).optional(),
});

const AddImageBody = z.object({
  filename: z.string().min(1),
  originalName: z.string().min(1),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().positive().max(20 * 1024 * 1024),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  storageKey: z.string().min(1),
});

router.get("/facesets", async (_req, res) => {
  const facesets = await db
    .select()
    .from(facesetsTable)
    .orderBy(desc(facesetsTable.createdAt));
  res.json({ facesets });
});

router.post("/facesets", async (req, res) => {
  const body = CreateFacesetBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input", details: body.error.issues });
    return;
  }
  const [faceset] = await db
    .insert(facesetsTable)
    .values({
      id: randomUUID(),
      name: body.data.name,
      description: body.data.description ?? null,
      status: "pending",
    })
    .returning();
  res.status(201).json({ faceset });
});

router.get("/facesets/:id", async (req, res) => {
  const [faceset] = await db
    .select()
    .from(facesetsTable)
    .where(eq(facesetsTable.id, req.params.id));
  if (!faceset) {
    res.status(404).json({ error: "Faceset not found" });
    return;
  }
  const images = await db
    .select()
    .from(facesetImagesTable)
    .where(eq(facesetImagesTable.facesetId, req.params.id))
    .orderBy(desc(facesetImagesTable.createdAt));
  const faces = await db
    .select()
    .from(extractedFacesTable)
    .where(eq(extractedFacesTable.facesetId, req.params.id))
    .orderBy(desc(extractedFacesTable.createdAt));
  res.json({ faceset, images, faces });
});

router.delete("/facesets/:id", async (req, res) => {
  const [deleted] = await db
    .delete(facesetsTable)
    .where(eq(facesetsTable.id, req.params.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Faceset not found" });
    return;
  }
  res.json({ success: true });
});

router.patch("/facesets/:id", async (req, res) => {
  const body = CreateFacesetBody.partial().safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input", details: body.error.issues });
    return;
  }
  const [updated] = await db
    .update(facesetsTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(eq(facesetsTable.id, req.params.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Faceset not found" });
    return;
  }
  res.json({ faceset: updated });
});

router.post("/facesets/:id/images", async (req, res) => {
  const [faceset] = await db
    .select()
    .from(facesetsTable)
    .where(eq(facesetsTable.id, req.params.id));
  if (!faceset) {
    res.status(404).json({ error: "Faceset not found" });
    return;
  }
  const [imgCount] = await db
    .select({ count: count() })
    .from(facesetImagesTable)
    .where(eq(facesetImagesTable.facesetId, req.params.id));
  if (imgCount.count >= 500) {
    res
      .status(400)
      .json({ error: "Faceset supports up to 500 images maximum" });
    return;
  }
  const body = AddImageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input", details: body.error.issues });
    return;
  }
  const [image] = await db
    .insert(facesetImagesTable)
    .values({
      id: randomUUID(),
      facesetId: req.params.id,
      ...body.data,
    })
    .returning();
  await db
    .update(facesetsTable)
    .set({ imageCount: imgCount.count + 1, updatedAt: new Date() })
    .where(eq(facesetsTable.id, req.params.id));
  res.status(201).json({ image });
});

router.delete("/facesets/:id/images/:imageId", async (req, res) => {
  const [deleted] = await db
    .delete(facesetImagesTable)
    .where(eq(facesetImagesTable.id, req.params.imageId))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  const [imgCount] = await db
    .select({ count: count() })
    .from(facesetImagesTable)
    .where(eq(facesetImagesTable.facesetId, req.params.id));
  await db
    .update(facesetsTable)
    .set({ imageCount: imgCount.count, updatedAt: new Date() })
    .where(eq(facesetsTable.id, req.params.id));
  res.json({ success: true });
});

router.post("/facesets/:id/extract", async (req, res) => {
  const [faceset] = await db
    .select()
    .from(facesetsTable)
    .where(eq(facesetsTable.id, req.params.id));
  if (!faceset) {
    res.status(404).json({ error: "Faceset not found" });
    return;
  }
  if (faceset.status === "extracting") {
    res.status(409).json({ error: "Extraction already in progress" });
    return;
  }
  const [imgCount] = await db
    .select({ count: count() })
    .from(facesetImagesTable)
    .where(eq(facesetImagesTable.facesetId, req.params.id));
  if (imgCount.count === 0) {
    res.status(400).json({ error: "No images to extract faces from" });
    return;
  }
  await db
    .update(facesetsTable)
    .set({ status: "extracting", updatedAt: new Date() })
    .where(eq(facesetsTable.id, req.params.id));
  res.json({
    message: "Face extraction queued",
    facesetId: req.params.id,
    imageCount: imgCount.count,
  });
});

router.post("/facesets/:id/faces", async (req, res) => {
  const AddFaceBody = z.object({
    sourceImageId: z.string().uuid().optional(),
    storageKey: z.string().min(1),
    confidence: z.string().optional(),
  });
  const body = AddFaceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input", details: body.error.issues });
    return;
  }
  const [face] = await db
    .insert(extractedFacesTable)
    .values({
      id: randomUUID(),
      facesetId: req.params.id,
      ...body.data,
    })
    .returning();
  const [faceCount] = await db
    .select({ count: count() })
    .from(extractedFacesTable)
    .where(eq(extractedFacesTable.facesetId, req.params.id));
  await db
    .update(facesetsTable)
    .set({
      faceCount: faceCount.count,
      status: "ready",
      updatedAt: new Date(),
    })
    .where(eq(facesetsTable.id, req.params.id));
  res.status(201).json({ face });
});

router.post("/facesets/:id/videos/extract-frames", async (req, res) => {
  const [faceset] = await db
    .select()
    .from(facesetsTable)
    .where(eq(facesetsTable.id, req.params.id));
  if (!faceset) {
    res.status(404).json({ error: "Faceset not found" });
    return;
  }
  const body = ExtractVideoFramesBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid input", details: body.error.issues });
    return;
  }

  let videoFile;
  try {
    videoFile = await objectStorageService.getObjectEntityFile(body.data.objectPath);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Video object not found" });
      return;
    }
    throw error;
  }

  const [videoBuffer] = await videoFile.download();

  let frames: Buffer[];
  try {
    frames = await extractVideoFrames(videoBuffer, {
      maxFrames: body.data.maxFrames,
      intervalSeconds: body.data.intervalSeconds,
    });
  } catch (error) {
    req.log.error({ err: error }, "ffmpeg frame extraction failed");
    res.status(500).json({ error: "Failed to extract frames from video" });
    return;
  }

  if (frames.length === 0) {
    res.status(422).json({ error: "No frames could be extracted from this video" });
    return;
  }

  const createdImages = [];
  for (let i = 0; i < frames.length; i++) {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const putRes = await fetch(uploadURL, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: frames[i],
    });
    if (!putRes.ok) {
      continue;
    }
    const storageKey = objectStorageService.normalizeObjectEntityPath(uploadURL);
    const [image] = await db
      .insert(facesetImagesTable)
      .values({
        id: randomUUID(),
        facesetId: req.params.id,
        filename: `video_frame_${String(i + 1).padStart(3, "0")}.jpg`,
        originalName: `video_frame_${i + 1}.jpg`,
        mimeType: "image/jpeg",
        sizeBytes: frames[i].length,
        storageKey,
      })
      .returning();
    createdImages.push(image);
  }

  const [imgCount] = await db
    .select({ count: count() })
    .from(facesetImagesTable)
    .where(eq(facesetImagesTable.facesetId, req.params.id));

  await db
    .update(facesetsTable)
    .set({ imageCount: imgCount.count, updatedAt: new Date() })
    .where(eq(facesetsTable.id, req.params.id));

  res.status(201).json({
    message: `Extracted ${createdImages.length} frame(s) from video`,
    images: createdImages,
  });
});

router.delete("/facesets/:id/faces/:faceId", async (req, res) => {
  const [deleted] = await db
    .delete(extractedFacesTable)
    .where(eq(extractedFacesTable.id, req.params.faceId))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Face not found" });
    return;
  }
  const [faceCount] = await db
    .select({ count: count() })
    .from(extractedFacesTable)
    .where(eq(extractedFacesTable.facesetId, req.params.id));
  await db
    .update(facesetsTable)
    .set({ faceCount: faceCount.count, updatedAt: new Date() })
    .where(eq(facesetsTable.id, req.params.id));
  res.json({ success: true });
});

export default router;
