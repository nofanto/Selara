import { test, expect } from '@playwright/test';

// Selectors
const SHARE_BTN = '[data-testid="share-button"]';
const SHARE_CONSENT_MODAL = '[data-testid="share-consent-modal"]';
const GENERATE_BTN = '[data-testid="generate-share-link-button"]';
const ERROR_NOTIFICATION = '[data-testid="import-error-notification"]';

test.describe('Sharable Links - Failure Paths', () => {
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
});
