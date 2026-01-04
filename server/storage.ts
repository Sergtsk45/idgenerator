import { db } from "./db";
import {
  works, messages, acts, attachments,
  type InsertWork, type InsertMessage, type InsertAct,
  type Work, type Message, type Act, type Attachment
} from "@shared/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  // Works
  getWorks(): Promise<Work[]>;
  createWork(work: InsertWork): Promise<Work>;
  getWorkByCode(code: string): Promise<Work | undefined>;

  // Messages
  getMessages(): Promise<Message[]>;
  getMessage(id: number): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessageNormalized(id: number, normalizedData: any): Promise<Message>;

  // Acts
  getActs(): Promise<Act[]>;
  getAct(id: number): Promise<Act | undefined>;
  createAct(act: InsertAct): Promise<Act>;
  
  // Attachments
  getAttachments(actId: number): Promise<Attachment[]>;
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

  async createAct(act: InsertAct): Promise<Act> {
    const [newAct] = await db.insert(acts).values(act).returning();
    return newAct;
  }

  async getAttachments(actId: number): Promise<Attachment[]> {
    return await db.select().from(attachments).where(eq(attachments.actId, actId));
  }
}

export const storage = new DatabaseStorage();
