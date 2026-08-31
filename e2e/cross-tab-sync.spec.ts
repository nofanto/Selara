import { test, expect } from '@playwright/test';

// Cross-tab sync is active/passive only — one tab edits and saves, other tabs on
// the same origin passively reload and refresh. See requirement-specs/cross-tab-sync.md.
// Two Playwright pages in the same browserContext share localStorage and
// IndexedDB (the same way two real browser tabs on one profile would), which is
// exactly the setup BroadcastChannel delivery needs to be exercised for real.

test.describe('Cross-tab sync', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('scenia-e2e', 'true');
      localStorage.setItem('scenia_has_seen_landing', 'true');
    });
    await page.reload();
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
  });

  test('a rename saved in one tab reaches a second tab, with a toast and no page reload', async ({ page, context }) => {
    const pageB = await context.newPage();
    await pageB.goto('/');
    await pageB.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });

    // Rename the first Initiative on page A (tab A) via a normal inline Data Manager
    // edit — this goes through the real save path, unlike the direct-IndexedDB
    // seeding other e2e specs use, which never triggers a save-time broadcast.
    const newName = `Synced Initiative Name ${Date.now()}`;
    await page.getByTestId('nav-data-manager').click();
    const nameInput = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"] td[data-key="name"] input').first();
    await nameInput.fill(newName);
    await nameInput.press('Tab');
    await page.waitForTimeout(300);

    // Page B never reloads or navigates — the toast and the updated row must appear
    // purely from the BroadcastChannel-triggered in-memory refresh.
    await expect(pageB.getByTestId('sync-toast')).toBeVisible({ timeout: 10000 });
    await expect(pageB.getByTestId('sync-toast')).toContainText('Updated in another tab');

    await pageB.getByTestId('nav-data-manager').click();
    const nameInputsB = pageB.locator('[data-testid="data-manager"] tbody tr[data-real="true"] td[data-key="name"] input');
    await expect(async () => {
      const count = await nameInputsB.count();
      const values = await Promise.all(Array.from({ length: count }, (_, i) => nameInputsB.nth(i).inputValue()));
      expect(values).toContain(newName);
    }).toPass({ timeout: 10000 });

    await pageB.close();
  });

  test('the sync toast can be dismissed', async ({ page, context }) => {
    const pageB = await context.newPage();
    await pageB.goto('/');
    await pageB.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });

    await page.getByTestId('nav-data-manager').click();
    const nameInput = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"] td[data-key="name"] input').first();
    await nameInput.fill(`Dismiss Toast Test ${Date.now()}`);
    await nameInput.press('Tab');

    const toast = pageB.getByTestId('sync-toast');
    await expect(toast).toBeVisible({ timeout: 10000 });
    await toast.locator('button', { hasText: '×' }).click();
    await expect(toast).not.toBeVisible();

    await pageB.close();
  });
});
