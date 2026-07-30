import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("act detail renders material usages and formal document attachments", async () => {
  const source = await readFile("client/src/pages/ActDetail.tsx", "utf8");

  assert.match(source, /useActMaterialUsages\(actId\)/);
  assert.match(source, /useActDocumentAttachments\(actId\)/);
  assert.match(source, /materialUsages\.map/);
  assert.match(source, /documentAttachments\.map/);
  assert.doesNotMatch(source, /Привязка материалов — в разделе/);
});

test("task material picker saves a selected quality document instead of a manual id", async () => {
  const source = await readFile("client/src/pages/SelectTaskMaterials.tsx", "utf8");

  assert.match(source, /resolveQualityDocumentId/);
  assert.match(source, /qualityDocumentId,/);
  assert.match(source, /<Select[\s\S]*qualityDocumentId/);
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
  assert.match(pdf, /u\.qualityDocument \?\? fallbackQualityDocuments/);
});
