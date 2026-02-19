import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import {
  buildActDataFromSourceData,
  buildAttachmentsText,
  buildP3MaterialsText,
  generateAosrPdf,
  loadTemplateCatalog,
  type ActData,
} from "./pdfGenerator";
import * as fs from "fs";
import * as path from "path";

function addDaysISO(dateStr: string, days: number): string {
  // Expect YYYY-MM-DD. Work in UTC to avoid timezone shifts.
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function eachDayInRange(start: string, end: string): string[] {
  const days: string[] = [];
  let current = start;
  while (current <= end) {
    days.push(current);
    current = addDaysISO(current, 1);
  }
  return days;
}

// OpenAI is optional for local/dev runs. Only initialize when credentials exist.
let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return openaiClient;
}

async function normalizeWorkMessage(messageRaw: string) {
  const openai = getOpenAIClient();
  if (!openai) {
    throw new Error("OpenAI API key is not configured (AI_INTEGRATIONS_OPENAI_API_KEY).");
  }
  const works = await storage.getWorks();
  const worksContext = works
    .map((w) => `${w.code}: ${w.description} (${w.unit})`)
    .join("\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a construction assistant. Extract data from the worker's message.
Available Works (BoQ):
${worksContext}

Return JSON with:
- workCode (best match from BoQ)
- quantity (number)
- date (YYYY-MM-DD, assume current year if not specified)
- location (string)

If no work matches, set workCode to null.`,
      },
      { role: "user", content: messageRaw },
    ],
    response_format: { type: "json_object" },
  });

  return JSON.parse(completion.choices[0].message.content || "{}");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Object (MVP: single current object)
  app.get(api.object.current.path, async (_req, res) => {
    const obj = await storage.getOrCreateDefaultObject();
    return res.status(200).json(obj);
  });

  app.patch(api.object.patchCurrent.path, async (req, res) => {
    try {
      const patch = api.object.patchCurrent.input.parse(req.body);
      const obj = await storage.getOrCreateDefaultObject();
      const updated = await storage.updateObject(obj.id, patch);
      return res.status(200).json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Object patch failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get(api.object.getSourceData.path, async (_req, res) => {
    try {
      const obj = await storage.getOrCreateDefaultObject();
      const data = await storage.getObjectSourceData(obj.id);
      return res.status(200).json(data);
    } catch (err) {
      if (err instanceof Error && err.message === "OBJECT_NOT_FOUND") {
        return res.status(404).json({ message: "Object not found" });
      }
      console.error("Get source-data failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.put(api.object.putSourceData.path, async (req, res) => {
    try {
      const input = api.object.putSourceData.input.parse(req.body);
      const obj = await storage.getOrCreateDefaultObject();
      const saved = await storage.saveObjectSourceData(obj.id, input);
      return res.status(200).json(saved);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      if (err instanceof Error && err.message === "OBJECT_NOT_FOUND") {
        return res.status(404).json({ message: "Object not found" });
      }
      console.error("Put source-data failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Materials & Documents (Source Data module)
  app.get(api.materialsCatalog.search.path, async (req, res) => {
    try {
      const query = typeof req.query.query === "string" ? req.query.query : "";
      const list = await storage.searchMaterialsCatalog(query);
      return res.status(200).json(list);
    } catch (err) {
      console.error("Materials catalog search failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.materialsCatalog.create.path, async (req, res) => {
    try {
      const input = api.materialsCatalog.create.input.parse(req.body);
      const created = await storage.createMaterialCatalog(input as any);
      return res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Materials catalog create failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get(api.projectMaterials.list.path, async (req, res) => {
    const objectId = Number(req.params.objectId);
    if (!Number.isFinite(objectId) || objectId <= 0) {
      return res.status(400).json({ message: "Invalid objectId" });
    }
    try {
      const list = await storage.listProjectMaterials(objectId);
      return res.status(200).json(list);
    } catch (err) {
      console.error("Project materials list failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.projectMaterials.create.path, async (req, res) => {
    const objectId = Number(req.params.objectId);
    if (!Number.isFinite(objectId) || objectId <= 0) {
      return res.status(400).json({ message: "Invalid objectId" });
    }
    try {
      const input = api.projectMaterials.create.input.parse(req.body);
      const created = await storage.createProjectMaterial(objectId, {
        catalogMaterialId: (input as any).catalogMaterialId ?? null,
        nameOverride: (input as any).nameOverride ?? null,
        baseUnitOverride: (input as any).baseUnitOverride ?? null,
        paramsOverride: (input as any).paramsOverride ?? {},
      } as any);
      return res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Project materials create failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get(api.projectMaterials.get.path, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid id" });
    }
    try {
      const data = await storage.getProjectMaterial(id);
      if (!data) return res.status(404).json({ message: "Not found" });
      return res.status(200).json(data);
    } catch (err) {
      console.error("Project material get failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch(api.projectMaterials.patch.path, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid id" });
    }
    try {
      const patch = api.projectMaterials.patch.input.parse(req.body);
      const updated = await storage.updateProjectMaterial(id, patch as any);
      if (!updated) return res.status(404).json({ message: "Not found" });
      return res.status(200).json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Project material patch failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.projectMaterials.saveToCatalog.path, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid id" });
    }
    try {
      api.projectMaterials.saveToCatalog.input?.parse(req.body ?? {});
      const created = await storage.saveProjectMaterialToCatalog(id);
      return res.status(200).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      if (err instanceof Error && err.message === "PROJECT_MATERIAL_NOT_FOUND") {
        return res.status(404).json({ message: "Not found" });
      }
      if (err instanceof Error && err.message === "NAME_OVERRIDE_REQUIRED") {
        return res.status(400).json({ message: "nameOverride is required for local materials" });
      }
      console.error("Save project material to catalog failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.materialBatches.create.path, async (req, res) => {
    const projectMaterialId = Number(req.params.id);
    if (!Number.isFinite(projectMaterialId) || projectMaterialId <= 0) {
      return res.status(400).json({ message: "Invalid project material id" });
    }
    try {
      const input = api.materialBatches.create.input.parse(req.body);
      const created = await storage.createBatch(projectMaterialId, input as any);
      return res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      if (err instanceof Error && err.message === "PROJECT_MATERIAL_NOT_FOUND") {
        return res.status(404).json({ message: "Not found" });
      }
      console.error("Create batch failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch(api.materialBatches.patch.path, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid id" });
    }
    try {
      const patch = api.materialBatches.patch.input.parse(req.body);
      const updated = await storage.updateBatch(id, patch as any);
      if (!updated) return res.status(404).json({ message: "Not found" });
      return res.status(200).json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Batch patch failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete(api.materialBatches.delete.path, async (req, res) => {
    // Dev-only destructive endpoint
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ message: "Not found" });
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid id" });
    }
    try {
      const ok = await storage.deleteBatch(id);
      if (!ok) return res.status(404).json({ message: "Not found" });
      return res.status(204).send();
    } catch (err) {
      console.error("Delete batch failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get(api.documents.list.path, async (req, res) => {
    try {
      const query = typeof req.query.query === "string" ? req.query.query : undefined;
      const docType = typeof req.query.docType === "string" ? req.query.docType : undefined;
      const scope = typeof req.query.scope === "string" ? req.query.scope : undefined;
      const list = await storage.searchDocuments({ query, docType, scope });
      return res.status(200).json(list);
    } catch (err) {
      console.error("Documents list failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.documents.create.path, async (req, res) => {
    try {
      const input = api.documents.create.input.parse(req.body);
      const created = await storage.createDocument(input as any);
      return res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Documents create failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.documentBindings.create.path, async (req, res) => {
    try {
      const input = api.documentBindings.create.input.parse(req.body);
      const created = await storage.createBinding(input as any);
      return res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Document binding create failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch(api.documentBindings.patch.path, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid id" });
    }
    try {
      const patch = api.documentBindings.patch.input.parse(req.body);
      const updated = await storage.updateBinding(id, patch as any);
      if (!updated) return res.status(404).json({ message: "Not found" });
      return res.status(200).json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Document binding patch failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete(api.documentBindings.delete.path, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid id" });
    }
    try {
      const ok = await storage.deleteBinding(id);
      if (!ok) return res.status(404).json({ message: "Not found" });
      return res.status(204).send();
    } catch (err) {
      console.error("Delete document binding failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get(api.actMaterialUsages.list.path, async (req, res) => {
    const actId = Number(req.params.id);
    if (!Number.isFinite(actId) || actId <= 0) {
      return res.status(400).json({ message: "Invalid act id" });
    }
    try {
      const items = await storage.getActMaterialUsages(actId);
      return res.status(200).json(items);
    } catch (err) {
      console.error("Act material usages list failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.put(api.actMaterialUsages.replace.path, async (req, res) => {
    const actId = Number(req.params.id);
    if (!Number.isFinite(actId) || actId <= 0) {
      return res.status(400).json({ message: "Invalid act id" });
    }
    try {
      const input = api.actMaterialUsages.replace.input.parse(req.body);
      await storage.replaceActMaterialUsages(actId, (input as any).items ?? []);
      const items = await storage.getActMaterialUsages(actId);
      return res.status(200).json(items);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Act material usages replace failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get(api.actDocumentAttachments.list.path, async (req, res) => {
    const actId = Number(req.params.id);
    if (!Number.isFinite(actId) || actId <= 0) {
      return res.status(400).json({ message: "Invalid act id" });
    }
    try {
      const items = await storage.getActDocAttachments(actId);
      return res.status(200).json(items);
    } catch (err) {
      console.error("Act document attachments list failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.put(api.actDocumentAttachments.replace.path, async (req, res) => {
    const actId = Number(req.params.id);
    if (!Number.isFinite(actId) || actId <= 0) {
      return res.status(400).json({ message: "Invalid act id" });
    }
    try {
      const input = api.actDocumentAttachments.replace.input.parse(req.body);
      await storage.replaceActDocAttachments(actId, (input as any).items ?? []);
      const items = await storage.getActDocAttachments(actId);
      return res.status(200).json(items);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Act document attachments replace failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Works (BoQ)
  app.get(api.works.list.path, async (req, res) => {
    const works = await storage.getWorks();
    res.json(works);
  });

  // Estimates (Сметы / ЛСР)
  app.get(api.estimates.list.path, async (_req, res) => {
    const list = await storage.getEstimates();
    return res.status(200).json(list);
  });

  app.get(api.estimates.get.path, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const data = await storage.getEstimateWithDetails(id);
    if (!data) {
      return res.status(404).json({ message: "Not found" });
    }

    return res.status(200).json(data);
  });

  app.post(api.estimates.import.path, async (req, res) => {
    try {
      const input = api.estimates.import.input.parse(req.body);
      const result = await storage.importEstimate(input as any);
      return res.status(200).json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Estimates import failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete(api.estimates.delete.path, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const resetScheduleRaw = (req.query as any)?.resetSchedule;
    const resetSchedule =
      resetScheduleRaw === "1" || resetScheduleRaw === "true";

    try {
      const ok = await storage.deleteEstimate(id, { resetScheduleIfInUse: resetSchedule });
      if (!ok) return res.status(404).json({ message: "Not found" });
      return res.status(204).send();
    } catch (err) {
      if (err instanceof Error && err.message === "ESTIMATE_IN_USE_BY_SCHEDULE") {
        return res.status(409).json({
          message:
            "Нельзя удалить смету: она используется как источник графика работ. Сначала смените источник графика (на ВОР) или очистите/пересоздайте задачи графика.",
        });
      }
      console.error("Delete estimate failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Works: safe bulk import (no destructive behavior by default)
  app.post(api.works.import.path, async (req, res) => {
    try {
      const input = api.works.import.input.parse(req.body);
      const mode = input.mode ?? "merge";

      // De-duplicate by code (last wins) and trim codes
      const map = new Map<string, (typeof input.items)[number]>();
      for (const item of input.items) {
        const code = String(item.code || "").trim();
        if (!code) continue;
        map.set(code, { ...item, code });
      }

      const items = Array.from(map.values());
      const result = await storage.importWorks(items, mode);

      return res.status(200).json({
        mode,
        received: input.items.length,
        created: result.created,
        updated: result.updated,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Works import failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete("/api/works", async (req, res) => {
    const resetScheduleRaw = (req.query as any)?.resetSchedule;
    const resetSchedule = resetScheduleRaw === "1" || resetScheduleRaw === "true";

    // Safety: keep destructive clear-works blocked in production unless explicitly confirmed via query flag.
    if (process.env.NODE_ENV === "production" && !resetSchedule) {
      return res.status(404).json({ message: "Not found" });
    }

    try {
      console.log("Clearing all works from database...");
      await storage.clearWorks({ resetScheduleIfInUse: resetSchedule });
      console.log("Works cleared successfully");
      return res.status(204).send();
    } catch (err) {
      if (err instanceof Error && err.message === "WORKS_IN_USE_BY_SCHEDULE") {
        return res.status(409).json({
          message:
            "Нельзя очистить ВОР: он используется как источник графика работ. Подтвердите очистку со сбросом графика/актов.",
        });
      }
      console.error("Error clearing works:", err);
      return res.status(500).json({ message: "Failed to clear works" });
    }
  });

  app.post(api.works.create.path, async (req, res) => {
    try {
      const input = api.works.create.input.parse(req.body);
      const work = await storage.createWork(input);
      res.status(201).json(work);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Messages
  app.get(api.messages.list.path, async (req, res) => {
    const messages = await storage.getMessages();
    res.json(messages);
  });

  app.post(api.messages.create.path, async (req, res) => {
    try {
      const input = api.messages.create.input.parse(req.body);
      const message = await storage.createMessage({
        userId: input.userId,
        messageRaw: input.messageRaw,
      });

      // Trigger normalization in background (or await if fast enough)
      // For MVP, we'll await it to show immediate result
      try {
        const normalized = await normalizeWorkMessage(input.messageRaw);
        await storage.updateMessageNormalized(message.id, normalized);
        
        // Return the updated message
        const updated = await storage.getMessage(message.id);
        res.status(201).json(updated);
      } catch (aiError) {
        console.error("AI Normalization failed:", aiError);
        // Return original message if AI fails
        res.status(201).json(message);
      }

    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Messages: explicit processing endpoint (sync with shared/routes.ts)
  app.post(api.messages.process.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid message id" });
      }

      const message = await storage.getMessage(id);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      // Re-run normalization on demand (useful if initial processing failed)
      const normalized = await normalizeWorkMessage(message.messageRaw);
      await storage.updateMessageNormalized(message.id, normalized);

      const updated = await storage.getMessage(message.id);
      return res.status(200).json(updated);
    } catch (err) {
      console.error("Message processing failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Messages: patch endpoint for inline editing
  app.patch(api.messages.patch.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid message id" });
      }

      const input = api.messages.patch.input.parse(req.body);
      const updated = await storage.patchMessage(id, input);

      if (!updated) {
        return res.status(404).json({ message: "Message not found" });
      }

      return res.status(200).json(updated);
    } catch (err) {
      console.error("Message patch failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Worklog Section 3: combined view of messages and acts, grouped by date
  app.get(api.worklog.section3.path, async (req, res) => {
    try {
      const showVolumes = req.query.showVolumes === "1";

      // Load messages and acts in parallel
      const [allMessages, allActs] = await Promise.all([
        storage.getMessages(),
        storage.getActs(),
      ]);

      type Segment = {
        text: string;
        sourceType: 'message' | 'act';
        sourceId: number;
        isPending: boolean;
      };

      type DateRow = {
        date: string;
        workConditions: string;
        segments: Segment[];
        representative: string;
      };

      // Group rows by date using a Map (insertion order preserved = sort later)
      const byDate = new Map<string, DateRow>();

      const getOrCreateRow = (date: string): DateRow => {
        if (!byDate.has(date)) {
          byDate.set(date, { date, workConditions: "", segments: [], representative: "" });
        }
        return byDate.get(date)!;
      };

      // First pass: acts (appear first in each date's segments list)
      for (const act of allActs) {
        if (!act.dateStart || !act.dateEnd || !act.worksData) continue;

        const dateStart = String(act.dateStart);
        const dateEnd = String(act.dateEnd);
        const worksData = act.worksData as Array<{
          description: string;
          code?: string;
          quantity?: number;
          unit?: string;
        }>;

        if (!Array.isArray(worksData) || worksData.length === 0) continue;

        const dates = eachDayInRange(dateStart, dateEnd);

        for (const date of dates) {
          const row = getOrCreateRow(date);

          for (const workItem of worksData) {
            let text = workItem.description || "";
            if (showVolumes && workItem.quantity != null && workItem.unit) {
              text += ` (${workItem.quantity} ${workItem.unit})`;
            }

            row.segments.push({ text, sourceType: 'act', sourceId: act.id, isPending: false });
          }
        }
      }

      // Second pass: messages (appear after acts in each date's segments list)
      for (const msg of allMessages) {
        const data = msg.normalizedData;

        // Determine date
        let dateStr = "";
        if (data?.date) {
          dateStr = data.date;
        } else if (msg.createdAt) {
          dateStr = new Date(msg.createdAt).toISOString().slice(0, 10);
        }
        if (!dateStr) continue;

        // Build work description
        let text = "";
        if (msg.isProcessed && data) {
          text = data.workDescription || msg.messageRaw || "";
          const materials = Array.isArray(data.materials) ? data.materials : [];
          if (materials.length > 0) text += ` — ${materials.join("; ")}`;
        } else {
          text = msg.messageRaw || "";
        }

        const row = getOrCreateRow(dateStr);

        // Merge workConditions from message (if any)
        if (data?.workConditions && !row.workConditions) {
          row.workConditions = data.workConditions;
        }
        // Merge representative from message (if any)
        if (data?.representative && !row.representative) {
          row.representative = data.representative;
        }

        row.segments.push({
          text,
          sourceType: 'message',
          sourceId: msg.id,
          isPending: !msg.isProcessed,
        });
      }

      // Sort rows by date and return
      const rows = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

      res.json(rows);
    } catch (err) {
      console.error("Worklog section3 fetch failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Acts
  app.get(api.acts.list.path, async (req, res) => {
    const acts = await storage.getActs();
    res.json(acts);
  });

  // Deprecated: acts can be created only from schedule now.
  app.post(api.acts.generate.path, async (_req, res) => {
    return res.status(410).json({
      message: "Эндпоинт устарел: акты АОСР теперь создаются только из графика работ (/schedule).",
    });
  });

  app.get(api.acts.get.path, async (req, res) => {
    const act = await storage.getAct(Number(req.params.id));
    if (!act) return res.status(404).json({ message: "Act not found" });
    
    const attachments = await storage.getAttachments(act.id);
    res.json({ ...act, attachments });
  });

  // Schedules (Gantt)
  app.get(api.schedules.default.path, async (_req, res) => {
    try {
      const schedule = await storage.getOrCreateDefaultSchedule();
      return res.status(200).json(schedule);
    } catch (err) {
      console.error("Get default schedule failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.schedules.create.path, async (req, res) => {
    try {
      const input = api.schedules.create.input.parse(req.body);
      const schedule = await storage.createSchedule(input);
      return res.status(201).json(schedule);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Create schedule failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get(api.schedules.get.path, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "Invalid schedule id" });
    }

    const schedule = await storage.getScheduleWithTasks(id);
    if (!schedule) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    return res.status(200).json(schedule);
  });

  app.post(api.schedules.bootstrapFromWorks.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid schedule id" });
      }

      const input = api.schedules.bootstrapFromWorks.input.parse(req.body ?? {});

      const schedule = await storage.getScheduleWithTasks(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }

      const today = new Date().toISOString().slice(0, 10);
      const defaultStartDate = input.defaultStartDate ?? (schedule.calendarStart as any) ?? today;
      const defaultDurationDays = input.defaultDurationDays ?? 1;

      const result = await storage.bootstrapScheduleTasksFromWorks({
        scheduleId: id,
        workIds: input.workIds,
        defaultStartDate,
        defaultDurationDays,
      });

      return res.status(200).json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Schedule bootstrap failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.schedules.generateActs.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid schedule id" });
      }

      api.schedules.generateActs.input.parse(req.body ?? {});

      const schedule = await storage.getScheduleWithTasks(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }

      const groups = new Map<number, typeof schedule.tasks>();
      let skippedNoActNumber = 0;

      for (const task of schedule.tasks) {
        const actNumber = (task as any).actNumber as number | null | undefined;
        if (actNumber == null) {
          skippedNoActNumber++;
          continue;
        }
        if (!Number.isFinite(actNumber) || actNumber <= 0) {
          return res.status(400).json({ message: `Invalid actNumber for task ${task.id}` });
        }

        const list = groups.get(actNumber) ?? [];
        list.push(task);
        groups.set(actNumber, list);
      }

      const actNumbers = Array.from(groups.keys()).sort((a, b) => a - b);
      let created = 0;
      let updated = 0;
      const deletedActNumbers: number[] = [];
      const warnings: Array<{ actNumber: number; type: string; message: string }> = [];

      const mergeFreeText = (values: Array<string | null | undefined>): string => {
        const tokens: string[] = [];
        const seen = new Set<string>();
        for (const v of values) {
          const raw = String(v ?? "").trim();
          if (!raw) continue;
          const parts = raw
            .split(/[\n,;]+/g)
            .map((p) => p.trim())
            .filter(Boolean);
          for (const p of parts) {
            const key = p.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            tokens.push(p);
          }
        }
        return tokens.join(", ");
      };

      for (const actNumber of actNumbers) {
        const tasks = (groups.get(actNumber) ?? []).slice().sort((a: any, b: any) => Number(a.orderIndex ?? 0) - Number(b.orderIndex ?? 0));
        if (tasks.length === 0) continue;

        // Determine act template type (one per actNumber)
        const distinctTemplateIds = Array.from(
          new Set(tasks.map((t: any) => (t as any).actTemplateId).filter((v: any) => v != null)),
        ).map((v: any) => Number(v));
        const actTemplateId = distinctTemplateIds.length > 0 ? distinctTemplateIds[0] : null;
        if (distinctTemplateIds.length === 0) {
          warnings.push({
            actNumber,
            type: "no_template_type",
            message: `Акт №${actNumber}: не выбран тип акта (шаблон) ни у одной задачи`,
          });
        } else if (distinctTemplateIds.length > 1) {
          warnings.push({
            actNumber,
            type: "mixed_template_types",
            message: `Акт №${actNumber}: в задачах выбрано несколько типов актов (${distinctTemplateIds.join(", ")}). Используется первый.`,
          });
        }

        let minStart: string | null = null;
        let maxEnd: string | null = null;

        for (const t of tasks) {
          const start = String(t.startDate);
          const durationDays = Number(t.durationDays ?? 0);
          // dateEnd is inclusive: if duration is 1 day, end = start
          const end = addDaysISO(start, Math.max(0, durationDays - 1));

          if (!minStart || start < minStart) minStart = start;
          if (!maxEnd || end > maxEnd) maxEnd = end;
        }

        // Aggregate task-scoped docs
        const projectDrawingsAgg = mergeFreeText(tasks.map((t: any) => (t as any).projectDrawings));
        const normativeRefsAgg = mergeFreeText(tasks.map((t: any) => (t as any).normativeRefs));
        const schemeSeen = new Set<string>();
        const executiveSchemesAgg: Array<{ title: string; fileUrl?: string }> = [];
        for (const t of tasks) {
          const list = (t as any).executiveSchemes;
          if (!Array.isArray(list)) continue;
          for (const s of list) {
            const title = String((s as any)?.title ?? "").trim();
            const fileUrl = String((s as any)?.fileUrl ?? "").trim();
            if (!title) continue;
            const key = `${title.toLowerCase()}|${fileUrl}`;
            if (schemeSeen.has(key)) continue;
            schemeSeen.add(key);
            executiveSchemesAgg.push(fileUrl ? { title, fileUrl } : { title });
          }
        }

        // Generate worksData from task-level quantity (independent from source).
        // Multiple tasks with the same sourceId have their quantities summed.
        let worksData: Array<{
          sourceType: 'works' | 'estimate';
          sourceId: number;
          description: string;
          quantity: number;
          unit?: string;
          code?: string;
        }>;

        if (schedule.sourceType === 'estimate') {
          // Group tasks by estimatePositionId and sum their independent quantities
          const positionIdToTasks = new Map<number, typeof tasks>();
          for (const t of tasks) {
            if (t.estimatePositionId) {
              const key = Number(t.estimatePositionId);
              const list = positionIdToTasks.get(key) ?? [];
              list.push(t);
              positionIdToTasks.set(key, list);
            }
          }
          const positionIds = Array.from(positionIdToTasks.keys());
          const positions = await storage.getEstimatePositionsByIds(positionIds);
          positions.sort((a, b) => String(a.code ?? '').localeCompare(String(b.code ?? '')));

          worksData = positions.map((p) => {
            const taskGroup = positionIdToTasks.get(p.id) ?? [];
            // Sum independent task quantities; fall back to source quantity if task has none
            const qty = taskGroup.reduce((sum, t) => {
              const tQty = (t as any).quantity;
              if (tQty != null) return sum + Number(tQty);
              const rawQty: any = (p as any).quantity;
              return sum + (rawQty != null ? Number(rawQty) : 0);
            }, 0);
            // Use task unit if set, else fall back to source
            const unit = ((taskGroup[0] as any)?.unit ?? (p as any).unit) ?? undefined;
            return {
              sourceType: 'estimate' as const,
              sourceId: p.id,
              description: p.name,
              quantity: Number.isFinite(qty) ? qty : 0,
              unit,
              code: p.code ?? undefined,
            };
          });
        } else {
          // Source: Works (BoQ) — group by workId and sum independent task quantities
          const workIdToTasks = new Map<number, typeof tasks>();
          for (const t of tasks) {
            if (t.workId) {
              const key = Number(t.workId);
              const list = workIdToTasks.get(key) ?? [];
              list.push(t);
              workIdToTasks.set(key, list);
            }
          }
          const workIds = Array.from(workIdToTasks.keys());
          const works = await storage.getWorksByIds(workIds);
          works.sort((a, b) => String(a.code).localeCompare(String(b.code)));

          worksData = works.map((w) => {
            const taskGroup = workIdToTasks.get(w.id) ?? [];
            // Sum independent task quantities; fall back to source quantityTotal if task has none
            const qty = taskGroup.reduce((sum, t) => {
              const tQty = (t as any).quantity;
              if (tQty != null) return sum + Number(tQty);
              const rawQty: any = (w as any).quantityTotal;
              return sum + (rawQty != null ? Number(rawQty) : 0);
            }, 0);
            // Use task unit if set, else fall back to source
            const unit = ((taskGroup[0] as any)?.unit ?? w.unit) ?? undefined;
            return {
              sourceType: 'works' as const,
              sourceId: w.id,
              description: w.description,
              quantity: Number.isFinite(qty) ? qty : 0,
              unit,
              code: w.code,
            };
          });
        }

        const result = await storage.upsertActByNumber({
          actNumber,
          actTemplateId,
          dateStart: minStart,
          dateEnd: maxEnd,
          status: "draft",
          worksData: worksData as any,
          projectDrawingsAgg: projectDrawingsAgg || null,
          normativeRefsAgg: normativeRefsAgg || null,
          executiveSchemesAgg: executiveSchemesAgg.length > 0 ? executiveSchemesAgg : null,
        });

        if (result.created) created++;
        else updated++;

        // Replace act materials and formal attachments from task_materials
        const taskIdToWorkId = new Map<number, number | null>();
        for (const t of tasks) taskIdToWorkId.set(Number((t as any).id), (t as any).workId != null ? Number((t as any).workId) : null);

        const taskMaterialsLists = await Promise.all(tasks.map((t: any) => storage.getTaskMaterials(Number(t.id))));
        const flatTaskMaterials = taskMaterialsLists.flat();

        const actUsageItems: any[] = [];
        const attachmentDocIds: number[] = [];
        const attachmentDocSeen = new Set<number>();
        let missingQualityDocs = 0;

        for (const row of flatTaskMaterials) {
          const qdId = (row as any).qualityDocumentId == null ? null : Number((row as any).qualityDocumentId);
          if (qdId == null) missingQualityDocs++;
          if (qdId != null && !attachmentDocSeen.has(qdId)) {
            attachmentDocSeen.add(qdId);
            attachmentDocIds.push(qdId);
          }
          actUsageItems.push({
            projectMaterialId: Number((row as any).projectMaterialId),
            workId: taskIdToWorkId.get(Number((row as any).taskId)) ?? null,
            batchId: (row as any).batchId == null ? null : Number((row as any).batchId),
            qualityDocumentId: qdId,
            note: (row as any).note ?? null,
            orderIndex: Number((row as any).orderIndex ?? 0),
          });
        }

        // Persist to DB for PDF defaults
        await storage.replaceActMaterialUsages(result.act.id, actUsageItems as any);
        await storage.replaceActDocAttachments(
          result.act.id,
          attachmentDocIds.map((documentId, orderIndex) => ({ documentId, orderIndex })) as any,
        );

        if (actUsageItems.length === 0) {
          warnings.push({ actNumber, type: "no_materials", message: `Акт №${actNumber}: нет материалов ни в одной задаче` });
        } else if (missingQualityDocs > 0) {
          warnings.push({
            actNumber,
            type: "no_quality_docs",
            message: `Акт №${actNumber}: у ${missingQualityDocs} материалов не указан документ качества`,
          });
        }
        if (!projectDrawingsAgg) {
          warnings.push({ actNumber, type: "no_drawings", message: `Акт №${actNumber}: не заполнены номера чертежей проекта` });
        }
        if (!normativeRefsAgg) {
          warnings.push({ actNumber, type: "no_normatives", message: `Акт №${actNumber}: не заполнены СНиП/ГОСТ/РД` });
        }
      }

      // Delete acts which no longer have any tasks (global actNumber uniqueness is assumed).
      const actNumbersSet = new Set<number>(actNumbers);
      const existingActs = await storage.getActs();
      for (const a of existingActs as any[]) {
        const n = (a as any).actNumber;
        if (n == null) continue;
        const num = Number(n);
        if (actNumbersSet.has(num)) continue;
        if (String((a as any).status ?? "") === "signed") continue;
        const ok = await storage.deleteActByNumber(num);
        if (ok) deletedActNumbers.push(num);
      }

      return res.status(200).json({
        scheduleId: id,
        actNumbers,
        created,
        updated,
        skippedNoActNumber,
        deletedActNumbers,
        warnings,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Generate acts from schedule failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Get schedule source info
  app.get(api.schedules.sourceInfo.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid schedule id" });
      }

      const info = await storage.getScheduleSourceInfo(id);
      if (!info) {
        return res.status(404).json({ message: "Schedule not found" });
      }

      return res.status(200).json(info);
    } catch (err) {
      console.error("Get schedule source info failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Change schedule source
  app.post(api.schedules.changeSource.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid schedule id" });
      }

      const input = api.schedules.changeSource.input.parse(req.body);

      // Validate: if estimate source, estimateId must be provided
      if (input.newSourceType === 'estimate' && !input.estimateId) {
        return res.status(400).json({ message: 'estimateId is required when newSourceType is "estimate"' });
      }

      // Get current state
      const info = await storage.getScheduleSourceInfo(id);
      if (!info) {
        return res.status(404).json({ message: "Schedule not found" });
      }

      // If not confirmed and there are tasks, return confirmation prompt
      if (!input.confirmReset && info.tasksCount > 0) {
        return res.status(200).json({
          requiresConfirmation: true,
          message: `При смене источника будут удалены все задачи графика (${info.tasksCount} шт.) и очищены списки работ в актах (${info.affectedActNumbers.length} шт.)`,
          tasksCount: info.tasksCount,
          affectedActNumbers: info.affectedActNumbers,
        });
      }

      // Execute change
      await storage.changeScheduleSource({
        scheduleId: id,
        newSourceType: input.newSourceType,
        newEstimateId: input.estimateId,
      });

      return res.status(200).json({
        success: true,
        deletedTasks: info.tasksCount,
        clearedActs: info.affectedActNumbers.length,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Change schedule source failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Bootstrap schedule from estimate
  app.post(api.schedules.bootstrapFromEstimate.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid schedule id" });
      }

      const input = api.schedules.bootstrapFromEstimate.input.parse(req.body);

      // Get schedule to check source
      const schedule = await storage.getScheduleWithTasks(id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }

      if (schedule.sourceType !== 'estimate') {
        return res.status(400).json({ message: 'Schedule source type must be "estimate"' });
      }

      if (!schedule.estimateId) {
        return res.status(400).json({ message: 'Schedule has no estimateId' });
      }

      const defaultStartDate = input.defaultStartDate || new Date().toISOString().split('T')[0];
      const defaultDurationDays = input.defaultDurationDays ?? 1;

      const result = await storage.bootstrapScheduleTasksFromEstimate({
        scheduleId: id,
        estimateId: schedule.estimateId,
        positionIds: input.positionIds,
        defaultStartDate,
        defaultDurationDays,
      });

      return res.status(200).json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      if ((err as Error).message === "SCHEDULE_NOT_FOUND") {
        return res.status(404).json({ message: "Schedule not found" });
      }
      if ((err as Error).message === "SCHEDULE_SOURCE_MISMATCH") {
        return res.status(400).json({ message: "Schedule source type does not match" });
      }
      console.error("Bootstrap from estimate failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.patch(api.scheduleTasks.patch.path, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid schedule task id" });
      }

      const input = api.scheduleTasks.patch.input.parse(req.body);
      const existing = await storage.getScheduleTask(id);
      if (!existing) {
        return res.status(404).json({ message: "Schedule task not found" });
      }

      const nextActNumber = input.actNumber !== undefined ? input.actNumber : (existing as any).actNumber;
      const nextTemplateId =
        input.actTemplateId !== undefined ? input.actTemplateId : ((existing as any).actTemplateId ?? null);

      // If changing actTemplateId for a task inside an actNumber group, enforce one template per actNumber.
      if (input.actTemplateId !== undefined && nextActNumber != null) {
        const tasksInAct = await storage.getTasksByActNumber(Number((existing as any).scheduleId), Number(nextActNumber));
        const distinct = Array.from(
          new Set(tasksInAct.map((t: any) => (t as any).actTemplateId).filter((v: any) => v != null)),
        );

        const conflict = distinct.length > 0 && (distinct.length > 1 || distinct[0] !== nextTemplateId);
        if (conflict && !input.updateAllTasks) {
          return res.status(409).json({
            message:
              "В этом акте уже выбран другой тип. Включите updateAllTasks=true, чтобы изменить тип для всех задач акта.",
            actNumber: nextActNumber,
            currentTemplateId: distinct[0] ?? null,
            otherTasksCount: Math.max(0, tasksInAct.length - 1),
          });
        }

        // Sync templateId across all tasks of the same actNumber if confirmed.
        if (conflict && input.updateAllTasks) {
          await storage.updateActTemplateForActNumber({
            scheduleId: Number((existing as any).scheduleId),
            actNumber: Number(nextActNumber),
            actTemplateId: nextTemplateId,
          });
        }

        // Also update act record (if exists) to keep list view consistent before next generate-acts.
        const act = await storage.getActByNumber(Number(nextActNumber));
        if (act && (act as any).status !== "signed") {
          await storage.upsertActByNumber({
            actNumber: Number(nextActNumber),
            actTemplateId: nextTemplateId,
            dateStart: (act as any).dateStart ?? null,
            dateEnd: (act as any).dateEnd ?? null,
            location: (act as any).location ?? null,
            status: (act as any).status ?? "draft",
            worksData: ((act as any).worksData ?? []) as any,
            projectDrawingsAgg: (act as any).projectDrawingsAgg ?? null,
            normativeRefsAgg: (act as any).normativeRefsAgg ?? null,
            executiveSchemesAgg: (act as any).executiveSchemesAgg ?? null,
          });
        }
      }

      // Remove route-level helper flag before passing to storage
      const { updateAllTasks: _updateAllTasks, ...patch } = input as any;
      const updated = await storage.patchScheduleTask(id, patch);

      if (!updated) {
        return res.status(404).json({ message: "Schedule task not found" });
      }

      return res.status(200).json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Schedule task patch failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Schedule task materials (p.3 AOSR sources)
  app.get(api.taskMaterials.list.path, async (req, res) => {
    try {
      const taskId = Number(req.params.id);
      if (!Number.isFinite(taskId) || taskId <= 0) {
        return res.status(400).json({ message: "Invalid schedule task id" });
      }

      const list = await storage.getTaskMaterials(taskId);
      const dto = list.map((r: any) => {
        const pm = r.projectMaterial ?? null;
        const cat = r.catalogMaterial ?? null;
        const batch = r.batch ?? null;
        const qd = r.qualityDocument ?? null;

        const name =
          String(cat?.name ?? "").trim() ||
          String(pm?.nameOverride ?? "").trim() ||
          (pm?.id != null ? `Материал #${String(pm.id)}` : null);

        const batchLabel = batch
          ? [batch.batchNumber ? `Партия ${String(batch.batchNumber)}` : null, batch.deliveryDate ? `от ${String(batch.deliveryDate)}` : null]
              .filter(Boolean)
              .join(" ")
          : null;

        return {
          id: Number(r.id),
          taskId: Number(r.taskId),
          projectMaterialId: Number(r.projectMaterialId),
          batchId: r.batchId == null ? null : Number(r.batchId),
          qualityDocumentId: r.qualityDocumentId == null ? null : Number(r.qualityDocumentId),
          note: r.note ?? null,
          orderIndex: Number(r.orderIndex ?? 0),
          createdAt: (r as any).createdAt,
          projectMaterialName: name,
          batchLabel,
          qualityDocumentTitle: qd?.title ?? null,
          qualityDocumentNumber: qd?.docNumber ?? null,
          qualityDocumentFileUrl: qd?.fileUrl ?? null,
        };
      });

      return res.status(200).json(dto);
    } catch (err) {
      console.error("List task materials failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.put(api.taskMaterials.replace.path, async (req, res) => {
    try {
      const taskId = Number(req.params.id);
      if (!Number.isFinite(taskId) || taskId <= 0) {
        return res.status(400).json({ message: "Invalid schedule task id" });
      }

      const input = api.taskMaterials.replace.input.parse(req.body);
      const items = input.items.map((it, idx) => ({
        projectMaterialId: Number(it.projectMaterialId),
        batchId: it.batchId == null ? null : Number(it.batchId),
        qualityDocumentId: it.qualityDocumentId == null ? null : Number(it.qualityDocumentId),
        note: it.note ?? null,
        orderIndex: it.orderIndex ?? idx,
      }));

      await storage.replaceTaskMaterials(taskId, items as any);
      const updated = await storage.getTaskMaterials(taskId);
      return res.status(200).json(updated as any);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Replace task materials failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post(api.taskMaterials.add.path, async (req, res) => {
    try {
      const taskId = Number(req.params.id);
      if (!Number.isFinite(taskId) || taskId <= 0) {
        return res.status(400).json({ message: "Invalid schedule task id" });
      }

      const input = api.taskMaterials.add.input.parse(req.body);
      const created = await storage.createTaskMaterial(taskId, {
        projectMaterialId: Number(input.projectMaterialId),
        batchId: input.batchId == null ? null : Number(input.batchId),
        qualityDocumentId: input.qualityDocumentId == null ? null : Number(input.qualityDocumentId),
        note: input.note ?? null,
        orderIndex: input.orderIndex,
      } as any);

      return res.status(201).json(created as any);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Add task material failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete(api.taskMaterials.remove.path, async (req, res) => {
    try {
      const materialId = Number(req.params.materialId);
      if (!Number.isFinite(materialId) || materialId <= 0) {
        return res.status(400).json({ message: "Invalid material id" });
      }

      const ok = await storage.deleteTaskMaterial(materialId);
      if (!ok) return res.status(404).json({ message: "Not found" });
      return res.status(204).send();
    } catch (err) {
      console.error("Delete task material failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Schedule (estimate source): quality document statuses for estimate subrows (aux positions)
  app.get(api.estimatePositionLinks.statuses.path, async (req, res) => {
    try {
      const scheduleId = Number(req.params.id);
      if (!Number.isFinite(scheduleId) || scheduleId <= 0) {
        return res.status(400).json({ message: "Invalid schedule id" });
      }

      const schedule = await storage.getScheduleWithTasks(scheduleId);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }

      if (schedule.sourceType !== "estimate" || !schedule.estimateId) {
        return res.status(400).json({ message: 'Schedule source type must be "estimate"' });
      }

      const obj = await storage.getOrCreateDefaultObject();
      const statuses = await storage.getEstimateSubrowStatuses({
        objectId: obj.id,
        estimateId: Number(schedule.estimateId),
      });

      return res.status(200).json({ byEstimatePositionId: statuses });
    } catch (err) {
      console.error("Get estimate subrow statuses failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Upsert estimate subrow ↔ project material link
  app.post(api.estimatePositionLinks.upsert.path, async (req, res) => {
    try {
      const input = api.estimatePositionLinks.upsert.input.parse(req.body);
      const obj = await storage.getOrCreateDefaultObject();

      const saved = await storage.upsertEstimatePositionMaterialLink(obj.id, {
        estimateId: input.estimateId,
        estimatePositionId: input.estimatePositionId,
        projectMaterialId: input.projectMaterialId,
        batchId: (input as any).batchId ?? null,
        source: "manual",
      } as any);

      return res.status(200).json(saved);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Upsert estimate position link failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Delete estimate subrow ↔ project material link
  app.delete(api.estimatePositionLinks.delete.path, async (req, res) => {
    const estimatePositionId = Number(req.params.estimatePositionId);
    if (!Number.isFinite(estimatePositionId) || estimatePositionId <= 0) {
      return res.status(400).json({ message: "Invalid estimatePositionId" });
    }
    try {
      const obj = await storage.getOrCreateDefaultObject();
      const ok = await storage.deleteEstimatePositionMaterialLink(obj.id, estimatePositionId);
      if (!ok) return res.status(404).json({ message: "Not found" });
      return res.status(204).send();
    } catch (err) {
      console.error("Delete estimate position link failed:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Act Templates
  app.get("/api/act-templates", async (_req, res) => {
    try {
      const templates = await storage.getActTemplates();
      
      // If no templates in DB, load from catalog file
      if (templates.length === 0) {
        const catalog = loadTemplateCatalog();
        const templatesData = catalog.templates.map((t: any) => ({
          templateId: t.id,
          code: t.code,
          category: t.category,
          title: t.title,
          titleEn: t.titleEn,
          description: t.description,
          normativeRef: t.normativeRef,
          isActive: true,
        }));
        await storage.seedActTemplates(templatesData);
        const seeded = await storage.getActTemplates();
        return res.json({ templates: seeded, categories: catalog.categories });
      }
      
      const catalog = loadTemplateCatalog();
      res.json({ templates, categories: catalog.categories });
    } catch (err) {
      console.error("Error fetching act templates:", err);
      res.status(500).json({ message: "Failed to load templates" });
    }
  });

  // Generate PDF for act
  app.post("/api/acts/:id/export", async (req, res) => {
    try {
      const actId = Number(req.params.id);
      const act = await storage.getAct(actId);
      if (!act) {
        return res.status(404).json({ message: "Act not found" });
      }

      const { templateIds, formData } = req.body ?? {};

      // Resolve object-scoped source data (MVP: single current object)
      const objectId = (act as any).objectId ?? (await storage.getOrCreateDefaultObject()).id;
      const sourceData = await storage.getObjectSourceData(Number(objectId));
      const objectActData = buildActDataFromSourceData(sourceData);
      const dbP3MaterialsText = await buildP3MaterialsText(actId);
      const dbAttachmentsText = await buildAttachmentsText(actId);

      // Allow exporting without explicit templates (for acts generated from schedule).
      // Strategy:
      // - if templateIds provided -> use them
      // - else use act.actTemplateId (single act type)
      // - else try act_template_selections (legacy)
      // - else generate a single "default" AOSR PDF using worksData aggregated from the act
      let effectiveTemplateIds: string[] = Array.isArray(templateIds) ? templateIds : [];
      if (effectiveTemplateIds.length === 0) {
        const actTemplateId = (act as any).actTemplateId as number | null | undefined;
        if (actTemplateId != null) {
          const tpl = await storage.getActTemplate(Number(actTemplateId));
          if (tpl?.templateId) effectiveTemplateIds.push(tpl.templateId);
        }
      }
      if (effectiveTemplateIds.length === 0) {
        const selections = await storage.getActTemplateSelections(actId);
        for (const s of selections) {
          const tpl = await storage.getActTemplate(Number((s as any).templateId));
          if (tpl?.templateId) effectiveTemplateIds.push(tpl.templateId);
        }
      }

      // Ensure generated PDFs directory exists
      const pdfDir = path.join(process.cwd(), "generated_pdfs");
      if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
      }

      const generatedFiles: { templateId: string; filename: string; url: string }[] = [];

      // Вычисляем p1Works один раз (авто из worksData + переопределение через formData)
      const p1WorksAuto =
        Array.isArray(act.worksData) && act.worksData.length > 0
          ? act.worksData
              .map((w, idx) => {
                const qty = typeof (w as any).quantity === "number" ? (w as any).quantity : 0;
                const desc = String((w as any).description ?? "").trim();
                const line = desc || `workId ${(w as any).workId ?? ""}`.trim();
                return `${idx + 1}. ${line}${qty ? ` — ${qty}` : ""}`;
              })
              .join("\n")
          : "";
      const p1Works = formData?.p1Works || p1WorksAuto;

      if (effectiveTemplateIds.length === 0) {
        const actNumber = formData?.actNumber || String(act.actNumber ?? act.id);
        const actDate = formData?.actDate || String(act.dateEnd ?? new Date().toISOString().split("T")[0]);

        const actProjectDrawingsAgg = String((act as any).projectDrawingsAgg ?? "").trim();
        const actNormativeRefsAgg = String((act as any).normativeRefsAgg ?? "").trim();
        const schemesAggRaw = (act as any).executiveSchemesAgg;
        const schemesAgg = Array.isArray(schemesAggRaw) ? schemesAggRaw : [];
        const schemesText = schemesAgg
          .map((s: any) => {
            const title = String(s?.title ?? "").trim();
            const fileUrl = String(s?.fileUrl ?? "").trim();
            if (!title) return "";
            return fileUrl ? `Исполнительная схема: ${title} — ${fileUrl}` : `Исполнительная схема: ${title}`;
          })
          .filter(Boolean)
          .join("\n");
        const combinedDbAttachmentsText = [String(dbAttachmentsText || "").trim(), schemesText].filter(Boolean).join("\n");

        const actData: ActData = {
          ...objectActData,
          actNumber,
          actDate,
          city: formData?.city ?? objectActData.city ?? "Москва",
          objectName: formData?.objectName ?? objectActData.objectName ?? "Объект строительства",
          objectAddress: formData?.objectAddress ?? objectActData.objectAddress ?? act.location ?? "Адрес объекта",
          workDescription: formData?.workDescription || "Работы по акту (из графика)",
          dateStart: act.dateStart || new Date().toISOString().split("T")[0],
          dateEnd: act.dateEnd || new Date().toISOString().split("T")[0],
          p1Works,

          // эталонные поля (005_АОСР 4)
          objectFullName: formData?.objectFullName ?? objectActData.objectFullName,
          developerOrgFull: formData?.developerOrgFull ?? objectActData.developerOrgFull,
          builderOrgFull: formData?.builderOrgFull ?? objectActData.builderOrgFull,
          designerOrgFull: formData?.designerOrgFull ?? objectActData.designerOrgFull,
          repCustomerControlLine: formData?.repCustomerControlLine ?? objectActData.repCustomerControlLine,
          repCustomerControlOrder: formData?.repCustomerControlOrder ?? objectActData.repCustomerControlOrder,
          repBuilderLine: formData?.repBuilderLine ?? objectActData.repBuilderLine,
          repBuilderOrder: formData?.repBuilderOrder ?? objectActData.repBuilderOrder,
          repBuilderControlLine: formData?.repBuilderControlLine ?? objectActData.repBuilderControlLine,
          repBuilderControlOrder: formData?.repBuilderControlOrder ?? objectActData.repBuilderControlOrder,
          repDesignerLine: formData?.repDesignerLine ?? objectActData.repDesignerLine,
          repDesignerOrder: formData?.repDesignerOrder ?? objectActData.repDesignerOrder,
          repWorkPerformerLine: formData?.repWorkPerformerLine ?? objectActData.repWorkPerformerLine,
          repWorkPerformerOrder: formData?.repWorkPerformerOrder ?? objectActData.repWorkPerformerOrder,
          p2ProjectDocs: formData?.p2ProjectDocs ?? actProjectDrawingsAgg,
          p3MaterialsText: formData?.p3MaterialsText ?? (dbP3MaterialsText || objectActData.p3MaterialsText),
          p4AsBuiltDocs: formData?.p4AsBuiltDocs ?? objectActData.p4AsBuiltDocs,
          p6NormativeRefs: formData?.p6NormativeRefs ?? actNormativeRefsAgg,
          p7NextWorks: formData?.p7NextWorks ?? objectActData.p7NextWorks,
          additionalInfo: formData?.additionalInfo ?? objectActData.additionalInfo,
          copiesCount: formData?.copiesCount ?? objectActData.copiesCount,
          attachments: Array.isArray(formData?.attachments) ? formData.attachments : undefined,
          attachmentsText: formData?.attachmentsText ?? (combinedDbAttachmentsText || objectActData.attachmentsText),
          sigCustomerControl: formData?.sigCustomerControl ?? objectActData.sigCustomerControl,
          sigBuilder: formData?.sigBuilder ?? objectActData.sigBuilder,
          sigBuilderControl: formData?.sigBuilderControl ?? objectActData.sigBuilderControl,
          sigDesigner: formData?.sigDesigner ?? objectActData.sigDesigner,
          sigWorkPerformer: formData?.sigWorkPerformer ?? objectActData.sigWorkPerformer,
        };

        const pdfBuffer = await generateAosrPdf(actData);
        const safeActNumber = String(actNumber).replace(/[^0-9A-Za-z_-]+/g, "_");
        const filename = `aosr-act-${safeActNumber}.pdf`;
        const filePath = path.join(pdfDir, filename);
        fs.writeFileSync(filePath, pdfBuffer);
        generatedFiles.push({ templateId: "default", filename, url: `/api/pdfs/${filename}` });

        return res.json({ files: generatedFiles });
      }

      for (const templateId of effectiveTemplateIds) {
        const template = await storage.getActTemplateByTemplateId(templateId);
        if (!template) continue;

        // Build act data from form and database
        const actProjectDrawingsAgg = String((act as any).projectDrawingsAgg ?? "").trim();
        const actNormativeRefsAgg = String((act as any).normativeRefsAgg ?? "").trim();
        const schemesAggRaw = (act as any).executiveSchemesAgg;
        const schemesAgg = Array.isArray(schemesAggRaw) ? schemesAggRaw : [];
        const schemesText = schemesAgg
          .map((s: any) => {
            const title = String(s?.title ?? "").trim();
            const fileUrl = String(s?.fileUrl ?? "").trim();
            if (!title) return "";
            return fileUrl ? `Исполнительная схема: ${title} — ${fileUrl}` : `Исполнительная схема: ${title}`;
          })
          .filter(Boolean)
          .join("\n");
        const combinedDbAttachmentsText = [String(dbAttachmentsText || "").trim(), schemesText].filter(Boolean).join("\n");

        const actData: ActData = {
          ...objectActData,
          actNumber: formData?.actNumber || String(act.actNumber ?? act.id),
          // "Дата составления" по умолчанию = дата окончания акта (если есть)
          actDate: formData?.actDate || String(act.dateEnd ?? new Date().toISOString().split("T")[0]),

          // legacy fields (оставляем для обратной совместимости/фолбэков)
          city: formData?.city ?? objectActData.city ?? "Москва",
          objectName: formData?.objectName ?? objectActData.objectName ?? "Объект строительства",
          objectAddress: formData?.objectAddress ?? objectActData.objectAddress ?? act.location ?? "Адрес объекта",
          developerRepName: formData?.developerRepName || objectActData.developerRepName || "",
          developerRepPosition: formData?.developerRepPosition || objectActData.developerRepPosition || "",
          contractorRepName: formData?.contractorRepName || objectActData.contractorRepName || "",
          contractorRepPosition: formData?.contractorRepPosition || objectActData.contractorRepPosition || "",
          supervisorRepName: formData?.supervisorRepName || objectActData.supervisorRepName || "",
          supervisorRepPosition: formData?.supervisorRepPosition || objectActData.supervisorRepPosition || "",

          workDescription: template.description || template.title,
          projectDocumentation: formData?.projectDocumentation || objectActData.projectDocumentation || "Рабочая документация",
          dateStart: act.dateStart || new Date().toISOString().split("T")[0],
          dateEnd: act.dateEnd || new Date().toISOString().split("T")[0],
          qualityDocuments: formData?.qualityDocuments || "Сертификаты, паспорта качества",
          materials: formData?.materials,
          p1Works,

          // эталонные поля (005_АОСР 4)
          objectFullName: formData?.objectFullName ?? objectActData.objectFullName,
          developerOrgFull: formData?.developerOrgFull ?? objectActData.developerOrgFull,
          builderOrgFull: formData?.builderOrgFull ?? objectActData.builderOrgFull,
          designerOrgFull: formData?.designerOrgFull ?? objectActData.designerOrgFull,

          repCustomerControlLine: formData?.repCustomerControlLine ?? objectActData.repCustomerControlLine,
          repCustomerControlOrder: formData?.repCustomerControlOrder ?? objectActData.repCustomerControlOrder,
          repBuilderLine: formData?.repBuilderLine ?? objectActData.repBuilderLine,
          repBuilderOrder: formData?.repBuilderOrder ?? objectActData.repBuilderOrder,
          repBuilderControlLine: formData?.repBuilderControlLine ?? objectActData.repBuilderControlLine,
          repBuilderControlOrder: formData?.repBuilderControlOrder ?? objectActData.repBuilderControlOrder,
          repDesignerLine: formData?.repDesignerLine ?? objectActData.repDesignerLine,
          repDesignerOrder: formData?.repDesignerOrder ?? objectActData.repDesignerOrder,
          repWorkPerformerLine: formData?.repWorkPerformerLine ?? objectActData.repWorkPerformerLine,
          repWorkPerformerOrder: formData?.repWorkPerformerOrder ?? objectActData.repWorkPerformerOrder,

          p2ProjectDocs: formData?.p2ProjectDocs ?? actProjectDrawingsAgg,
          p3MaterialsText: formData?.p3MaterialsText ?? (dbP3MaterialsText || objectActData.p3MaterialsText),
          p4AsBuiltDocs: formData?.p4AsBuiltDocs ?? objectActData.p4AsBuiltDocs,
          p6NormativeRefs: formData?.p6NormativeRefs ?? actNormativeRefsAgg,
          p7NextWorks: formData?.p7NextWorks ?? objectActData.p7NextWorks,
          additionalInfo: formData?.additionalInfo ?? objectActData.additionalInfo,
          copiesCount: formData?.copiesCount ?? objectActData.copiesCount,

          attachments: Array.isArray(formData?.attachments) ? formData.attachments : undefined,
          attachmentsText: formData?.attachmentsText ?? (combinedDbAttachmentsText || objectActData.attachmentsText),

          sigCustomerControl: formData?.sigCustomerControl ?? objectActData.sigCustomerControl,
          sigBuilder: formData?.sigBuilder ?? objectActData.sigBuilder,
          sigBuilderControl: formData?.sigBuilderControl ?? objectActData.sigBuilderControl,
          sigDesigner: formData?.sigDesigner ?? objectActData.sigDesigner,
          sigWorkPerformer: formData?.sigWorkPerformer ?? objectActData.sigWorkPerformer,
        };

        try {
          const pdfBuffer = await generateAosrPdf(actData);
          const filename = `AOSR_${template.code}_${act.id}_${Date.now()}.pdf`;
          const filePath = path.join(pdfDir, filename);
          fs.writeFileSync(filePath, pdfBuffer);

          generatedFiles.push({
            templateId: template.templateId,
            filename,
            url: `/api/pdfs/${filename}`,
          });
        } catch (pdfError) {
          console.error(`Error generating PDF for template ${templateId}:`, pdfError);
        }
      }

      res.json({
        success: true,
        files: generatedFiles,
        message: `Generated ${generatedFiles.length} PDF(s)`,
      });
    } catch (err) {
      console.error("Error exporting act:", err);
      res.status(500).json({ message: "Failed to export act" });
    }
  });

  // Serve generated PDFs
  app.get("/api/pdfs/:filename", (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(process.cwd(), "generated_pdfs", filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found" });
    }
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    res.sendFile(filePath);
  });

  // Deprecated: acts can be created only from schedule now.
  app.post("/api/acts/create-with-templates", async (_req, res) => {
    return res.status(410).json({
      message: "Эндпоинт устарел: акты АОСР теперь создаются только из графика работ (/schedule).",
    });
  });

  return httpServer;
}

// Seed function
async function seedDatabase() {
  const existingWorks = await storage.getWorks();
  if (existingWorks.length === 0) {
    await storage.createWork({
      code: "3.1.1",
      description: "Installation of foundation rebar",
      unit: "tons",
      quantityTotal: "100"
    });
    await storage.createWork({
      code: "3.1.2",
      description: "Concrete pouring for foundation",
      unit: "m3",
      quantityTotal: "500"
    });
    await storage.createWork({
      code: "4.5",
      description: "Bricklaying for external walls",
      unit: "m2",
      quantityTotal: "1200"
    });
  }
}

// Run seed (dev-only, opt-in)
const enableDemoSeed =
  process.env.NODE_ENV !== "production" &&
  String(process.env.ENABLE_DEMO_SEED || "").toLowerCase() === "true";

if (enableDemoSeed) {
  seedDatabase().catch(console.error);
}
