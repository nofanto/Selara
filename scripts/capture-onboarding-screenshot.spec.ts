import { test } from '@playwright/test';

/**
 * Captures the first-run onboarding picker for docs/user-guide/01-getting-started.
 *
 * Kept apart from capture-feature-screenshots.spec.ts because that one sets the
 * `scenia-e2e` flag in beforeEach, which suppresses the picker outright — so the
 * picker could never be recaptured there, and its screenshot went stale enough to
 * still show Scenia's four inherited templates (issue #27).
 *
 * Run against a dev server:  npx playwright test scripts/capture-onboarding-screenshot.spec.ts
 */
test('capture the onboarding picker', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  // Reach a genuine first run: the deletion must be awaited, and `scenia-e2e`
  // removed, or the picker never appears. Mirrors e2e/rpti-import-onboarding.spec.ts.
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('it-initiative-visualiser');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => setTimeout(resolve, 200);
    });
    localStorage.removeItem('scenia-e2e');
    localStorage.setItem('scenia_has_seen_landing', 'true');
  });
  await page.reload();

  const overlay = page.getByTestId('template-picker-modal');
  await overlay.waitFor({ timeout: 20000 });
  await page.waitForTimeout(400); // let the entrance transition settle

  // The testid is on the full-screen backdrop, so shooting it captures the blurred
  // app behind the dialog too. The white card is its only child — shoot that.
  await overlay.locator('> div').first()
    .screenshot({ path: 'public/features/template-picker-modal.png' });
});
