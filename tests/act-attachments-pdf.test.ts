/**
 * @file: act-attachments-pdf.test.ts
 * @description: Runnable check сборки PDF-пакета приложений к акту.
 * @dependencies: node:test, pdf-lib, server/actAttachmentsPdf
 * @created: 2026-07-31
 */

import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import {
  ACT_ATTACHMENTS_MAX_BYTES,
  ACT_ATTACHMENTS_MAX_DOCUMENTS,
  buildActAttachmentsPdf,
} from "../server/actAttachmentsPdf";
import { api } from "../shared/routes";

async function onePagePdf(width: number, height: number): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.addPage([width, height]);
  return Buffer.from(await pdf.save());
}

test("attachment package is ordered, deduplicated and rejects incomplete input", async () => {
  const uploadRoot = await mkdtemp(path.join(os.tmpdir(), "act-attachments-"));
  const previousUploadRoot = process.env.DOCUMENTS_UPLOAD_DIR;
  const source = {
    getAct: async () => ({ id: 21, objectId: 6, actNumber: 5, dateEnd: "2026-07-31" }),
    getObject: async () => ({ title: "Тестовый объект" }),
    getActDocAttachments: async (): Promise<any[]> => [],
  };

  process.env.DOCUMENTS_UPLOAD_DIR = uploadRoot;

  try {
    const objectRoot = path.join(uploadRoot, "6");
    await mkdir(objectRoot);
    await writeFile(path.join(objectRoot, "1_first_abcd1234.pdf"), await onePagePdf(200, 300));
    await writeFile(path.join(objectRoot, "2_second_abcd1234.pdf"), await onePagePdf(400, 500));

    source.getActDocAttachments = async () => [
      {
        documentId: 1,
        orderIndex: 20,
        document: { title: "Первый", fileUrl: "/api/documents/files/6/1_first_abcd1234.pdf" },
      },
      {
        documentId: 2,
        orderIndex: 10,
        document: { title: "Второй", fileUrl: "/api/documents/files/6/2_second_abcd1234.pdf" },
      },
      {
        documentId: 2,
        orderIndex: 30,
        document: { title: "Дубликат", fileUrl: "/api/documents/files/6/2_second_abcd1234.pdf" },
      },
    ];

    const success = await buildActAttachmentsPdf(21, source);
    const merged = await PDFDocument.load(success.buffer);
    assert.equal(success.documentsCount, 2);
    assert.deepEqual(success.problems, []);
    assert.equal(merged.getPageCount(), 3);
    assert.deepEqual(
      merged.getPages().slice(1).map((page) => [page.getWidth(), page.getHeight()]),
      [
        [400, 500],
        [200, 300],
      ],
    );

    await writeFile(path.join(objectRoot, "4_broken_abcd1234.pdf"), "not a pdf");
    source.getActDocAttachments = async () => [
      {
        documentId: 3,
        orderIndex: 0,
        document: { title: "Нет файла", fileUrl: "/api/documents/files/6/3_missing_abcd1234.pdf" },
      },
      {
        documentId: 4,
        orderIndex: 1,
        document: { title: "Не PDF", fileUrl: "/api/documents/files/6/4_broken_abcd1234.pdf" },
      },
      {
        documentId: 5,
        orderIndex: 2,
        document: { title: "Внешний", fileUrl: "https://example.com/file.pdf" },
      },
    ];

    const rejected = await buildActAttachmentsPdf(21, source);
    assert.equal(rejected.buffer.length, 0);
    assert.deepEqual(
      rejected.problems.map(({ documentId, reason }) => [documentId, reason]),
      [
        [3, "missing"],
        [4, "not_pdf"],
        [5, "unsupported_url"],
      ],
    );

    source.getActDocAttachments = async () =>
      Array.from({ length: ACT_ATTACHMENTS_MAX_DOCUMENTS + 1 }, (_, index) => ({
        documentId: index + 1,
        orderIndex: index,
        document: { title: `Документ ${index + 1}`, fileUrl: null },
      }));
    const overLimit = await buildActAttachmentsPdf(21, source);
    assert.equal(ACT_ATTACHMENTS_MAX_BYTES, 200 * 1024 * 1024);
    assert.equal(overLimit.buffer.length, 0);
    assert.equal(overLimit.documentsCount, 101);
    assert.equal(overLimit.problems[0].reason, "too_many_documents");
  } finally {
    if (previousUploadRoot === undefined) delete process.env.DOCUMENTS_UPLOAD_DIR;
    else process.env.DOCUMENTS_UPLOAD_DIR = previousUploadRoot;
    await rm(uploadRoot, { recursive: true, force: true });
  }
});

test("attachment export contract and route enforce the documented boundary", async () => {
  assert.equal(api.acts.exportAttachments.method, "POST");
  assert.equal(api.acts.exportAttachments.path, "/api/acts/:id/export-attachments");
  assert.doesNotThrow(() =>
    api.acts.exportAttachments.responses[200].parse({
      url: "/api/pdfs/act_attachments_21_1785288000000.pdf",
      filename: "Акт_5_приложения.pdf",
      documentsCount: 1,
    }),
  );
  assert.doesNotThrow(() =>
    api.acts.exportAttachments.responses[422].parse({
      message: "Не удалось собрать полный пакет приложений",
      problems: [{ documentId: 61, title: "Паспорт", reason: "missing" }],
    }),
  );

  const routes = await readFile("server/routes/acts.ts", "utf8");
  assert.match(routes, /app\.post\(api\.acts\.exportAttachments\.path,\s*\.\.\.appAuth/);
  assert.match(routes, /!act \|\| act\.objectId !== object\.id[\s\S]*status\(404\)/);
  assert.match(routes, /result\.documentsCount === 0[\s\S]*status\(409\)/);
  assert.match(routes, /result\.problems\.length > 0[\s\S]*status\(422\)/);
  assert.match(routes, /filename\*=UTF-8''\$\{encodeURIComponent\(downloadName\)\}/);
});
