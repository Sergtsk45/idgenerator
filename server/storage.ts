import { db } from "./db";
import {
  objects,
  objectParties,
  objectResponsiblePersons,
  works,
  estimates,
  estimateSections,
  estimatePositions,
  estimatePositionMaterialLinks,
  positionResources,
  messages,
  acts,
  attachments,
  materialsCatalog,
  projectMaterials,
  materialBatches,
  documents,
  documentBindings,
  actMaterialUsages,
  actDocumentAttachments,
  actTemplates,
  actTemplateSelections,
  schedules,
  scheduleTasks,
  taskMaterials,
  type InsertWork,
  type InsertEstimate,
  type InsertEstimateSection,
  type InsertEstimatePosition,
  type InsertPositionResource,
  type InsertMessage,
  type InsertAct,
  type InsertSchedule,
  type Work,
  type Estimate,
  type EstimateSection,
  type EstimatePosition,
  type EstimatePositionMaterialLink,
  type InsertEstimatePositionMaterialLink,
  type PositionResource,
  type Message,
  type Act,
  type Attachment,
  type MaterialCatalog,
  type InsertMaterialCatalog,
  type ProjectMaterial,
  type InsertProjectMaterial,
  type MaterialBatch,
  type InsertMaterialBatch,
  type Document,
  type InsertDocument,
  type DocumentBinding,
  type InsertDocumentBinding,
  type ActMaterialUsage,
  type InsertActMaterialUsage,
  type ActDocumentAttachment,
  type InsertActDocumentAttachment,
  type Object as DbObject,
  type InsertObject,
  type ObjectParty,
  type InsertObjectParty,
  type ObjectResponsiblePerson,
  type InsertObjectResponsiblePerson,
  type ActTemplate,
  type InsertActTemplate,
  type ActTemplateSelection,
  type InsertActTemplateSelection,
  type Schedule,
  type ScheduleTask,
  type TaskMaterial,
  type InsertTaskMaterial
} from "@shared/schema";
import type { PartyDto, PersonDto, SourceDataDto } from "@shared/routes";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

type ObjectPartyRole = "customer" | "builder" | "designer";
type ObjectPersonRole =
  | "developer_rep"
  | "contractor_rep"
  | "supervisor_rep"
  | "rep_customer_control"
  | "rep_builder"
  | "rep_builder_control"
  | "rep_designer"
  | "rep_work_performer";

/**
 * Determines if an estimate position is a "main" work (for schedule tasks).
 * Main positions have code starting with ГЭСН, ФЕР, ТЕР (case-insensitive).
 * Other positions (ФСБЦ, прайс, etc.) are "auxiliary" and shown as sub-items.
 */
function isMainEstimatePosition(position: { code?: string | null }): boolean {
  const code = String(position.code ?? "").trim().toUpperCase();
  if (!code) return false;
  return code.startsWith("ГЭСН") || code.startsWith("ФЕР") || code.startsWith("ТЕР");
}

export interface IStorage {
  // Objects / Source data (MVP: single default object)
  getOrCreateDefaultObject(telegramUserId?: number): Promise<DbObject>;
  getObject(id: number): Promise<DbObject | undefined>;
  updateObject(id: number, patch: Partial<Pick<InsertObject, "title" | "address" | "city">>): Promise<DbObject>;
  getObjectSourceData(objectId: number): Promise<SourceDataDto>;
  saveObjectSourceData(objectId: number, data: SourceDataDto): Promise<SourceDataDto>;

  // Materials Catalog
  searchMaterialsCatalog(query?: string): Promise<MaterialCatalog[]>;
  createMaterialCatalog(material: InsertMaterialCatalog): Promise<MaterialCatalog>;

  // Project Materials
  listProjectMaterials(objectId: number): Promise<
    Array<
      ProjectMaterial & {
        batchesCount: number;
        docsCount: number;
        qualityDocsCount: number;
        hasUseInActsQualityDoc: boolean;
      }
    >
  >;
  getProjectMaterial(
    id: number
  ): Promise<
    | {
        material: ProjectMaterial;
        catalog: MaterialCatalog | null;
        batches: MaterialBatch[];
        bindings: DocumentBinding[];
        documents: Document[];
      }
    | undefined
  >;
  createProjectMaterial(
    objectId: number,
    data: Omit<InsertProjectMaterial, "objectId">
  ): Promise<ProjectMaterial>;
  updateProjectMaterial(
    id: number,
    patch: Partial<Pick<ProjectMaterial, "nameOverride" | "baseUnitOverride" | "paramsOverride" | "catalogMaterialId" | "deletedAt">>
  ): Promise<ProjectMaterial | undefined>;
  saveProjectMaterialToCatalog(id: number): Promise<MaterialCatalog>;

  // Material Batches
  createBatch(projectMaterialId: number, data: Omit<InsertMaterialBatch, "objectId" | "projectMaterialId">): Promise<MaterialBatch>;
  updateBatch(
    id: number,
    patch: Partial<
      Pick<MaterialBatch, "supplierName" | "plant" | "batchNumber" | "deliveryDate" | "quantity" | "unit" | "notes">
    >
  ): Promise<MaterialBatch | undefined>;
  deleteBatch(id: number): Promise<boolean>;

  // Documents
  searchDocuments(params: { query?: string; docType?: string; scope?: string }): Promise<Document[]>;
  createDocument(data: InsertDocument): Promise<Document>;

  // Document Bindings
  createBinding(data: InsertDocumentBinding): Promise<DocumentBinding>;
  updateBinding(
    id: number,
    patch: Partial<Pick<DocumentBinding, "useInActs" | "isPrimary" | "bindingRole">>
  ): Promise<DocumentBinding | undefined>;
  deleteBinding(id: number): Promise<boolean>;

  // Act Material Usages
  getActMaterialUsages(actId: number): Promise<
    Array<
      ActMaterialUsage & {
        projectMaterial?: ProjectMaterial;
        catalogMaterial?: MaterialCatalog | null;
        qualityDocument?: Document | null;
      }
    >
  >;
  replaceActMaterialUsages(actId: number, items: Array<Omit<InsertActMaterialUsage, "actId">>): Promise<void>;

  // Act Document Attachments
  getActDocAttachments(actId: number): Promise<Array<ActDocumentAttachment & { document?: Document | null }>>;
  replaceActDocAttachments(actId: number, items: Array<Omit<InsertActDocumentAttachment, "actId">>): Promise<void>;

  // Works
  getWorks(): Promise<Work[]>;
  createWork(work: InsertWork): Promise<Work>;
  getWorkByCode(code: string): Promise<Work | undefined>;
  getWorksByIds(ids: number[]): Promise<Work[]>;
  clearWorks(options?: { resetScheduleIfInUse?: boolean }): Promise<void>;
  importWorks(items: InsertWork[], mode: "merge" | "replace"): Promise<{ created: number; updated: number }>;

  // Estimates (Сметы / ЛСР)
  getEstimates(): Promise<Estimate[]>;
  getEstimate(id: number): Promise<Estimate | undefined>;
  getEstimateSections(estimateId: number): Promise<EstimateSection[]>;
  getEstimatePositions(estimateId: number): Promise<EstimatePosition[]>;
  getPositionResources(positionIds: number[]): Promise<PositionResource[]>;
  getEstimateWithDetails(
    estimateId: number
  ): Promise<
    | {
        estimate: Estimate;
        sections: Array<
          EstimateSection & { positions: Array<EstimatePosition & { resources: PositionResource[] }> }
        >;
      }
    | undefined
  >;
  importEstimate(payload: {
    estimate: InsertEstimate;
    sections: Array<Omit<InsertEstimateSection, "estimateId">>;
    positions: Array<Omit<InsertEstimatePosition, "estimateId" | "sectionId"> & { sectionNumber?: string | null }>;
    resources: Array<Omit<InsertPositionResource, "positionId"> & { positionLineNo: string }>;
  }): Promise<{ estimateId: number; sections: number; positions: number; resources: number }>;
  deleteEstimate(id: number, options?: { resetScheduleIfInUse?: boolean }): Promise<boolean>;

  // Messages
  getMessages(userId?: string): Promise<Message[]>;
  getMessage(id: number): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessageNormalized(id: number, normalizedData: any): Promise<Message>;
  patchMessage(id: number, data: { messageRaw?: string; normalizedData?: any }): Promise<Message | undefined>;
  clearMessages(userId?: string): Promise<void>;

  // Acts
  getActs(): Promise<Act[]>;
  getAct(id: number): Promise<Act | undefined>;
  getActByNumber(actNumber: number): Promise<Act | undefined>;
  createAct(act: InsertAct): Promise<Act>;
  upsertActByNumber(data: {
    actNumber: number;
    actTemplateId?: number | null;
    dateStart: string | null;
    dateEnd: string | null;
    location?: string | null;
    status?: string | null;
    worksData?: Array<{ workId: number; quantity: number; description: string }> | null;
    projectDrawingsAgg?: string | null;
    normativeRefsAgg?: string | null;
    executiveSchemesAgg?: Array<{ title: string; fileUrl?: string }> | null;
  }): Promise<{ act: Act; created: boolean }>;

