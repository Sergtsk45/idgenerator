/**
 * @file: materials.ts
 * @description: Materials, documents, invoice parsing and corrections API routes
 * @dependencies: _common.ts, @shared/routes, server/middleware/tariff, multer, express-rate-limit
 * @created: 2026-03-18
 */

import type { Express } from 'express';
import { z } from 'zod';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { api } from '@shared/routes';
import { storage, appAuth } from './_common';
import { requireFeature, requireQuota } from '../middleware/tariff';

// ── Invoice upload config ────────────────────────────────────────────────────

const invoiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted'));
    }
  },
});

const ALLOWED_EXTRACTOR_URLS = [
  'http://localhost:5002',
  'http://localhost:5050',
  'http://invoice-extractor:5000',
];

function validateExtractorUrl(url: string): boolean {
  return ALLOWED_EXTRACTOR_URLS.includes(url);
}

const invoiceParseRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many invoice parse requests, please try again later' },
});

const correctionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { message: 'Too many correction submissions, try later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Route registration ───────────────────────────────────────────────────────

export function registerMaterialsRoutes(app: Express): void {
  // ── Materials Catalog ──────────────────────────────────────────────────────

  // GET /api/materials-catalog/search — поиск в каталоге материалов
  app.get(api.materialsCatalog.search.path, async (req, res) => {
    try {
      const query = typeof req.query.query === 'string' ? req.query.query : '';
      const list = await storage.searchMaterialsCatalog(query);
      return res.status(200).json(list);
    } catch (err) {
      console.error('Materials catalog search failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // POST /api/materials-catalog — создать запись в каталоге
  app.post(api.materialsCatalog.create.path, async (req, res) => {
    try {
      const input = api.materialsCatalog.create.input.parse(req.body);
      const created = await storage.createMaterialCatalog(input as any);
      return res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error('Materials catalog create failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // ── Project Materials ──────────────────────────────────────────────────────

  // GET /api/objects/:objectId/materials — список материалов проекта
  app.get(api.projectMaterials.list.path, async (req, res) => {
    const objectId = Number(req.params.objectId);
    if (!Number.isFinite(objectId) || objectId <= 0) {
      return res.status(400).json({ message: 'Invalid objectId' });
    }
    try {
      const list = await storage.listProjectMaterials(objectId);
      return res.status(200).json(list);
    } catch (err) {
      console.error('Project materials list failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // POST /api/objects/:objectId/materials — создать материал проекта
  app.post(api.projectMaterials.create.path, async (req, res) => {
    const objectId = Number(req.params.objectId);
    if (!Number.isFinite(objectId) || objectId <= 0) {
      return res.status(400).json({ message: 'Invalid objectId' });
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
      console.error('Project materials create failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // GET /api/materials/:id — получить материал проекта
  app.get(api.projectMaterials.get.path, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid id' });
    }
    try {
      const data = await storage.getProjectMaterial(id);
      if (!data) return res.status(404).json({ message: 'Not found' });
      return res.status(200).json(data);
    } catch (err) {
      console.error('Project material get failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // PATCH /api/materials/:id — обновить материал проекта
  app.patch(api.projectMaterials.patch.path, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid id' });
    }
    try {
      const patch = api.projectMaterials.patch.input.parse(req.body);
      const updated = await storage.updateProjectMaterial(id, patch as any);
      if (!updated) return res.status(404).json({ message: 'Not found' });
      return res.status(200).json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error('Project material patch failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // POST /api/materials/:id/save-to-catalog — сохранить материал в каталог
  app.post(api.projectMaterials.saveToCatalog.path, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid id' });
    }
    try {
      api.projectMaterials.saveToCatalog.input?.parse(req.body ?? {});
      const created = await storage.saveProjectMaterialToCatalog(id);
      return res.status(200).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      if (err instanceof Error && err.message === 'PROJECT_MATERIAL_NOT_FOUND') {
        return res.status(404).json({ message: 'Not found' });
      }
      if (err instanceof Error && err.message === 'NAME_OVERRIDE_REQUIRED') {
        return res.status(400).json({ message: 'nameOverride is required for local materials' });
      }
      console.error('Save project material to catalog failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // POST /api/objects/:objectId/materials/parse-invoice — парсинг накладной (PDF → позиции)
  app.post(
    api.projectMaterials.parseInvoice.path,
    invoiceParseRateLimiter,
    ...appAuth,
    requireFeature('INVOICE_IMPORT'),
    requireQuota('invoiceImports', (req) => storage.countMonthlyInvoiceImports(req.user!.id)),
    (req, res, next) => {
      invoiceUpload.single('file')(req, res, (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return res.status(400).json({ message: 'File too large (max 50 MB)' });
            }
            return res.status(400).json({ message: err.message });
          }
          if (err.message === 'Only PDF files are accepted') {
            return res.status(400).json({ message: err.message });
          }
          return res.status(500).json({ message: 'File upload failed' });
        }
        next();
      });
    },
    async (req, res) => {
      const objectId = Number(req.params.objectId);
      if (!Number.isFinite(objectId) || objectId <= 0) {
        return res.status(400).json({ message: 'Invalid objectId' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'PDF file is required' });
      }

      const extractorUrl = process.env.INVOICE_EXTRACTOR_URL || 'http://localhost:5050';

      if (!validateExtractorUrl(extractorUrl)) {
        console.error(`Invalid INVOICE_EXTRACTOR_URL: ${extractorUrl}`);
        return res.status(502).json({ message: 'Invoice extractor configuration error' });
      }

      const formData = new FormData();
      formData.append(
        'file',
        new Blob([req.file.buffer], { type: 'application/pdf' }),
        req.file.originalname,
      );
      formData.append('output', 'json');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 150_000);

      try {
        const response = await fetch(`${extractorUrl}/convert`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          console.error(`Invoice extractor error ${response.status}:`, errBody);
          return res.status(502).json({ message: `Invoice extractor returned ${response.status}` });
        }

        const data = await response.json();
        const items = (data.items || [])
          .map((item: any) => ({
            name: String(item.name || item.description || '').trim(),
            unit: String(item.unit || '').trim(),
            qty: item.qty != null ? String(item.qty).trim() : undefined,
          }))
          .filter((item: any) => item.name.length > 0);

        await storage.recordInvoiceImport({
          userId: req.user!.id,
          objectId,
          pdfFilename: req.file!.originalname || null,
          itemsCount: items.length,
        });

        return res.status(200).json({
          items,
          invoice_number: data.invoice_number || undefined,
          invoice_date: data.invoice_date || undefined,
          supplier_name: data.supplier?.name || undefined,
        });
      } catch (err: any) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
          return res.status(502).json({ message: 'Invoice extractor timeout' });
        }
        console.error('Invoice parse-invoice proxy error:', err);
        return res.status(502).json({ message: 'Invoice extractor unavailable' });
      } finally {
        if (req.file) {
          (req.file as any).buffer = null;
        }
      }
    },
  );

  // POST /api/objects/:objectId/materials/bulk — массовое создание материалов
  app.post(api.projectMaterials.bulkCreate.path, async (req, res) => {
    const objectId = Number(req.params.objectId);
    if (!Number.isFinite(objectId) || objectId <= 0) {
      return res.status(400).json({ message: 'Invalid objectId' });
    }
    try {
      const { items, supplierName, deliveryDate } =
        api.projectMaterials.bulkCreate.input.parse(req.body);
      const result = await storage.bulkCreateProjectMaterials(objectId, items, {
        supplierName,
        deliveryDate,
      });
      return res.status(200).json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error('Bulk create materials failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // ── Material Batches ───────────────────────────────────────────────────────

  // POST /api/materials/:id/batches — создать партию
  app.post(api.materialBatches.create.path, async (req, res) => {
    const projectMaterialId = Number(req.params.id);
    if (!Number.isFinite(projectMaterialId) || projectMaterialId <= 0) {
      return res.status(400).json({ message: 'Invalid project material id' });
    }
    try {
      const input = api.materialBatches.create.input.parse(req.body);
      const created = await storage.createBatch(projectMaterialId, input as any);
      return res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      if (err instanceof Error && err.message === 'PROJECT_MATERIAL_NOT_FOUND') {
        return res.status(404).json({ message: 'Not found' });
      }
      console.error('Create batch failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // PATCH /api/batches/:id — обновить партию
  app.patch(api.materialBatches.patch.path, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid id' });
    }
    try {
      const patch = api.materialBatches.patch.input.parse(req.body);
      const updated = await storage.updateBatch(id, patch as any);
      if (!updated) return res.status(404).json({ message: 'Not found' });
      return res.status(200).json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error('Batch patch failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // DELETE /api/batches/:id — удалить партию (только dev)
  app.delete(api.materialBatches.delete.path, async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ message: 'Not found' });
    }
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid id' });
    }
    try {
      const ok = await storage.deleteBatch(id);
      if (!ok) return res.status(404).json({ message: 'Not found' });
      return res.status(204).send();
    } catch (err) {
      console.error('Delete batch failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // ── Invoice Corrections ────────────────────────────────────────────────────

  // POST /api/invoice-corrections — сохранить исправления разметки накладной
  app.post(api.invoiceCorrections.submit.path, correctionRateLimiter, ...appAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const input = api.invoiceCorrections.submit.input.parse(req.body);

      const obj = await storage.getObject(input.objectId);
      if (!obj || obj.userId !== userId) {
        return res.status(400).json({ message: 'Invalid objectId' });
      }

      const corrections = input.corrections.map((c) => ({
        objectId: input.objectId,
        userId,
        fieldName: c.fieldName,
        originalValue: c.originalValue,
        correctedValue: c.correctedValue,
        itemIndex: c.itemIndex,
        invoiceNumber: input.invoiceNumber,
        supplierName: input.supplierName,
        pdfFilename: input.pdfFilename,
      }));

      const saved = await storage.saveInvoiceCorrections(corrections);
      return res.status(200).json({ saved });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error('Save invoice corrections failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // GET /api/invoice-corrections/stats — статистика исправлений
  app.get(api.invoiceCorrections.stats.path, ...appAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const obj = await storage.getCurrentObject(userId);
      const from = typeof req.query.from === 'string' ? req.query.from : undefined;
      const to = typeof req.query.to === 'string' ? req.query.to : undefined;

      const stats = await storage.getInvoiceCorrectionStats({ objectId: obj.id, from, to });
      return res.status(200).json(stats);
    } catch (err) {
      console.error('Get invoice correction stats failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // ── Documents & Bindings ───────────────────────────────────────────────────

  // GET /api/documents — список документов
  app.get(api.documents.list.path, async (req, res) => {
    try {
      const query = typeof req.query.query === 'string' ? req.query.query : undefined;
      const docType = typeof req.query.docType === 'string' ? req.query.docType : undefined;
      const scope = typeof req.query.scope === 'string' ? req.query.scope : undefined;
      const list = await storage.searchDocuments({ query, docType, scope });
      return res.status(200).json(list);
    } catch (err) {
      console.error('Documents list failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // POST /api/documents — создать документ
  app.post(api.documents.create.path, async (req, res) => {
    try {
      const input = api.documents.create.input.parse(req.body);
      const created = await storage.createDocument(input as any);
      return res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error('Documents create failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // POST /api/document-bindings — создать привязку документа
  app.post(api.documentBindings.create.path, async (req, res) => {
    try {
      const input = api.documentBindings.create.input.parse(req.body);
      const created = await storage.createBinding(input as any);
      return res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error('Document binding create failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // PATCH /api/document-bindings/:id — обновить привязку документа
  app.patch(api.documentBindings.patch.path, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid id' });
    }
    try {
      const patch = api.documentBindings.patch.input.parse(req.body);
      const updated = await storage.updateBinding(id, patch as any);
      if (!updated) return res.status(404).json({ message: 'Not found' });
      return res.status(200).json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error('Document binding patch failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // DELETE /api/document-bindings/:id — удалить привязку документа
  app.delete(api.documentBindings.delete.path, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid id' });
    }
    try {
      const ok = await storage.deleteBinding(id);
      if (!ok) return res.status(404).json({ message: 'Not found' });
      return res.status(204).send();
    } catch (err) {
      console.error('Delete document binding failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });
}
