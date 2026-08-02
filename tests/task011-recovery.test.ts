import assert from "node:assert/strict";
import test from "node:test";

test("TASK-011 recovery paths cover labor gaps, missing passports, expired uploads and stale drafts", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL not set; skipping DB-backed TASK-011 recovery test");
    return;
  }

  const { eq } = await import("drizzle-orm");
  const { db } = await import("../server/db.ts");
  const {
    users,
    objects,
    estimates,
    estimateSections,
    estimatePositions,
    positionResources,
    executionWorkflows,
    uploadSessions,
    toolIdempotencyRecords,
  } = await import("../shared/schema.ts");
  const { analyzeEstimate } = await import("../server/services/estimateAnalysisService.ts");
  const { setWorkflowInput } = await import("../server/services/execution-workflow/workflowService.ts");
  const { calculateScheduleDraft, approveSchedule } = await import("../server/services/schedulePlanningService.ts");
  const { createUploadSession, storeMcpUpload } = await import("../server/services/estimateUploadService.ts");
  const { buildMaterialRegister, getMissingQualityDocuments } = await import("../server/services/materialRegisterService.ts");
  const { MCP_ERROR_CODES, McpToolError } = await import("../server/mcp/errors.ts");

  await t.test("no labor hours blocks crew-size schedule planning", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [owner] = await db.insert(users).values({ displayName: "TASK-011 labor owner", email: `task011-labor-${suffix}@test.local` }).returning();
    const [object] = await db.insert(objects).values({ title: `TASK-011 labor ${suffix}`, userId: owner.id }).returning();
    const [estimate] = await db.insert(estimates).values({ objectId: object.id, name: `TASK-011 labor estimate ${suffix}` }).returning();
    const [section] = await db.insert(estimateSections).values({ estimateId: estimate.id, number: "1", title: "Works", orderIndex: 1 }).returning();
    const [position] = await db.insert(estimatePositions).values({
      estimateId: estimate.id,
      sectionId: section.id,
      lineNo: "1",
      code: "TASK011-NO-LABOR",
      name: "No labor",
      unit: "шт",
      quantity: "1",
      orderIndex: 1,
    }).returning();
    await db.insert(positionResources).values({
      positionId: position.id,
      resourceType: "М",
      name: "Machine only",
      unit: "т",
      quantityTotal: "1",
      orderIndex: 1,
    });
    const [workflow] = await db.insert(executionWorkflows).values({
      userId: owner.id,
      objectId: object.id,
      estimateId: estimate.id,
      stage: "estimate_imported",
      status: "active",
      version: 1,
    }).returning();
    t.after(async () => {
      await db.delete(executionWorkflows).where(eq(executionWorkflows.id, workflow.id));
      await db.delete(estimatePositions).where(eq(estimatePositions.estimateId, estimate.id));
      await db.delete(estimateSections).where(eq(estimateSections.estimateId, estimate.id));
      await db.delete(estimates).where(eq(estimates.id, estimate.id));
      await db.delete(objects).where(eq(objects.id, object.id));
      await db.delete(toolIdempotencyRecords).where(eq(toolIdempotencyRecords.userId, owner.id));
      await db.delete(users).where(eq(users.id, owner.id));
    });

    const analyzed = await analyzeEstimate({ userId: owner.id, displayName: owner.displayName, email: owner.email, role: owner.role }, {
      workflowId: workflow.id,
      expectedVersion: workflow.version,
      idempotencyKey: `task011-labor-analyze-${suffix}`,
    });
    let currentVersion = analyzed.version;
    const set = async (key: "projectStartDate" | "workingCalendar" | "planningMode" | "crewSize" | "shiftHours" | "utilizationFactor", value: string | number) => {
      const result = await setWorkflowInput({ userId: owner.id, displayName: owner.displayName, email: owner.email, role: owner.role }, {
        workflowId: workflow.id,
        expectedVersion: currentVersion,
        idempotencyKey: `task011-labor-input-${key}-${suffix}`,
        key,
        value,
        source: "user",
        confirmed: true,
      });
      currentVersion = result.version;
    };
    await set("projectStartDate", "2026-08-05");
    await set("workingCalendar", "5x2");
    await set("planningMode", "crew_size");
    await set("crewSize", 4);
    await set("shiftHours", 8);
    await set("utilizationFactor", 0.85);

    await assert.rejects(
      () => calculateScheduleDraft({ userId: owner.id, displayName: owner.displayName, email: owner.email, role: owner.role }, {
        workflowId: workflow.id,
        expectedVersion: currentVersion,
        idempotencyKey: `task011-labor-calc-${suffix}`,
      }),
      (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.LABOR_DATA_REQUIRED,
    );
  });

  await t.test("missing passport remains a missing quality requirement", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [owner] = await db.insert(users).values({ displayName: "TASK-011 passport owner", email: `task011-passport-${suffix}@test.local` }).returning();
    const [object] = await db.insert(objects).values({ title: `TASK-011 passport ${suffix}`, userId: owner.id }).returning();
    const [estimate] = await db.insert(estimates).values({ objectId: object.id, name: `TASK-011 passport estimate ${suffix}` }).returning();
    const [section] = await db.insert(estimateSections).values({ estimateId: estimate.id, number: "1", title: "Works", orderIndex: 1 }).returning();
    const [position] = await db.insert(estimatePositions).values({
      estimateId: estimate.id,
      sectionId: section.id,
      lineNo: "1",
      code: "TASK011-PASSPORT",
      name: "Need passport",
      unit: "шт",
      quantity: "1",
      orderIndex: 1,
    }).returning();
    await db.insert(positionResources).values({
      positionId: position.id,
      resourceType: "ОТ",
      name: "Labor",
      unit: "чел.-ч",
      quantityTotal: "8",
      orderIndex: 1,
    });
    const [workflow] = await db.insert(executionWorkflows).values({
      userId: owner.id,
      objectId: object.id,
      estimateId: estimate.id,
      stage: "estimate_imported",
      status: "active",
      version: 1,
    }).returning();
    t.after(async () => {
      await db.delete(executionWorkflows).where(eq(executionWorkflows.id, workflow.id));
      await db.delete(estimatePositions).where(eq(estimatePositions.estimateId, estimate.id));
      await db.delete(estimateSections).where(eq(estimateSections.estimateId, estimate.id));
      await db.delete(estimates).where(eq(estimates.id, estimate.id));
      await db.delete(objects).where(eq(objects.id, object.id));
      await db.delete(toolIdempotencyRecords).where(eq(toolIdempotencyRecords.userId, owner.id));
      await db.delete(users).where(eq(users.id, owner.id));
    });

    const analyzed = await analyzeEstimate({ userId: owner.id, displayName: owner.displayName, email: owner.email, role: owner.role }, {
      workflowId: workflow.id,
      expectedVersion: workflow.version,
      idempotencyKey: `task011-passport-analyze-${suffix}`,
    });
    let currentVersion = analyzed.version;
    for (const [key, value] of [
      ["projectStartDate", "2026-08-05"],
      ["workingCalendar", "5x2"],
      ["planningMode", "target_duration"],
      ["targetDurationDays", 3],
    ] as const) {
      const result = await setWorkflowInput({ userId: owner.id, displayName: owner.displayName, email: owner.email, role: owner.role }, {
        workflowId: workflow.id,
        expectedVersion: currentVersion,
        idempotencyKey: `task011-passport-input-${key}-${suffix}`,
        key,
        value,
        source: "user",
        confirmed: true,
      });
      currentVersion = result.version;
    }
    const draft = await calculateScheduleDraft({ userId: owner.id, displayName: owner.displayName, email: owner.email, role: owner.role }, {
      workflowId: workflow.id,
      expectedVersion: currentVersion,
      idempotencyKey: `task011-passport-calc-${suffix}`,
    });
    currentVersion = draft.workflowVersion;
    const approved = await approveSchedule({ userId: owner.id, displayName: owner.displayName, email: owner.email, role: owner.role }, {
      workflowId: workflow.id,
      draftVersion: draft.draftVersion,
      expectedVersion: currentVersion,
      idempotencyKey: `task011-passport-approve-${suffix}`,
    });
    currentVersion = approved.workflowVersion;
    const register = await buildMaterialRegister({ userId: owner.id, displayName: owner.displayName, email: owner.email, role: owner.role }, {
      workflowId: workflow.id,
      expectedVersion: currentVersion,
      idempotencyKey: `task011-passport-register-${suffix}`,
    });
    const missing = await getMissingQualityDocuments({ userId: owner.id, displayName: owner.displayName, email: owner.email, role: owner.role }, workflow.id);
    assert.equal(register.items.length, 1);
    assert.equal(missing.missingRequirements.length, 1);
    assert.match(missing.missingRequirements[0].acceptableDocTypes.join(","), /passport/);
  });

  await t.test("expired quality-document uploads are rejected", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [owner] = await db.insert(users).values({ displayName: "TASK-011 upload owner", email: `task011-upload-${suffix}@test.local` }).returning();
    const [object] = await db.insert(objects).values({ title: `TASK-011 upload ${suffix}`, userId: owner.id }).returning();
    const [workflow] = await db.insert(executionWorkflows).values({
      userId: owner.id,
      objectId: object.id,
      stage: "created",
      status: "active",
      version: 1,
    }).returning();
    t.after(async () => {
      await db.delete(executionWorkflows).where(eq(executionWorkflows.id, workflow.id));
      await db.delete(objects).where(eq(objects.id, object.id));
      await db.delete(toolIdempotencyRecords).where(eq(toolIdempotencyRecords.userId, owner.id));
      await db.delete(users).where(eq(users.id, owner.id));
    });

    const session = await createUploadSession({ userId: owner.id, displayName: owner.displayName, email: owner.email, role: owner.role }, {
      workflowId: workflow.id,
      expectedVersion: workflow.version,
      idempotencyKey: `task011-upload-session-${suffix}`,
      originalFilename: "passport.pdf",
      purpose: "quality_document",
    });
    await db.update(uploadSessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(uploadSessions.id, session.uploadId));
    await assert.rejects(
      () => storeMcpUpload({ userId: owner.id, displayName: owner.displayName, email: owner.email, role: owner.role }, session.uploadId, {
        originalname: "passport.pdf",
        mimetype: "application/pdf",
        buffer: Buffer.from("%PDF-1.7\nexpired\n%%EOF"),
        size: 24,
      }),
      (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.UPLOAD_EXPIRED,
    );
  });

  await t.test("stale schedule drafts are rejected after input changes", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [owner] = await db.insert(users).values({ displayName: "TASK-011 stale owner", email: `task011-stale-${suffix}@test.local` }).returning();
    const [object] = await db.insert(objects).values({ title: `TASK-011 stale ${suffix}`, userId: owner.id }).returning();
    const [estimate] = await db.insert(estimates).values({ objectId: object.id, name: `TASK-011 stale estimate ${suffix}` }).returning();
    const [section] = await db.insert(estimateSections).values({ estimateId: estimate.id, number: "1", title: "Works", orderIndex: 1 }).returning();
    const [position] = await db.insert(estimatePositions).values({
      estimateId: estimate.id,
      sectionId: section.id,
      lineNo: "1",
      code: "TASK011-STALE",
      name: "Stale draft",
      unit: "шт",
      quantity: "1",
      orderIndex: 1,
    }).returning();
    await db.insert(positionResources).values({
      positionId: position.id,
      resourceType: "ОТ",
      name: "Labor",
      unit: "чел.-ч",
      quantityTotal: "8",
      orderIndex: 1,
    });
    const [workflow] = await db.insert(executionWorkflows).values({
      userId: owner.id,
      objectId: object.id,
      estimateId: estimate.id,
      stage: "estimate_imported",
      status: "active",
      version: 1,
    }).returning();
    t.after(async () => {
      await db.delete(executionWorkflows).where(eq(executionWorkflows.id, workflow.id));
      await db.delete(estimatePositions).where(eq(estimatePositions.estimateId, estimate.id));
      await db.delete(estimateSections).where(eq(estimateSections.estimateId, estimate.id));
      await db.delete(estimates).where(eq(estimates.id, estimate.id));
      await db.delete(objects).where(eq(objects.id, object.id));
      await db.delete(toolIdempotencyRecords).where(eq(toolIdempotencyRecords.userId, owner.id));
      await db.delete(users).where(eq(users.id, owner.id));
    });

    const analyzed = await analyzeEstimate({ userId: owner.id, displayName: owner.displayName, email: owner.email, role: owner.role }, {
      workflowId: workflow.id,
      expectedVersion: workflow.version,
      idempotencyKey: `task011-stale-analyze-${suffix}`,
    });
    let currentVersion = analyzed.version;
    for (const [key, value] of [
      ["projectStartDate", "2026-08-05"],
      ["workingCalendar", "5x2"],
      ["planningMode", "target_duration"],
      ["targetDurationDays", 3],
    ] as const) {
      const result = await setWorkflowInput({ userId: owner.id, displayName: owner.displayName, email: owner.email, role: owner.role }, {
        workflowId: workflow.id,
        expectedVersion: currentVersion,
        idempotencyKey: `task011-stale-input-${key}-${suffix}`,
        key,
        value,
        source: "user",
        confirmed: true,
      });
      currentVersion = result.version;
    }
    const draft = await calculateScheduleDraft({ userId: owner.id, displayName: owner.displayName, email: owner.email, role: owner.role }, {
      workflowId: workflow.id,
      expectedVersion: currentVersion,
      idempotencyKey: `task011-stale-calc-${suffix}`,
    });
    await setWorkflowInput({ userId: owner.id, displayName: owner.displayName, email: owner.email, role: owner.role }, {
      workflowId: workflow.id,
      expectedVersion: draft.workflowVersion,
      idempotencyKey: `task011-stale-rewrite-${suffix}`,
      key: "targetDurationDays",
      value: 4,
      source: "user",
      confirmed: true,
    });
    await assert.rejects(
      () => approveSchedule({ userId: owner.id, displayName: owner.displayName, email: owner.email, role: owner.role }, {
        workflowId: workflow.id,
        draftVersion: draft.draftVersion,
        expectedVersion: draft.workflowVersion,
        idempotencyKey: `task011-stale-approve-${suffix}`,
      }),
      (error: unknown) => error instanceof McpToolError && error.code === MCP_ERROR_CODES.SCHEDULE_DRAFT_STALE,
    );
  });
});
