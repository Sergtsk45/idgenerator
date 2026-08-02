import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("act detail renders material usages and formal document attachments", async () => {
  const source = await readFile("client/src/pages/ActDetail.tsx", "utf8");

  assert.match(source, /useActMaterialUsages\(actId\)/);
  assert.match(source, /useActDocumentAttachments\(actId\)/);
  assert.match(source, /materialUsages\.map/);
  assert.match(source, /documentAttachments\.map/);
  assert.match(source, /Экспорт акта/);
  assert.match(source, /Экспорт приложений/);
  assert.match(source, /documentAttachments\.length === 0/);
  assert.match(source, /api\.acts\.exportAttachments/);
  assert.match(source, /openPdfDownload\(result\.url, result\.filename\)/);
  assert.match(source, /error\.status === 422/);
  assert.match(source, /handleAttachmentRowClick/);
  assert.match(source, /useResetActDocumentAttachments/);
  assert.doesNotMatch(source, /Привязка материалов — в разделе/);
});

test("task material picker multi-selects quality documents into D′ rows", async () => {
  const source = await readFile("client/src/pages/SelectTaskMaterials.tsx", "utf8");

  assert.match(source, /handlePickMaterial/);
  assert.match(source, /handleConfirmDocs/);
  assert.match(source, /pendingDocIds/);
  assert.match(source, /qualityDocumentId,/);
  assert.match(source, /<Select[\s\S]*qualityDocumentId/);
  assert.doesNotMatch(source, /resolveQualityDocumentId/);
  assert.doesNotMatch(source, /placeholder=\{language === "ru" \? "ID документа"/);
});

test("generate-acts persists fallback quality documents for both source branches and PDF keeps a fallback", async () => {
  const schedule = await readFile("server/routes/schedule.ts", "utf8");
  const pdf = await readFile("server/pdfGenerator.ts", "utf8");

  assert.match(schedule, /sourceType: 'estimate'/);
  assert.match(schedule, /sourceType: 'works'/);
  assert.match(schedule, /resolveQualityDocumentForMaterial/);
  assert.match(schedule, /qualityDocumentId: qdId/);
  assert.match(schedule, /attachmentDocIds\.map/);
  assert.match(schedule, /attachmentsManual/);
  assert.match(pdf, /u\.qualityDocument \?\? fallbackQualityDocuments/);
  assert.match(pdf, /formatP3MaterialsGrouped/);
});
