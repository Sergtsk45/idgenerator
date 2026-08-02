import assert from "node:assert/strict";
import test from "node:test";

import { buildExecutionPackageManifest } from "../server/services/execution-package/executionPackageManifestCore.ts";

test("execution package manifest is deterministic, explicit about missing files and excludes other objects", () => {
  const expectedArtifacts = [
    { key: "worklog", kind: "worklog_draft", requiredMode: "draft" as const, required: true, label: "Черновик журнала" },
    { key: "act:7", kind: "act_pdf", requiredMode: "draft" as const, required: true, label: "АОСР №7" },
    { key: "act:7:attachments", kind: "attachments_pdf", requiredMode: "draft" as const, required: false, label: "Приложения АОСР №7" },
  ];
  const ownedAct = {
    expectedKey: "act:7",
    artifactId: "artifact-owned",
    workflowId: 12,
    objectId: 34,
    kind: "act_pdf",
    mode: "draft" as const,
    filename: "АОСР_7.pdf",
    mimeType: "application/pdf",
    sizeBytes: 321,
    sha256: "a".repeat(64),
    createdAt: "2026-08-02T10:00:00.000Z",
  };
  const olderAct = { ...ownedAct, artifactId: "artifact-older", createdAt: "2026-08-01T10:00:00.000Z" };
  const foreign = { ...ownedAct, artifactId: "artifact-foreign", objectId: 99 };
  const unknown = { ...ownedAct, expectedKey: "unexpected", artifactId: "artifact-unknown" };
  const base = {
    workflowId: 12,
    objectId: 34,
    mode: "draft" as const,
    blockers: [{ code: "QUALITY_DOCUMENT_MISSING", message: "Нет паспорта" }],
    warnings: [{ code: "DRAFT_WORKLOG", message: "Журнал не является нормативным ОЖР" }],
    assumptions: ["Температура не указана", "Температура не указана"],
  };

  const manifest = buildExecutionPackageManifest({
    ...base,
    expectedArtifacts,
    availableArtifacts: [foreign, olderAct, unknown, ownedAct],
  });
  const reordered = buildExecutionPackageManifest({
    ...base,
    expectedArtifacts: [...expectedArtifacts].reverse(),
    availableArtifacts: [ownedAct, unknown, foreign, olderAct],
  });

  assert.equal(manifest.inputHash, reordered.inputHash);
  assert.equal(manifest.draft, true);
  assert.equal(manifest.readyForFinal, false);
  assert.deepEqual(manifest.expectedArtifacts.map(({ key }) => key), ["act:7", "act:7:attachments", "worklog"]);
  assert.deepEqual(manifest.artifacts.map(({ artifactId }) => artifactId), ["artifact-owned"]);
  assert.deepEqual(manifest.missingItems.map(({ key }) => key), ["act:7:attachments", "worklog"]);
  assert.ok(manifest.blockers.some(({ code, message }) => code === "REQUIRED_ARTIFACT_MISSING" && message.includes("worklog")));
  assert.deepEqual(manifest.assumptions, ["Температура не указана"]);
  assert.ok(manifest.warnings.some(({ code }) => code === "OUT_OF_SCOPE_ARTIFACTS_EXCLUDED"));
  assert.ok(manifest.warnings.some(({ code }) => code === "UNKNOWN_ARTIFACTS_EXCLUDED"));
  assert.doesNotMatch(JSON.stringify(manifest), /artifact-(foreign|unknown|older)/);

  const finalManifest = buildExecutionPackageManifest({
    workflowId: 12,
    objectId: 34,
    mode: "final",
    expectedArtifacts: [{ ...expectedArtifacts[1], requiredMode: "final" }],
    availableArtifacts: [ownedAct],
  });
  assert.equal(finalManifest.artifacts.length, 0, "a draft artifact must not satisfy a final slot");
  assert.equal(finalManifest.readyForFinal, false);

  const draftWithFinalArtifact = buildExecutionPackageManifest({
    workflowId: 12,
    objectId: 34,
    mode: "draft",
    expectedArtifacts: [expectedArtifacts[1]],
    availableArtifacts: [{ ...ownedAct, mode: "final" }],
  });
  assert.equal(draftWithFinalArtifact.missingItems.length, 0, "a final artifact may satisfy a draft slot");

  assert.throws(() => buildExecutionPackageManifest({
    workflowId: 12,
    objectId: 34,
    mode: "draft",
    expectedArtifacts: [expectedArtifacts[1]],
    availableArtifacts: [{ ...ownedAct, sha256: "not-a-checksum" }],
  }), /Invalid artifact checksum/);
  assert.throws(() => buildExecutionPackageManifest({
    workflowId: 12,
    objectId: 34,
    mode: "draft",
    expectedArtifacts: [expectedArtifacts[1]],
    availableArtifacts: [{ ...ownedAct, sizeBytes: 0 }],
  }), /Invalid artifact size/);
});
