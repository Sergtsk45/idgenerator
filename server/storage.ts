import { db } from "./db";
import {
  works,
  messages,
  acts,
  attachments,
  actTemplates,
  actTemplateSelections,
  schedules,
  scheduleTasks,
  type InsertWork,
  type InsertMessage,
  type InsertAct,
  type InsertSchedule,
  type Work,
  type Message,
  type Act,
  type Attachment,
  type ActTemplate,
  type InsertActTemplate,
  type ActTemplateSelection,
  type InsertActTemplateSelection,
  type Schedule,
  type ScheduleTask
} from "@shared/schema";
import { eq, desc, inArray, asc } from "drizzle-orm";

export interface IStorage {
  // Works
  getWorks(): Promise<Work[]>;
  createWork(work: InsertWork): Promise<Work>;
  getWorkByCode(code: string): Promise<Work | undefined>;
  getWorksByIds(ids: number[]): Promise<Work[]>;
  clearWorks(): Promise<void>;
  importWorks(items: InsertWork[], mode: "merge" | "replace"): Promise<{ created: number; updated: number }>;

  // Messages
  getMessages(): Promise<Message[]>;
  getMessage(id: number): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessageNormalized(id: number, normalizedData: any): Promise<Message>;

  // Acts
  getActs(): Promise<Act[]>;
  getAct(id: number): Promise<Act | undefined>;
  getActByNumber(actNumber: number): Promise<Act | undefined>;
  createAct(act: InsertAct): Promise<Act>;
  upsertActByNumber(data: {
    actNumber: number;
    dateStart: string | null;
    dateEnd: string | null;
    location?: string | null;
    status?: string | null;
    worksData?: Array<{ workId: number; quantity: number; description: string }> | null;
  }): Promise<{ act: Act; created: boolean }>;
  
  // Attachments
  getAttachments(actId: number): Promise<Attachment[]>;

  // Act Templates
  getActTemplates(): Promise<ActTemplate[]>;
  getActTemplate(id: number): Promise<ActTemplate | undefined>;
  getActTemplateByTemplateId(templateId: string): Promise<ActTemplate | undefined>;
  createActTemplate(template: InsertActTemplate): Promise<ActTemplate>;
  seedActTemplates(templates: InsertActTemplate[]): Promise<void>;

  // Act Template Selections
  getActTemplateSelections(actId: number): Promise<ActTemplateSelection[]>;
  createActTemplateSelection(selection: InsertActTemplateSelection): Promise<ActTemplateSelection>;
  updateActTemplateSelectionStatus(id: number, status: string, pdfUrl?: string): Promise<ActTemplateSelection>;

  // Schedules (Gantt)
  getOrCreateDefaultSchedule(): Promise<Schedule>;
  createSchedule(schedule: InsertSchedule): Promise<Schedule>;
  getScheduleWithTasks(id: number): Promise<(Schedule & { tasks: ScheduleTask[] }) | undefined>;
  bootstrapScheduleTasksFromWorks(params: {
    scheduleId: number;
    workIds?: number[];
    defaultStartDate: string;
    defaultDurationDays: number;
  }): Promise<{ scheduleId: number; created: number; skipped: number }>;
  patchScheduleTask(
    id: number,
    patch: Partial<Pick<ScheduleTask, "titleOverride" | "startDate" | "durationDays" | "orderIndex" | "actNumber">>
  ): Promise<ScheduleTask | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getWorks(): Promise<Work[]> {
    return await db.select().from(works).orderBy(works.code);
  }

  async createWork(work: InsertWork): Promise<Work> {
    const [newWork] = await db.insert(works).values(work).returning();
    return newWork;
  }

  async getWorkByCode(code: string): Promise<Work | undefined> {
    const [work] = await db.select().from(works).where(eq(works.code, code));
    return work;
  }

  async getWorksByIds(ids: number[]): Promise<Work[]> {
    if (ids.length === 0) return [];
    return await db.select().from(works).where(inArray(works.id, ids));
  }

  async clearWorks(): Promise<void> {
    await db.delete(works);
  }

