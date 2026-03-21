/**
 * @file: acts.ts
 * @description: Acts (АОСР), act templates, PDF export and material/document attachment routes
 * @dependencies: _common.ts, @shared/routes, server/pdfGenerator, fs, path
 * @created: 2026-03-18
 */

import type { Express } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { api } from '@shared/routes';
import { storage, appAuth } from './_common';
import {
  buildActDataFromSourceData,
  buildAttachmentsText,
  buildP3MaterialsText,
  generateAosrPdf,
  loadTemplateCatalog,
  type ActData,
} from '../pdfGenerator';

export function registerActsRoutes(app: Express): void {
  // ── Act Material Usages ────────────────────────────────────────────────────

  // GET /api/acts/:id/material-usages
  app.get(api.actMaterialUsages.list.path, async (req, res) => {
    const actId = Number(req.params.id);
    if (!Number.isFinite(actId) || actId <= 0) {
      return res.status(400).json({ message: 'Invalid act id' });
    }
    try {
      const items = await storage.getActMaterialUsages(actId);
      return res.status(200).json(items);
    } catch (err) {
      console.error('Act material usages list failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // PUT /api/acts/:id/material-usages
  app.put(api.actMaterialUsages.replace.path, async (req, res) => {
    const actId = Number(req.params.id);
    if (!Number.isFinite(actId) || actId <= 0) {
      return res.status(400).json({ message: 'Invalid act id' });
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
      console.error('Act material usages replace failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // ── Act Document Attachments ───────────────────────────────────────────────

  // GET /api/acts/:id/document-attachments
  app.get(api.actDocumentAttachments.list.path, async (req, res) => {
    const actId = Number(req.params.id);
    if (!Number.isFinite(actId) || actId <= 0) {
      return res.status(400).json({ message: 'Invalid act id' });
    }
    try {
      const items = await storage.getActDocAttachments(actId);
      return res.status(200).json(items);
    } catch (err) {
      console.error('Act document attachments list failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // PUT /api/acts/:id/document-attachments
  app.put(api.actDocumentAttachments.replace.path, async (req, res) => {
    const actId = Number(req.params.id);
    if (!Number.isFinite(actId) || actId <= 0) {
      return res.status(400).json({ message: 'Invalid act id' });
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
      console.error('Act document attachments replace failed:', err);
      return res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // ── Acts CRUD ──────────────────────────────────────────────────────────────

  // GET /api/acts — список актов текущего объекта
  app.get(api.acts.list.path, ...appAuth, async (req, res) => {
    const obj = await storage.getCurrentObject(req.user!.id);
    const acts = await storage.getActs(obj.id);
    res.json(acts);
  });

  // POST /api/acts/generate — DEPRECATED (410)
  app.post(api.acts.generate.path, async (_req, res) => {
    return res.status(410).json({
      message: 'Эндпоинт устарел: акты АОСР теперь создаются только из графика работ (/schedule).',
    });
  });

  // GET /api/acts/:id — получить акт с вложениями
  app.get(api.acts.get.path, ...appAuth, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid id' });
    }

    const obj = await storage.getCurrentObject(req.user!.id);
    const act = await storage.getAct(id);
    if (!act) return res.status(404).json({ message: 'Act not found' });
    if (act.objectId !== obj.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const attachments = await storage.getAttachments(act.id);
    return res.json({ ...act, attachments });
  });

  // ── Act Templates ──────────────────────────────────────────────────────────

  // GET /api/act-templates — список шаблонов актов (seed при первом запросе)
  app.get('/api/act-templates', async (_req, res) => {
    try {
      const templates = await storage.getActTemplates();

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
      console.error('Error fetching act templates:', err);
      res.status(500).json({ message: 'Failed to load templates' });
    }
  });

  // ── PDF Export ─────────────────────────────────────────────────────────────

  // POST /api/acts/:id/export — генерация PDF для акта
  app.post('/api/acts/:id/export', ...appAuth, async (req, res) => {
    try {
      const actId = Number(req.params.id);
      const act = await storage.getAct(actId);
      if (!act) {
        return res.status(404).json({ message: 'Act not found' });
      }

      const { templateIds, formData } = req.body ?? {};

      const objectId = (act as any).objectId ?? (await storage.getCurrentObject(req.user!.id)).id;
      const sourceData = await storage.getObjectSourceData(Number(objectId));
      const objectActData = buildActDataFromSourceData(sourceData);
      const dbP3MaterialsText = await buildP3MaterialsText(actId);
      const dbAttachmentsText = await buildAttachmentsText(actId);

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

      const pdfDir = path.join(process.cwd(), 'generated_pdfs');
      if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
      }

      const generatedFiles: { templateId: string; filename: string; url: string }[] = [];

      const p1WorksAuto =
        Array.isArray(act.worksData) && act.worksData.length > 0
          ? act.worksData
              .map((w, idx) => {
                const qty = typeof (w as any).quantity === 'number' ? (w as any).quantity : 0;
                const desc = String((w as any).description ?? '').trim();
                const line = desc || `workId ${(w as any).workId ?? ''}`.trim();
                return `${idx + 1}. ${line}${qty ? ` — ${qty}` : ''}`;
              })
              .join('\n')
          : '';
      const p1Works = formData?.p1Works || p1WorksAuto;

      if (effectiveTemplateIds.length === 0) {
        const actNumber = formData?.actNumber || String(act.actNumber ?? act.id);
        const actDate =
          formData?.actDate || String(act.dateEnd ?? new Date().toISOString().split('T')[0]);

        const actProjectDrawingsAgg = String((act as any).projectDrawingsAgg ?? '').trim();
        const actNormativeRefsAgg = String((act as any).normativeRefsAgg ?? '').trim();
        const schemesAggRaw = (act as any).executiveSchemesAgg;
        const schemesAgg = Array.isArray(schemesAggRaw) ? schemesAggRaw : [];
        const schemesText = schemesAgg
          .map((s: any) => {
            const title = String(s?.title ?? '').trim();
            const fileUrl = String(s?.fileUrl ?? '').trim();
            if (!title) return '';
            return fileUrl
              ? `Исполнительная схема: ${title} — ${fileUrl}`
              : `Исполнительная схема: ${title}`;
          })
          .filter(Boolean)
          .join('\n');
        const combinedDbAttachmentsText = [
          String(dbAttachmentsText || '').trim(),
          schemesText,
        ]
          .filter(Boolean)
          .join('\n');

        const actData: ActData = {
          ...objectActData,
          actNumber,
          actDate,
          city: formData?.city ?? objectActData.city ?? 'Москва',
          objectName: formData?.objectName ?? objectActData.objectName ?? 'Объект строительства',
          objectAddress:
            formData?.objectAddress ?? objectActData.objectAddress ?? act.location ?? 'Адрес объекта',
          workDescription: formData?.workDescription || 'Работы по акту (из графика)',
          dateStart: act.dateStart || new Date().toISOString().split('T')[0],
          dateEnd: act.dateEnd || new Date().toISOString().split('T')[0],
          p1Works,
          objectFullName: formData?.objectFullName ?? objectActData.objectFullName,
          developerOrgFull: formData?.developerOrgFull ?? objectActData.developerOrgFull,
          builderOrgFull: formData?.builderOrgFull ?? objectActData.builderOrgFull,
          designerOrgFull: formData?.designerOrgFull ?? objectActData.designerOrgFull,
          repCustomerControlLine:
            formData?.repCustomerControlLine ?? objectActData.repCustomerControlLine,
          repCustomerControlOrder:
            formData?.repCustomerControlOrder ?? objectActData.repCustomerControlOrder,
          repBuilderLine: formData?.repBuilderLine ?? objectActData.repBuilderLine,
          repBuilderOrder: formData?.repBuilderOrder ?? objectActData.repBuilderOrder,
          repBuilderControlLine:
            formData?.repBuilderControlLine ?? objectActData.repBuilderControlLine,
          repBuilderControlOrder:
            formData?.repBuilderControlOrder ?? objectActData.repBuilderControlOrder,
          repDesignerLine: formData?.repDesignerLine ?? objectActData.repDesignerLine,
          repDesignerOrder: formData?.repDesignerOrder ?? objectActData.repDesignerOrder,
          repWorkPerformerLine:
            formData?.repWorkPerformerLine ?? objectActData.repWorkPerformerLine,
          repWorkPerformerOrder:
            formData?.repWorkPerformerOrder ?? objectActData.repWorkPerformerOrder,
          p2ProjectDocs: formData?.p2ProjectDocs ?? actProjectDrawingsAgg,
          p3MaterialsText:
            formData?.p3MaterialsText ?? (dbP3MaterialsText || objectActData.p3MaterialsText),
          p4AsBuiltDocs: formData?.p4AsBuiltDocs ?? objectActData.p4AsBuiltDocs,
          p6NormativeRefs: formData?.p6NormativeRefs ?? actNormativeRefsAgg,
          p7NextWorks: formData?.p7NextWorks ?? objectActData.p7NextWorks,
          additionalInfo: formData?.additionalInfo ?? objectActData.additionalInfo,
          copiesCount: formData?.copiesCount ?? objectActData.copiesCount,
          attachments: Array.isArray(formData?.attachments) ? formData.attachments : undefined,
          attachmentsText:
            formData?.attachmentsText ??
            (combinedDbAttachmentsText || objectActData.attachmentsText),
          sigCustomerControl:
            formData?.sigCustomerControl ?? objectActData.sigCustomerControl,
          sigBuilder: formData?.sigBuilder ?? objectActData.sigBuilder,
          sigBuilderControl: formData?.sigBuilderControl ?? objectActData.sigBuilderControl,
          sigDesigner: formData?.sigDesigner ?? objectActData.sigDesigner,
          sigWorkPerformer: formData?.sigWorkPerformer ?? objectActData.sigWorkPerformer,
        };

        const pdfBuffer = await generateAosrPdf(actData);
        const safeActNumber = String(actNumber).replace(/[^0-9A-Za-z_-]+/g, '_');
        const filename = `aosr-act-${safeActNumber}.pdf`;
        const filePath = path.join(pdfDir, filename);
        fs.writeFileSync(filePath, pdfBuffer);
        generatedFiles.push({ templateId: 'default', filename, url: `/api/pdfs/${filename}` });

        return res.json({ files: generatedFiles });
      }

      for (const templateId of effectiveTemplateIds) {
        const template = await storage.getActTemplateByTemplateId(templateId);
        if (!template) continue;

        const actProjectDrawingsAgg = String((act as any).projectDrawingsAgg ?? '').trim();
        const actNormativeRefsAgg = String((act as any).normativeRefsAgg ?? '').trim();
        const schemesAggRaw = (act as any).executiveSchemesAgg;
        const schemesAgg = Array.isArray(schemesAggRaw) ? schemesAggRaw : [];
        const schemesText = schemesAgg
          .map((s: any) => {
            const title = String(s?.title ?? '').trim();
            const fileUrl = String(s?.fileUrl ?? '').trim();
            if (!title) return '';
            return fileUrl
              ? `Исполнительная схема: ${title} — ${fileUrl}`
              : `Исполнительная схема: ${title}`;
          })
          .filter(Boolean)
          .join('\n');
        const combinedDbAttachmentsText = [
          String(dbAttachmentsText || '').trim(),
          schemesText,
        ]
          .filter(Boolean)
          .join('\n');

        const actData: ActData = {
          ...objectActData,
          actNumber: formData?.actNumber || String(act.actNumber ?? act.id),
          actDate:
            formData?.actDate || String(act.dateEnd ?? new Date().toISOString().split('T')[0]),
          city: formData?.city ?? objectActData.city ?? 'Москва',
          objectName: formData?.objectName ?? objectActData.objectName ?? 'Объект строительства',
          objectAddress:
            formData?.objectAddress ?? objectActData.objectAddress ?? act.location ?? 'Адрес объекта',
          developerRepName: formData?.developerRepName || objectActData.developerRepName || '',
          developerRepPosition:
            formData?.developerRepPosition || objectActData.developerRepPosition || '',
          contractorRepName: formData?.contractorRepName || objectActData.contractorRepName || '',
          contractorRepPosition:
            formData?.contractorRepPosition || objectActData.contractorRepPosition || '',
          supervisorRepName: formData?.supervisorRepName || objectActData.supervisorRepName || '',
          supervisorRepPosition:
            formData?.supervisorRepPosition || objectActData.supervisorRepPosition || '',
          workDescription: template.description || template.title,
          projectDocumentation:
            formData?.projectDocumentation ||
            objectActData.projectDocumentation ||
            'Рабочая документация',
          dateStart: act.dateStart || new Date().toISOString().split('T')[0],
          dateEnd: act.dateEnd || new Date().toISOString().split('T')[0],
          qualityDocuments:
            formData?.qualityDocuments || 'Сертификаты, паспорта качества',
          materials: formData?.materials,
          p1Works,
          objectFullName: formData?.objectFullName ?? objectActData.objectFullName,
          developerOrgFull: formData?.developerOrgFull ?? objectActData.developerOrgFull,
          builderOrgFull: formData?.builderOrgFull ?? objectActData.builderOrgFull,
          designerOrgFull: formData?.designerOrgFull ?? objectActData.designerOrgFull,
          repCustomerControlLine:
            formData?.repCustomerControlLine ?? objectActData.repCustomerControlLine,
          repCustomerControlOrder:
            formData?.repCustomerControlOrder ?? objectActData.repCustomerControlOrder,
          repBuilderLine: formData?.repBuilderLine ?? objectActData.repBuilderLine,
          repBuilderOrder: formData?.repBuilderOrder ?? objectActData.repBuilderOrder,
          repBuilderControlLine:
            formData?.repBuilderControlLine ?? objectActData.repBuilderControlLine,
          repBuilderControlOrder:
            formData?.repBuilderControlOrder ?? objectActData.repBuilderControlOrder,
          repDesignerLine: formData?.repDesignerLine ?? objectActData.repDesignerLine,
          repDesignerOrder: formData?.repDesignerOrder ?? objectActData.repDesignerOrder,
          repWorkPerformerLine:
            formData?.repWorkPerformerLine ?? objectActData.repWorkPerformerLine,
          repWorkPerformerOrder:
            formData?.repWorkPerformerOrder ?? objectActData.repWorkPerformerOrder,
          p2ProjectDocs: formData?.p2ProjectDocs ?? actProjectDrawingsAgg,
          p3MaterialsText:
            formData?.p3MaterialsText ?? (dbP3MaterialsText || objectActData.p3MaterialsText),
          p4AsBuiltDocs: formData?.p4AsBuiltDocs ?? objectActData.p4AsBuiltDocs,
          p6NormativeRefs: formData?.p6NormativeRefs ?? actNormativeRefsAgg,
          p7NextWorks: formData?.p7NextWorks ?? objectActData.p7NextWorks,
          additionalInfo: formData?.additionalInfo ?? objectActData.additionalInfo,
          copiesCount: formData?.copiesCount ?? objectActData.copiesCount,
          attachments: Array.isArray(formData?.attachments) ? formData.attachments : undefined,
          attachmentsText:
            formData?.attachmentsText ??
            (combinedDbAttachmentsText || objectActData.attachmentsText),
          sigCustomerControl:
            formData?.sigCustomerControl ?? objectActData.sigCustomerControl,
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
      console.error('Error exporting act:', err);
      res.status(500).json({ message: 'Failed to export act' });
    }
  });

  // GET /api/pdfs/:filename — раздача сгенерированных PDF
  app.get('/api/pdfs/:filename', (req, res) => {
    const requested = String(req.params.filename ?? '');
    const filename = path.basename(requested);
    if (!filename || filename !== requested) {
      return res.status(400).json({ message: 'Invalid filename' });
    }
    if (!filename.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ message: 'Invalid file type' });
    }

    const filePath = path.join(process.cwd(), 'generated_pdfs', filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    const download = req.query.download === '1' || req.query.download === 'true';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.sendFile(filePath);
  });

  // POST /api/acts/create-with-templates — DEPRECATED (410)
  app.post('/api/acts/create-with-templates', async (_req, res) => {
    return res.status(410).json({
      message: 'Эндпоинт устарел: акты АОСР теперь создаются только из графика работ (/schedule).',
    });
  });
}
