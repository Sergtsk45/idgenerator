import { z } from 'zod';
import {
  insertWorkSchema,
  insertMessageSchema,
  insertActSchema,
  insertScheduleSchema,
  schedules,
  scheduleTasks,
  works,
  messages,
  acts,
  attachments
} from './schema';

export const api = {
  works: {
    list: {
      method: 'GET' as const,
      path: '/api/works',
      responses: {
        200: z.array(z.custom<typeof works.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/works',
      input: insertWorkSchema,
      responses: {
        201: z.custom<typeof works.$inferSelect>(),
        400: z.object({ message: z.string() }),
      },
    },
    import: {
      method: 'POST' as const,
      path: '/api/works/import',
      input: z.object({
        mode: z.enum(['merge', 'replace']).optional(),
        items: z.array(insertWorkSchema),
      }),
      responses: {
        200: z.object({
          mode: z.enum(['merge', 'replace']),
          received: z.number(),
          created: z.number(),
          updated: z.number(),
        }),
        400: z.object({ message: z.string() }),
      },
    },
  },
  messages: {
    list: {
      method: 'GET' as const,
      path: '/api/messages',
      responses: {
        200: z.array(z.custom<typeof messages.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/messages',
      input: z.object({
        userId: z.string(),
        messageRaw: z.string(),
      }),
      responses: {
        201: z.custom<typeof messages.$inferSelect>(),
        400: z.object({ message: z.string() }),
      },
    },
    process: {
      method: 'POST' as const,
      path: '/api/messages/:id/process',
      responses: {
        200: z.custom<typeof messages.$inferSelect>(),
        404: z.object({ message: z.string() }),
      },
    },
  },
  acts: {
    list: {
      method: 'GET' as const,
      path: '/api/acts',
      responses: {
        200: z.array(z.custom<typeof acts.$inferSelect>()),
      },
    },
    generate: {
      method: 'POST' as const,
      path: '/api/acts/generate',
      input: z.object({
        dateStart: z.string(), // ISO Date
        dateEnd: z.string(),   // ISO Date
      }),
      responses: {
        201: z.custom<typeof acts.$inferSelect>(),
        400: z.object({ message: z.string() }),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/acts/:id',
      responses: {
        200: z.custom<typeof acts.$inferSelect & { attachments: typeof attachments.$inferSelect[] }>(),
        404: z.object({ message: z.string() }),
      },
    },
  },
  schedules: {
    default: {
      method: 'GET' as const,
      path: '/api/schedules/default',
      responses: {
        200: z.custom<typeof schedules.$inferSelect>(),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/schedules',
      input: insertScheduleSchema,
      responses: {
        201: z.custom<typeof schedules.$inferSelect>(),
        400: z.object({ message: z.string() }),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/schedules/:id',
      responses: {
        200: z.custom<typeof schedules.$inferSelect & { tasks: typeof scheduleTasks.$inferSelect[] }>(),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
    bootstrapFromWorks: {
      method: 'POST' as const,
      path: '/api/schedules/:id/bootstrap-from-works',
      input: z.object({
        workIds: z.array(z.number().int().positive()).optional(),
        defaultStartDate: z.string().optional(), // YYYY-MM-DD
        defaultDurationDays: z.number().int().min(1).optional(),
      }),
      responses: {
        200: z.object({
          scheduleId: z.number(),
          created: z.number(),
          skipped: z.number(),
        }),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
    generateActs: {
      method: 'POST' as const,
      path: '/api/schedules/:id/generate-acts',
      input: z.object({}).optional(),
      responses: {
        200: z.object({
          scheduleId: z.number(),
          actNumbers: z.array(z.number().int().positive()),
          created: z.number(),
          updated: z.number(),
          skippedNoActNumber: z.number(),
        }),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
  },
  scheduleTasks: {
    patch: {
      method: 'PATCH' as const,
      path: '/api/schedule-tasks/:id',
      input: z
        .object({
          titleOverride: z.string().nullable().optional(),
          startDate: z.string().optional(), // YYYY-MM-DD
          durationDays: z.number().int().min(1).optional(),
          orderIndex: z.number().int().min(0).optional(),
          actNumber: z.number().int().positive().nullable().optional(),
        })
        .refine((v) => Object.keys(v).length > 0, { message: 'Empty patch' }),
      responses: {
        200: z.custom<typeof scheduleTasks.$inferSelect>(),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type {
  Work,
  InsertWork,
  Message,
  InsertMessage,
  Act,
  InsertAct,
  Schedule,
  InsertSchedule,
  ScheduleTask,
  InsertScheduleTask,
  CreateMessageRequest,
  GenerateActRequest,
} from "./schema";