  async importWorks(
    items: InsertWork[],
    mode: "merge" | "replace"
  ): Promise<{ created: number; updated: number }> {
    return await db.transaction(async (tx) => {
      if (mode === "replace") {
        await tx.delete(works);
      }

      const codes = Array.from(
        new Set(
          items
            .map((i) => String(i.code || "").trim())
            .filter((c) => c.length > 0)
        )
      );

      const existing =
        codes.length === 0
          ? []
          : await tx
              .select({ code: works.code })
              .from(works)
              .where(inArray(works.code, codes));

      const existingSet = new Set(existing.map((e) => e.code));

      let created = 0;
      let updated = 0;

      for (const item of items) {
        const code = String(item.code || "").trim();
        if (!code) continue;

        const values: InsertWork = {
          ...item,
          code,
        };

        if (existingSet.has(code)) {
          await tx
            .update(works)
            .set({
              description: values.description,
              unit: values.unit,
              quantityTotal: values.quantityTotal ?? null,
              synonyms: values.synonyms ?? null,
            })
            .where(eq(works.code, code));
          updated++;
        } else {
          await tx.insert(works).values(values);
          existingSet.add(code);
          created++;
        }
      }

      return { created, updated };
    });
  }

  async getMessages(): Promise<Message[]> {
    return await db.select().from(messages).orderBy(desc(messages.createdAt));
  }

