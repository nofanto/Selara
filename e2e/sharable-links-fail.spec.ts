import { test, expect } from '@playwright/test';

// Selectors
const SHARE_BTN = '[data-testid="share-button"]';
const SHARE_CONSENT_MODAL = '[data-testid="share-consent-modal"]';
const GENERATE_BTN = '[data-testid="generate-share-link-button"]';
const ERROR_NOTIFICATION = '[data-testid="import-error-notification"]';

// Skipped: the Share feature is disabled (SHARING_ENABLED = false in
// DataControls.tsx) pending Selara's own backend — src/lib/share.ts's
// hardcoded endpoint belongs to Scenia's original author. Re-enable this
// suite once the feature points at Selara's own backend.
test.describe.skip('Sharable Links - Failure Paths', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('scenia-e2e', 'true');
    });
    await page.goto('/');
    // Force desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('US-SL-03: Handle API Error on Share', async ({ page }) => {
    // 1. Click Share to open consent
    const shareBtn = page.locator(SHARE_BTN);
    await shareBtn.waitFor({ state: 'visible', timeout: 20000 });
    await shareBtn.click();

    // 2. Grant Consent
    const consentModal = page.locator(SHARE_CONSENT_MODAL);
    await expect(consentModal).toBeVisible();
    await page.locator('text=I understand and consent').click();

    // 3. Mock API failure
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

    // 4. Click Generate and expect error
    const generateBtn = page.locator(GENERATE_BTN);
    await generateBtn.click();

    // 5. Verify error notification
    await expect(page.locator(ERROR_NOTIFICATION)).toBeVisible({ timeout: 20000 });
  });

  test('US-SL-03: Handle Expired Link (410)', async ({ page }) => {
    // Mock API failure with 410 Gone
    await page.route('**/handleShare*', async route => {
      await route.fulfill({
        status: 410,
        contentType: 'text/plain',
        body: 'This link has expired'
      });
    });

    // Visit with an ID and Key
    await page.goto('/?id=expired-id#key=expired-key');

    // Verify error banner shows the expiry message (App.tsx uses db-error-banner for mount errors)
    const errorBanner = page.locator('[data-testid="db-error-banner"]');
    await expect(errorBanner).toBeVisible({ timeout: 20000 });
    await expect(errorBanner).toContainText('This share link has expired or does not exist');
  });
});
