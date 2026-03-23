/**
 * @file: schedule-acts.e2e.ts
 * @description: E2E тесты для Schedule (Gantt) и Acts страниц (Sprint 4 tablet adaptation).
 *   Требует: npm install -D @playwright/test && npx playwright install
 * @dependencies: Schedule.tsx, Acts.tsx
 * @created: 2026-03-14
 */

// TODO: Установить Playwright: npm install -D @playwright/test && npx playwright install
// После установки раскомментировать тесты ниже.

/*
import { test, expect } from '@playwright/test';

const BREAKPOINTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 1024, height: 768 },
  tabletPortrait: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
};

// ---------------------------------------------------------------------------
// Schedule (Gantt) — Task 4.1, 4.2, 4.3
// ---------------------------------------------------------------------------

test.describe('Schedule page — tablet layout (Sprint 4)', () => {
  test.beforeEach(async ({ page }) => {
    // Assumes dev server at localhost:5000 with a seeded user session
    await page.goto('/schedule');
  });

  test('4.1 — Gantt container uses full width on tablet', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.tablet);
    // Max-width container should NOT be capped at 5xl on lg+
    const container = page.locator('[data-testid="schedule-gantt-container"]');
    const box = await container.boundingBox();
    expect(box?.width).toBeGreaterThan(900);
  });

  test('4.2 — Zoom-out button decreases day width', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.tablet);
    const ganttHeader = page.locator('[data-testid="gantt-timeline-header"]');
    const initialWidth = (await ganttHeader.boundingBox())?.width ?? 0;

    await page.click('[aria-label="Zoom out"], [aria-label="Уменьшить масштаб"]');
    const newWidth = (await ganttHeader.boundingBox())?.width ?? 0;
    // After zoom out — more days shown, timeline wider
    expect(newWidth).toBeGreaterThanOrEqual(initialWidth);
  });

  test('4.2 — Zoom level label updates on click', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.tablet);
    // Default label is "2М" / "2M"
    const zoomLabel = page.locator('span.tabular-nums');
    await expect(zoomLabel).toContainText(/2М|2M/);

    await page.click('[aria-label="Zoom in"], [aria-label="Увеличить масштаб"]');
    await expect(zoomLabel).toContainText(/6Н|6W/);
  });

  test('4.3 — Task editor opens with tabs on tablet', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.tablet);
    // Click the first task bar in the Gantt
    const firstBar = page.locator('button.absolute.h-6').first();
    await firstBar.click();

    // Tabs should be visible
    await expect(page.locator('[role="tablist"]')).toBeVisible();
    await expect(page.locator('[role="tab"]', { hasText: /Основное|Basic/ })).toBeVisible();
    await expect(page.locator('[role="tab"]', { hasText: /Материалы|Materials/ })).toBeVisible();
    await expect(page.locator('[role="tab"]', { hasText: /Документация|Docs/ })).toBeVisible();
  });

  test('4.3 — Switching to Docs tab shows executive schemes editor', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.tablet);
    const firstBar = page.locator('button.absolute.h-6').first();
    await firstBar.click();

    await page.click('[role="tab"]:has-text("Документация"), [role="tab"]:has-text("Docs")');
    // Executive schemes editor should be visible
    await expect(page.locator('text=Исполнительные схемы, text=Executive schemes')).toBeVisible();
  });

  test('4.4 — Act template picker opens as inline dialog', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.tablet);
    const firstBar = page.locator('button.absolute.h-6').first();
    await firstBar.click();

    // Click the act type button (should open inline dialog, not navigate)
    await page.click('button:has-text("Выбрать тип акта"), button:has-text("Select act type")');
    await expect(page.locator('input[placeholder*="Поиск шаблона"], input[placeholder*="Search template"]')).toBeVisible();
  });

  test('4.4 — Act template search filters the list', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.tablet);
    const firstBar = page.locator('button.absolute.h-6').first();
    await firstBar.click();
    await page.click('button:has-text("Выбрать тип акта"), button:has-text("Select act type")');

    const search = page.locator('input[placeholder*="Поиск шаблона"], input[placeholder*="Search template"]');
    await search.fill('АОСР');
    // Some results should be visible
    const items = page.locator('[role="dialog"] button.min-h-\\[44px\\]');
    await expect(items.first()).toBeVisible();
  });

  test('No regression — mobile layout unchanged', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.mobile);
    // Gantt left panel is narrow (160px)
    const leftPanel = page.locator('.w-\\[160px\\]');
    await expect(leftPanel.first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Acts page — Task 4.5, 4.7
// ---------------------------------------------------------------------------

test.describe('Acts page — tablet layout (Sprint 4)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/acts');
  });

  test('4.5 — Acts list wider than max-w-md on tablet', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.tablet);
    const container = page.locator('[data-testid="acts-list-container"], .lg\\:grid-cols-2').first();
    const box = await container.boundingBox();
    // On tablet lg:max-w-4xl ~896px
    expect(box?.width).toBeGreaterThan(600);
  });

  test('4.5 — Acts render in 2-column grid on tablet', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.tablet);
    // If there are acts, the grid wrapper should have lg:grid-cols-2 class
    const grid = page.locator('.grid.lg\\:grid-cols-2');
    await expect(grid).toBeVisible();
  });

  test('4.7 — Download button shows progress bar during export', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.tablet);
    // If no acts exist this test is skipped
    const downloadBtn = page.locator('[data-testid^="button-download-act-"]').first();
    const hasActs = await downloadBtn.count() > 0;
    test.skip(!hasActs, 'No acts to test export');

    await downloadBtn.click();
    // Progress bar should appear
    await expect(page.locator('[role="progressbar"]')).toBeVisible({ timeout: 2000 });
  });

  test('4.5 — Export dialog is wider on tablet (lg:max-w-2xl)', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.tablet);
    const downloadBtn = page.locator('[data-testid^="button-download-act-"]').first();
    const hasActs = await downloadBtn.count() > 0;
    test.skip(!hasActs, 'No acts to test export dialog');

    // Open export dialog via FAB or direct button
    const exportDialogBtn = page.locator('button:has-text("АОСР")').first();
    await exportDialogBtn.click();

    const dialog = page.locator('[role="dialog"]');
    const box = await dialog.boundingBox();
    // lg:max-w-2xl is 672px
    expect(box?.width).toBeGreaterThan(500);
  });
});

// ---------------------------------------------------------------------------
// SplitTaskDialog — Task 4.8
// ---------------------------------------------------------------------------

test.describe('SplitTaskDialog — tablet polish (Sprint 4)', () => {
  test('4.8 — Split dialog is wider on tablet (sm:max-w-lg)', async ({ page }) => {
    await page.goto('/schedule');
    await page.setViewportSize(BREAKPOINTS.tablet);

    // Open a task editor
    const firstBar = page.locator('button.absolute.h-6').first();
    await firstBar.click();

    // If split button is available (task duration > 1), click it
    const splitBtn = page.locator('[aria-label="Разделить задачу"], [aria-label="Split task"]').first();
    const hasSplit = await splitBtn.count() > 0;
    test.skip(!hasSplit, 'No split button available');

    await splitBtn.click();
    const dialog = page.locator('[role="dialog"]').last();
    const box = await dialog.boundingBox();
    expect(box?.width).toBeGreaterThan(400);
  });
});
*/