  async getMessage(id: number): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message;
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    return newMessage;
  }

  async updateMessageNormalized(id: number, normalizedData: any): Promise<Message> {
    const [updated] = await db.update(messages)
      .set({ 
        normalizedData, 
        isProcessed: true 
      })
      .where(eq(messages.id, id))
      .returning();
    return updated;
  }

  async getActs(): Promise<Act[]> {
    return await db.select().from(acts).orderBy(desc(acts.createdAt));
  }

  async getAct(id: number): Promise<Act | undefined> {
    const [act] = await db.select().from(acts).where(eq(acts.id, id));
    return act;
  }

  async getActByNumber(actNumber: number): Promise<Act | undefined> {
    const [act] = await db.select().from(acts).where(eq(acts.actNumber, actNumber as any));
    return act;
  }

  async createAct(act: InsertAct): Promise<Act> {
    const [newAct] = await db.insert(acts).values(act).returning();
    return newAct;
  }

  async upsertActByNumber(data: {
    actNumber: number;
    dateStart: string | null;
    dateEnd: string | null;
    location?: string | null;
    status?: string | null;
    worksData?: Array<{ workId: number; quantity: number; description: string }> | null;
  }): Promise<{ act: Act; created: boolean }> {
    const existing = await this.getActByNumber(data.actNumber);

    if (existing) {
      const nextStatus =
        existing.status === "signed"
          ? existing.status
          : ((data.status ?? existing.status ?? null) as any);
      const [updated] = await db
        .update(acts)
        .set({
          actNumber: data.actNumber as any,
          dateStart: (data.dateStart ?? null) as any,
          dateEnd: (data.dateEnd ?? null) as any,
          location: (data.location ?? existing.location ?? null) as any,
          status: nextStatus,
          worksData: (data.worksData ?? existing.worksData ?? null) as any,
        })
        .where(eq(acts.id, existing.id))
        .returning();
      return { act: updated, created: false };
    }

    const [created] = await db
      .insert(acts)
      .values({
        actNumber: data.actNumber as any,
        dateStart: (data.dateStart ?? null) as any,
        dateEnd: (data.dateEnd ?? null) as any,
        location: (data.location ?? null) as any,
        status: (data.status ?? "draft") as any,
        worksData: (data.worksData ?? []) as any,
      })
      .returning();

    return { act: created, created: true };
  }

  async getAttachments(actId: number): Promise<Attachment[]> {
    return await db.select().from(attachments).where(eq(attachments.actId, actId));
  }

  // Act Templates
  async getActTemplates(): Promise<ActTemplate[]> {
    return await db.select().from(actTemplates).orderBy(actTemplates.code);
  }

  async getActTemplate(id: number): Promise<ActTemplate | undefined> {
    const [template] = await db.select().from(actTemplates).where(eq(actTemplates.id, id));
    return template;
  }

  async getActTemplateByTemplateId(templateId: string): Promise<ActTemplate | undefined> {
    const [template] = await db.select().from(actTemplates).where(eq(actTemplates.templateId, templateId));
    return template;
  }

  async createActTemplate(template: InsertActTemplate): Promise<ActTemplate> {
    const [newTemplate] = await db.insert(actTemplates).values(template).returning();
    return newTemplate;
  }

  async seedActTemplates(templates: InsertActTemplate[]): Promise<void> {
    for (const template of templates) {
      const existing = await this.getActTemplateByTemplateId(template.templateId);
      if (!existing) {
        await this.createActTemplate(template);
      }
    }
  }

  // Act Template Selections
  async getActTemplateSelections(actId: number): Promise<ActTemplateSelection[]> {
    return await db.select().from(actTemplateSelections).where(eq(actTemplateSelections.actId, actId));
  }

  async createActTemplateSelection(selection: InsertActTemplateSelection): Promise<ActTemplateSelection> {
    const [newSelection] = await db.insert(actTemplateSelections).values(selection).returning();
    return newSelection;
  }

  async updateActTemplateSelectionStatus(id: number, status: string, pdfUrl?: string): Promise<ActTemplateSelection> {
    const updateData: any = { status };
    if (pdfUrl) {
      updateData.pdfUrl = pdfUrl;
      updateData.generatedAt = new Date();
    }
    const [updated] = await db.update(actTemplateSelections)
      .set(updateData)
      .where(eq(actTemplateSelections.id, id))
      .returning();
    return updated;
  }

  // Schedules (Gantt)
  async getOrCreateDefaultSchedule(): Promise<Schedule> {
    const defaultTitle = "График работ";
    const [existing] = await db.select().from(schedules).where(eq(schedules.title, defaultTitle));
    if (existing) return existing;

    const [created] = await db
      .insert(schedules)
      .values({ title: defaultTitle, calendarStart: null })
      .returning();
    return created;
  }

  async createSchedule(schedule: InsertSchedule): Promise<Schedule> {
    const [created] = await db.insert(schedules).values(schedule).returning();
    return created;
  }

  async getScheduleWithTasks(id: number): Promise<(Schedule & { tasks: ScheduleTask[] }) | undefined> {
    const [schedule] = await db.select().from(schedules).where(eq(schedules.id, id));
    if (!schedule) return undefined;

    const tasks = await db
      .select()
      .from(scheduleTasks)
      .where(eq(scheduleTasks.scheduleId, id))
      .orderBy(asc(scheduleTasks.orderIndex));

    return { ...schedule, tasks };
  }

  async bootstrapScheduleTasksFromWorks(params: {
    scheduleId: number;
    workIds?: number[];
    defaultStartDate: string;
    defaultDurationDays: number;
  }): Promise<{ scheduleId: number; created: number; skipped: number }> {
    const { scheduleId, workIds, defaultStartDate, defaultDurationDays } = params;

    return await db.transaction(async (tx) => {
      const [schedule] = await tx.select().from(schedules).where(eq(schedules.id, scheduleId));
      if (!schedule) {
        // Let the route translate this to 404.
        throw new Error("SCHEDULE_NOT_FOUND");
      }

      const worksList =
        workIds && workIds.length > 0
          ? await tx
              .select()
              .from(works)
              .where(inArray(works.id, workIds))
              .orderBy(works.code)
          : await tx.select().from(works).orderBy(works.code);

      const existingTasks = await tx
        .select({ workId: scheduleTasks.workId, orderIndex: scheduleTasks.orderIndex })
        .from(scheduleTasks)
        .where(eq(scheduleTasks.scheduleId, scheduleId));

      const existingWorkIds = new Set(existingTasks.map((t) => t.workId));
      const maxOrderIndex =
        existingTasks.length === 0
          ? -1
          : Math.max(...existingTasks.map((t) => Number(t.orderIndex ?? 0)));

      let nextOrderIndex = maxOrderIndex + 1;
      let created = 0;
      let skipped = 0;

      for (const w of worksList) {
        if (existingWorkIds.has(w.id)) {
          skipped++;
          continue;
        }

        await tx.insert(scheduleTasks).values({
          scheduleId,
          workId: w.id,
          titleOverride: null,
          startDate: defaultStartDate,
          durationDays: defaultDurationDays,
          orderIndex: nextOrderIndex++,
        });
        created++;
        existingWorkIds.add(w.id);
      }

      return { scheduleId, created, skipped };
    });
  }

  async patchScheduleTask(
    id: number,
    patch: Partial<Pick<ScheduleTask, "titleOverride" | "startDate" | "durationDays" | "orderIndex" | "actNumber">>
  ): Promise<ScheduleTask | undefined> {
    const updateData: Partial<typeof scheduleTasks.$inferInsert> = {};

    if ("titleOverride" in patch) updateData.titleOverride = patch.titleOverride ?? null;
    if (patch.startDate !== undefined) updateData.startDate = patch.startDate as any;
    if (patch.durationDays !== undefined) updateData.durationDays = patch.durationDays as any;
    if (patch.orderIndex !== undefined) updateData.orderIndex = patch.orderIndex as any;
    if ("actNumber" in patch) updateData.actNumber = (patch.actNumber ?? null) as any;

    if (Object.keys(updateData).length === 0) return undefined;

    const [updated] = await db.update(scheduleTasks).set(updateData).where(eq(scheduleTasks.id, id)).returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
