import { z } from 'zod';
import { insertWorkSchema, insertMessageSchema, insertActSchema, works, messages, acts, attachments } from './schema';

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
