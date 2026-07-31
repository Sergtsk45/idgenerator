/**
 * @file: actAttachmentsPdf.ts
 * @description: Сборка единого PDF-пакета приложений к акту.
 * @dependencies: pdf-lib, server/storage, server/document-files, server/pdfGenerator
 * @created: 2026-07-31
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { PDFDocument } from "pdf-lib";
import { isPdf, resolveDocumentFile } from "./document-files";
import { generatePdfBuffer } from "./pdfGenerator";

export const ACT_ATTACHMENTS_MAX_DOCUMENTS = 100;
export const ACT_ATTACHMENTS_MAX_BYTES = 200 * 1024 * 1024;

export type ActAttachmentProblemReason =
  | "missing"
  | "not_pdf"
  | "unreadable"
  | "unsupported_url"
  | "too_many_documents"
  | "total_size_exceeded";

export interface ActAttachmentProblem {
  documentId: number;
  title: string;
  reason: ActAttachmentProblemReason;
}

export interface ActAttachmentsPdfResult {
  buffer: Buffer;
  documentsCount: number;
  problems: ActAttachmentProblem[];
}

const INTERNAL_DOCUMENT_URL = /^\/api\/documents\/files\/(\d+)\/([^/]+)$/;

interface ActAttachmentsSource {
  getAct(actId: number): Promise<{
    id: number;
    objectId: number | null;
    actNumber: number | null;
    dateEnd: string | null;
  } | undefined>;
  getObject(objectId: number): Promise<{ title: string } | undefined>;
  getActDocAttachments(actId: number): Promise<
    Array<{
      documentId: number;
      orderIndex: number;
      document?: { title: string | null; fileUrl: string | null } | null;
    }>
  >;
}

function formatActDate(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  return match ? `${match[3]}.${match[2]}.${match[1]}` : String(value ?? "");
}

function buildTitleDefinition(input: {
  actNumber: number;
  objectName: string;
  actDate: string;
  documentsCount: number;
}): TDocumentDefinitions {
  return {
    pageSize: "A4",
    pageMargins: [60, 80, 60, 80],
    defaultStyle: { font: "Roboto", fontSize: 14 },
    content: [
      {
        text: `Приложения к Акту №${input.actNumber}`,
        bold: true,
        fontSize: 22,
        alignment: "center",
        margin: [0, 120, 0, 60],
      },
      { text: input.objectName, alignment: "center", margin: [0, 0, 0, 24] },
      { text: `Дата акта: ${input.actDate}`, alignment: "center", margin: [0, 0, 0, 12] },
      { text: `Количество документов: ${input.documentsCount}`, alignment: "center" },
    ],
  };
}

export async function buildActAttachmentsPdf(
  actId: number,
  source?: ActAttachmentsSource,
): Promise<ActAttachmentsPdfResult> {
  const dataSource = source ?? (await import("./storage")).storage;
  const act = await dataSource.getAct(actId);
  if (!act?.objectId) throw new Error("Act not found");

  const object = await dataSource.getObject(act.objectId);
  if (!object) throw new Error("Object not found");

  const seenDocumentIds = new Set<number>();
  const attachments = (await dataSource.getActDocAttachments(actId))
    .map((attachment, sourceIndex) => ({ attachment, sourceIndex }))
    .sort(
      (left, right) =>
        Number(left.attachment.orderIndex) - Number(right.attachment.orderIndex) ||
        left.sourceIndex - right.sourceIndex,
    )
    .filter(({ attachment }) => {
      const documentId = Number(attachment.documentId);
      if (seenDocumentIds.has(documentId)) return false;
      seenDocumentIds.add(documentId);
      return true;
    })
    .map(({ attachment }) => attachment);

  const documentsCount = attachments.length;
  if (documentsCount === 0) return { buffer: Buffer.alloc(0), documentsCount, problems: [] };
  if (documentsCount > ACT_ATTACHMENTS_MAX_DOCUMENTS) {
    return {
      buffer: Buffer.alloc(0),
      documentsCount,
      problems: [
        {
          documentId: 0,
          title: `Пакет содержит ${documentsCount} документов (максимум ${ACT_ATTACHMENTS_MAX_DOCUMENTS})`,
          reason: "too_many_documents",
        },
      ],
    };
  }

  const problems: ActAttachmentProblem[] = [];
  const sourcePdfs: PDFDocument[] = [];
  let totalBytes = 0;

  for (const attachment of attachments) {
    const documentId = Number(attachment.documentId);
    const document = attachment.document;
    const title = document?.title?.trim() || `Документ #${documentId}`;
    const fileUrl = document?.fileUrl?.trim();

    if (!fileUrl) {
      problems.push({ documentId, title, reason: "missing" });
      continue;
    }
    if (/^https?:\/\//i.test(fileUrl)) {
      problems.push({ documentId, title, reason: "unsupported_url" });
      continue;
    }

    const match = INTERNAL_DOCUMENT_URL.exec(fileUrl);
    if (!match || Number(match[1]) !== act.objectId) {
      problems.push({ documentId, title, reason: "unreadable" });
      continue;
    }

    let buffer: Buffer;
    try {
      buffer = await readFile(resolveDocumentFile(act.objectId, path.basename(match[2])));
    } catch (error) {
      const reason = (error as NodeJS.ErrnoException).code === "ENOENT" ? "missing" : "unreadable";
      problems.push({ documentId, title, reason });
      continue;
    }

    if (!isPdf(buffer)) {
      problems.push({ documentId, title, reason: "not_pdf" });
      continue;
    }

    totalBytes += buffer.length;
    if (totalBytes > ACT_ATTACHMENTS_MAX_BYTES) {
      problems.push({
        documentId,
        title: `Суммарный размер пакета превышает ${ACT_ATTACHMENTS_MAX_BYTES / 1024 / 1024} МБ`,
        reason: "total_size_exceeded",
      });
      break;
    }

    try {
      sourcePdfs.push(await PDFDocument.load(buffer));
    } catch {
      problems.push({ documentId, title, reason: "unreadable" });
    }
  }

  if (problems.length > 0) return { buffer: Buffer.alloc(0), documentsCount, problems };

  const title = await generatePdfBuffer(
    buildTitleDefinition({
      actNumber: act.actNumber ?? act.id,
      objectName: object.title,
      actDate: formatActDate(act.dateEnd),
      documentsCount,
    }),
  );
  const result = await PDFDocument.create();
  for (const pdf of [await PDFDocument.load(title), ...sourcePdfs]) {
    const pages = await result.copyPages(pdf, pdf.getPageIndices());
    for (const page of pages) result.addPage(page);
  }

  return { buffer: Buffer.from(await result.save()), documentsCount, problems };
}
