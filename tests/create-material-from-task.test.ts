/**
 * @file: create-material-from-task.test.ts
 * @description: Runnable checks для создания материала из задачи графика с автопривязкой.
 * @dependencies: node:test, materialWizardResult, selectTaskMaterialsHelpers
 * @created: 2026-08-02
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  bindingRoleFromDocType,
  buildCreatedMaterialResult,
  qualityDocumentIdForTask,
} from "../client/src/components/materials/materialWizardResult.ts";
import {
  appendCreatedMaterial,
  toReplaceTaskMaterialsPayload,
} from "../client/src/pages/selectTaskMaterialsHelpers.ts";

test("buildCreatedMaterialResult returns projectMaterialId and displayName", () => {
  const result = buildCreatedMaterialResult({
    projectMaterialId: 42,
    source: "new",
    nameOverride: "Труба DN100",
  });

  assert.equal(result.projectMaterialId, 42);
  assert.equal(result.batchId, null);
  assert.equal(result.qualityDocumentId, null);
  assert.equal(result.displayName, "Труба DN100");
});

test("buildCreatedMaterialResult includes batchId when batch was created", () => {
  const result = buildCreatedMaterialResult({
    projectMaterialId: 7,
    batchId: 15,
    source: "new",
    nameOverride: "Бетон B25",
  });

  assert.equal(result.batchId, 15);
});

test("quality document roles populate qualityDocumentId", () => {
  assert.equal(bindingRoleFromDocType("certificate"), "quality");
  assert.equal(bindingRoleFromDocType("passport"), "passport");
  assert.equal(bindingRoleFromDocType("protocol"), "protocol");
  assert.equal(bindingRoleFromDocType("scheme"), "scheme");
  assert.equal(bindingRoleFromDocType("other"), "other");

  for (const role of ["quality", "passport", "protocol"] as const) {
    const result = buildCreatedMaterialResult({
      projectMaterialId: 1,
      documentId: 99,
      bindingRole: role,
      source: "new",
      nameOverride: "M",
    });
    assert.equal(result.qualityDocumentId, 99, `role ${role}`);
  }
});

test("scheme and other do not populate qualityDocumentId", () => {
  for (const role of ["scheme", "other"] as const) {
    assert.equal(qualityDocumentIdForTask(55, role), null);
    const result = buildCreatedMaterialResult({
      projectMaterialId: 1,
      documentId: 55,
      bindingRole: role,
      source: "new",
      nameOverride: "M",
    });
    assert.equal(result.qualityDocumentId, null);
  }
});

test("appendCreatedMaterial keeps previous rows and notes", () => {
  const existing = [
    { projectMaterialId: 1, batchId: 2, qualityDocumentId: 3, note: "keep-me" },
    { projectMaterialId: 4, batchId: null, qualityDocumentId: null, note: null },
  ];
  const next = appendCreatedMaterial(existing, {
    projectMaterialId: 10,
    batchId: 11,
    qualityDocumentId: 12,
    displayName: "Новый",
  });

  assert.equal(next.length, 3);
  assert.equal(next[0].note, "keep-me");
  assert.deepEqual(next[2], {
    projectMaterialId: 10,
    batchId: 11,
    qualityDocumentId: 12,
    note: null,
  });
  assert.equal(existing.length, 2);
});

test("appendCreatedMaterial does not append the same project material twice", () => {
  const existing = [
    { projectMaterialId: 10, batchId: null, qualityDocumentId: null, note: "keep-me" },
  ];
  const next = appendCreatedMaterial(existing, {
    projectMaterialId: 10,
    batchId: 11,
    qualityDocumentId: 12,
    displayName: "Тот же материал",
  });

  assert.strictEqual(next, existing);
  assert.equal(next.length, 1);
  assert.equal(next[0].note, "keep-me");
});

test("toReplaceTaskMaterialsPayload preserves orderIndex for full list", () => {
  const payload = toReplaceTaskMaterialsPayload([
    { projectMaterialId: 1, batchId: null, qualityDocumentId: null, note: "a" },
    { projectMaterialId: 2, batchId: 9, qualityDocumentId: 8, note: null },
  ]);
  assert.deepEqual(payload, [
    { projectMaterialId: 1, batchId: null, qualityDocumentId: null, note: "a", orderIndex: 0 },
    { projectMaterialId: 2, batchId: 9, qualityDocumentId: 8, note: null, orderIndex: 1 },
  ]);
});

test("MaterialWizard wires onCreated after creation and keeps backward-compatible props", async () => {
  const source = await readFile("client/src/components/materials/MaterialWizard.tsx", "utf8");
  assert.match(source, /onCreated\?:/);
  assert.match(source, /skipSourceStep\?:/);
  assert.match(source, /initialSource\?:/);
  assert.match(source, /await props\.onCreated\(result\)/);
  assert.match(source, /buildCreatedMaterialResult/);
  assert.match(source, /Материал создан, но не удалось добавить его в задачу/);
  assert.match(source, /Материал создан и добавлен в задачу/);
  assert.match(source, /Не удалось создать материал\. Проверьте заполненные данные/);
  // Without onCreated — legacy toast remains
  assert.match(source, /Материал добавлен/);
});

test("MaterialWizard retries only task linking and locks the complete submit pipeline", async () => {
  const source = await readFile("client/src/components/materials/MaterialWizard.tsx", "utf8");
  const cacheResult = source.indexOf("setCreatedResult(result)");
  const linkResult = source.indexOf("await props.onCreated(result)");

  assert.match(source, /let result = createdResult;\s+if \(!result\)/);
  assert.ok(cacheResult >= 0 && cacheResult < linkResult, "created result must be cached before onCreated");
  assert.match(source, /if \(submittingRef\.current\) return/);
  assert.match(source, /finally \{\s+submittingRef\.current = false;\s+setSubmitting\(false\)/);
  assert.match(source, /disabled=\{isBusy \|\| submitting\}/);
  assert.match(source, /isBusy \|\| submitting \? <Loader2/);
});

test("SelectTaskMaterials opens wizard and persists full local list", async () => {
  const source = await readFile("client/src/pages/SelectTaskMaterials.tsx", "utf8");
  assert.match(source, /createNewMaterial/);
  assert.match(source, /materialWizardOpen/);
  assert.match(source, /MaterialWizard/);
  assert.match(source, /skipSourceStep/);
  assert.match(source, /initialSource="new"/);
  assert.match(source, /handleMaterialCreated/);
  assert.match(source, /persistMaterials\(nextMaterials\)/);
  assert.match(source, /appendCreatedMaterial/);
  assert.match(source, /materialsRef\.current/);
  assert.doesNotMatch(source, /navigate\("\/source\/materials"\)/);
});

test("persistMaterials requires taskId before replace request", async () => {
  const helpers = await readFile("client/src/pages/selectTaskMaterialsHelpers.ts", "utf8");
  const page = await readFile("client/src/pages/SelectTaskMaterials.tsx", "utf8");
  assert.match(helpers, /toReplaceTaskMaterialsPayload/);
  assert.match(page, /if \(!taskId\)/);
  assert.match(page, /throw new Error\(t\.taskMissing\)/);
  assert.match(page, /disabled=\{!taskId/);
});

test("task materials and project material create routes require auth and ownership", async () => {
  const schedule = await readFile("server/routes/schedule.ts", "utf8");
  const materials = await readFile("server/routes/materials.ts", "utf8");

  assert.match(schedule, /assertUserOwnsScheduleTask/);
  assert.match(schedule, /assertMaterialsBelongToObject/);
  assert.match(schedule, /app\.put\(api\.taskMaterials\.replace\.path, \.\.\.appAuth/);
  assert.match(schedule, /app\.get\(api\.taskMaterials\.list\.path, \.\.\.appAuth/);
  assert.match(materials, /app\.post\(api\.projectMaterials\.create\.path, \.\.\.appAuth, requireObjectAccess/);
  assert.match(materials, /app\.post\(api\.materialBatches\.create\.path, \.\.\.appAuth/);
});