  deleteActByNumber(actNumber: number): Promise<boolean>;
  
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
  getScheduleTask(id: number): Promise<ScheduleTask | undefined>;
  bootstrapScheduleTasksFromWorks(params: {
    scheduleId: number;
    workIds?: number[];
    defaultStartDate: string;
    defaultDurationDays: number;
  }): Promise<{ scheduleId: number; created: number; skipped: number }>;
  patchScheduleTask(
    id: number,
    patch: Partial<
      Pick<
        ScheduleTask,
        | "titleOverride"
        | "startDate"
        | "durationDays"
        | "orderIndex"
        | "actNumber"
        | "actTemplateId"
        | "projectDrawings"
        | "normativeRefs"
        | "executiveSchemes"
      >
    >
  ): Promise<ScheduleTask | undefined>;

  getTasksByActNumber(scheduleId: number, actNumber: number): Promise<ScheduleTask[]>;
  updateActTemplateForActNumber(params: { scheduleId: number; actNumber: number; actTemplateId: number | null }): Promise<number>;

  // Task materials (materials linked to a specific schedule task)
  getTaskMaterials(
    taskId: number
  ): Promise<Array<TaskMaterial & { projectMaterial?: ProjectMaterial; catalogMaterial?: MaterialCatalog | null; batch?: MaterialBatch | null; qualityDocument?: Document | null }>>;
  replaceTaskMaterials(taskId: number, items: Array<Omit<InsertTaskMaterial, "taskId">>): Promise<void>;
  createTaskMaterial(taskId: number, item: Omit<InsertTaskMaterial, "taskId">): Promise<TaskMaterial>;
  deleteTaskMaterial(taskMaterialId: number): Promise<boolean>;
  
  // Schedule source (works vs estimate)
  getScheduleSourceInfo(scheduleId: number): Promise<{
    sourceType: 'works' | 'estimate';
    estimateId: number | null;
    estimateName: string | null;
    tasksCount: number;
    affectedActNumbers: number[];
  } | undefined>;
  changeScheduleSource(params: {
    scheduleId: number;
    newSourceType: 'works' | 'estimate';
    newEstimateId?: number;
  }): Promise<void>;
  bootstrapScheduleTasksFromEstimate(params: {
    scheduleId: number;
    estimateId: number;
    positionIds?: number[];
    defaultStartDate: string;
    defaultDurationDays: number;
  }): Promise<{ scheduleId: number; created: number; skipped: number }>;
  
  // Estimate positions
  getEstimatePositionsByIds(ids: number[]): Promise<EstimatePosition[]>;

  // Estimate subrows ↔ project materials (quality statuses on /schedule)
  listEstimatePositionMaterialLinks(objectId: number, estimateId: number): Promise<EstimatePositionMaterialLink[]>;
  upsertEstimatePositionMaterialLink(
    objectId: number,
    data: Omit<InsertEstimatePositionMaterialLink, "objectId">
  ): Promise<EstimatePositionMaterialLink>;
  deleteEstimatePositionMaterialLink(objectId: number, estimatePositionId: number): Promise<boolean>;
  getEstimateSubrowStatuses(params: {
    objectId: number;
    estimateId: number;
  }): Promise<
    Record<
      number,
      {
        status: "none" | "partial" | "ok";
        reason?: string;
        projectMaterialId?: number;
        batchId?: number | null;
      }
    >
  >;
}

export class DatabaseStorage implements IStorage {
  async getOrCreateDefaultObject(telegramUserId?: number): Promise<DbObject> {
    // MVP: single "current" object per user (if telegramUserId provided).
    // IMPORTANT: do NOT rely on title to find the current object,
    // because title is user-editable via source-data and would lead to duplicates.
    
    // Если передан telegramUserId, ищем объект для этого пользователя
    let all: DbObject[];
    if (telegramUserId !== undefined) {
      all = await db
        .select()
        .from(objects)
        .where(eq(objects.telegramUserId, telegramUserId));
    } else {
      // Для обратной совместимости: если telegramUserId не передан,
      // ищем объекты без привязки к пользователю (legacy)
      all = await db
        .select()
        .from(objects)
        .where(sql`${objects.telegramUserId} IS NULL`);
    }
    
    if (all.length === 1) return all[0];
    if (all.length > 1) {
      // If duplicates exist (legacy bug), pick the object that was most recently
      // updated via source-data (parties/persons have updatedAt).
      const ids = all.map((o) => o.id);
      const parties = await db
        .select({ objectId: objectParties.objectId, updatedAt: objectParties.updatedAt })
        .from(objectParties)
        .where(inArray(objectParties.objectId, ids));
      const persons = await db
        .select({ objectId: objectResponsiblePersons.objectId, updatedAt: objectResponsiblePersons.updatedAt })
        .from(objectResponsiblePersons)
        .where(inArray(objectResponsiblePersons.objectId, ids));

      const stats = new Map<number, { updatedAtMs: number; count: number }>();
      for (const o of all) stats.set(o.id, { updatedAtMs: 0, count: 0 });

      const bump = (objectId: number, dt: Date | null) => {
        const s = stats.get(objectId);
        if (!s) return;
        s.count += 1;
        const ms = dt instanceof Date ? dt.getTime() : 0;
        if (ms > s.updatedAtMs) s.updatedAtMs = ms;
      };

      for (const p of parties) bump(Number(p.objectId), p.updatedAt as any);
      for (const p of persons) bump(Number(p.objectId), p.updatedAt as any);

      const best = all
        .slice()
        .sort((a, b) => {
          const sa = stats.get(a.id)!;
          const sb = stats.get(b.id)!;
          // 1) latest updatedAt
          if (sb.updatedAtMs !== sa.updatedAtMs) return sb.updatedAtMs - sa.updatedAtMs;
          // 2) more related records
          if (sb.count !== sa.count) return sb.count - sa.count;
          // 3) stable tie-breaker: newest id
          return b.id - a.id;
        })[0];

      return best;
    }

    const defaultTitle = "Объект по умолчанию";
    const [created] = await db
      .insert(objects)
      .values({ 
        title: defaultTitle, 
        address: null, 
        city: null,
        telegramUserId: telegramUserId ?? null
      })
      .returning();
    return created;
  }

  async getObject(id: number): Promise<DbObject | undefined> {
    const [obj] = await db.select().from(objects).where(eq(objects.id, id));
    return obj;
  }

