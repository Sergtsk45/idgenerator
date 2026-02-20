import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  jsonb,
  date,
  numeric,
  bigint,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

// Construction Objects (Объекты строительства)
export const objects = pgTable("objects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(), // e.g. "ЖК Северный, корпус 2"
  address: text("address"),
  city: text("city"),
  telegramUserId: bigint("telegram_user_id", { mode: "number" }), // Telegram user ID (owner)
  createdAt: timestamp("created_at").defaultNow(),
});

export const objectParties = pgTable(
  "object_parties",
  {
    id: serial("id").primaryKey(),
    objectId: integer("object_id")
      .notNull()
      .references(() => objects.id),
    role: text("role").notNull(), // customer | builder | designer (MVP)

    fullName: text("full_name").notNull(),
    shortName: text("short_name"),
    inn: text("inn"),
    kpp: text("kpp"),
    ogrn: text("ogrn"),
    // SRO (Саморегулируемая организация) details
    sroFullName: text("sro_full_name"),
    sroShortName: text("sro_short_name"),
    sroOgrn: text("sro_ogrn"),
    sroInn: text("sro_inn"),
    addressLegal: text("address_legal"),
    phone: text("phone"),
    email: text("email"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    objectRoleUnique: uniqueIndex("object_parties_object_role_uq").on(t.objectId, t.role),
  })
);

export const objectResponsiblePersons = pgTable(
  "object_responsible_persons",
  {
    id: serial("id").primaryKey(),
    objectId: integer("object_id")
      .notNull()
      .references(() => objects.id),
    role: text("role").notNull(),

    personName: text("person_name").notNull(),
    position: text("position"),
    basisText: text("basis_text"),
    lineText: text("line_text"),
    signText: text("sign_text"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    objectRoleUnique: uniqueIndex("object_responsible_persons_object_role_uq").on(t.objectId, t.role),
  })
);

// Bill of Quantities (Ведомость объемов работ)
export const works = pgTable("works", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(), // Code from BoQ
  description: text("description").notNull(), // Work description
  unit: text("unit").notNull(), // Unit of measurement
  quantityTotal: numeric("quantity_total", { precision: 20, scale: 4 }), // Total planned quantity (numeric for floats)
  synonyms: jsonb("synonyms").$type<string[]>(), // Normalized synonyms for matching
});

// Estimates (Сметы / ЛСР)
export const estimates = pgTable("estimates", {
  id: serial("id").primaryKey(),
  code: text("code"), // e.g. "ЛСР-02-01-03"
  name: text("name").notNull(), // e.g. "Узлы учета и управления"

  objectName: text("object_name"),
  region: text("region"),
  pricingQuarter: text("pricing_quarter"), // e.g. "II квартал 2024"

  totalCost: numeric("total_cost", { precision: 20, scale: 4 }),
  totalConstruction: numeric("total_construction", { precision: 20, scale: 4 }),
  totalInstallation: numeric("total_installation", { precision: 20, scale: 4 }),
  totalEquipment: numeric("total_equipment", { precision: 20, scale: 4 }),
  totalOther: numeric("total_other", { precision: 20, scale: 4 }),

  createdAt: timestamp("created_at").defaultNow(),
});

export const estimateSections = pgTable(
  "estimate_sections",
  {
    id: serial("id").primaryKey(),
    estimateId: integer("estimate_id")
      .notNull()
      .references(() => estimates.id),
    number: text("number").notNull(), // e.g. "1"
    title: text("title").notNull(), // e.g. "Узел управления (подвал)"
    orderIndex: integer("order_index").notNull().default(0),
  },
  (t) => ({
    estimateIdIdx: index("estimate_sections_estimate_id_idx").on(t.estimateId),
    estimateSectionUnique: uniqueIndex("estimate_sections_estimate_number_uq").on(t.estimateId, t.number),
  })
);

