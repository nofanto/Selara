import { test, expect } from '@playwright/test';

// Selectors
const SHARE_BTN = '[data-testid="share-button"]';
const ERROR_NOTIFICATION = '[data-testid="import-error-notification"]';

test.describe('Sharable Links - Failure Paths', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('scenia-e2e', 'true');
    });
    await page.goto('/');
  });

  test('US-SL-03: Handle API Error on Share', async ({ page }) => {
    // Mock API failure
    await page.route('**/handleShare', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'text/plain',
          body: 'Internal Server Error'
        });
      } else {
        await route.continue();
      }
    });

    const shareBtn = page.locator(SHARE_BTN);
    await expect(shareBtn).toBeVisible();
    await shareBtn.click();

    // Verify error notification
    await expect(page.locator(ERROR_NOTIFICATION)).toBeVisible({ timeout: 20000 });
  });
});
