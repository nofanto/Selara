import { test, expect } from '@playwright/test';

// Selectors
const SHARE_BTN = '[data-testid="share-button"]';
const SHARE_SUCCESS_MODAL = '[data-testid="share-success-modal"]';
const RESTORING_DATA_MODAL = '[data-testid="restoring-data-modal"]';

test.describe('Sharable Links', () => {
  test.beforeEach(async ({ page }) => {
    // Force a desktop viewport to ensure header controls are visible
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('US-SL-01: Generate a Sharable Link shows success modal', async ({ page, context }) => {
    await page.addInitScript(() => {
      localStorage.setItem('scenia-e2e', 'true');
    });
    await page.goto('/');

    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Mock successful share
    await page.route('**/handleShare', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'mock-id' })
        });
      } else {
        await route.continue();
      }
    });

    const shareBtn = page.locator(SHARE_BTN);
    await expect(shareBtn).toBeVisible({ timeout: 20000 });
    await shareBtn.click();

    // Verify Success Modal
    const modal = page.locator(SHARE_SUCCESS_MODAL);
    await expect(modal).toBeVisible({ timeout: 15000 });
    await expect(modal).toContainText('Link Copied!');
    await expect(modal).toContainText('This link will expire in 1 week');
    
    // Check clipboard
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('?id=mock-id');
  });

  test('US-SL-02: Import shows Restoring Data modal and skips landing page', async ({ page }) => {
    const mockId = 'test-share-id';
    const mockKey = 'test-key';

    // Mock successful fetch with delay
    await page.route('**/handleShare*', async route => {
      await new Promise(resolve => setTimeout(resolve, 3000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ciphertext: 'YTM0YTU2',
          iv: 'YTM0YTU2'
        })
      });
    });

    // Go directly to the share link
    await page.goto(`/?id=${mockId}#key=${mockKey}`);
    
    // Should show "Restoring Data" modal
    await expect(page.locator(RESTORING_DATA_MODAL)).toBeVisible({ timeout: 15000 });
    
    // Landing page should NOT be visible
    const landingHeading = page.getByRole('heading', { name: /strategic portfolio planning/i });
    await expect(landingHeading).not.toBeVisible();
  });
});
