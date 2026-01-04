import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";

// Initialize OpenAI client - it will use the environment variables from the integration
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Works (BoQ)
  app.get(api.works.list.path, async (req, res) => {
    const works = await storage.getWorks();
    res.json(works);
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
        const works = await storage.getWorks();
        const worksContext = works.map(w => `${w.code}: ${w.description} (${w.unit})`).join('\n');

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
              
              If no work matches, set workCode to null.`
            },
            { role: "user", content: input.messageRaw }
          ],
          response_format: { type: "json_object" }
        });

        const normalized = JSON.parse(completion.choices[0].message.content || "{}");
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
      for (const [code, quantity] of worksMap.entries()) {
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
      quantityTotal: 100
    });
    await storage.createWork({
      code: "3.1.2",
      description: "Concrete pouring for foundation",
      unit: "m3",
      quantityTotal: 500
    });
    await storage.createWork({
      code: "4.5",
      description: "Bricklaying for external walls",
      unit: "m2",
      quantityTotal: 1200
    });
  }
}

// Run seed
seedDatabase().catch(console.error);
