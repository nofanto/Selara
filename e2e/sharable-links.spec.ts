import { test, expect } from '@playwright/test';

test.describe('Sharable Links', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('US-SL-01: Generate a Sharable Link (with Consent)', async ({ page, context }) => {
    await page.addInitScript(() => {
      localStorage.setItem('scenia-e2e', 'true');
    });
    await page.goto('/');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Click Share
    await page.getByTestId('share-button').click({ timeout: 15000 });

    // Consent
    await page.getByRole('checkbox').check();
    
    // Mock
    await page.route('**/handleShare', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'mock-id' })
      });
    });

    // Generate
    await page.getByTestId('generate-share-link-button').click();

    // Success
    await expect(page.getByTestId('share-success-modal')).toBeVisible({ timeout: 15000 });
  });

  test('US-SL-02: Import shows Restoring Data modal', async ({ page }) => {
    await page.route('**/handleShare*', async route => {
      await new Promise(resolve => setTimeout(resolve, 3000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ciphertext: 'YTM0YTU2', iv: 'YTM0YTU2' })
      });
    });

    await page.goto('/?id=test-id#key=test-key');
    await expect(page.getByTestId('restoring-data-modal')).toBeVisible({ timeout: 10000 });
  });
});