export const estimatePositions = pgTable(
  "estimate_positions",
  {
    id: serial("id").primaryKey(),
    estimateId: integer("estimate_id")
      .notNull()
      .references(() => estimates.id),
    sectionId: integer("section_id").references(() => estimateSections.id),

    lineNo: text("line_no").notNull(), // "1", "70.1"
    code: text("code"), // ГЭСН/ФСБЦ/и т.п. (может отсутствовать у некоторых строк)
    name: text("name").notNull(),
    unit: text("unit"),
    quantity: numeric("quantity", { precision: 20, scale: 4 }),

    baseCostPerUnit: numeric("base_cost_per_unit", { precision: 20, scale: 4 }),
    indexValue: numeric("index_value", { precision: 20, scale: 6 }),
    currentCostPerUnit: numeric("current_cost_per_unit", { precision: 20, scale: 4 }),
    totalCurrentCost: numeric("total_current_cost", { precision: 20, scale: 4 }),

    notes: text("notes"),
    orderIndex: integer("order_index").notNull().default(0),
  },
  (t) => ({
    estimateIdIdx: index("estimate_positions_estimate_id_idx").on(t.estimateId),
    sectionIdIdx: index("estimate_positions_section_id_idx").on(t.sectionId),
    estimateLineNoIdx: index("estimate_positions_estimate_line_no_idx").on(t.estimateId, t.lineNo),
  })
);

export const positionResources = pgTable(
  "position_resources",
  {
    id: serial("id").primaryKey(),
    positionId: integer("position_id")
      .notNull()
      .references(() => estimatePositions.id),

    resourceCode: text("resource_code"),
    resourceType: text("resource_type"), // ОТ, ЭМ, М, Н и т.п.
    name: text("name").notNull(),
    unit: text("unit"),
    quantity: numeric("quantity", { precision: 20, scale: 4 }),
    quantityTotal: numeric("quantity_total", { precision: 20, scale: 4 }),

    baseCostPerUnit: numeric("base_cost_per_unit", { precision: 20, scale: 4 }),
    currentCostPerUnit: numeric("current_cost_per_unit", { precision: 20, scale: 4 }),
    totalCurrentCost: numeric("total_current_cost", { precision: 20, scale: 4 }),

    orderIndex: integer("order_index").notNull().default(0),
  },
  (t) => ({
    positionIdIdx: index("position_resources_position_id_idx").on(t.positionId),
  })
);

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

// Type for a single work item in an act (with explicit source)
export type ActWorkItem = {
  sourceType: 'works' | 'estimate';  // Source of this work item
  sourceId: number;                   // ID from works or estimate_positions
  description: string;                // Work description/name
  quantity: number;                   // Work quantity
  unit?: string;                      // Unit of measurement (optional)
  code?: string;                      // Work code/GESN code (optional)
};

export type ExecutiveSchemeLink = {
  title: string;
  fileUrl?: string;
};

// Acts (AOSR)
export const acts = pgTable("acts", {
  id: serial("id").primaryKey(),
  objectId: integer("object_id").references(() => objects.id),
  // Global act number (business identifier). Nullable for legacy records.
  actNumber: integer("act_number").unique(),
  actTemplateId: integer("act_template_id").references(() => actTemplates.id, { onDelete: "set null" }),
  dateStart: date("date_start"),
  dateEnd: date("date_end"),
  location: text("location"),
  status: text("status").default("draft"), // draft, generated, signed
  // Aggregated works for this act (with explicit source reference)
  worksData: jsonb("works_data").$type<ActWorkItem[]>(),
  // Aggregated documentation (copied/merged from schedule tasks during generate-acts)
  projectDrawingsAgg: text("project_drawings_agg"),
  normativeRefsAgg: text("normative_refs_agg"),
  executiveSchemesAgg: jsonb("executive_schemes_agg").$type<ExecutiveSchemeLink[]>(),
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

// === Materials & Documents (Source Data module) ===

export const materialsCatalog = pgTable(
  "materials_catalog",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    name: text("name").notNull(),
    category: text("category"), // material | equipment | product
    standardRef: text("standard_ref"),
    baseUnit: text("base_unit"),
    params: jsonb("params").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    nameIdx: index("materials_catalog_name_idx").on(t.name),
    uniqueName: uniqueIndex("materials_catalog_name_uniq").on(t.name).where(sql`deleted_at IS NULL`),
    categoryCheck: check(
      "materials_catalog_category_check",
      sql`category IN ('material', 'equipment', 'product') OR category IS NULL`,
    ),
  })
);

