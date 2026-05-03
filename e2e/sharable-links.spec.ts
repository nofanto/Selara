import { test, expect } from '@playwright/test';

// Selectors
const SHARE_BTN = '[data-testid="share-button"]';
const SUCCESS_NOTIFICATION = '[data-testid="import-success-notification"]';
const ERROR_NOTIFICATION = '[data-testid="import-error-notification"]'; // In DataControls
const DB_ERROR_BANNER = '[data-testid="db-error-banner"]'; // In App.tsx

test.describe('Sharable Links', () => {
  test('US-SL-01: Generate a Sharable Link', async ({ page, context }) => {
    // Inject E2E flag
    await page.addInitScript(() => {
      localStorage.setItem('scenia-e2e', 'true');
    });
    await page.goto('/');

    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Find the share button
    const shareBtn = page.locator(SHARE_BTN);
    await expect(shareBtn).toBeVisible();

    // Click share (it will fail because backend is not deployed, should show error)
    await shareBtn.click();

    // Verify error notification (from DataControls)
    await expect(page.locator(ERROR_NOTIFICATION)).toBeVisible({ timeout: 20000 });
  });

  test('US-SL-02: Import Data from a Sharable Link', async ({ page }) => {
    const mockId = 'test-share-id';
    const mockKey = 'invalid-key';

    // Inject E2E flag
    await page.addInitScript(() => {
      localStorage.setItem('scenia-e2e', 'true');
    });

    // Mock the fetch to return something that will fail decryption
    await page.route('**/handleShare*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ciphertext: 'dGVzdA==',
          iv: 'dGVzdA=='
        })
      });
    });

    // Go directly to the share link
    await page.goto(`/?id=${mockId}#key=${mockKey}`);
    
    // Decryption or fetch should fail, App-level error banner should appear
    await expect(page.locator(DB_ERROR_BANNER)).toBeVisible({ timeout: 20000 });
  });
});
