import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import { generateAosrPdf, loadTemplateCatalog, type ActData } from "./pdfGenerator";
import * as fs from "fs";
import * as path from "path";

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

      const { templateIds, formData } = req.body;

      if (!templateIds || !Array.isArray(templateIds) || templateIds.length === 0) {
        return res.status(400).json({ message: "No templates selected" });
      }

      // Ensure generated PDFs directory exists
      const pdfDir = path.join(process.cwd(), "generated_pdfs");
      if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
      }

      const generatedFiles: { templateId: string; filename: string; url: string }[] = [];

      for (const templateId of templateIds) {
        const template = await storage.getActTemplateByTemplateId(templateId);
        if (!template) continue;

        // Build act data from form and database
        const actData: ActData = {
          actNumber: formData?.actNumber || `${act.id}`,
          actDate: formData?.actDate || new Date().toISOString().split("T")[0],
          city: formData?.city || "Москва",
          objectName: formData?.objectName || "Объект строительства",
          objectAddress: formData?.objectAddress || act.location || "Адрес объекта",
          developerRepName: formData?.developerRepName || "Иванов И.И.",
          developerRepPosition: formData?.developerRepPosition || "Главный инженер",
          contractorRepName: formData?.contractorRepName || "Петров П.П.",
          contractorRepPosition: formData?.contractorRepPosition || "Прораб",
          supervisorRepName: formData?.supervisorRepName || "Сидоров С.С.",
          supervisorRepPosition: formData?.supervisorRepPosition || "Инженер стройконтроля",
          workDescription: template.description || template.title,
          projectDocumentation: formData?.projectDocumentation || "Рабочая документация",
          dateStart: act.dateStart || new Date().toISOString().split("T")[0],
          dateEnd: act.dateEnd || new Date().toISOString().split("T")[0],
          qualityDocuments: formData?.qualityDocuments || "Сертификаты, паспорта качества",
          materials: formData?.materials,
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
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
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