export const projectMaterials = pgTable(
  "project_materials",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    objectId: integer("object_id")
      .notNull()
      .references(() => objects.id, { onDelete: "restrict" }),
    catalogMaterialId: bigint("catalog_material_id", { mode: "number" }).references(() => materialsCatalog.id, {
      onDelete: "set null",
    }),
    nameOverride: text("name_override"),
    baseUnitOverride: text("base_unit_override"),
    paramsOverride: jsonb("params_override").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    objectIdIdx: index("project_materials_object_id_idx").on(t.objectId),
    catalogIdIdx: index("project_materials_catalog_id_idx").on(t.catalogMaterialId),
  })
);

export const materialBatches = pgTable(
  "material_batches",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    objectId: integer("object_id")
      .notNull()
      .references(() => objects.id, { onDelete: "restrict" }),
    projectMaterialId: bigint("project_material_id", { mode: "number" })
      .notNull()
      .references(() => projectMaterials.id, { onDelete: "cascade" }),
    supplierName: text("supplier_name"),
    plant: text("plant"),
    batchNumber: text("batch_number"),
    deliveryDate: date("delivery_date"),
    quantity: numeric("quantity", { precision: 14, scale: 3 }),
    unit: text("unit"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    projectMaterialIdIdx: index("material_batches_project_material_id_idx").on(t.projectMaterialId),
    quantityCheck: check("material_batches_quantity_check", sql`quantity IS NULL OR quantity >= 0`),
  })
);

export const documents = pgTable(
  "documents",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    docType: text("doc_type").notNull(),
    scope: text("scope").notNull().default("project"),
    title: text("title"),
    docNumber: text("doc_number"),
    docDate: date("doc_date"),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    fileUrl: text("file_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    docTypeIdx: index("documents_doc_type_idx").on(t.docType),
    scopeIdx: index("documents_scope_idx").on(t.scope),
    docNumberIdx: index("documents_doc_number_idx").on(t.docNumber),
    docTypeCheck: check(
      "documents_doc_type_check",
      sql`doc_type IN ('certificate', 'declaration', 'passport', 'protocol', 'scheme', 'other')`,
    ),
    scopeCheck: check("documents_scope_check", sql`scope IN ('global', 'project')`),
    validDatesCheck: check(
      "documents_valid_dates_check",
      sql`valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to`,
    ),
  })
);

export const documentBindings = pgTable(
  "document_bindings",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    documentId: bigint("document_id", { mode: "number" })
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    objectId: integer("object_id").references(() => objects.id, { onDelete: "cascade" }),
    projectMaterialId: bigint("project_material_id", { mode: "number" }).references(() => projectMaterials.id, {
      onDelete: "cascade",
    }),
    batchId: bigint("batch_id", { mode: "number" }).references(() => materialBatches.id, { onDelete: "cascade" }),
    bindingRole: text("binding_role").notNull().default("quality"),
    useInActs: boolean("use_in_acts").notNull().default(true),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    documentIdIdx: index("document_bindings_document_id_idx").on(t.documentId),
    projectMaterialIdIdx: index("document_bindings_project_material_id_idx").on(t.projectMaterialId),
    objectIdIdx: index("document_bindings_object_id_idx").on(t.objectId),
    roleCheck: check(
      "document_bindings_role_check",
      sql`binding_role IN ('quality', 'passport', 'protocol', 'scheme', 'other')`,
    ),
    hasTargetCheck: check(
      "document_bindings_has_target_check",
      sql`object_id IS NOT NULL OR project_material_id IS NOT NULL OR batch_id IS NOT NULL`,
    ),
  })
);

