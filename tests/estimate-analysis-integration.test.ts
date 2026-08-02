import test from "node:test";
import assert from "node:assert/strict";

test("estimate analysis: ownership, snapshots, idempotency and source invalidation", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL not set; skipping DB-backed estimate analysis integration test");
    return;
  }

  const { and, eq } = await import("drizzle-orm");
  const { db } = await import("../server/db.ts");
  const {
    users,
    objects,
    estimates,
    estimateSections,
    estimatePositions,
    positionResources,
    executionWorkflows,
    estimateAnalysisSnapshots,
  } = await import("../shared/schema.ts");
  const { analyzeEstimate, getEstimateAnalysis } = await import(
    "../server/services/estimateAnalysisService.ts"
  );
  const { McpToolError, MCP_ERROR_CODES } = await import("../server/mcp/errors.ts");

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [owner] = await db
    .insert(users)
    .values({ displayName: "Analysis owner", email: `analysis-owner-${suffix}@test.local` })
    .returning();
  const [other] = await db
    .insert(users)
    .values({ displayName: "Analysis other", email: `analysis-other-${suffix}@test.local` })
    .returning();
  const [object] = await db
    .insert(objects)
    .values({ title: `Analysis object ${suffix}`, userId: owner.id })
    .returning();
  const [estimate] = await db
    .insert(estimates)
    .values({ objectId: object.id, code: "ЛСР-ТЕСТ", name: `Analysis estimate ${suffix}` })
    .returning();
  const [sectionOne, sectionTwo] = await db
    .insert(estimateSections)
    .values([
      { estimateId: estimate.id, number: "1", title: "Earthworks", orderIndex: 1 },
      { estimateId: estimate.id, number: "2", title: "Finishing", orderIndex: 2 },
    ])
    .returning();
  const [workOne, workTwo, workThree] = await db
    .insert(estimatePositions)
    .values([
      {
        estimateId: estimate.id,
        sectionId: sectionOne.id,
        lineNo: "1",
        code: "ГЭСН01-01-001-01",
        name: "Excavate soil",
        unit: "м3",
        quantity: "10",
        orderIndex: 1,
      },
      {
        estimateId: estimate.id,
        sectionId: sectionOne.id,
        lineNo: "2",
        code: "ФЕР01-02-003",
        name: "Backfill",
        unit: "м3",
        quantity: "5",
        orderIndex: 2,
      },
      {
        estimateId: estimate.id,
        sectionId: sectionTwo.id,
        lineNo: "3",
        code: "ТЕР15-01-001",
        name: "Finish walls",
        unit: "м2",
        quantity: "20",
        orderIndex: 3,
      },
    ])
    .returning();
  const [laborToChange] = await db
    .insert(positionResources)
    .values([
      {
        positionId: workOne.id,
        resourceType: "ОТ",
        name: "Worker labor",
        unit: "чел.-ч",
        quantity: "1",
        quantityTotal: "8",
        orderIndex: 1,
      },
      {
        positionId: workOne.id,
        resourceType: "М",
        name: "Sand",
        unit: "м3",
        quantityTotal: "2",
        orderIndex: 2,
      },
      {
        positionId: workTwo.id,
        resourceType: "ОТМ",
        name: "Machine operator",
        unit: "чел.-ч",
        quantityTotal: "4",
        orderIndex: 3,
      },
      {
        positionId: workTwo.id,
        resourceType: "ЭМ",
        name: "Excavator",
        unit: "маш.-ч",
        quantityTotal: "2",
        orderIndex: 4,
      },
      {
        positionId: workThree.id,
        resourceType: "UNKNOWN",
        name: "Unknown resource",
        unit: "шт",
        quantityTotal: "1",
        orderIndex: 5,
      },
    ])
    .returning();
  const [workflow] = await db
    .insert(executionWorkflows)
    .values({
      userId: owner.id,
      objectId: object.id,
      estimateId: estimate.id,
      stage: "estimate_imported",
      status: "active",
      version: 4,
    })
    .returning();

  const ownerAuth = { userId: owner.id, displayName: owner.displayName, email: owner.email, role: owner.role };
  const otherAuth = { userId: other.id, displayName: other.displayName, email: other.email, role: other.role };
  const analyzeArgs = {
    workflowId: workflow.id,
    expectedVersion: workflow.version,
    idempotencyKey: `analyze-${suffix}`,
  };

  await assert.rejects(
    () => analyzeEstimate(otherAuth, analyzeArgs),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.NOT_FOUND,
  );

  const first = await analyzeEstimate(ownerAuth, analyzeArgs);
  assert.equal(first.stage, "estimate_analysis_ready");
  assert.equal(first.version, workflow.version + 1);
  assert.equal(first.summary.mainWorksCount, 3);
  assert.equal(first.summary.laborHoursTotal, 12);
  assert.equal(first.summary.laborCoveragePercent, 66.67);

  const read = await getEstimateAnalysis(ownerAuth, workflow.id);
  assert.deepEqual(read, first);
  await assert.rejects(
    () => getEstimateAnalysis(otherAuth, workflow.id),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.NOT_FOUND,
  );

  const retry = await analyzeEstimate(ownerAuth, analyzeArgs);
  assert.deepEqual(retry, first);
  let snapshots = await db
    .select()
    .from(estimateAnalysisSnapshots)
    .where(eq(estimateAnalysisSnapshots.workflowId, workflow.id));
  assert.equal(snapshots.length, 1);

  await db
    .update(positionResources)
    .set({ quantityTotal: "10" })
    .where(
      and(
        eq(positionResources.id, laborToChange.id),
        eq(positionResources.positionId, workOne.id),
      ),
    );
  await assert.rejects(
    () => getEstimateAnalysis(ownerAuth, workflow.id),
    (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.NOT_FOUND,
  );

  const refreshed = await analyzeEstimate(ownerAuth, {
    workflowId: workflow.id,
    expectedVersion: first.version,
    idempotencyKey: `reanalyze-${suffix}`,
  });
  assert.equal(refreshed.stage, "estimate_analysis_ready");
  assert.equal(refreshed.version, first.version + 1);
  assert.notEqual(refreshed.inputHash, first.inputHash);
  assert.equal(refreshed.summary.laborHoursTotal, 14);

  snapshots = await db
    .select()
    .from(estimateAnalysisSnapshots)
    .where(eq(estimateAnalysisSnapshots.workflowId, workflow.id));
  assert.equal(snapshots.length, 2);
});
