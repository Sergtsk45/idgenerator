import { pgTable, text, serial, integer, boolean, timestamp, jsonb, date, numeric, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

// Bill of Quantities (Ведомость объемов работ)
export const works = pgTable("works", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(), // Code from BoQ
  description: text("description").notNull(), // Work description
  unit: text("unit").notNull(), // Unit of measurement
  quantityTotal: numeric("quantity_total", { precision: 20, scale: 4 }), // Total planned quantity (numeric for floats)
  synonyms: jsonb("synonyms").$type<string[]>(), // Normalized synonyms for matching
});

// Messages (Raw and Normalized)
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(), // Telegram User ID
  messageRaw: text("message_raw").notNull(), // Original text
  // Normalized data extracted from LLM
  normalizedData: jsonb("normalized_data").$type<{
    workCode?: string;
    workDescription?: string;
    quantity?: number;
    unit?: string;
    date?: string;
    location?: string;
    workConditions?: string;
    materials?: string[];
    representative?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  isProcessed: boolean("is_processed").default(false),
});

// Acts (AOSR)
export const acts = pgTable("acts", {
  id: serial("id").primaryKey(),
  // Global act number (business identifier). Nullable for legacy records.
  actNumber: integer("act_number").unique(),
  dateStart: date("date_start"),
  dateEnd: date("date_end"),
  location: text("location"),
  status: text("status").default("draft"), // draft, generated, signed
  // Aggregated works for this act
  worksData: jsonb("works_data").$type<{
    workId: number;
    quantity: number;
    description: string;
  }[]>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Attachments (Documents)
export const attachments = pgTable("attachments", {
  id: serial("id").primaryKey(),
  actId: integer("act_id").references(() => acts.id),
  url: text("url").notNull(),
  name: text("name").notNull(),
  type: text("type"), // 'certificate', 'passport', etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Act Templates catalog
export const actTemplates = pgTable("act_templates", {
  id: serial("id").primaryKey(),
  templateId: text("template_id").notNull().unique(), // e.g., "foundation-prep"
  code: text("code").notNull(), // e.g., "AOSR-01"
  category: text("category").notNull(), // e.g., "general", "roofing"
  title: text("title").notNull(), // Russian title
  titleEn: text("title_en"), // English title
  description: text("description"),
  normativeRef: text("normative_ref"), // Reference to normative document
  isActive: boolean("is_active").default(true),
});

// Selected templates for act generation
export const actTemplateSelections = pgTable("act_template_selections", {
  id: serial("id").primaryKey(),
  actId: integer("act_id").references(() => acts.id),
  templateId: integer("template_id").references(() => actTemplates.id),
  status: text("status").default("pending"), // pending, generated, error
  pdfUrl: text("pdf_url"),
  generatedAt: timestamp("generated_at"),
});

// Schedules (Gantt)
export const schedules = pgTable("schedules", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  calendarStart: date("calendar_start"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const scheduleTasks = pgTable(
  "schedule_tasks",
  {
    id: serial("id").primaryKey(),
    scheduleId: integer("schedule_id")
      .notNull()
      .references(() => schedules.id),
    workId: integer("work_id")
      .notNull()
      .references(() => works.id),
    // Act number this task belongs to (global). Nullable = not assigned to an act.
    actNumber: integer("act_number"),
    titleOverride: text("title_override"),
    startDate: date("start_date").notNull(),
    durationDays: integer("duration_days").notNull(),
    orderIndex: integer("order_index").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    scheduleIdIdx: index("schedule_tasks_schedule_id_idx").on(t.scheduleId),
    workIdIdx: index("schedule_tasks_work_id_idx").on(t.workId),
    scheduleOrderIdx: index("schedule_tasks_schedule_order_idx").on(t.scheduleId, t.orderIndex),
    scheduleActNumberIdx: index("schedule_tasks_schedule_act_number_idx").on(t.scheduleId, t.actNumber),
  })
);


// === SCHEMAS ===

export const insertWorkSchema = createInsertSchema(works).omit({ id: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true, isProcessed: true, normalizedData: true });
export const insertActSchema = createInsertSchema(acts).omit({ id: true, createdAt: true });
export const insertAttachmentSchema = createInsertSchema(attachments).omit({ id: true, createdAt: true });
export const insertActTemplateSchema = createInsertSchema(actTemplates).omit({ id: true });
export const insertActTemplateSelectionSchema = createInsertSchema(actTemplateSelections).omit({ id: true, generatedAt: true });
export const insertScheduleSchema = createInsertSchema(schedules).omit({ id: true, createdAt: true });
export const insertScheduleTaskSchema = createInsertSchema(scheduleTasks).omit({ id: true, createdAt: true });

// === EXPLICIT API TYPES ===

export type Work = typeof works.$inferSelect;
export type InsertWork = z.infer<typeof insertWorkSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Act = typeof acts.$inferSelect;
export type InsertAct = z.infer<typeof insertActSchema>;

export type Attachment = typeof attachments.$inferSelect;

export type ActTemplate = typeof actTemplates.$inferSelect;
export type InsertActTemplate = z.infer<typeof insertActTemplateSchema>;

export type ActTemplateSelection = typeof actTemplateSelections.$inferSelect;
export type InsertActTemplateSelection = z.infer<typeof insertActTemplateSelectionSchema>;

export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;

export type ScheduleTask = typeof scheduleTasks.$inferSelect;
export type InsertScheduleTask = z.infer<typeof insertScheduleTaskSchema>;

// Request/Response Types
export type CreateMessageRequest = {
  userId: string;
  messageRaw: string;
};

export type GenerateActRequest = {
  dateStart: string;
  dateEnd: string;
};

export type WorkStatsResponse = {
  totalWorks: number;
  completedWorks: number;
};