export const actMaterialUsages = pgTable(
  "act_material_usages",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    actId: integer("act_id")
      .notNull()
      .references(() => acts.id, { onDelete: "cascade" }),
    projectMaterialId: bigint("project_material_id", { mode: "number" })
      .notNull()
      .references(() => projectMaterials.id, { onDelete: "restrict" }),
    workId: integer("work_id").references(() => works.id, { onDelete: "set null" }),
    batchId: bigint("batch_id", { mode: "number" }).references(() => materialBatches.id, { onDelete: "set null" }),
    qualityDocumentId: bigint("quality_document_id", { mode: "number" }).references(() => documents.id, {
      onDelete: "restrict",
    }),
    note: text("note"),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    actIdIdx: index("act_material_usages_act_id_idx").on(t.actId),
    orderIdx: index("act_material_usages_order_idx").on(t.actId, t.orderIndex),
  })
);

export const actDocumentAttachments = pgTable(
  "act_document_attachments",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    actId: integer("act_id")
      .notNull()
      .references(() => acts.id, { onDelete: "cascade" }),
    documentId: bigint("document_id", { mode: "number" })
      .notNull()
      .references(() => documents.id, { onDelete: "restrict" }),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    actIdIdx: index("act_document_attachments_act_id_idx").on(t.actId),
    orderIdx: index("act_document_attachments_order_idx").on(t.actId, t.orderIndex),
    uniqActDoc: uniqueIndex("act_document_attachments_act_doc_uniq").on(t.actId, t.documentId),
  })
);

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
  // Source of works for this schedule: 'works' (BoQ) or 'estimate' (LSR/Estimate)
  sourceType: text("source_type").notNull().default("works"),
  // If sourceType='estimate', this is the estimate ID
  estimateId: integer("estimate_id").references(() => estimates.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const scheduleTasks = pgTable(
  "schedule_tasks",
  {
    id: serial("id").primaryKey(),
    scheduleId: integer("schedule_id")
      .notNull()
      .references(() => schedules.id),
    // Source reference: either workId (from BoQ) or estimatePositionId (from Estimate)
    // Exactly one must be set (enforced by CHECK constraint in migration)
    workId: integer("work_id").references(() => works.id),
    estimatePositionId: integer("estimate_position_id").references(() => estimatePositions.id, {
      onDelete: "cascade",
    }),
    // Act number this task belongs to (global). Nullable = not assigned to an act.
    actNumber: integer("act_number"),
    actTemplateId: integer("act_template_id").references(() => actTemplates.id, { onDelete: "set null" }),
    // Task-scoped docs for act generation
    projectDrawings: text("project_drawings"),
    normativeRefs: text("normative_refs"),
    executiveSchemes: jsonb("executive_schemes").$type<ExecutiveSchemeLink[]>(),
    titleOverride: text("title_override"),
    // Independent quantity and unit — copied from source during bootstrap, editable per-task.
    // Allows splitting a work into sub-sections (захватки) with partial volumes in the future.
    quantity: numeric("quantity", { precision: 20, scale: 4 }),
    unit: text("unit"),
    startDate: date("start_date").notNull(),
    durationDays: integer("duration_days").notNull(),
    orderIndex: integer("order_index").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    scheduleIdIdx: index("schedule_tasks_schedule_id_idx").on(t.scheduleId),
    workIdIdx: index("schedule_tasks_work_id_idx").on(t.workId),
    estimatePositionIdIdx: index("schedule_tasks_estimate_position_id_idx").on(t.estimatePositionId),
    scheduleOrderIdx: index("schedule_tasks_schedule_order_idx").on(t.scheduleId, t.orderIndex),
    scheduleActNumberIdx: index("schedule_tasks_schedule_act_number_idx").on(t.scheduleId, t.actNumber),
    scheduleActTemplateIdx: index("schedule_tasks_schedule_act_template_idx").on(t.scheduleId, t.actTemplateId),
  })
);

