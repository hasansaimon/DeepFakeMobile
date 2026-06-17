import { pgTable, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { modelsTable } from "./models";
import { facesetsTable } from "./facesets";

export const jobTypeEnum = pgEnum("job_type", [
  "train_online",
  "train_device",
  "swap_video_small",
  "swap_video_medium",
  "swap_video_large",
  "swap_image",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "draft",
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

export const jobSizeEnum = pgEnum("job_size", ["small", "medium", "large"]);

export const jobsTable = pgTable("jobs", {
  id: text("id").primaryKey(),
  type: jobTypeEnum("type").notNull(),
  status: jobStatusEnum("status").notNull().default("draft"),
  modelId: text("model_id").references(() => modelsTable.id, {
    onDelete: "set null",
  }),
  facesetId: text("faceset_id").references(() => facesetsTable.id, {
    onDelete: "set null",
  }),
  inputStorageKey: text("input_storage_key"),
  outputStorageKey: text("output_storage_key"),
  size: jobSizeEnum("size"),
  iterations: integer("iterations"),
  progressPercent: integer("progress_percent").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export type Job = typeof jobsTable.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
