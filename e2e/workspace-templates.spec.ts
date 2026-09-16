import { test, expect } from '@playwright/test';

/**
 * User Story 15: Workspace Templates (Multi-Taxonomy Support)
 *
 * AC1: TemplatePickerModal shown on first load (empty DB, no scenia-e2e flag)
 * AC2: Modal shows 3 template cards: rpti, viewer, blank
 * AC4: RPTI catalogue template loads RPTI demo portfolio; catalogue section visible
 * AC5: Viewer card has single "Upload file" button; triggers file chooser; closes picker after import
 * AC6: Blank template loads empty workspace; catalogue section available
 * AC7: Template picker NOT shown in E2E mode (scenia-e2e flag)
 * AC8: Template picker NOT shown on subsequent loads (non-empty DB)
 */

/**
 * Helper: delete the app's IndexedDB and remove the scenia-e2e flag so that the
 * next page.reload() triggers the first-run template picker.
 */
async function simulateFirstRun(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('it-initiative-visualiser');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => setTimeout(resolve, 200);
    });
    localStorage.removeItem('scenia-e2e');
    // Skip the landing page so the template picker shows immediately
    localStorage.setItem('scenia_has_seen_landing', 'true');
  });
  await page.reload();
}

test.describe('Workspace Templates', () => {
  // AC7: template picker is suppressed when scenia-e2e is set (default E2E setup)
  test('AC7: template picker is not shown in E2E mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
    await expect(page.getByTestId('template-picker-modal')).not.toBeVisible();
  });

  // AC1: picker shown on first load
  test('AC1: template picker modal is shown on first load', async ({ page }) => {
    await page.goto('/');
    await simulateFirstRun(page);
    await expect(page.getByTestId('template-picker-modal')).toBeVisible({ timeout: 20000 });
  });

  // AC2 (revised for #38): the picker offers two ways to begin, not a template
  // gallery — start from your filed OJK returns, or start empty.
  test('AC2: exactly two ways to begin are offered', async ({ page }) => {
    await page.goto('/');
    await simulateFirstRun(page);
    await page.waitForSelector('[data-testid="template-picker-modal"]', { timeout: 20000 });
    await expect(page.getByTestId('onboarding-path-returns')).toBeVisible();
    await expect(page.getByTestId('onboarding-path-empty')).toBeVisible();
    // The template gallery is gone; the catalogue is now added from the Visualiser.
    await expect(page.getByTestId('template-card-rpti')).toHaveCount(0);
    await expect(page.getByTestId('template-card-viewer')).toHaveCount(0);
  });

  // AC4: RPTI catalogue template
  test('AC4: RPTI catalogue template loads demo portfolio and shows catalogue section', async ({ page }) => {
    await page.goto('/');
    await simulateFirstRun(page);
    await page.waitForSelector('[data-testid="template-picker-modal"]', { timeout: 20000 });
    // Demo data moved to the start-empty path when the catalogue card was
    // removed — it was previously reachable only through that card.
    await page.getByTestId('template-start-demo-btn').click();
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
    // Catalogue section must be visible
    await expect(page.getByTestId('rpti-catalogue-section')).toBeVisible();
  });

  // AC5 (revised for #38): opening a colleague's shared file is no longer a way
  // to *start* a workspace — it is a mode, and it lives on the import/share
  // surface. The capability must survive the move (SC-006).
  test('AC5: opening a shared file is available from the import/share controls', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
    await expect(page.getByTestId('open-shared-file')).toBeVisible();

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByTestId('open-shared-file').click(),
    ]);
    expect(fileChooser).toBeTruthy();
  });

  // AC6: Blank template
  test('AC6: Blank template loads empty workspace; catalogue section available', async ({ page }) => {
    await page.goto('/');
    await simulateFirstRun(page);
    await page.waitForSelector('[data-testid="template-picker-modal"]', { timeout: 20000 });
    await page.getByTestId('template-start-blank-btn').click();
    // Modal dismissed
    await expect(page.getByTestId('template-picker-modal')).not.toBeVisible({ timeout: 10000 });
    // App nav is visible (app loaded)
    await expect(page.getByTestId('nav-visualiser')).toBeVisible();
    // No asset swimlanes
    await expect(page.locator('[data-testid="asset-row-content"]')).toHaveCount(0);
    // The catalogue IS shown on a blank workspace now. It previously had its own
    // onboarding card; with that gone, this is the only route to the OJK areas,
    // and showRptiCatalogue has no UI toggle — so hiding it here would make them
    // unreachable (SC-006).
    await expect(page.getByTestId('rpti-catalogue-section')).toBeVisible();
  });

  // AC8: picker not shown on subsequent loads
  test('AC8: template picker not shown when DB already has data', async ({ page }) => {
    // Load with the RPTI catalogue (default E2E behavior) — DB is populated
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
    // Remove the scenia-e2e flag — but DB is non-empty now
    await page.evaluate(() => localStorage.removeItem('scenia-e2e'));
    await page.reload();
    // App should load data from DB, not show the picker
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
    await expect(page.getByTestId('template-picker-modal')).not.toBeVisible();
  });
});