// Materials linked to a specific schedule task (used for p.3 AOSR and attachments)
export const taskMaterials = pgTable(
  "task_materials",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => scheduleTasks.id, { onDelete: "cascade" }),
    projectMaterialId: bigint("project_material_id", { mode: "number" })
      .notNull()
      .references(() => projectMaterials.id, { onDelete: "restrict" }),
    batchId: bigint("batch_id", { mode: "number" }).references(() => materialBatches.id, { onDelete: "set null" }),
    qualityDocumentId: bigint("quality_document_id", { mode: "number" }).references(() => documents.id, {
      onDelete: "restrict",
    }),
    note: text("note"),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    taskIdIdx: index("task_materials_task_id_idx").on(t.taskId),
    orderIdx: index("task_materials_order_idx").on(t.taskId, t.orderIndex),
    taskMaterialBatchUq: uniqueIndex("task_materials_task_material_batch_uq").on(
      t.taskId,
      t.projectMaterialId,
      t.batchId,
    ),
  }),
);

export const estimatePositionMaterialLinks = pgTable(
  "estimate_position_material_links",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    objectId: integer("object_id")
      .notNull()
      .references(() => objects.id, { onDelete: "restrict" }),
    estimateId: integer("estimate_id")
      .notNull()
      .references(() => estimates.id, { onDelete: "cascade" }),
    estimatePositionId: integer("estimate_position_id")
      .notNull()
      .references(() => estimatePositions.id, { onDelete: "cascade" }),
    projectMaterialId: bigint("project_material_id", { mode: "number" })
      .notNull()
      .references(() => projectMaterials.id, { onDelete: "cascade" }),
    batchId: bigint("batch_id", { mode: "number" }).references(() => materialBatches.id, { onDelete: "set null" }),
    source: text("source").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    objectEstimatePositionUq: uniqueIndex("estimate_position_material_links_object_position_uq").on(t.objectId, t.estimatePositionId),
    objectEstimateIdIdx: index("estimate_position_material_links_object_estimate_id_idx").on(t.objectId, t.estimateId),
    estimatePositionIdIdx: index("estimate_position_material_links_estimate_position_id_idx").on(t.estimatePositionId),
    projectMaterialIdIdx: index("estimate_position_material_links_project_material_id_idx").on(t.projectMaterialId),
  })
);


// === SCHEMAS ===

export const insertWorkSchema = createInsertSchema(works).omit({ id: true });
export const insertEstimateSchema = createInsertSchema(estimates).omit({ id: true, createdAt: true });
export const insertEstimateSectionSchema = createInsertSchema(estimateSections).omit({ id: true });
export const insertEstimatePositionSchema = createInsertSchema(estimatePositions).omit({ id: true });
export const insertPositionResourceSchema = createInsertSchema(positionResources).omit({ id: true });
export const insertObjectSchema = createInsertSchema(objects).omit({ id: true, createdAt: true });
export const insertObjectPartySchema = createInsertSchema(objectParties).omit({ id: true, createdAt: true, updatedAt: true });
export const insertObjectResponsiblePersonSchema = createInsertSchema(objectResponsiblePersons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true, isProcessed: true, normalizedData: true });
export const insertActSchema = createInsertSchema(acts).omit({ id: true, createdAt: true });
export const insertAttachmentSchema = createInsertSchema(attachments).omit({ id: true, createdAt: true });
export const insertActTemplateSchema = createInsertSchema(actTemplates).omit({ id: true });
export const insertActTemplateSelectionSchema = createInsertSchema(actTemplateSelections).omit({ id: true, generatedAt: true });
export const insertScheduleSchema = createInsertSchema(schedules).omit({ id: true, createdAt: true });
export const insertScheduleTaskSchema = createInsertSchema(scheduleTasks).omit({ id: true, createdAt: true });
export const insertTaskMaterialSchema = createInsertSchema(taskMaterials).omit({ id: true, createdAt: true });
export const insertEstimatePositionMaterialLinkSchema = createInsertSchema(estimatePositionMaterialLinks).omit({
  createdAt: true,
  updatedAt: true,
});

