import { pgTable, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const facesetStatusEnum = pgEnum("faceset_status", [
  "pending",
  "extracting",
  "ready",
  "failed",
]);

export const facesetsTable = pgTable("facesets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: facesetStatusEnum("status").notNull().default("pending"),
  faceCount: integer("face_count").notNull().default(0),
  imageCount: integer("image_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const facesetImagesTable = pgTable("faceset_images", {
  id: text("id").primaryKey(),
  facesetId: text("faceset_id")
    .notNull()
    .references(() => facesetsTable.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  width: integer("width"),
  height: integer("height"),
  facesExtracted: integer("faces_extracted").default(0),
  storageKey: text("storage_key").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const extractedFacesTable = pgTable("extracted_faces", {
  id: text("id").primaryKey(),
  facesetId: text("faceset_id")
    .notNull()
    .references(() => facesetsTable.id, { onDelete: "cascade" }),
  sourceImageId: text("source_image_id").references(
    () => facesetImagesTable.id,
    { onDelete: "set null" },
  ),
  storageKey: text("storage_key").notNull(),
  confidence: text("confidence"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFacesetSchema = createInsertSchema(facesetsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertFacesetImageSchema = createInsertSchema(
  facesetImagesTable,
).omit({ createdAt: true });
export const insertExtractedFaceSchema = createInsertSchema(
  extractedFacesTable,
).omit({ createdAt: true });

export type Faceset = typeof facesetsTable.$inferSelect;
export type FacesetImage = typeof facesetImagesTable.$inferSelect;
export type ExtractedFace = typeof extractedFacesTable.$inferSelect;
export type InsertFaceset = z.infer<typeof insertFacesetSchema>;