  async updateObject(
    id: number,
    patch: Partial<Pick<InsertObject, "title" | "address" | "city">>
  ): Promise<DbObject> {
    const [updated] = await db
      .update(objects)
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.address !== undefined ? { address: patch.address ?? null } : {}),
        ...(patch.city !== undefined ? { city: patch.city ?? null } : {}),
      })
      .where(eq(objects.id, id))
      .returning();
    return updated;
  }

  async getObjectSourceData(objectId: number): Promise<SourceDataDto> {
    const obj = await this.getObject(objectId);
    if (!obj) throw new Error("OBJECT_NOT_FOUND");

    const parties = await db.select().from(objectParties).where(eq(objectParties.objectId, objectId));
    const persons = await db
      .select()
      .from(objectResponsiblePersons)
      .where(eq(objectResponsiblePersons.objectId, objectId));

    const partiesByRole = new Map<string, ObjectParty>();
    for (const p of parties) partiesByRole.set(p.role, p);

    const personsByRole = new Map<string, ObjectResponsiblePerson>();
    for (const p of persons) personsByRole.set(p.role, p);

    const ensureParty = (role: ObjectPartyRole): PartyDto => {
      const p = partiesByRole.get(role);
      return {
        fullName: p?.fullName ?? "",
        shortName: p?.shortName ?? undefined,
        inn: p?.inn ?? undefined,
        kpp: p?.kpp ?? undefined,
        ogrn: p?.ogrn ?? undefined,
        sroFullName: p?.sroFullName ?? undefined,
        sroShortName: p?.sroShortName ?? undefined,
        sroOgrn: p?.sroOgrn ?? undefined,
        sroInn: p?.sroInn ?? undefined,
        addressLegal: p?.addressLegal ?? undefined,
        phone: p?.phone ?? undefined,
        email: p?.email ?? undefined,
      };
    };

    const ensurePerson = (role: ObjectPersonRole): PersonDto => {
      const p = personsByRole.get(role);
      return {
        personName: p?.personName ?? "",
        position: p?.position ?? undefined,
        basisText: p?.basisText ?? undefined,
        lineText: p?.lineText ?? undefined,
        signText: p?.signText ?? undefined,
      };
    };

    return {
      object: {
        title: obj.title ?? "",
        address: obj.address ?? "",
        city: obj.city ?? "",
      },
      parties: {
        customer: ensureParty("customer"),
        builder: ensureParty("builder"),
        designer: ensureParty("designer"),
      },
      persons: {
        developer_rep: ensurePerson("developer_rep"),
        contractor_rep: ensurePerson("contractor_rep"),
        supervisor_rep: ensurePerson("supervisor_rep"),
        rep_customer_control: ensurePerson("rep_customer_control"),
        rep_builder: ensurePerson("rep_builder"),
        rep_builder_control: ensurePerson("rep_builder_control"),
        rep_designer: ensurePerson("rep_designer"),
        rep_work_performer: ensurePerson("rep_work_performer"),
      },
    };
  }

  async saveObjectSourceData(objectId: number, data: SourceDataDto): Promise<SourceDataDto> {
    return await db.transaction(async (tx) => {
      const [obj] = await tx.select().from(objects).where(eq(objects.id, objectId));
      if (!obj) throw new Error("OBJECT_NOT_FOUND");

      await tx
        .update(objects)
        .set({
          title: data.object.title,
          address: data.object.address || null,
          city: data.object.city || null,
        })
        .where(eq(objects.id, objectId));

      const upsertParty = async (role: ObjectPartyRole, party: PartyDto) => {
        const values: InsertObjectParty = {
          objectId,
          role,
          fullName: party.fullName ?? "",
          shortName: party.shortName ?? null,
          inn: party.inn ?? null,
          kpp: party.kpp ?? null,
          ogrn: party.ogrn ?? null,
          sroFullName: party.sroFullName ?? null,
          sroShortName: party.sroShortName ?? null,
          sroOgrn: party.sroOgrn ?? null,
          sroInn: party.sroInn ?? null,
          addressLegal: party.addressLegal ?? null,
          phone: party.phone ?? null,
          email: party.email ?? null,
        };
        const updatedAt = new Date();

        await tx
          .insert(objectParties)
          .values(values)
          .onConflictDoUpdate({
            target: [objectParties.objectId, objectParties.role],
            set: {
              fullName: values.fullName,
              shortName: values.shortName,
              inn: values.inn,
              kpp: values.kpp,
              ogrn: values.ogrn,
              sroFullName: values.sroFullName,
              sroShortName: values.sroShortName,
              sroOgrn: values.sroOgrn,
              sroInn: values.sroInn,
              addressLegal: values.addressLegal,
              phone: values.phone,
              email: values.email,
              updatedAt,
            },
          });
      };

      const upsertPerson = async (role: ObjectPersonRole, person: PersonDto) => {
        const values: InsertObjectResponsiblePerson = {
          objectId,
          role,
          personName: person.personName ?? "",
          position: person.position ?? null,
          basisText: person.basisText ?? null,
          lineText: person.lineText ?? null,
          signText: person.signText ?? null,
        };
        const updatedAt = new Date();

        await tx
          .insert(objectResponsiblePersons)
          .values(values)
          .onConflictDoUpdate({
            target: [objectResponsiblePersons.objectId, objectResponsiblePersons.role],
            set: {
              personName: values.personName,
              position: values.position,
              basisText: values.basisText,
              lineText: values.lineText,
              signText: values.signText,
              updatedAt,
            },
          });
      };

      await upsertParty("customer", data.parties.customer);
      await upsertParty("builder", data.parties.builder);
      await upsertParty("designer", data.parties.designer);

      await upsertPerson("developer_rep", data.persons.developer_rep);
      await upsertPerson("contractor_rep", data.persons.contractor_rep);
      await upsertPerson("supervisor_rep", data.persons.supervisor_rep);
      await upsertPerson("rep_customer_control", data.persons.rep_customer_control);
      await upsertPerson("rep_builder", data.persons.rep_builder);
      await upsertPerson("rep_builder_control", data.persons.rep_builder_control);
      await upsertPerson("rep_designer", data.persons.rep_designer);
      await upsertPerson("rep_work_performer", data.persons.rep_work_performer);

      return await this.getObjectSourceData(objectId);
    });
  }

  // === Materials & Documents (Source Data module) ===

  async searchMaterialsCatalog(query?: string): Promise<MaterialCatalog[]> {
    const q = String(query ?? "").trim();
    const where =
      q.length > 0 ? and(isNull(materialsCatalog.deletedAt), ilike(materialsCatalog.name, `%${q}%`)) : isNull(materialsCatalog.deletedAt);

    return await db.select().from(materialsCatalog).where(where).orderBy(asc(materialsCatalog.name));
  }

  async createMaterialCatalog(material: InsertMaterialCatalog): Promise<MaterialCatalog> {
    const [created] = await db.insert(materialsCatalog).values(material).returning();
    return created;
  }

  async listProjectMaterials(
    objectId: number
  ): Promise<Array<ProjectMaterial & { batchesCount: number; docsCount: number; qualityDocsCount: number; hasUseInActsQualityDoc: boolean }>> {
    const rows = await db
      .select({
        id: projectMaterials.id,
        objectId: projectMaterials.objectId,
        catalogMaterialId: projectMaterials.catalogMaterialId,
        nameOverride: projectMaterials.nameOverride,
        baseUnitOverride: projectMaterials.baseUnitOverride,
        paramsOverride: projectMaterials.paramsOverride,
        createdAt: projectMaterials.createdAt,
        updatedAt: projectMaterials.updatedAt,
        deletedAt: projectMaterials.deletedAt,
        // IMPORTANT: COUNT() is bigint in Postgres and is returned as string by the driver.
        // Cast to int so API returns numbers (matches shared/routes.ts zod schema).
        batchesCount: sql<number>`COALESCE(COUNT(DISTINCT ${materialBatches.id})::int, 0)`,
        docsCount: sql<number>`COALESCE(COUNT(DISTINCT ${documentBindings.id})::int, 0)`,
        qualityDocsCount: sql<number>`COALESCE(COUNT(DISTINCT CASE WHEN ${documentBindings.bindingRole}='quality' THEN ${documentBindings.id} END)::int, 0)`,
        hasUseInActsQualityDoc: sql<boolean>`COALESCE(BOOL_OR(${documentBindings.bindingRole}='quality' AND ${documentBindings.useInActs}=TRUE), FALSE)`,
      })
      .from(projectMaterials)
      .leftJoin(materialBatches, eq(materialBatches.projectMaterialId, projectMaterials.id))
      .leftJoin(documentBindings, eq(documentBindings.projectMaterialId, projectMaterials.id))
      .where(and(eq(projectMaterials.objectId, objectId), isNull(projectMaterials.deletedAt)))
      .groupBy(projectMaterials.id)
      .orderBy(desc(projectMaterials.updatedAt));

    // Row shape matches ProjectMaterial + aggregates
    return rows as any;
  }

  async getProjectMaterial(
    id: number
  ): Promise<
    | {
        material: ProjectMaterial;
        catalog: MaterialCatalog | null;
        batches: MaterialBatch[];
        bindings: DocumentBinding[];
        documents: Document[];
      }
    | undefined
  > {
    const [material] = await db
      .select()
      .from(projectMaterials)
      .where(and(eq(projectMaterials.id, id as any), isNull(projectMaterials.deletedAt)));
    if (!material) return undefined;

    const catalogId = (material as any).catalogMaterialId as number | null | undefined;
    const catalog =
      catalogId == null
        ? null
        : (await db.select().from(materialsCatalog).where(and(eq(materialsCatalog.id, catalogId as any), isNull(materialsCatalog.deletedAt))))[0] ??
          null;

    const batches = await db
      .select()
      .from(materialBatches)
      .where(eq(materialBatches.projectMaterialId, material.id))
      .orderBy(desc(materialBatches.deliveryDate));

    const bindings = await db
      .select()
      .from(documentBindings)
      .where(eq(documentBindings.projectMaterialId, material.id))
      .orderBy(desc(documentBindings.createdAt));

    const documentIds = Array.from(new Set(bindings.map((b) => b.documentId).filter((v): v is any => v != null)));
    const docs =
      documentIds.length === 0
        ? []
        : await db
            .select()
            .from(documents)
            .where(and(inArray(documents.id, documentIds as any), isNull(documents.deletedAt)))
            .orderBy(desc(documents.updatedAt));

    return { material, catalog, batches, bindings, documents: docs };
  }

  async createProjectMaterial(objectId: number, data: Omit<InsertProjectMaterial, "objectId">): Promise<ProjectMaterial> {
    const [created] = await db
      .insert(projectMaterials)
      .values({
        ...(data as any),
        objectId,
      })
      .returning();
    return created;
  }

  async updateProjectMaterial(
    id: number,
    patch: Partial<Pick<ProjectMaterial, "nameOverride" | "baseUnitOverride" | "paramsOverride" | "catalogMaterialId" | "deletedAt">>
  ): Promise<ProjectMaterial | undefined> {
    if (Object.keys(patch).length === 0) return undefined;
    const [updated] = await db
      .update(projectMaterials)
      .set({
        ...(patch.nameOverride !== undefined ? { nameOverride: patch.nameOverride as any } : {}),
        ...(patch.baseUnitOverride !== undefined ? { baseUnitOverride: patch.baseUnitOverride as any } : {}),
        ...(patch.paramsOverride !== undefined ? { paramsOverride: (patch.paramsOverride as any) ?? {} } : {}),
        ...(patch.catalogMaterialId !== undefined ? { catalogMaterialId: patch.catalogMaterialId as any } : {}),
        ...(patch.deletedAt !== undefined ? { deletedAt: patch.deletedAt as any } : {}),
      })
      .where(eq(projectMaterials.id, id as any))
      .returning();
    return updated;
  }

  async saveProjectMaterialToCatalog(id: number): Promise<MaterialCatalog> {
    return await db.transaction(async (tx) => {
      const [material] = await tx.select().from(projectMaterials).where(eq(projectMaterials.id, id as any));
      if (!material) throw new Error("PROJECT_MATERIAL_NOT_FOUND");

      const existingCatalogId = (material as any).catalogMaterialId as number | null | undefined;
      if (existingCatalogId != null) {
        const [existing] = await tx
          .select()
          .from(materialsCatalog)
          .where(and(eq(materialsCatalog.id, existingCatalogId as any), isNull(materialsCatalog.deletedAt)));
        if (!existing) throw new Error("CATALOG_MATERIAL_NOT_FOUND");
        return existing;
      }

      const name = String((material as any).nameOverride ?? "").trim();
      if (!name) throw new Error("NAME_OVERRIDE_REQUIRED");

      const [createdCatalog] = await tx
        .insert(materialsCatalog)
        .values({
          name,
          category: null,
          standardRef: null,
          baseUnit: (material as any).baseUnitOverride ?? null,
          params: (material as any).paramsOverride ?? {},
        } as any)
        .returning();

      await tx
        .update(projectMaterials)
        .set({ catalogMaterialId: createdCatalog.id as any })
        .where(eq(projectMaterials.id, id as any));

      return createdCatalog;
    });
  }

  async createBatch(projectMaterialId: number, data: Omit<InsertMaterialBatch, "objectId" | "projectMaterialId">): Promise<MaterialBatch> {
    const [material] = await db.select({ objectId: projectMaterials.objectId }).from(projectMaterials).where(eq(projectMaterials.id, projectMaterialId as any));
    if (!material) throw new Error("PROJECT_MATERIAL_NOT_FOUND");

    const [created] = await db
      .insert(materialBatches)
      .values({
        ...(data as any),
        objectId: material.objectId,
        projectMaterialId,
      })
      .returning();
    return created;
  }

  async updateBatch(
    id: number,
    patch: Partial<
      Pick<MaterialBatch, "supplierName" | "plant" | "batchNumber" | "deliveryDate" | "quantity" | "unit" | "notes">
    >
  ): Promise<MaterialBatch | undefined> {
    if (Object.keys(patch).length === 0) return undefined;
    const [updated] = await db
      .update(materialBatches)
      .set({
        ...(patch.supplierName !== undefined ? { supplierName: patch.supplierName as any } : {}),
        ...(patch.plant !== undefined ? { plant: patch.plant as any } : {}),
        ...(patch.batchNumber !== undefined ? { batchNumber: patch.batchNumber as any } : {}),
        ...(patch.deliveryDate !== undefined ? { deliveryDate: patch.deliveryDate as any } : {}),
        ...(patch.quantity !== undefined ? { quantity: patch.quantity as any } : {}),
        ...(patch.unit !== undefined ? { unit: patch.unit as any } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes as any } : {}),
      })
      .where(eq(materialBatches.id, id as any))
      .returning();
    return updated;
  }

  async deleteBatch(id: number): Promise<boolean> {
    const [existing] = await db.select({ id: materialBatches.id }).from(materialBatches).where(eq(materialBatches.id, id as any));
    if (!existing) return false;
    await db.delete(materialBatches).where(eq(materialBatches.id, id as any));
    return true;
  }

  async searchDocuments(params: { query?: string; docType?: string; scope?: string }): Promise<Document[]> {
    const q = String(params.query ?? "").trim();
    const docType = params.docType ? String(params.docType) : null;
    const scope = params.scope ? String(params.scope) : null;

    const whereParts = [
      isNull(documents.deletedAt),
      docType ? eq(documents.docType, docType) : undefined,
      scope ? eq(documents.scope, scope) : undefined,
      q
        ? or(
            ilike(documents.docNumber, `%${q}%`),
            ilike(documents.title, `%${q}%`)
          )
        : undefined,
    ].filter(Boolean) as any[];

    const where = whereParts.length === 1 ? whereParts[0] : and(...whereParts);
    return await db.select().from(documents).where(where).orderBy(desc(documents.updatedAt));
  }

  async createDocument(data: InsertDocument): Promise<Document> {
    const [created] = await db.insert(documents).values(data).returning();
    return created;
  }

  async createBinding(data: InsertDocumentBinding): Promise<DocumentBinding> {
    const [created] = await db.insert(documentBindings).values(data).returning();
    return created;
  }

  async updateBinding(
    id: number,
    patch: Partial<Pick<DocumentBinding, "useInActs" | "isPrimary" | "bindingRole">>
  ): Promise<DocumentBinding | undefined> {
    if (Object.keys(patch).length === 0) return undefined;

    return await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(documentBindings).where(eq(documentBindings.id, id as any));
      if (!existing) return undefined;

      const [updated] = await tx
        .update(documentBindings)
        .set({
          ...(patch.useInActs !== undefined ? { useInActs: patch.useInActs } : {}),
          ...(patch.isPrimary !== undefined ? { isPrimary: patch.isPrimary } : {}),
          ...(patch.bindingRole !== undefined ? { bindingRole: patch.bindingRole as any } : {}),
        })
        .where(eq(documentBindings.id, id as any))
        .returning();

      // Enforce single primary within a material + role (UX constraint)
      if (patch.isPrimary === true && updated.projectMaterialId != null) {
        await tx
          .update(documentBindings)
          .set({ isPrimary: false })
          .where(
            and(
              eq(documentBindings.projectMaterialId, updated.projectMaterialId as any),
              eq(documentBindings.bindingRole, updated.bindingRole as any),
              sql`${documentBindings.id} <> ${updated.id}`
            )
          );
      }

      return updated;
    });
  }

  async deleteBinding(id: number): Promise<boolean> {
    const [existing] = await db.select({ id: documentBindings.id }).from(documentBindings).where(eq(documentBindings.id, id as any));
    if (!existing) return false;
    await db.delete(documentBindings).where(eq(documentBindings.id, id as any));
    return true;
  }

  async getActMaterialUsages(
    actId: number
  ): Promise<Array<ActMaterialUsage & { projectMaterial?: ProjectMaterial; catalogMaterial?: MaterialCatalog | null; qualityDocument?: Document | null }>> {
    const usages = await db
      .select()
      .from(actMaterialUsages)
      .where(eq(actMaterialUsages.actId, actId))
      .orderBy(asc(actMaterialUsages.orderIndex));

    const materialIds = Array.from(new Set(usages.map((u) => u.projectMaterialId)));
    const qualityDocIds = Array.from(new Set(usages.map((u) => u.qualityDocumentId).filter((v): v is any => v != null)));

    const materials =
      materialIds.length === 0
        ? []
        : await db
            .select({
              material: projectMaterials,
              catalog: materialsCatalog,
            })
            .from(projectMaterials)
            .leftJoin(materialsCatalog, eq(materialsCatalog.id, projectMaterials.catalogMaterialId))
            .where(inArray(projectMaterials.id, materialIds as any));

    const docs =
      qualityDocIds.length === 0
        ? []
        : await db.select().from(documents).where(and(inArray(documents.id, qualityDocIds as any), isNull(documents.deletedAt)));

    const materialById = new Map<number, { material: ProjectMaterial; catalog: MaterialCatalog | null }>();
    for (const row of materials) {
      const mat = (row as any).material as ProjectMaterial;
      const cat = (row as any).catalog as MaterialCatalog | null;
      materialById.set(Number(mat.id), { material: mat, catalog: cat });
    }

    const docById = new Map<number, Document>();
    for (const d of docs) docById.set(Number(d.id), d);

    return usages.map((u) => {
      const mat = materialById.get(Number(u.projectMaterialId));
      const qd = u.qualityDocumentId == null ? null : (docById.get(Number(u.qualityDocumentId)) ?? null);
      return {
        ...(u as any),
        projectMaterial: mat?.material,
        catalogMaterial: mat?.catalog ?? null,
        qualityDocument: qd,
      };
    });
  }

  async replaceActMaterialUsages(actId: number, items: Array<Omit<InsertActMaterialUsage, "actId">>): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(actMaterialUsages).where(eq(actMaterialUsages.actId, actId));
      if (items.length === 0) return;

      const values = items.map((it, idx) => ({
        ...(it as any),
        actId,
        orderIndex: (it as any).orderIndex ?? idx,
      }));
      await tx.insert(actMaterialUsages).values(values as any);
    });
  }

  async getTaskMaterials(
    taskId: number
  ): Promise<
    Array<
      TaskMaterial & {
        projectMaterial?: ProjectMaterial;
        catalogMaterial?: MaterialCatalog | null;
        batch?: MaterialBatch | null;
        qualityDocument?: Document | null;
      }
    >
  > {
    const rows = await db
      .select()
      .from(taskMaterials)
      .where(eq(taskMaterials.taskId, taskId))
      .orderBy(asc(taskMaterials.orderIndex));

    const materialIds = Array.from(new Set(rows.map((r) => r.projectMaterialId)));
    const batchIds = Array.from(new Set(rows.map((r) => r.batchId).filter((v): v is any => v != null)));
    const qualityDocIds = Array.from(new Set(rows.map((r) => r.qualityDocumentId).filter((v): v is any => v != null)));

    const materials =
      materialIds.length === 0
        ? []
        : await db
            .select({
              material: projectMaterials,
              catalog: materialsCatalog,
            })
            .from(projectMaterials)
            .leftJoin(materialsCatalog, eq(materialsCatalog.id, projectMaterials.catalogMaterialId))
            .where(inArray(projectMaterials.id, materialIds as any));

    const batches =
      batchIds.length === 0 ? [] : await db.select().from(materialBatches).where(inArray(materialBatches.id, batchIds as any));

    const docs =
      qualityDocIds.length === 0
        ? []
        : await db.select().from(documents).where(and(inArray(documents.id, qualityDocIds as any), isNull(documents.deletedAt)));

    const materialById = new Map<number, { material: ProjectMaterial; catalog: MaterialCatalog | null }>();
    for (const row of materials) {
      const mat = (row as any).material as ProjectMaterial;
      const cat = (row as any).catalog as MaterialCatalog | null;
      materialById.set(Number(mat.id), { material: mat, catalog: cat });
    }

    const batchById = new Map<number, MaterialBatch>();
    for (const b of batches) batchById.set(Number(b.id), b);

    const docById = new Map<number, Document>();
    for (const d of docs) docById.set(Number(d.id), d);

    return rows.map((r) => {
      const mat = materialById.get(Number(r.projectMaterialId));
      const batch = r.batchId == null ? null : (batchById.get(Number(r.batchId)) ?? null);
      const qd = r.qualityDocumentId == null ? null : (docById.get(Number(r.qualityDocumentId)) ?? null);
      return {
        ...(r as any),
        projectMaterial: mat?.material,
        catalogMaterial: mat?.catalog ?? null,
        batch,
        qualityDocument: qd,
      };
    });
  }

  async replaceTaskMaterials(taskId: number, items: Array<Omit<InsertTaskMaterial, "taskId">>): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(taskMaterials).where(eq(taskMaterials.taskId, taskId));
      if (items.length === 0) return;

      const values = items.map((it, idx) => ({
        ...(it as any),
        taskId,
        orderIndex: (it as any).orderIndex ?? idx,
      }));
      await tx.insert(taskMaterials).values(values as any);
    });
  }

  async createTaskMaterial(taskId: number, item: Omit<InsertTaskMaterial, "taskId">): Promise<TaskMaterial> {
    const orderIndex =
      (item as any).orderIndex != null
        ? Number((item as any).orderIndex)
        : (() => {
            // append to end
            return 0;
          })();

    // If orderIndex not provided, compute max(order_index)+1
    let finalOrderIndex = orderIndex;
    if ((item as any).orderIndex == null) {
      const [row] = await db
        .select({ max: sql<number>`COALESCE(MAX(${taskMaterials.orderIndex}), -1)` })
        .from(taskMaterials)
        .where(eq(taskMaterials.taskId, taskId));
      finalOrderIndex = Number((row as any)?.max ?? -1) + 1;
    }

    const [created] = await db
      .insert(taskMaterials)
      .values({
        ...(item as any),
        taskId,
        orderIndex: finalOrderIndex as any,
      })
      .returning();
    return created;
  }

  async deleteTaskMaterial(taskMaterialId: number): Promise<boolean> {
    const [existing] = await db.select({ id: taskMaterials.id }).from(taskMaterials).where(eq(taskMaterials.id, taskMaterialId));
    if (!existing) return false;
    await db.delete(taskMaterials).where(eq(taskMaterials.id, taskMaterialId));
    return true;
  }

  async getActDocAttachments(actId: number): Promise<Array<ActDocumentAttachment & { document?: Document | null }>> {
    const attachmentsRows = await db
      .select()
      .from(actDocumentAttachments)
      .where(eq(actDocumentAttachments.actId, actId))
      .orderBy(asc(actDocumentAttachments.orderIndex));

    const docIds = Array.from(new Set(attachmentsRows.map((a) => a.documentId)));
    const docs =
      docIds.length === 0
        ? []
        : await db.select().from(documents).where(and(inArray(documents.id, docIds as any), isNull(documents.deletedAt)));
    const docById = new Map<number, Document>();
    for (const d of docs) docById.set(Number(d.id), d);

    return attachmentsRows.map((a) => ({ ...(a as any), document: docById.get(Number(a.documentId)) ?? null }));
  }

  async replaceActDocAttachments(actId: number, items: Array<Omit<InsertActDocumentAttachment, "actId">>): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(actDocumentAttachments).where(eq(actDocumentAttachments.actId, actId));
      if (items.length === 0) return;

      // Dedupe by documentId (keep first occurrence, preserve order)
      const seen = new Set<number>();
      const deduped: Array<Omit<InsertActDocumentAttachment, "actId"> & { orderIndex: number }> = [];
      for (let i = 0; i < items.length; i++) {
        const docId = Number((items[i] as any).documentId);
        if (!Number.isFinite(docId)) continue;
        if (seen.has(docId)) continue;
        seen.add(docId);
        deduped.push({ ...(items[i] as any), orderIndex: (items[i] as any).orderIndex ?? i });
      }

      const values = deduped.map((it) => ({ ...(it as any), actId }));
      await tx.insert(actDocumentAttachments).values(values as any);
    });
  }

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

  async clearWorks(options?: { resetScheduleIfInUse?: boolean }): Promise<void> {
    await db.transaction(async (tx) => {
      // If any schedules use "works" as the source, clearing works would leave the schedule source selected
      // but with missing tasks and potentially inconsistent acts. Force explicit confirmation via option.
      const schedulesUsingWorks = await tx
        .select({ id: schedules.id })
        .from(schedules)
        .where(eq(schedules.sourceType, "works" as any));

      if (schedulesUsingWorks.length > 0 && !options?.resetScheduleIfInUse) {
        throw new Error("WORKS_IN_USE_BY_SCHEDULE");
      }

      if (schedulesUsingWorks.length > 0 && options?.resetScheduleIfInUse) {
        for (const s of schedulesUsingWorks) {
          const scheduleId = s.id;

          // 1) Find affected acts via tasks
          const tasks = await tx
            .select({ actNumber: scheduleTasks.actNumber })
            .from(scheduleTasks)
            .where(eq(scheduleTasks.scheduleId, scheduleId));

          const affectedActNumbers = Array.from(
            new Set(tasks.map((t) => t.actNumber).filter((n): n is number => n != null))
          );

          // 2) Clear worksData in affected acts
          if (affectedActNumbers.length > 0) {
            await tx
              .update(acts)
              .set({ worksData: [] as any })
              .where(inArray(acts.actNumber, affectedActNumbers));
          }

          // 3) Delete all tasks for this schedule
          await tx.delete(scheduleTasks).where(eq(scheduleTasks.scheduleId, scheduleId));
        }
      }

      // Finally, delete all works (ВОР справочник работ)
      await tx.delete(works);
    });
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

  // Estimates (Сметы / ЛСР)
  async getEstimates(): Promise<Estimate[]> {
    return await db.select().from(estimates).orderBy(desc(estimates.createdAt));
  }

  async getEstimate(id: number): Promise<Estimate | undefined> {
    const [e] = await db.select().from(estimates).where(eq(estimates.id, id));
    return e;
  }

  async getEstimateSections(estimateId: number): Promise<EstimateSection[]> {
    return await db
      .select()
      .from(estimateSections)
      .where(eq(estimateSections.estimateId, estimateId))
      .orderBy(asc(estimateSections.orderIndex));
  }

  async getEstimatePositions(estimateId: number): Promise<EstimatePosition[]> {
    return await db
      .select()
      .from(estimatePositions)
      .where(eq(estimatePositions.estimateId, estimateId))
      .orderBy(asc(estimatePositions.orderIndex));
  }

  async getPositionResources(positionIds: number[]): Promise<PositionResource[]> {
    if (positionIds.length === 0) return [];
    return await db
      .select()
      .from(positionResources)
      .where(inArray(positionResources.positionId, positionIds))
      .orderBy(asc(positionResources.orderIndex));
  }

  async getEstimateWithDetails(
    estimateId: number
  ): Promise<
    | {
        estimate: Estimate;
        sections: Array<
          EstimateSection & { positions: Array<EstimatePosition & { resources: PositionResource[] }> }
        >;
      }
    | undefined
  > {
    const estimate = await this.getEstimate(estimateId);
    if (!estimate) return undefined;

    const [sections, positions] = await Promise.all([
      this.getEstimateSections(estimateId),
      this.getEstimatePositions(estimateId),
    ]);

    const positionIds = positions.map((p) => p.id);
    const resources = await this.getPositionResources(positionIds);

    const resourcesByPositionId = new Map<number, PositionResource[]>();
    for (const r of resources) {
      const list = resourcesByPositionId.get(r.positionId) ?? [];
      list.push(r);
      resourcesByPositionId.set(r.positionId, list);
    }

    const positionsBySectionId = new Map<number | null, Array<EstimatePosition & { resources: PositionResource[] }>>();
    for (const p of positions) {
      const sid = (p.sectionId ?? null) as number | null;
      const list = positionsBySectionId.get(sid) ?? [];
      list.push({ ...p, resources: resourcesByPositionId.get(p.id) ?? [] });
      positionsBySectionId.set(sid, list);
    }

    const hydratedSections = sections.map((s) => ({
      ...s,
      positions: positionsBySectionId.get(s.id) ?? [],
    }));

    // Some files may have positions outside a "Раздел"
    const unsectioned = positionsBySectionId.get(null);
    if (unsectioned && unsectioned.length > 0) {
      hydratedSections.unshift({
        id: 0,
        estimateId,
        number: "0",
        title: "Без раздела",
        orderIndex: -1,
        positions: unsectioned,
      } as any);
    }

    return { estimate, sections: hydratedSections };
  }

  async importEstimate(payload: {
    estimate: InsertEstimate;
    sections: Array<Omit<InsertEstimateSection, "estimateId">>;
    positions: Array<Omit<InsertEstimatePosition, "estimateId" | "sectionId"> & { sectionNumber?: string | null }>;
    resources: Array<Omit<InsertPositionResource, "positionId"> & { positionLineNo: string }>;
  }): Promise<{ estimateId: number; sections: number; positions: number; resources: number }> {
    const { estimate, sections, positions, resources } = payload;

    return await db.transaction(async (tx) => {
      const [createdEstimate] = await tx.insert(estimates).values(estimate).returning();

      const sectionIdByNumber = new Map<string, number>();
      let sectionCount = 0;
      for (const s of sections) {
        const [created] = await tx
          .insert(estimateSections)
          .values({ ...s, estimateId: createdEstimate.id })
          .returning();
        sectionIdByNumber.set(created.number, created.id);
        sectionCount++;
      }

      const positionIdByLineNo = new Map<string, number>();
      let positionCount = 0;
      for (const p of positions) {
        const sectionId =
          p.sectionNumber && sectionIdByNumber.has(p.sectionNumber) ? sectionIdByNumber.get(p.sectionNumber)! : null;

        const values: InsertEstimatePosition = {
          ...p,
          estimateId: createdEstimate.id,
          sectionId,
        } as any;
        delete (values as any).sectionNumber;

        const [created] = await tx.insert(estimatePositions).values(values).returning();
        positionIdByLineNo.set(created.lineNo, created.id);
        positionCount++;
      }

      let resourceCount = 0;
      for (const r of resources) {
        const positionId = positionIdByLineNo.get(r.positionLineNo);
        if (!positionId) continue;

        const values: InsertPositionResource = {
          ...r,
          positionId,
        } as any;
        delete (values as any).positionLineNo;

        await tx.insert(positionResources).values(values);
        resourceCount++;
      }

      return {
        estimateId: createdEstimate.id,
        sections: sectionCount,
        positions: positionCount,
        resources: resourceCount,
      };
    });
  }

  async deleteEstimate(id: number, options?: { resetScheduleIfInUse?: boolean }): Promise<boolean> {
    return await db.transaction(async (tx) => {
      const [existing] = await tx.select({ id: estimates.id }).from(estimates).where(eq(estimates.id, id));
      if (!existing) return false;

      // Prevent deleting an estimate that is used as a schedule source.
      // Otherwise FK ON DELETE SET NULL will violate CHECK constraint:
      // schedules.source_type='estimate' => schedules.estimate_id must be NOT NULL.
      const schedulesUsing = await tx
        .select({ id: schedules.id, sourceType: schedules.sourceType })
        .from(schedules)
        .where(eq(schedules.estimateId, id));
      if (schedulesUsing.length > 0 && !options?.resetScheduleIfInUse) {
        throw new Error("ESTIMATE_IN_USE_BY_SCHEDULE");
      }

      // If explicitly requested, reset any schedules that use this estimate
      // (same effect as changing source to "works": delete tasks and clear worksData in affected acts),
      // then proceed with deletion.
      if (schedulesUsing.length > 0 && options?.resetScheduleIfInUse) {
        for (const s of schedulesUsing) {
          const scheduleId = s.id;

          // 1) Find affected acts via tasks
          const tasks = await tx
            .select({ actNumber: scheduleTasks.actNumber })
            .from(scheduleTasks)
            .where(eq(scheduleTasks.scheduleId, scheduleId));

          const affectedActNumbers = Array.from(
            new Set(tasks.map((t) => t.actNumber).filter((n): n is number => n != null))
          );

          // 2) Clear worksData in affected acts
          if (affectedActNumbers.length > 0) {
            await tx
              .update(acts)
              .set({ worksData: [] as any })
              .where(inArray(acts.actNumber, affectedActNumbers));
          }

          // 3) Delete schedule tasks
          await tx.delete(scheduleTasks).where(eq(scheduleTasks.scheduleId, scheduleId));

          // 4) Reset schedule source to works
          await tx
            .update(schedules)
            .set({ sourceType: "works" as any, estimateId: null })
            .where(eq(schedules.id, scheduleId));
        }
      }

      const positions = await tx
        .select({ id: estimatePositions.id })
        .from(estimatePositions)
        .where(eq(estimatePositions.estimateId, id));
      const positionIds = positions.map((p) => p.id);

      if (positionIds.length > 0) {
        await tx.delete(positionResources).where(inArray(positionResources.positionId, positionIds));
      }
      await tx.delete(estimatePositions).where(eq(estimatePositions.estimateId, id));
      await tx.delete(estimateSections).where(eq(estimateSections.estimateId, id));
      await tx.delete(estimates).where(eq(estimates.id, id));

      return true;
    });
  }

  async getMessages(userId?: string): Promise<Message[]> {
    if (userId) {
      return await db.select().from(messages)
        .where(eq(messages.userId, userId))
        .orderBy(desc(messages.createdAt));
    }
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

  async patchMessage(id: number, data: { messageRaw?: string; normalizedData?: any }): Promise<Message | undefined> {
    const existing = await this.getMessage(id);
    if (!existing) return undefined;

    const updates: any = {};
    
    if (data.messageRaw !== undefined) {
      updates.messageRaw = data.messageRaw;
    }
    
    if (data.normalizedData !== undefined) {
      // Merge with existing normalizedData
      updates.normalizedData = {
        ...(existing.normalizedData || {}),
        ...data.normalizedData,
      };
    }

    if (Object.keys(updates).length === 0) {
      return existing;
    }

    const [updated] = await db.update(messages)
      .set(updates)
      .where(eq(messages.id, id))
      .returning();
    
    return updated;
  }

  async clearMessages(userId?: string): Promise<void> {
    if (userId) {
      await db.delete(messages).where(eq(messages.userId, userId));
    } else {
      await db.delete(messages);
    }
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
    const defaultObject = await this.getOrCreateDefaultObject();
    const objectId = (act as any).objectId ?? defaultObject.id;
    const [newAct] = await db
      .insert(acts)
      .values({ ...(act as any), objectId })
      .returning();
    return newAct;
  }

  async upsertActByNumber(data: {
    actNumber: number;
    actTemplateId?: number | null;
    dateStart: string | null;
    dateEnd: string | null;
    location?: string | null;
    status?: string | null;
    worksData?: Array<{ workId: number; quantity: number; description: string }> | null;
    projectDrawingsAgg?: string | null;
    normativeRefsAgg?: string | null;
    executiveSchemesAgg?: Array<{ title: string; fileUrl?: string }> | null;
  }): Promise<{ act: Act; created: boolean }> {
    const existing = await this.getActByNumber(data.actNumber);
    const defaultObject = await this.getOrCreateDefaultObject();

    if (existing) {
      const nextStatus =
        existing.status === "signed"
          ? existing.status
          : ((data.status ?? existing.status ?? null) as any);
      const [updated] = await db
        .update(acts)
        .set({
          // Backfill objectId for legacy/older records if missing.
          objectId: ((existing as any).objectId ?? defaultObject.id) as any,
          actNumber: data.actNumber as any,
          actTemplateId: (data.actTemplateId ?? (existing as any).actTemplateId ?? null) as any,
          dateStart: (data.dateStart ?? null) as any,
          dateEnd: (data.dateEnd ?? null) as any,
          location: (data.location ?? existing.location ?? null) as any,
          status: nextStatus,
          worksData: (data.worksData ?? existing.worksData ?? null) as any,
          projectDrawingsAgg: (data.projectDrawingsAgg ?? (existing as any).projectDrawingsAgg ?? null) as any,
          normativeRefsAgg: (data.normativeRefsAgg ?? (existing as any).normativeRefsAgg ?? null) as any,
          executiveSchemesAgg: (data.executiveSchemesAgg ?? (existing as any).executiveSchemesAgg ?? null) as any,
        })
        .where(eq(acts.id, existing.id))
        .returning();
      return { act: updated, created: false };
    }

    const [created] = await db
      .insert(acts)
      .values({
        objectId: defaultObject.id,
        actNumber: data.actNumber as any,
        actTemplateId: (data.actTemplateId ?? null) as any,
        dateStart: (data.dateStart ?? null) as any,
        dateEnd: (data.dateEnd ?? null) as any,
        location: (data.location ?? null) as any,
        status: (data.status ?? "draft") as any,
        worksData: (data.worksData ?? []) as any,
        projectDrawingsAgg: (data.projectDrawingsAgg ?? null) as any,
        normativeRefsAgg: (data.normativeRefsAgg ?? null) as any,
        executiveSchemesAgg: (data.executiveSchemesAgg ?? null) as any,
      })
      .returning();

    return { act: created, created: true };
  }

  async deleteActByNumber(actNumber: number): Promise<boolean> {
    const [existing] = await db.select({ id: acts.id }).from(acts).where(eq(acts.actNumber, actNumber as any));
    if (!existing) return false;
    await db.delete(acts).where(eq(acts.id, existing.id));
    return true;
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

  async getScheduleTask(id: number): Promise<ScheduleTask | undefined> {
    const [task] = await db.select().from(scheduleTasks).where(eq(scheduleTasks.id, id));
    return task;
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
        .select({ id: scheduleTasks.id, workId: scheduleTasks.workId, orderIndex: scheduleTasks.orderIndex, quantity: scheduleTasks.quantity })
        .from(scheduleTasks)
        .where(eq(scheduleTasks.scheduleId, scheduleId));

      const existingWorkIds = new Set(existingTasks.map((t) => t.workId));
      const maxOrderIndex =
        existingTasks.length === 0
          ? -1
          : Math.max(...existingTasks.map((t) => Number(t.orderIndex ?? 0)));

      // Build lookup: workId → task id (for backfill of existing tasks with quantity=NULL)
      const existingTaskByWorkId = new Map(existingTasks.map((t) => [t.workId, t]));

      let nextOrderIndex = maxOrderIndex + 1;
      let created = 0;
      let skipped = 0;

      for (const w of worksList) {
        const rawQty = (w as any).quantityTotal;
        const qty = rawQty == null ? null : Number(rawQty);
        const qtyStr = qty != null && Number.isFinite(qty) ? String(qty) : null;

        if (existingWorkIds.has(w.id)) {
          // Backfill quantity/unit for existing tasks that were created without them
          const existing = existingTaskByWorkId.get(w.id);
          if (existing && existing.quantity == null && qtyStr != null) {
            await tx
              .update(scheduleTasks)
              .set({ quantity: qtyStr as any, unit: w.unit ?? null })
              .where(eq(scheduleTasks.id, existing.id));
          }
          skipped++;
          continue;
        }

        await tx.insert(scheduleTasks).values({
          scheduleId,
          workId: w.id,
          titleOverride: null,
          quantity: qtyStr as any,
          unit: w.unit ?? null,
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
    patch: Partial<
      Pick<
        ScheduleTask,
        | "titleOverride"
        | "startDate"
        | "durationDays"
        | "orderIndex"
        | "actNumber"
        | "actTemplateId"
        | "projectDrawings"
        | "normativeRefs"
        | "executiveSchemes"
        | "quantity"
        | "unit"
      >
    >
  ): Promise<ScheduleTask | undefined> {
    const updateData: Partial<typeof scheduleTasks.$inferInsert> = {};

    if ("titleOverride" in patch) updateData.titleOverride = patch.titleOverride ?? null;
    if (patch.startDate !== undefined) updateData.startDate = patch.startDate as any;
    if (patch.durationDays !== undefined) updateData.durationDays = patch.durationDays as any;
    if (patch.orderIndex !== undefined) updateData.orderIndex = patch.orderIndex as any;
    if ("actNumber" in patch) updateData.actNumber = (patch.actNumber ?? null) as any;
    if ("actTemplateId" in patch) updateData.actTemplateId = (patch.actTemplateId ?? null) as any;
    if ("projectDrawings" in patch) updateData.projectDrawings = patch.projectDrawings ?? null;
    if ("normativeRefs" in patch) updateData.normativeRefs = patch.normativeRefs ?? null;
    if ("executiveSchemes" in patch) updateData.executiveSchemes = (patch.executiveSchemes ?? null) as any;
    if ("quantity" in patch) updateData.quantity = (patch.quantity != null ? String(patch.quantity) : null) as any;
    if ("unit" in patch) updateData.unit = patch.unit ?? null;

    if (Object.keys(updateData).length === 0) return undefined;

    const [updated] = await db.update(scheduleTasks).set(updateData).where(eq(scheduleTasks.id, id)).returning();
    return updated;
  }

  async getTasksByActNumber(scheduleId: number, actNumber: number): Promise<ScheduleTask[]> {
    return await db
      .select()
      .from(scheduleTasks)
      .where(and(eq(scheduleTasks.scheduleId, scheduleId), eq(scheduleTasks.actNumber, actNumber as any)))
      .orderBy(asc(scheduleTasks.orderIndex));
  }

  async updateActTemplateForActNumber(params: {
    scheduleId: number;
    actNumber: number;
    actTemplateId: number | null;
  }): Promise<number> {
    const res = await db
      .update(scheduleTasks)
      .set({ actTemplateId: (params.actTemplateId ?? null) as any })
      .where(and(eq(scheduleTasks.scheduleId, params.scheduleId), eq(scheduleTasks.actNumber, params.actNumber as any)))
      .returning({ id: scheduleTasks.id });
    return res.length;
  }

  // Schedule source management (works vs estimate)
  async getScheduleSourceInfo(scheduleId: number): Promise<{
    sourceType: 'works' | 'estimate';
    estimateId: number | null;
    estimateName: string | null;
    tasksCount: number;
    affectedActNumbers: number[];
  } | undefined> {
    const [schedule] = await db.select().from(schedules).where(eq(schedules.id, scheduleId));
    if (!schedule) return undefined;

    const tasks = await db
      .select({ actNumber: scheduleTasks.actNumber })
      .from(scheduleTasks)
      .where(eq(scheduleTasks.scheduleId, scheduleId));

    const affectedActNumbers = Array.from(new Set(
      tasks.map(t => t.actNumber).filter((n): n is number => n != null)
    ));

    let estimateName: string | null = null;
    if (schedule.estimateId) {
      const [estimate] = await db
        .select({ name: estimates.name })
        .from(estimates)
        .where(eq(estimates.id, schedule.estimateId));
      estimateName = estimate?.name ?? null;
    }

    return {
      sourceType: (schedule.sourceType as 'works' | 'estimate') ?? 'works',
      estimateId: schedule.estimateId,
      estimateName,
      tasksCount: tasks.length,
      affectedActNumbers,
    };
  }

  async changeScheduleSource(params: {
    scheduleId: number;
    newSourceType: 'works' | 'estimate';
    newEstimateId?: number;
  }): Promise<void> {
    const { scheduleId, newSourceType, newEstimateId } = params;

    await db.transaction(async (tx) => {
      // 1. Get affected act numbers
      const tasks = await tx
        .select({ actNumber: scheduleTasks.actNumber })
        .from(scheduleTasks)
        .where(eq(scheduleTasks.scheduleId, scheduleId));

      const affectedActNumbers = Array.from(new Set(
        tasks.map(t => t.actNumber).filter((n): n is number => n != null)
      ));

      // 2. Clear worksData in affected acts
      if (affectedActNumbers.length > 0) {
        await tx
          .update(acts)
          .set({ worksData: [] as any })
          .where(inArray(acts.actNumber, affectedActNumbers));
      }

      // 3. Delete all tasks
      await tx
        .delete(scheduleTasks)
        .where(eq(scheduleTasks.scheduleId, scheduleId));

      // 4. Update schedule source
      await tx
        .update(schedules)
        .set({
          sourceType: newSourceType,
          estimateId: newSourceType === 'estimate' ? newEstimateId : null,
        })
        .where(eq(schedules.id, scheduleId));
    });
  }

  async bootstrapScheduleTasksFromEstimate(params: {
    scheduleId: number;
    estimateId: number;
    positionIds?: number[];
    defaultStartDate: string;
    defaultDurationDays: number;
  }): Promise<{ scheduleId: number; created: number; skipped: number }> {
    const { scheduleId, estimateId, positionIds, defaultStartDate, defaultDurationDays } = params;

    return await db.transaction(async (tx) => {
      // Check schedule and source match
      const [schedule] = await tx.select().from(schedules).where(eq(schedules.id, scheduleId));
      if (!schedule) {
        throw new Error("SCHEDULE_NOT_FOUND");
      }
      if (schedule.sourceType !== 'estimate' || schedule.estimateId !== estimateId) {
        throw new Error("SCHEDULE_SOURCE_MISMATCH");
      }

      // Get positions from estimate
      let allPositions =
        positionIds && positionIds.length > 0
          ? await tx
              .select()
              .from(estimatePositions)
              .where(and(
                eq(estimatePositions.estimateId, estimateId),
                inArray(estimatePositions.id, positionIds)
              ))
              .orderBy(estimatePositions.orderIndex)
          : await tx
              .select()
              .from(estimatePositions)
              .where(eq(estimatePositions.estimateId, estimateId))
              .orderBy(estimatePositions.orderIndex);

      // Filter: only create tasks for "main" positions (ГЭСН/ФЕР/ТЕР)
      const mainPositions = allPositions.filter(p => isMainEstimatePosition(p));

      // Get existing tasks (idempotency)
      const existingTasks = await tx
        .select({ id: scheduleTasks.id, estimatePositionId: scheduleTasks.estimatePositionId, orderIndex: scheduleTasks.orderIndex, quantity: scheduleTasks.quantity })
        .from(scheduleTasks)
        .where(eq(scheduleTasks.scheduleId, scheduleId));

      const existingPositionIds = new Set(
        existingTasks.map(t => t.estimatePositionId).filter((id): id is number => id != null)
      );
      const maxOrderIndex =
        existingTasks.length === 0
          ? -1
          : Math.max(...existingTasks.map(t => Number(t.orderIndex ?? 0)));

      // Build lookup: estimatePositionId → task (for backfill of tasks with quantity=NULL)
      const existingTaskByPositionId = new Map(
        existingTasks
          .filter(t => t.estimatePositionId != null)
          .map(t => [t.estimatePositionId!, t])
      );

      let nextOrderIndex = maxOrderIndex + 1;
      let created = 0;
      let skipped = 0;

      for (const pos of mainPositions) {
        const rawQty = (pos as any).quantity;
        const qty = rawQty == null ? null : Number(rawQty);
        const qtyStr = qty != null && Number.isFinite(qty) ? String(qty) : null;
        const unit = (pos as any).unit ?? null;

        if (existingPositionIds.has(pos.id)) {
          // Backfill quantity/unit for existing tasks that were created without them
          const existing = existingTaskByPositionId.get(pos.id);
          if (existing && existing.quantity == null && qtyStr != null) {
            await tx
              .update(scheduleTasks)
              .set({ quantity: qtyStr as any, unit })
              .where(eq(scheduleTasks.id, existing.id));
          }
          skipped++;
          continue;
        }

        await tx.insert(scheduleTasks).values({
          scheduleId,
          workId: null,
          estimatePositionId: pos.id,
          titleOverride: null,
          quantity: qtyStr as any,
          unit,
          startDate: defaultStartDate,
          durationDays: defaultDurationDays,
          orderIndex: nextOrderIndex++,
        });
        created++;
        existingPositionIds.add(pos.id);
      }

      return { scheduleId, created, skipped };
    });
  }

  async getEstimatePositionsByIds(ids: number[]): Promise<EstimatePosition[]> {
    if (ids.length === 0) return [];
    return await db
      .select()
      .from(estimatePositions)
      .where(inArray(estimatePositions.id, ids));
  }

  // === Estimate subrows ↔ project materials (quality statuses on /schedule) ===

  async listEstimatePositionMaterialLinks(objectId: number, estimateId: number): Promise<EstimatePositionMaterialLink[]> {
    return (await db
      .select()
      .from(estimatePositionMaterialLinks)
      .where(and(eq(estimatePositionMaterialLinks.objectId, objectId), eq(estimatePositionMaterialLinks.estimateId, estimateId)))
      .orderBy(desc(estimatePositionMaterialLinks.updatedAt))) as any;
  }

  async upsertEstimatePositionMaterialLink(
    objectId: number,
    data: Omit<InsertEstimatePositionMaterialLink, "objectId">
  ): Promise<EstimatePositionMaterialLink> {
    const values: InsertEstimatePositionMaterialLink = {
      ...(data as any),
      objectId,
      source: (data as any).source ?? "manual",
    };

    const [saved] = await db
      .insert(estimatePositionMaterialLinks)
      .values(values as any)
      .onConflictDoUpdate({
        target: [estimatePositionMaterialLinks.objectId, estimatePositionMaterialLinks.estimatePositionId],
        set: {
          estimateId: (values as any).estimateId,
          projectMaterialId: (values as any).projectMaterialId,
          batchId: (values as any).batchId ?? null,
          source: (values as any).source ?? "manual",
        } as any,
      })
      .returning();

    return saved as any;
  }

  async deleteEstimatePositionMaterialLink(objectId: number, estimatePositionId: number): Promise<boolean> {
    const [existing] = await db
      .select({ id: estimatePositionMaterialLinks.id })
      .from(estimatePositionMaterialLinks)
      .where(
        and(
          eq(estimatePositionMaterialLinks.objectId, objectId),
          eq(estimatePositionMaterialLinks.estimatePositionId, estimatePositionId)
        )
      );
    if (!existing) return false;

    await db
      .delete(estimatePositionMaterialLinks)
      .where(
        and(
          eq(estimatePositionMaterialLinks.objectId, objectId),
          eq(estimatePositionMaterialLinks.estimatePositionId, estimatePositionId)
        )
      );
    return true;
  }

  async getEstimateSubrowStatuses(params: { objectId: number; estimateId: number }): Promise<
    Record<number, { status: "none" | "partial" | "ok"; reason?: string; projectMaterialId?: number; batchId?: number | null }>
  > {
    const { objectId, estimateId } = params;

    // We return statuses keyed by estimatePositionId.
    // For MVP we compute for all positions within an estimate and let UI pick subrows.
    const allPositions = await db
      .select({ id: estimatePositions.id })
      .from(estimatePositions)
      .where(eq(estimatePositions.estimateId, estimateId));
    const allIds = allPositions.map((p) => Number(p.id));

    // Compute aggregated doc stats per linked estimatePositionId (batched).
    const rows = await db
      .select({
        estimatePositionId: estimatePositionMaterialLinks.estimatePositionId,
        projectMaterialId: estimatePositionMaterialLinks.projectMaterialId,
        batchId: estimatePositionMaterialLinks.batchId,
        // IMPORTANT: COUNT() is bigint in Postgres and may be returned as string by driver.
        // Cast to int to keep numbers stable for API/logic.
        qualityDocsTotal: sql<number>`COALESCE(COUNT(DISTINCT CASE WHEN ${documentBindings.bindingRole}='quality' THEN ${documentBindings.id} END)::int, 0)`,
        qualityDocsUseInActs: sql<number>`COALESCE(COUNT(DISTINCT CASE WHEN ${documentBindings.bindingRole}='quality' AND ${documentBindings.useInActs}=TRUE THEN ${documentBindings.id} END)::int, 0)`,
        qualityDocsValid: sql<number>`COALESCE(COUNT(DISTINCT CASE WHEN ${documentBindings.bindingRole}='quality' AND (${documents.validTo} IS NULL OR ${documents.validTo} >= CURRENT_DATE) THEN ${documentBindings.id} END)::int, 0)`,
        qualityDocsValidUseInActs: sql<number>`COALESCE(COUNT(DISTINCT CASE WHEN ${documentBindings.bindingRole}='quality' AND ${documentBindings.useInActs}=TRUE AND (${documents.validTo} IS NULL OR ${documents.validTo} >= CURRENT_DATE) THEN ${documentBindings.id} END)::int, 0)`,
      })
      .from(estimatePositionMaterialLinks)
      .leftJoin(documentBindings, eq(documentBindings.projectMaterialId, estimatePositionMaterialLinks.projectMaterialId))
      .leftJoin(documents, and(eq(documents.id, documentBindings.documentId), isNull(documents.deletedAt)))
      .where(and(eq(estimatePositionMaterialLinks.objectId, objectId), eq(estimatePositionMaterialLinks.estimateId, estimateId)))
      .groupBy(
        estimatePositionMaterialLinks.estimatePositionId,
        estimatePositionMaterialLinks.projectMaterialId,
        estimatePositionMaterialLinks.batchId
      );

    const linkByEstimatePositionId = new Map<number, typeof rows[number]>();
    for (const r of rows as any[]) {
      linkByEstimatePositionId.set(Number(r.estimatePositionId), r as any);
    }

    const result: Record<number, { status: "none" | "partial" | "ok"; reason?: string; projectMaterialId?: number; batchId?: number | null }> = {};

    for (const id of allIds) {
      const r = linkByEstimatePositionId.get(id);
      if (!r) {
        result[id] = { status: "none", reason: "Не привязан материал" };
        continue;
      }

      const total = Number((r as any).qualityDocsTotal ?? 0);
      const useInActs = Number((r as any).qualityDocsUseInActs ?? 0);
      const valid = Number((r as any).qualityDocsValid ?? 0);
      const validUseInActs = Number((r as any).qualityDocsValidUseInActs ?? 0);

      const projectMaterialId = Number((r as any).projectMaterialId);
      const batchId = (r as any).batchId == null ? null : Number((r as any).batchId);

      if (total === 0) {
        result[id] = { status: "none", reason: "Нет документов качества", projectMaterialId, batchId };
        continue;
      }

      if (validUseInActs > 0) {
        result[id] = { status: "ok", projectMaterialId, batchId };
        continue;
      }

      // Documents exist, but not a valid one usable in acts.
      let reason = "Документы качества есть, но нет валидных для актов";
      if (valid === 0) {
        reason = "Документы качества есть, но все просрочены";
      } else if (useInActs === 0) {
        reason = "Документы качества есть, но они выключены для актов";
      }

      result[id] = { status: "partial", reason, projectMaterialId, batchId };
    }

    return result;
  }
}

export const storage = new DatabaseStorage();