// Zod schema for ActWorkItem (explicit source validation)
export const actWorkItemSchema = z.object({
  sourceType: z.enum(['works', 'estimate']),
  sourceId: z.number().int().positive(),
  description: z.string(),
  quantity: z.number(),
  unit: z.string().optional(),
  code: z.string().optional(),
});

// === EXPLICIT API TYPES ===

export type Work = typeof works.$inferSelect;
export type InsertWork = z.infer<typeof insertWorkSchema>;

export type Estimate = typeof estimates.$inferSelect;
export type InsertEstimate = z.infer<typeof insertEstimateSchema>;
export type EstimateSection = typeof estimateSections.$inferSelect;
export type InsertEstimateSection = z.infer<typeof insertEstimateSectionSchema>;
export type EstimatePosition = typeof estimatePositions.$inferSelect;
export type InsertEstimatePosition = z.infer<typeof insertEstimatePositionSchema>;
export type PositionResource = typeof positionResources.$inferSelect;
export type InsertPositionResource = z.infer<typeof insertPositionResourceSchema>;

export type Object = typeof objects.$inferSelect;
export type InsertObject = z.infer<typeof insertObjectSchema>;

export type ObjectParty = typeof objectParties.$inferSelect;
export type InsertObjectParty = z.infer<typeof insertObjectPartySchema>;

export type ObjectResponsiblePerson = typeof objectResponsiblePersons.$inferSelect;
export type InsertObjectResponsiblePerson = z.infer<typeof insertObjectResponsiblePersonSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Act = typeof acts.$inferSelect;
export type InsertAct = z.infer<typeof insertActSchema>;

export type Attachment = typeof attachments.$inferSelect;

export type MaterialCatalog = typeof materialsCatalog.$inferSelect;
export type InsertMaterialCatalog = typeof materialsCatalog.$inferInsert;

export type ProjectMaterial = typeof projectMaterials.$inferSelect;
export type InsertProjectMaterial = typeof projectMaterials.$inferInsert;

export type MaterialBatch = typeof materialBatches.$inferSelect;
export type InsertMaterialBatch = typeof materialBatches.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

export type DocumentBinding = typeof documentBindings.$inferSelect;
export type InsertDocumentBinding = typeof documentBindings.$inferInsert;

export type ActMaterialUsage = typeof actMaterialUsages.$inferSelect;
export type InsertActMaterialUsage = typeof actMaterialUsages.$inferInsert;

export type ActDocumentAttachment = typeof actDocumentAttachments.$inferSelect;
export type InsertActDocumentAttachment = typeof actDocumentAttachments.$inferInsert;

export type ActTemplate = typeof actTemplates.$inferSelect;
export type InsertActTemplate = z.infer<typeof insertActTemplateSchema>;

export type ActTemplateSelection = typeof actTemplateSelections.$inferSelect;
export type InsertActTemplateSelection = z.infer<typeof insertActTemplateSelectionSchema>;

export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;

export type ScheduleTask = typeof scheduleTasks.$inferSelect;
export type InsertScheduleTask = z.infer<typeof insertScheduleTaskSchema>;

export type TaskMaterial = typeof taskMaterials.$inferSelect;
export type InsertTaskMaterial = z.infer<typeof insertTaskMaterialSchema>;

export type EstimatePositionMaterialLink = typeof estimatePositionMaterialLinks.$inferSelect;
export type InsertEstimatePositionMaterialLink = z.infer<typeof insertEstimatePositionMaterialLinkSchema>;

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
