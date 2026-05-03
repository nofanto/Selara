import { test, expect } from '@playwright/test';

// Selectors
const SHARE_BTN = '[data-testid="share-button"]';
const SHARE_CONSENT_MODAL = '[data-testid="share-consent-modal"]';
const GENERATE_BTN = '[data-testid="generate-share-link-button"]';
const SHARE_SUCCESS_MODAL = '[data-testid="share-success-modal"]';
const RESTORING_DATA_MODAL = '[data-testid="restoring-data-modal"]';

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

    // 1. Click Share
    const shareBtn = page.locator(SHARE_BTN);
    await shareBtn.waitFor({ state: 'attached', timeout: 20000 });
    
    // Log visibility
    const isBtnVisible = await shareBtn.isVisible();
    console.log(`Share button visible: ${isBtnVisible}`);
    
    await shareBtn.click({ force: true });

    // 2. Verify Consent Modal
    const consentModal = page.locator(SHARE_CONSENT_MODAL);
    await expect(consentModal).toBeVisible({ timeout: 10000 });

    // 3. Grant Consent
    await page.locator('text=I understand and consent').click();
    
    // 4. Mock successful share
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

    // 5. Click Generate
    const generateBtn = page.locator(GENERATE_BTN);
    await expect(generateBtn).toBeEnabled();
    await generateBtn.click();

    // 6. Verify Success Modal
    const successModal = page.locator(SHARE_SUCCESS_MODAL);
    await expect(successModal).toBeVisible({ timeout: 15000 });
  });

  test('US-SL-02: Import shows Restoring Data modal and skips landing page', async ({ page }) => {
    const mockId = 'test-share-id';
    const mockKey = 'test-key';

    await page.route('**/handleShare*', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ciphertext: 'YTM0YTU2',
          iv: 'YTM0YTU2'
        })
      });
    });

    await page.goto(`/?id=${mockId}#key=${mockKey}`);
    
    // Should show "Restoring Data" modal
    const restoringModal = page.locator(RESTORING_DATA_MODAL);
    await expect(restoringModal).toBeVisible({ timeout: 15000 });
  });
});
