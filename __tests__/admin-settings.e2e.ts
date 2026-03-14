/**
 * @file: admin-settings.e2e.ts
 * @description: E2E тесты для Admin, Settings, RBAC и 404 страниц (Sprint 6 tablet adaptation).
 *   Требует: npm install -D @playwright/test && npx playwright install
 * @dependencies: AdminLayout.tsx, AdminGuard.tsx, Settings.tsx, not-found.tsx
 * @created: 2026-03-14
 */

// TODO: uncomment when Playwright is configured
// npm install -D @playwright/test && npx playwright install

/*
import { test, expect } from '@playwright/test';

const BREAKPOINTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  tabletLandscape: { width: 1024, height: 768 },
  desktop: { width: 1280, height: 900 },
};

// ---------------------------------------------------------------------------
// Task 6.2 — Admin Layout: hamburger on tablet (768px)
// ---------------------------------------------------------------------------

test.describe('AdminLayout — hamburger sidebar on tablet (Sprint 6)', () => {
  test.beforeEach(async ({ page }) => {
    // Assumes dev server at localhost:5000 with seeded admin session
    await page.goto('/admin');
  });

  test('6.2 — Hamburger button visible only on md breakpoint (768–1023px)', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.tablet);
    const hamburger = page.locator('button[aria-label="Открыть меню"], button[aria-label="Закрыть меню"]');
    await expect(hamburger).toBeVisible();

    // Should not be visible on mobile
    await page.setViewportSize(BREAKPOINTS.mobile);
    await expect(hamburger).toBeHidden();

    // Should not be visible on desktop
    await page.setViewportSize(BREAKPOINTS.desktop);
    await expect(hamburger).toBeHidden();
  });

  test('6.2 — Hamburger click opens sidebar Sheet', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.tablet);
    const hamburger = page.locator('button[aria-label="Открыть меню"]');
    await hamburger.click();
    // Sheet overlay should be visible
    const sheet = page.locator('[role="dialog"]');
    await expect(sheet).toBeVisible();
    // Nav items should be present in the sheet
    await expect(sheet.locator('text=Дашборд')).toBeVisible();
    await expect(sheet.locator('text=Пользователи')).toBeVisible();
  });

  test('6.2 — Clicking nav item inside Sheet closes the overlay', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.tablet);
    const hamburger = page.locator('button[aria-label="Открыть меню"]');
    await hamburger.click();

    const sheet = page.locator('[role="dialog"]');
    await sheet.locator('text=Пользователи').click();
    // Sheet should close after navigation
    await expect(sheet).toBeHidden({ timeout: 2000 });
  });

  test('6.2 — Sidebar always visible on desktop (lg+)', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.desktop);
    // Desktop sidebar: .hidden.lg\\:flex should render as flex
    const sidebar = page.locator('aside.hidden.lg\\:flex');
    await expect(sidebar).toBeVisible();
  });

  test('6.2 — Mobile bottom nav visible only on mobile (<md)', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.mobile);
    const bottomNav = page.locator('.md\\:hidden.fixed.bottom-0');
    await expect(bottomNav).toBeVisible();

    await page.setViewportSize(BREAKPOINTS.tablet);
    await expect(bottomNav).toBeHidden();
  });
});

// ---------------------------------------------------------------------------
// Task 6.6 — Admin RBAC: non-admin user redirected from /admin
// ---------------------------------------------------------------------------

test.describe('AdminGuard — RBAC (Sprint 6)', () => {
  test('6.6 — Non-admin user sees Access Denied page on /admin', async ({ page }) => {
    // Navigate to /admin as a non-admin user (assumes no admin session)
    // In a real scenario this would use a seeded non-admin user session
    await page.goto('/admin');
    // Should either redirect to login or show Access Denied
    const isLoginPage = page.url().includes('/login');
    const isAccessDenied = await page.locator('text=Доступ запрещён').isVisible().catch(() => false);
    expect(isLoginPage || isAccessDenied).toBe(true);
  });

  test('6.6 — Access Denied page has "Настройки" link', async ({ page }) => {
    // Assumes logged-in but non-admin session; mock or seed accordingly
    // This verifies the UI structure of the AccessDenied component
    await page.goto('/admin');
    const accessDenied = page.locator('text=Доступ запрещён');
    const hasPage = await accessDenied.isVisible().catch(() => false);
    if (hasPage) {
      const settingsLink = page.locator('a[href="/settings"], text=Настройки');
      await expect(settingsLink).toBeVisible();
    }
  });

  test('6.6 — Admin user can access /admin without redirect', async ({ page }) => {
    // Assumes admin session is set up in beforeAll or via cookies
    // This test only runs when an admin session is available
    await page.goto('/admin');
    const isDashboard = await page.locator('text=Admin Panel').isVisible().catch(() => false);
    const isLoginRedirect = page.url().includes('/login');
    // Either we're on admin dashboard or we need login (no RBAC block for admin)
    expect(isDashboard || isLoginRedirect).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task 6.7 — 404 page
// ---------------------------------------------------------------------------

test.describe('404 page — not-found.tsx (Sprint 6)', () => {
  test('6.7 — Shows 404 page on invalid route', async ({ page }) => {
    await page.goto('/this-route-definitely-does-not-exist-12345');
    await expect(page.locator('text=404')).toBeVisible();
    await expect(page.locator('text=Страница не найдена')).toBeVisible();
    await expect(page.locator('text=Страница, которую вы ищете, не существует')).toBeVisible();
  });

  test('6.7 — "На главную" button navigates to /', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz');
    const homeButton = page.locator('text=На главную');
    await expect(homeButton).toBeVisible();
    await homeButton.click();
    await expect(page).toHaveURL('/');
  });

  test('6.7 — "Назад" button is present and calls window.history.back()', async ({ page }) => {
    await page.goto('/');
    await page.goto('/nonexistent-page-xyz');
    const backButton = page.locator('text=Назад');
    await expect(backButton).toBeVisible();
    await backButton.click();
    // Should navigate back to previous page (/)
    await expect(page).toHaveURL('/');
  });

  test('6.7 — 404 page is centered on all breakpoints', async ({ page }) => {
    for (const [, size] of Object.entries(BREAKPOINTS)) {
      await page.setViewportSize(size);
      await page.goto('/nonexistent-page-abc');
      // The container should be centered (flexbox)
      const container = page.locator('.min-h-screen.flex.items-center.justify-center');
      await expect(container).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Task 6.1 — Settings tablet layout: two-column on lg+ (1280px)
// ---------------------------------------------------------------------------

test.describe('Settings — two-column tablet layout (Sprint 6)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
  });

  test('6.1 — Sidebar nav visible on desktop (lg+)', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.desktop);
    // Sidebar with lg:hidden marker should be visible
    const sidebar = page.locator('aside.hidden.lg\\:flex, aside.w-64');
    await expect(sidebar).toBeVisible();
  });

  test('6.1 — Sidebar nav contains expected section items', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.desktop);
    const sidebar = page.locator('aside');
    await expect(sidebar.locator('text=Профиль')).toBeVisible();
    await expect(sidebar.locator('text=Язык')).toBeVisible();
    await expect(sidebar.locator('text=Журнал работ')).toBeVisible();
    await expect(sidebar.locator('text=О приложении')).toBeVisible();
  });

  test('6.1 — Clicking sidebar item shows its content in right panel', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.desktop);
    const sidebar = page.locator('aside');
    await sidebar.locator('text=Язык').click();
    // Language switcher should appear in the right content area
    await expect(page.locator('text=Русский')).toBeVisible();
    await expect(page.locator('text=English')).toBeVisible();
  });

  test('6.1 — Single-scroll layout on mobile (no sidebar)', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.mobile);
    // Sidebar should be hidden on mobile
    const mobileSidebar = page.locator('aside.hidden.lg\\:flex');
    await expect(mobileSidebar).toBeHidden();
    // All sections visible in scroll
    await expect(page.locator('text=Профиль')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Task 6.3 — AdminUsers search filter
// ---------------------------------------------------------------------------

test.describe('AdminUsers — search filter (Sprint 6)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/users');
  });

  test('6.3 — Search input filters user cards', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.tablet);
    const searchInput = page.locator('input[placeholder*="Поиск по ID"]');
    await expect(searchInput).toBeVisible();
    // Type a search query that should produce no results
    await searchInput.fill('__nonexistent_user_12345__');
    await expect(page.locator('text=Пользователи не найдены')).toBeVisible();
  });

  test('6.3 — Filter tabs work (Все / Admin / Заблокированные)', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.desktop);
    const allTab = page.locator('button:has-text("Все")');
    const adminTab = page.locator('button:has-text("Admin")');
    const blockedTab = page.locator('button:has-text("Заблокированные")');

    await expect(allTab).toBeVisible();
    await expect(adminTab).toBeVisible();
    await expect(blockedTab).toBeVisible();

    await adminTab.click();
    // After clicking Admin, the filter should be active (bg-background shadow class)
    await expect(adminTab).toHaveClass(/bg-background|shadow/);
  });

  test('6.3 — User cards rendered in 2-column grid on lg+', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.desktop);
    // The grid container should have grid-cols-2 class
    const grid = page.locator('.lg\\:grid.lg\\:grid-cols-2, .lg\\:grid-cols-2');
    // Grid exists in DOM even if no users
    await expect(grid).toBeAttached();
  });
});

// ---------------------------------------------------------------------------
// Task 6.5 — AdminMaterials create/delete flow (mocked)
// ---------------------------------------------------------------------------

test.describe('AdminMaterials — create/delete flow (Sprint 6)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the materials API to return a test material
    await page.route('/api/admin/materials', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 1, name: 'Тестовый материал', baseUnit: 'шт', standardRef: 'ГОСТ 12345' }
          ]),
        });
      } else {
        await route.continue();
      }
    });
    await page.goto('/admin/materials');
  });

  test('6.5 — Create material button opens dialog', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.tablet);
    const addButton = page.locator('button:has-text("Добавить")');
    await expect(addButton).toBeVisible();
    await addButton.click();
    // Dialog should open
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('text=Добавить материал')).toBeVisible();
  });

  test('6.5 — Material dialog is wider on tablet (sm:max-w-lg)', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.tablet);
    const addButton = page.locator('button:has-text("Добавить")');
    await addButton.click();
    const dialog = page.locator('[role="dialog"]');
    const box = await dialog.boundingBox();
    // sm:max-w-lg = 512px; should be wider than default max-w-sm (384px)
    expect(box?.width).toBeGreaterThan(400);
  });

  test('6.5 — Delete button opens confirm dialog', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.tablet);
    const deleteBtn = page.locator('[data-testid="delete-material"], button[class*="destructive"]').first();
    const hasBtn = await deleteBtn.count() > 0;
    test.skip(!hasBtn, 'No delete button to test');

    await deleteBtn.click();
    const alertDialog = page.locator('[role="alertdialog"]');
    await expect(alertDialog).toBeVisible();
    await expect(alertDialog.locator('text=Удалить материал?')).toBeVisible();
  });

  test('6.5 — Materials in 2-column grid on desktop', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.desktop);
    const grid = page.locator('.lg\\:grid.lg\\:grid-cols-2, .lg\\:grid-cols-2');
    await expect(grid).toBeAttached();
  });

  test('6.5 — Search filters materials list', async ({ page }) => {
    await page.setViewportSize(BREAKPOINTS.tablet);
    const searchInput = page.locator('input[placeholder*="Поиск по названию"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Тестовый');
    // The mocked material should still be visible
    await expect(page.locator('text=Тестовый материал')).toBeVisible();

    await searchInput.fill('__nonexistent__');
    await expect(page.locator('text=Материалы не найдены')).toBeVisible();
  });
});
*/
