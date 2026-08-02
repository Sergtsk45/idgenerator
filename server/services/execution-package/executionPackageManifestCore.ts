import { createHash } from "node:crypto";

export type ExecutionPackageMode = "draft" | "final";

export interface ExpectedPackageArtifact {
  key: string;
  kind: string;
  requiredMode: ExecutionPackageMode;
  required: boolean;
  label: string;
}

export interface PackageArtifactMetadata {
  expectedKey: string;
  artifactId: string;
  workflowId: number;
  objectId: number;
  kind: string;
  mode: ExecutionPackageMode;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
}

export interface PackageManifestNote {
  code: string;
  message: string;
}

export interface ExecutionPackageManifestInput {
  workflowId: number;
  objectId: number;
  mode: ExecutionPackageMode;
  expectedArtifacts: readonly ExpectedPackageArtifact[];
  availableArtifacts: readonly PackageArtifactMetadata[];
  blockers?: readonly PackageManifestNote[];
  warnings?: readonly PackageManifestNote[];
  assumptions?: readonly string[];
}

function compareKey(a: { key: string }, b: { key: string }): number {
  return a.key.localeCompare(b.key);
}

function compareNote(a: PackageManifestNote, b: PackageManifestNote): number {
  return a.code.localeCompare(b.code) || a.message.localeCompare(b.message);
}

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function validateArtifact(artifact: PackageArtifactMetadata): void {
  if (!Number.isSafeInteger(artifact.sizeBytes) || artifact.sizeBytes <= 0) {
    throw new Error(`Invalid artifact size: ${artifact.artifactId}`);
  }
  if (!/^[0-9a-f]{64}$/.test(artifact.sha256)) {
    throw new Error(`Invalid artifact checksum: ${artifact.artifactId}`);
  }
  if (Number.isNaN(Date.parse(artifact.createdAt))) {
    throw new Error(`Invalid artifact creation time: ${artifact.artifactId}`);
  }
}

export function buildExecutionPackageManifest(input: ExecutionPackageManifestInput) {
  const expectedArtifacts = [...input.expectedArtifacts].sort(compareKey);
  if (new Set(expectedArtifacts.map(({ key }) => key)).size !== expectedArtifacts.length) {
    throw new Error("Execution package artifact keys must be unique");
  }

  const scopedArtifacts = input.availableArtifacts
    .filter(({ workflowId, objectId }) => workflowId === input.workflowId && objectId === input.objectId);
  const expectedKeys = new Set(expectedArtifacts.map(({ key }) => key));
  const unknownArtifactsCount = scopedArtifacts.filter(({ expectedKey }) => !expectedKeys.has(expectedKey)).length;
  const artifacts = expectedArtifacts.flatMap((expected) => {
    const candidates = scopedArtifacts
      .filter(({ expectedKey, kind, mode }) => (
        expectedKey === expected.key && kind === expected.kind
          && (mode === expected.requiredMode || (expected.requiredMode === "draft" && mode === "final"))
      ))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.artifactId.localeCompare(a.artifactId));
    const selected = candidates[0];
    if (!selected) return [];
    validateArtifact(selected);
    return [selected];
  });
  const availableKeys = new Set(artifacts.map(({ expectedKey, kind }) => `${expectedKey}\0${kind}`));
  const missingItems = expectedArtifacts
    .filter(({ key, kind }) => !availableKeys.has(`${key}\0${kind}`))
    .map(({ key, kind, requiredMode, label, required }) => ({ key, kind, requiredMode, label, required }));
  const blockers = [
    ...(input.blockers ?? []),
    ...missingItems.filter(({ required }) => required).map(({ key, label }) => ({
      code: "REQUIRED_ARTIFACT_MISSING",
      message: `${label} (${key})`,
    })),
  ].sort(compareNote);
  const excludedArtifactsCount = input.availableArtifacts.length - scopedArtifacts.length;
  const warnings = [
    ...(input.warnings ?? []),
    ...(excludedArtifactsCount ? [{
      code: "OUT_OF_SCOPE_ARTIFACTS_EXCLUDED",
      message: `Excluded ${excludedArtifactsCount} artifact(s) outside workflow/object scope`,
    }] : []),
    ...(unknownArtifactsCount ? [{
      code: "UNKNOWN_ARTIFACTS_EXCLUDED",
      message: `Excluded ${unknownArtifactsCount} same-scope artifact(s) with unknown expected keys`,
    }] : []),
  ].sort(compareNote);
  const assumptions = Array.from(new Set(input.assumptions ?? [])).sort();
  const canonical = {
    schemaVersion: 1,
    workflowId: input.workflowId,
    objectId: input.objectId,
    mode: input.mode,
    draft: input.mode === "draft",
    expectedArtifacts,
    artifacts,
    missingItems,
    blockers,
    warnings,
    assumptions,
  };

  return {
    ...canonical,
    readyForFinal: blockers.length === 0,
    inputHash: sha256(canonical),
  };
}
