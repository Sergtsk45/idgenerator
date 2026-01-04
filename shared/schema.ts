import { pgTable, text, serial, integer, boolean, timestamp, jsonb, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

// Bill of Quantities (Ведомость объемов работ)
export const works = pgTable("works", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(), // Code from BoQ
  description: text("description").notNull(), // Work description
  unit: text("unit").notNull(), // Unit of measurement
  quantityTotal: integer("quantity_total"), // Total planned quantity
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
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  isProcessed: boolean("is_processed").default(false),
});

// Acts (AOSR)
export const acts = pgTable("acts", {
  id: serial("id").primaryKey(),
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


// === SCHEMAS ===

export const insertWorkSchema = createInsertSchema(works).omit({ id: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true, isProcessed: true, normalizedData: true });
export const insertActSchema = createInsertSchema(acts).omit({ id: true, createdAt: true });
export const insertAttachmentSchema = createInsertSchema(attachments).omit({ id: true, createdAt: true });

// === EXPLICIT API TYPES ===

export type Work = typeof works.$inferSelect;
export type InsertWork = z.infer<typeof insertWorkSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Act = typeof acts.$inferSelect;
export type InsertAct = z.infer<typeof insertActSchema>;

export type Attachment = typeof attachments.$inferSelect;

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
