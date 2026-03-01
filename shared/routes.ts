import { z } from 'zod';
import {
  objects,
  materialsCatalog,
  projectMaterials,
  materialBatches,
  documents,
  documentBindings,
  actMaterialUsages,
  actDocumentAttachments,
  estimatePositionMaterialLinks,
  taskMaterials,
  insertWorkSchema,
  insertWorkCollectionSchema,
  insertWorkSectionSchema,
  insertEstimateSchema,
  insertEstimateSectionSchema,
  insertEstimatePositionSchema,
  insertPositionResourceSchema,
  insertMessageSchema,
  insertActSchema,
  insertScheduleSchema,
  schedules,
  scheduleTasks,
  works,
  workCollections,
  workSections,
  estimates,
  estimateSections,
  estimatePositions,
  positionResources,
  messages,
  acts,
  attachments,
} from './schema';

export const partyDtoSchema = z.object({
  fullName: z.string(),
  shortName: z.string().optional(),
  inn: z.string().optional(),
  kpp: z.string().optional(),
  ogrn: z.string().optional(),
  sroFullName: z.string().optional(),
  sroShortName: z.string().optional(),
  sroOgrn: z.string().optional(),
  sroInn: z.string().optional(),
  addressLegal: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
});

export const personDtoSchema = z.object({
  personName: z.string(),
  position: z.string().optional(),
  basisText: z.string().optional(),
  lineText: z.string().optional(),
  signText: z.string().optional(),
});

export const sourceDataDtoSchema = z.object({
  object: z.object({
    title: z.string(),
    address: z.string(),
    city: z.string(),
  }),
  parties: z.object({
    customer: partyDtoSchema,
    builder: partyDtoSchema,
    designer: partyDtoSchema,
  }),
  persons: z.object({
    developer_rep: personDtoSchema,
    contractor_rep: personDtoSchema,
    supervisor_rep: personDtoSchema,
    rep_customer_control: personDtoSchema,
    rep_builder: personDtoSchema,
    rep_builder_control: personDtoSchema,
    rep_designer: personDtoSchema,
    rep_work_performer: personDtoSchema,
  }),
});

const estimateSubrowStatusSchema = z.object({
  status: z.enum(["none", "partial", "ok"]),
  reason: z.string().optional(),
  projectMaterialId: z.number().int().positive().optional(),
  batchId: z.number().int().positive().nullable().optional(),
});

export const workSegmentSchema = z.object({
  text: z.string(),
  sourceType: z.enum(['message', 'act']),
  sourceId: z.number(),
  isPending: z.boolean(),
});
export type WorkSegment = z.infer<typeof workSegmentSchema>;

export const section3RowSchema = z.object({
  date: z.string(),
  workConditions: z.string(),
  segments: z.array(workSegmentSchema),
  representative: z.string(),
});
export type Section3Row = z.infer<typeof section3RowSchema>;

