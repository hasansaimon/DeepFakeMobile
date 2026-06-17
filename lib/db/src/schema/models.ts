import { pgTable, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { facesetsTable } from "./facesets";

export const modelStatusEnum = pgEnum("model_status", [
  "untrained",
  "queued",
  "training",
  "ready",
  "failed",
]);

export const modelResolutionEnum = pgEnum("model_resolution", ["128", "256"]);

export const modelsTable = pgTable("models", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: modelStatusEnum("status").notNull().default("untrained"),
  resolution: modelResolutionEnum("resolution").notNull().default("128"),
  facesetId: text("faceset_id").references(() => facesetsTable.id, {
    onDelete: "set null",
  }),
  iterations: integer("iterations").notNull().default(0),
  targetIterations: integer("target_iterations").notNull().default(500),
  checkpointKey: text("checkpoint_key"),
  faceCount: integer("face_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  trainedAt: timestamp("trained_at"),
});

export const modelFacesTable = pgTable("model_faces", {
  id: text("id").primaryKey(),
  modelId: text("model_id")
    .notNull()
    .references(() => modelsTable.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  originalName: text("original_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertModelSchema = createInsertSchema(modelsTable).omit({
  createdAt: true,
  updatedAt: true,
  trainedAt: true,
});
export const insertModelFaceSchema = createInsertSchema(modelFacesTable).omit({
  createdAt: true,
});

export type Model = typeof modelsTable.$inferSelect;
export type ModelFace = typeof modelFacesTable.$inferSelect;
export type InsertModel = z.infer<typeof insertModelSchema>;
