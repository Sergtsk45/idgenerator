import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import { generateAosrPdf, loadTemplateCatalog, type ActData } from "./pdfGenerator";
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
  
  // Works (BoQ)
  app.get(api.works.list.path, async (req, res) => {
    const works = await storage.getWorks();
    res.json(works);
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

  app.delete("/api/works", async (_req, res) => {
    // Safety: do not allow destructive "clear all works" in production.
    // (The UI no longer depends on this endpoint; keep it only for dev/debug.)
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ message: "Not found" });
    }

    try {
      console.log("Clearing all works from database...");
      await storage.clearWorks();
      console.log("Works cleared successfully");
      return res.status(204).send();
    } catch (err) {
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

  // Acts
  app.get(api.acts.list.path, async (req, res) => {
    const acts = await storage.getActs();
    res.json(acts);
  });

  app.post(api.acts.generate.path, async (req, res) => {
    try {
      const input = api.acts.generate.input.parse(req.body);
      
      // Simple logic: Find all normalized messages in date range and group them
      const messages = await storage.getMessages();
      const filtered = messages.filter(m => {
        if (!m.isProcessed || !m.normalizedData) return false;
        const d = (m.normalizedData as any).date;
        return d >= input.dateStart && d <= input.dateEnd;
      });

      if (filtered.length === 0) {
        return res.status(400).json({ message: "No works found for this period" });
      }

      // Group by workCode
      const worksMap = new Map<string, number>();
      filtered.forEach(m => {
        const data = m.normalizedData as any;
        if (data.workCode && data.quantity) {
          const current = worksMap.get(data.workCode) || 0;
          worksMap.set(data.workCode, current + data.quantity);
        }
      });

      const worksData = [];
      for (const entry of Array.from(worksMap.entries())) {
        const [code, quantity] = entry;
        const work = await storage.getWorkByCode(code);
        if (work) {
          worksData.push({
            workId: work.id,
            quantity,
            description: work.description
          });
        }
      }

      const act = await storage.createAct({
        dateStart: input.dateStart,
        dateEnd: input.dateEnd,
        status: "generated",
        worksData: worksData,
        location: (filtered[0].normalizedData as any)?.location || "Site"
      });

      res.status(201).json(act);

    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
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

      for (const actNumber of actNumbers) {
        const tasks = groups.get(actNumber) ?? [];
        if (tasks.length === 0) continue;

        let minStart: string | null = null;
        let maxEnd: string | null = null;

        const workIdsSet = new Set<number>();
        for (const t of tasks) {
          const start = String(t.startDate);
          const durationDays = Number(t.durationDays ?? 0);
          const end = addDaysISO(start, durationDays);

          if (!minStart || start < minStart) minStart = start;
          if (!maxEnd || end > maxEnd) maxEnd = end;

          workIdsSet.add(Number(t.workId));
        }

        const workIds = Array.from(workIdsSet);
        const works = await storage.getWorksByIds(workIds);
        works.sort((a, b) => String(a.code).localeCompare(String(b.code)));

        const worksData = works.map((w) => {
          const rawQty: any = (w as any).quantityTotal;
          const qty = rawQty == null ? 0 : Number(rawQty);
          return {
            workId: w.id,
            quantity: Number.isFinite(qty) ? qty : 0,
            description: w.description,
          };
        });

        const result = await storage.upsertActByNumber({
          actNumber,
          dateStart: minStart,
          dateEnd: maxEnd,
          status: "draft",
          worksData,
        });

        if (result.created) created++;
        else updated++;
      }

      return res.status(200).json({
        scheduleId: id,
        actNumbers,
        created,
        updated,
        skippedNoActNumber,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Generate acts from schedule failed:", err);
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
      const updated = await storage.patchScheduleTask(id, input);

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

      // Allow exporting without explicit templates (for acts generated from schedule).
      // Strategy:
      // - if templateIds provided -> use them
      // - else try act_template_selections
      // - else generate a single "default" AOSR PDF using worksData aggregated from the act
      let effectiveTemplateIds: string[] = Array.isArray(templateIds) ? templateIds : [];
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

      if (effectiveTemplateIds.length === 0) {
        const actNumber = formData?.actNumber || String(act.actNumber ?? act.id);
        const actDate = formData?.actDate || String(act.dateEnd ?? new Date().toISOString().split("T")[0]);
        const p1Works =
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

        const actData: ActData = {
          actNumber,
          actDate,
          city: formData?.city || "Москва",
          objectName: formData?.objectName || "Объект строительства",
          objectAddress: formData?.objectAddress || act.location || "Адрес объекта",
          workDescription: formData?.workDescription || "Работы по акту (из графика)",
          dateStart: act.dateStart || new Date().toISOString().split("T")[0],
          dateEnd: act.dateEnd || new Date().toISOString().split("T")[0],
          p1Works,

          // эталонные поля (005_АОСР 4)
          objectFullName: formData?.objectFullName,
          developerOrgFull: formData?.developerOrgFull,
          builderOrgFull: formData?.builderOrgFull,
          designerOrgFull: formData?.designerOrgFull,
          repCustomerControlLine: formData?.repCustomerControlLine,
          repCustomerControlOrder: formData?.repCustomerControlOrder,
          repBuilderLine: formData?.repBuilderLine,
          repBuilderOrder: formData?.repBuilderOrder,
          repBuilderControlLine: formData?.repBuilderControlLine,
          repBuilderControlOrder: formData?.repBuilderControlOrder,
          repDesignerLine: formData?.repDesignerLine,
          repDesignerOrder: formData?.repDesignerOrder,
          repWorkPerformerLine: formData?.repWorkPerformerLine,
          repWorkPerformerOrder: formData?.repWorkPerformerOrder,
          p2ProjectDocs: formData?.p2ProjectDocs,
          p3MaterialsText: formData?.p3MaterialsText,
          p4AsBuiltDocs: formData?.p4AsBuiltDocs,
          p6NormativeRefs: formData?.p6NormativeRefs,
          p7NextWorks: formData?.p7NextWorks,
          additionalInfo: formData?.additionalInfo,
          copiesCount: formData?.copiesCount,
          attachments: Array.isArray(formData?.attachments) ? formData.attachments : undefined,
          attachmentsText: formData?.attachmentsText,
          sigCustomerControl: formData?.sigCustomerControl,
          sigBuilder: formData?.sigBuilder,
          sigBuilderControl: formData?.sigBuilderControl,
          sigDesigner: formData?.sigDesigner,
          sigWorkPerformer: formData?.sigWorkPerformer,
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
        const actData: ActData = {
          actNumber: formData?.actNumber || String(act.actNumber ?? act.id),
          // "Дата составления" по умолчанию = дата окончания акта (если есть)
          actDate: formData?.actDate || String(act.dateEnd ?? new Date().toISOString().split("T")[0]),

          // legacy fields (оставляем для обратной совместимости/фолбэков)
          city: formData?.city || "Москва",
          objectName: formData?.objectName || "Объект строительства",
          objectAddress: formData?.objectAddress || act.location || "Адрес объекта",
          developerRepName: formData?.developerRepName || "",
          developerRepPosition: formData?.developerRepPosition || "",
          contractorRepName: formData?.contractorRepName || "",
          contractorRepPosition: formData?.contractorRepPosition || "",
          supervisorRepName: formData?.supervisorRepName || "",
          supervisorRepPosition: formData?.supervisorRepPosition || "",

          workDescription: template.description || template.title,
          projectDocumentation: formData?.projectDocumentation || "Рабочая документация",
          dateStart: act.dateStart || new Date().toISOString().split("T")[0],
          dateEnd: act.dateEnd || new Date().toISOString().split("T")[0],
          qualityDocuments: formData?.qualityDocuments || "Сертификаты, паспорта качества",
          materials: formData?.materials,

          // эталонные поля (005_АОСР 4)
          objectFullName: formData?.objectFullName,
          developerOrgFull: formData?.developerOrgFull,
          builderOrgFull: formData?.builderOrgFull,
          designerOrgFull: formData?.designerOrgFull,

          repCustomerControlLine: formData?.repCustomerControlLine,
          repCustomerControlOrder: formData?.repCustomerControlOrder,
          repBuilderLine: formData?.repBuilderLine,
          repBuilderOrder: formData?.repBuilderOrder,
          repBuilderControlLine: formData?.repBuilderControlLine,
          repBuilderControlOrder: formData?.repBuilderControlOrder,
          repDesignerLine: formData?.repDesignerLine,
          repDesignerOrder: formData?.repDesignerOrder,
          repWorkPerformerLine: formData?.repWorkPerformerLine,
          repWorkPerformerOrder: formData?.repWorkPerformerOrder,

          p2ProjectDocs: formData?.p2ProjectDocs,
          p3MaterialsText: formData?.p3MaterialsText,
          p4AsBuiltDocs: formData?.p4AsBuiltDocs,
          p6NormativeRefs: formData?.p6NormativeRefs,
          p7NextWorks: formData?.p7NextWorks,
          additionalInfo: formData?.additionalInfo,
          copiesCount: formData?.copiesCount,

          attachments: Array.isArray(formData?.attachments) ? formData.attachments : undefined,
          attachmentsText: formData?.attachmentsText,

          sigCustomerControl: formData?.sigCustomerControl,
          sigBuilder: formData?.sigBuilder,
          sigBuilderControl: formData?.sigBuilderControl,
          sigDesigner: formData?.sigDesigner,
          sigWorkPerformer: formData?.sigWorkPerformer,
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

  // Create act with selected templates
  app.post("/api/acts/create-with-templates", async (req, res) => {
    try {
      const { dateStart, dateEnd, location, templateIds, formData } = req.body;

      if (!templateIds || !Array.isArray(templateIds) || templateIds.length === 0) {
        return res.status(400).json({ message: "No templates selected" });
      }

      // Create the act
      const act = await storage.createAct({
        dateStart,
        dateEnd,
        location: location || formData?.objectAddress || "Объект",
        status: "draft",
        worksData: [],
      });

      // Create template selections
      for (const templateId of templateIds) {
        const template = await storage.getActTemplateByTemplateId(templateId);
        if (template) {
          await storage.createActTemplateSelection({
            actId: act.id,
            templateId: template.id,
            status: "pending",
          });
        }
      }

      res.status(201).json(act);
    } catch (err) {
      console.error("Error creating act with templates:", err);
      res.status(500).json({ message: "Failed to create act" });
    }
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