const registerSchema = z.object({
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const linkProviderSchema = z.object({
  provider: z.enum(['telegram', 'email', 'phone']),
  externalId: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

const linkEmailSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const userResponseSchema = z.object({
  id: z.number(),
  displayName: z.string(),
  email: z.string().nullable(),
  role: z.string(),
});

const authResponseSchema = z.object({
  user: userResponseSchema,
  token: z.string(),
});

export const api = {
  auth: {
    loginTelegram: {
      method: 'POST' as const,
      path: '/api/auth/login/telegram',
      responses: {
        200: authResponseSchema,
        401: z.object({ error: z.string() }),
      },
    },
    register: {
      method: 'POST' as const,
      path: '/api/auth/register',
      input: registerSchema,
      responses: {
        201: authResponseSchema,
        400: z.object({ error: z.string(), details: z.array(z.any()).optional() }),
        409: z.object({ error: z.string() }),
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/auth/login',
      input: loginSchema,
      responses: {
        200: authResponseSchema,
        401: z.object({ error: z.string() }),
        403: z.object({ error: z.string() }),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me',
      responses: {
        200: userResponseSchema,
        401: z.object({ error: z.string() }),
      },
    },
    linkEmail: {
      method: 'POST' as const,
      path: '/api/auth/link-email',
      input: linkEmailSchema,
      responses: {
        200: z.object({ success: z.boolean() }),
        400: z.object({ error: z.string(), details: z.array(z.any()).optional() }),
        401: z.object({ error: z.string() }),
        409: z.object({ error: z.string() }),
      },
    },
    linkProvider: {
      method: 'POST' as const,
      path: '/api/auth/link-provider',
      input: linkProviderSchema,
      responses: {
        200: z.object({ success: z.boolean() }),
        400: z.object({ error: z.string(), details: z.array(z.any()).optional() }),
        401: z.object({ error: z.string() }),
        409: z.object({ error: z.string() }),
      },
    },
  },
  object: {
    current: {
      method: 'GET' as const,
      path: '/api/object/current',
      responses: {
        200: z.custom<typeof objects.$inferSelect>(),
      },
    },
    patchCurrent: {
      method: 'PATCH' as const,
      path: '/api/object/current',
      input: z
        .object({
          title: z.string().optional(),
          address: z.string().nullable().optional(),
          city: z.string().nullable().optional(),
        })
        .refine((v) => Object.keys(v).length > 0, { message: 'Empty patch' }),
      responses: {
        200: z.custom<typeof objects.$inferSelect>(),
        400: z.object({ message: z.string() }),
      },
    },
    getSourceData: {
      method: 'GET' as const,
      path: '/api/object/current/source-data',
      responses: {
        200: sourceDataDtoSchema,
        404: z.object({ message: z.string() }),
      },
    },
    putSourceData: {
      method: 'PUT' as const,
      path: '/api/object/current/source-data',
      input: sourceDataDtoSchema,
      responses: {
        200: sourceDataDtoSchema,
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
  },
  materialsCatalog: {
    search: {
      method: "GET" as const,
      path: "/api/materials-catalog",
      responses: {
        200: z.array(z.custom<typeof materialsCatalog.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/materials-catalog",
      input: z.object({
        name: z.string().trim().min(1),
        category: z.enum(["material", "equipment", "product"]).nullable().optional(),
        standardRef: z.string().nullable().optional(),
        baseUnit: z.string().nullable().optional(),
        params: z.record(z.any()).optional(),
      }),
      responses: {
        201: z.custom<typeof materialsCatalog.$inferSelect>(),
        400: z.object({ message: z.string() }),
      },
    },
    import: {
      method: "POST" as const,
      path: "/api/admin/materials-catalog/import",
      input: z.object({
        mode: z.enum(["merge", "replace"]),
        items: z.array(
          z.object({
            name: z.string().min(1),
            unit: z.string().optional(),
            gostTu: z.string().optional(),
            category: z.enum(["material", "equipment", "product"]).optional(),
          })
        ).max(5000),
      }),
      responses: {
        200: z.object({
          received: z.number(),
          created: z.number(),
          updated: z.number(),
          skipped: z.number(),
        }),
        400: z.object({ message: z.string() }),
      },
    },
  },
  projectMaterials: {
    list: {
      method: "GET" as const,
      path: "/api/objects/:objectId/materials",
      responses: {
        200: z.array(
          z
            .object({
              id: z.number(),
              objectId: z.number(),
              catalogMaterialId: z.number().nullable().optional(),
              nameOverride: z.string().nullable().optional(),
              baseUnitOverride: z.string().nullable().optional(),
              paramsOverride: z.any().optional(),
              createdAt: z.any().optional(),
              updatedAt: z.any().optional(),
              deletedAt: z.any().optional(),
              // aggregates
              batchesCount: z.number().int().nonnegative(),
              docsCount: z.number().int().nonnegative(),
              qualityDocsCount: z.number().int().nonnegative(),
              hasUseInActsQualityDoc: z.boolean(),
            })
            .passthrough()
        ),
        400: z.object({ message: z.string() }),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/objects/:objectId/materials",
      input: z
        .object({
          catalogMaterialId: z.number().int().positive().optional(),
          nameOverride: z.string().trim().min(1).optional(),
          baseUnitOverride: z.string().trim().min(1).optional(),
          paramsOverride: z.record(z.any()).optional(),
        })
        .refine((v) => v.catalogMaterialId != null || v.nameOverride != null, {
          message: "Either catalogMaterialId or nameOverride is required",
        }),
      responses: {
        201: z.custom<typeof projectMaterials.$inferSelect>(),
        400: z.object({ message: z.string() }),
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/project-materials/:id",
      responses: {
        200: z
          .object({
            material: z.custom<typeof projectMaterials.$inferSelect>(),
            catalog: z.custom<typeof materialsCatalog.$inferSelect>().nullable().optional(),
            batches: z.array(z.custom<typeof materialBatches.$inferSelect>()),
            bindings: z.array(z.custom<typeof documentBindings.$inferSelect>()),
            documents: z.array(z.custom<typeof documents.$inferSelect>()).optional(),
          })
          .passthrough(),
        404: z.object({ message: z.string() }),
      },
    },
    patch: {
      method: "PATCH" as const,
      path: "/api/project-materials/:id",
      input: z
        .object({
          nameOverride: z.string().nullable().optional(),
          baseUnitOverride: z.string().nullable().optional(),
          paramsOverride: z.record(z.any()).nullable().optional(),
          catalogMaterialId: z.number().int().positive().nullable().optional(),
        })
        .refine((v) => Object.keys(v).length > 0, { message: "Empty patch" }),
      responses: {
        200: z.custom<typeof projectMaterials.$inferSelect>(),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
    saveToCatalog: {
      method: "POST" as const,
      path: "/api/project-materials/:id/save-to-catalog",
      input: z.object({}).optional(),
      responses: {
        200: z.custom<typeof materialsCatalog.$inferSelect>(),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
    parseInvoice: {
      method: "POST" as const,
      path: "/api/objects/:objectId/materials/parse-invoice",
      input: z.object({}),
      responses: {
        200: z.object({
          items: z.array(z.object({
            name: z.string(),
            unit: z.string().optional().default(""),
            qty: z.union([z.number(), z.string()]).optional(),
            price: z.union([z.number(), z.string()]).optional(),
            amount_w_vat: z.union([z.number(), z.string()]).optional(),
            vat_rate: z.string().optional(),
          })),
          invoice_number: z.string().optional(),
          invoice_date: z.string().optional(),
          supplier_name: z.string().optional(),
          warnings: z.array(z.string()).optional(),
        }),
        400: z.object({ message: z.string() }),
        502: z.object({ message: z.string() }),
      },
    },
    bulkCreate: {
      method: "POST" as const,
      path: "/api/objects/:objectId/materials/bulk",
      input: z.object({
        items: z.array(z.object({
          nameOverride: z.string().trim().min(1),
          baseUnitOverride: z.string().trim().optional(),
        })).min(1).max(500),
      }),
      responses: {
        200: z.object({
          created: z.number().int().nonnegative(),
          skipped: z.number().int().nonnegative(),
          materials: z.array(z.custom<typeof projectMaterials.$inferSelect>()),
        }),
        400: z.object({ message: z.string() }),
      },
    },
  },
  materialBatches: {
    create: {
      method: "POST" as const,
      path: "/api/project-materials/:id/batches",
      input: z.object({
        supplierName: z.string().nullable().optional(),
        plant: z.string().nullable().optional(),
        batchNumber: z.string().nullable().optional(),
        deliveryDate: z.string().nullable().optional(), // YYYY-MM-DD
        quantity: z.string().nullable().optional(), // numeric
        unit: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
      responses: {
        201: z.custom<typeof materialBatches.$inferSelect>(),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
    patch: {
      method: "PATCH" as const,
      path: "/api/material-batches/:id",
      input: z
        .object({
          supplierName: z.string().nullable().optional(),
          plant: z.string().nullable().optional(),
          batchNumber: z.string().nullable().optional(),
          deliveryDate: z.string().nullable().optional(), // YYYY-MM-DD
          quantity: z.string().nullable().optional(), // numeric
          unit: z.string().nullable().optional(),
          notes: z.string().nullable().optional(),
        })
        .refine((v) => Object.keys(v).length > 0, { message: "Empty patch" }),
      responses: {
        200: z.custom<typeof materialBatches.$inferSelect>(),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/material-batches/:id",
      responses: {
        204: z.any(),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
  },
  documents: {
    list: {
      method: "GET" as const,
      path: "/api/documents",
      responses: {
        200: z.array(z.custom<typeof documents.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/documents",
      input: z.object({
        docType: z.enum(["certificate", "declaration", "passport", "protocol", "scheme", "other"]),
        scope: z.enum(["global", "project"]).optional(),
        title: z.string().nullable().optional(),
        docNumber: z.string().nullable().optional(),
        docDate: z.string().nullable().optional(), // YYYY-MM-DD
        validFrom: z.string().nullable().optional(),
        validTo: z.string().nullable().optional(),
        meta: z.record(z.any()).optional(),
        fileUrl: z.string().nullable().optional(),
      }),
      responses: {
        201: z.custom<typeof documents.$inferSelect>(),
        400: z.object({ message: z.string() }),
      },
    },
  },
  documentBindings: {
    create: {
      method: "POST" as const,
      path: "/api/document-bindings",
      input: z
        .object({
          documentId: z.number().int().positive(),
          objectId: z.number().int().positive().nullable().optional(),
          projectMaterialId: z.number().int().positive().nullable().optional(),
          batchId: z.number().int().positive().nullable().optional(),
          bindingRole: z.enum(["quality", "passport", "protocol", "scheme", "other"]).optional(),
          useInActs: z.boolean().optional(),
          isPrimary: z.boolean().optional(),
        })
        .refine((v) => v.objectId != null || v.projectMaterialId != null || v.batchId != null, {
          message: "Binding target is required (objectId/projectMaterialId/batchId)",
        }),
      responses: {
        201: z.custom<typeof documentBindings.$inferSelect>(),
        400: z.object({ message: z.string() }),
      },
    },
    patch: {
      method: "PATCH" as const,
      path: "/api/document-bindings/:id",
      input: z
        .object({
          useInActs: z.boolean().optional(),
          isPrimary: z.boolean().optional(),
          bindingRole: z.enum(["quality", "passport", "protocol", "scheme", "other"]).optional(),
        })
        .refine((v) => Object.keys(v).length > 0, { message: "Empty patch" }),
      responses: {
        200: z.custom<typeof documentBindings.$inferSelect>(),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/document-bindings/:id",
      responses: {
        204: z.any(),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
  },
  actMaterialUsages: {
    list: {
      method: "GET" as const,
      path: "/api/acts/:id/material-usages",
      responses: {
        200: z.array(z.custom<typeof actMaterialUsages.$inferSelect>()).or(z.array(z.any())),
        404: z.object({ message: z.string() }),
      },
    },
    replace: {
      method: "PUT" as const,
      path: "/api/acts/:id/material-usages",
      input: z.object({
        items: z.array(
          z.object({
            projectMaterialId: z.number().int().positive(),
            workId: z.number().int().positive().nullable().optional(),
            batchId: z.number().int().positive().nullable().optional(),
            qualityDocumentId: z.number().int().positive().nullable().optional(),
            note: z.string().nullable().optional(),
            orderIndex: z.number().int().min(0).optional(),
          })
        ),
      }),
      responses: {
        200: z.array(z.any()),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
  },
  actDocumentAttachments: {
    list: {
      method: "GET" as const,
      path: "/api/acts/:id/document-attachments",
      responses: {
        200: z.array(z.custom<typeof actDocumentAttachments.$inferSelect>()).or(z.array(z.any())),
        404: z.object({ message: z.string() }),
      },
    },
    replace: {
      method: "PUT" as const,
      path: "/api/acts/:id/document-attachments",
      input: z.object({
        items: z.array(
          z.object({
            documentId: z.number().int().positive(),
            orderIndex: z.number().int().min(0).optional(),
          })
        ),
      }),
      responses: {
        200: z.array(z.any()),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
  },
  works: {
    list: {
      method: 'GET' as const,
      path: '/api/works',
      responses: {
        200: z.array(z.custom<typeof works.$inferSelect>()),
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/works",
      // Optional query:
      // - resetSchedule=1: if any schedules use works as their source, reset their tasks and clear worksData in affected acts,
      //   then clear all works (BoQ).
      responses: {
        204: z.any(),
        409: z.object({ message: z.string() }),
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
  workCollections: {
    list: {
      method: "GET" as const,
      path: "/api/work-collections",
      responses: {
        200: z.array(z.custom<typeof workCollections.$inferSelect>()),
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/work-collections/:id",
      responses: {
        200: z.object({
          collection: z.custom<typeof workCollections.$inferSelect>(),
          sections: z.array(z.any()),
        }),
        404: z.object({ message: z.string() }),
      },
    },
    import: {
      method: "POST" as const,
      path: "/api/work-collections/import",
      input: z.object({
        collection: insertWorkCollectionSchema.extend({
          code: z.string().nullable().optional(),
          objectName: z.string().nullable().optional(),
          region: z.string().nullable().optional(),
          totalCost: z.string().nullable().optional(),
          totalConstruction: z.string().nullable().optional(),
          totalInstallation: z.string().nullable().optional(),
          totalEquipment: z.string().nullable().optional(),
          totalOther: z.string().nullable().optional(),
        }),
        sections: z.array(
          insertWorkSectionSchema
            .omit({ workCollectionId: true })
            .extend({ orderIndex: z.number().int().optional().default(0) })
        ),
        positions: z.array(
          insertWorkSchema
            .omit({ workCollectionId: true, sectionId: true })
            .extend({
              sectionNumber: z.string().nullable().optional(),
              lineNo: z.string().nullable().optional(),
              notes: z.string().nullable().optional(),
              baseCostPerUnit: z.string().nullable().optional(),
              currentCostPerUnit: z.string().nullable().optional(),
              totalCurrentCost: z.string().nullable().optional(),
              orderIndex: z.number().int().optional().default(0),
            })
        ),
      }),
      responses: {
        200: z.object({
          collectionId: z.number(),
          sections: z.number(),
          positions: z.number(),
        }),
        400: z.object({ message: z.string() }),
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/work-collections/:id",
      // Optional query:
      // - resetSchedule=1: if this collection is used as a schedule source, reset schedule
      responses: {
        204: z.any(),
        404: z.object({ message: z.string() }),
        409: z.object({ message: z.string() }),
      },
    },
  },
  estimates: {
    list: {
      method: "GET" as const,
      path: "/api/estimates",
      responses: {
        200: z.array(z.custom<typeof estimates.$inferSelect>()),
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/estimates/:id",
      responses: {
        200: z.object({
          estimate: z.custom<typeof estimates.$inferSelect>(),
          // NOTE: keep flexible to allow iterative parser improvements without breaking clients
          sections: z.array(z.any()),
        }),
        404: z.object({ message: z.string() }),
      },
    },
    import: {
      method: "POST" as const,
      path: "/api/estimates/import",
      input: z.object({
        estimate: insertEstimateSchema.extend({
          // Allow null/undefined from parser
          code: z.string().nullable().optional(),
          objectName: z.string().nullable().optional(),
          region: z.string().nullable().optional(),
          pricingQuarter: z.string().nullable().optional(),
          totalCost: z.string().nullable().optional(),
          totalConstruction: z.string().nullable().optional(),
          totalInstallation: z.string().nullable().optional(),
          totalEquipment: z.string().nullable().optional(),
          totalOther: z.string().nullable().optional(),
        }),
        sections: z.array(
          insertEstimateSectionSchema
            .omit({ estimateId: true })
            .extend({ orderIndex: z.number().int().optional().default(0) })
        ),
        positions: z.array(
          insertEstimatePositionSchema
            .omit({ estimateId: true, sectionId: true })
            .extend({
              sectionNumber: z.string().nullable().optional(),
              code: z.string().nullable().optional(),
              unit: z.string().nullable().optional(),
              quantity: z.string().nullable().optional(),
              baseCostPerUnit: z.string().nullable().optional(),
              indexValue: z.string().nullable().optional(),
              currentCostPerUnit: z.string().nullable().optional(),
              totalCurrentCost: z.string().nullable().optional(),
              notes: z.string().nullable().optional(),
              orderIndex: z.number().int().optional().default(0),
            })
        ),
        resources: z.array(
          insertPositionResourceSchema
            .omit({ positionId: true })
            .extend({
              positionLineNo: z.string(),
              resourceCode: z.string().nullable().optional(),
              resourceType: z.string().nullable().optional(),
              unit: z.string().nullable().optional(),
              quantity: z.string().nullable().optional(),
              quantityTotal: z.string().nullable().optional(),
              baseCostPerUnit: z.string().nullable().optional(),
              currentCostPerUnit: z.string().nullable().optional(),
              totalCurrentCost: z.string().nullable().optional(),
              orderIndex: z.number().int().optional().default(0),
            }),
        ),
      }),
      responses: {
        200: z.object({
          estimateId: z.number(),
          sections: z.number(),
          positions: z.number(),
          resources: z.number(),
        }),
        400: z.object({ message: z.string() }),
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/estimates/:id",
      // Optional query:
      // - resetSchedule=1: if this estimate is used as a schedule source, reset schedule (tasks + affected acts worksData)
      //   and then delete the estimate.
      responses: {
        204: z.any(),
        404: z.object({ message: z.string() }),
        409: z.object({ message: z.string() }),
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
    patch: {
      method: 'PATCH' as const,
      path: '/api/messages/:id',
      input: z.object({
        messageRaw: z.string().optional(),
        normalizedData: z.object({
          workCode: z.string().optional(),
          workDescription: z.string().optional(),
          quantity: z.number().optional(),
          unit: z.string().optional(),
          date: z.string().optional(),
          location: z.string().optional(),
          workConditions: z.string().optional(),
          materials: z.array(z.string()).optional(),
          representative: z.string().optional(),
        }).optional(),
      }),
      responses: {
        200: z.custom<typeof messages.$inferSelect>(),
        404: z.object({ message: z.string() }),
      },
    },
  },
  worklog: {
    section3: {
      method: 'GET' as const,
      path: '/api/worklog/section3',
      responses: {
        200: z.array(section3RowSchema),
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
          deletedActNumbers: z.array(z.number().int().positive()),
          warnings: z.array(
            z.object({
              actNumber: z.number().int().positive(),
              type: z.enum([
                "no_materials",
                "no_quality_docs",
                "no_drawings",
                "no_normatives",
                "mixed_template_types",
                "no_template_type",
              ]),
              message: z.string(),
            }),
          ),
        }),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
    sourceInfo: {
      method: 'GET' as const,
      path: '/api/schedules/:id/source-info',
      responses: {
        200: z.object({
          sourceType: z.enum(['works', 'estimate']),
          estimateId: z.number().nullable(),
          estimateName: z.string().nullable(),
          tasksCount: z.number(),
          affectedActNumbers: z.array(z.number().int().positive()),
        }),
        404: z.object({ message: z.string() }),
      },
    },
    changeSource: {
      method: 'POST' as const,
      path: '/api/schedules/:id/change-source',
      input: z.object({
        newSourceType: z.enum(['works', 'estimate']),
        estimateId: z.number().int().positive().optional(),
        confirmReset: z.boolean(),
      }),
      responses: {
        200: z.union([
          z.object({
            requiresConfirmation: z.literal(true),
            message: z.string(),
            tasksCount: z.number(),
            affectedActNumbers: z.array(z.number().int().positive()),
          }),
          z.object({
            success: z.literal(true),
            deletedTasks: z.number(),
            clearedActs: z.number(),
          }),
        ]),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
    bootstrapFromEstimate: {
      method: 'POST' as const,
      path: '/api/schedules/:id/bootstrap-from-estimate',
      input: z.object({
        positionIds: z.array(z.number().int().positive()).optional(),
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
          actTemplateId: z.number().int().positive().nullable().optional(),
          projectDrawings: z.string().nullable().optional(),
          normativeRefs: z.string().nullable().optional(),
          executiveSchemes: z
            .array(z.object({ title: z.string().min(1), fileUrl: z.string().min(1).optional() }))
            .nullable()
            .optional(),
          // Independent quantity/unit for this task (detached from source after bootstrap)
          quantity: z.number().nonnegative().nullable().optional(),
          unit: z.string().nullable().optional(),
          updateAllTasks: z.boolean().optional(),
        })
        .refine((v) => Object.keys(v).length > 0, { message: 'Empty patch' }),
      responses: {
        200: z.custom<typeof scheduleTasks.$inferSelect>(),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
        409: z.object({
          message: z.string(),
          actNumber: z.number().int().positive().nullable(),
          currentTemplateId: z.number().int().positive().nullable(),
          otherTasksCount: z.number().int().min(0),
          conflictKind: z.enum(["actNumberAssign", "actNumberChange", "templateChange"]).optional(),
        }),
      },
    },
  },
  taskMaterials: {
    list: {
      method: "GET" as const,
      path: "/api/schedule-tasks/:id/materials",
      responses: {
        200: z.array(
          z.object({
            id: z.number().int().positive(),
            taskId: z.number().int().positive(),
            projectMaterialId: z.number().int().positive(),
            batchId: z.number().int().positive().nullable(),
            qualityDocumentId: z.number().int().positive().nullable(),
            note: z.string().nullable(),
            orderIndex: z.number().int(),
            createdAt: z.any(),
            projectMaterialName: z.string().nullable().optional(),
            batchLabel: z.string().nullable().optional(),
            qualityDocumentTitle: z.string().nullable().optional(),
            qualityDocumentNumber: z.string().nullable().optional(),
            qualityDocumentFileUrl: z.string().nullable().optional(),
          }),
        ),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
    replace: {
      method: "PUT" as const,
      path: "/api/schedule-tasks/:id/materials",
      input: z.object({
        items: z.array(
          z.object({
            projectMaterialId: z.number().int().positive(),
            batchId: z.number().int().positive().nullable().optional(),
            qualityDocumentId: z.number().int().positive().nullable().optional(),
            note: z.string().nullable().optional(),
            orderIndex: z.number().int().min(0).optional(),
          }),
        ),
      }),
      responses: {
        200: z.array(z.custom<typeof taskMaterials.$inferSelect>()).or(z.array(z.any())),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
    add: {
      method: "POST" as const,
      path: "/api/schedule-tasks/:id/materials",
      input: z.object({
        projectMaterialId: z.number().int().positive(),
        batchId: z.number().int().positive().nullable().optional(),
        qualityDocumentId: z.number().int().positive().nullable().optional(),
        note: z.string().nullable().optional(),
        orderIndex: z.number().int().min(0).optional(),
      }),
      responses: {
        201: z.custom<typeof taskMaterials.$inferSelect>(),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
    remove: {
      method: "DELETE" as const,
      path: "/api/schedule-tasks/:id/materials/:materialId",
      responses: {
        204: z.any(),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
  },
  estimatePositionLinks: {
    statuses: {
      method: "GET" as const,
      path: "/api/schedules/:id/estimate-subrows/statuses",
      responses: {
        200: z.object({
          byEstimatePositionId: z.record(z.string(), estimateSubrowStatusSchema),
        }),
        400: z.object({ message: z.string() }),
        404: z.object({ message: z.string() }),
      },
    },
    upsert: {
      method: "POST" as const,
      path: "/api/estimate-position-links",
      input: z.object({
        estimateId: z.number().int().positive(),
        estimatePositionId: z.number().int().positive(),
        projectMaterialId: z.number().int().positive(),
        batchId: z.number().int().positive().nullable().optional(),
      }),
      responses: {
        200: z.custom<typeof estimatePositionMaterialLinks.$inferSelect>(),
        201: z.custom<typeof estimatePositionMaterialLinks.$inferSelect>(),
        400: z.object({ message: z.string() }),
      },
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/estimate-position-links/:estimatePositionId",
      responses: {
        204: z.any(),
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
  Estimate,
  InsertEstimate,
  EstimateSection,
  InsertEstimateSection,
  EstimatePosition,
  InsertEstimatePosition,
  PositionResource,
  InsertPositionResource,
  Message,
  InsertMessage,
  Act,
  InsertAct,
  MaterialCatalog,
  InsertMaterialCatalog,
  ProjectMaterial,
  InsertProjectMaterial,
  MaterialBatch,
  InsertMaterialBatch,
  Document,
  InsertDocument,
  DocumentBinding,
  InsertDocumentBinding,
  ActMaterialUsage,
  InsertActMaterialUsage,
  ActDocumentAttachment,
  InsertActDocumentAttachment,
  Schedule,
  InsertSchedule,
  ScheduleTask,
  InsertScheduleTask,
  CreateMessageRequest,
  GenerateActRequest,
} from "./schema";

export type PartyDto = z.infer<typeof partyDtoSchema>;
export type PersonDto = z.infer<typeof personDtoSchema>;
export type SourceDataDto = z.infer<typeof sourceDataDtoSchema>;

export type ImportMaterialItem = z.infer<typeof api.materialsCatalog.import.input>["items"][number];
export type ImportMaterialsRequest = z.infer<typeof api.materialsCatalog.import.input>;
export type ImportMaterialsResponse = z.infer<typeof api.materialsCatalog.import.responses[200]>;
