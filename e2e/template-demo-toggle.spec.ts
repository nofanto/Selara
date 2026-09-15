import { test, expect } from '@playwright/test';

/**
 * User Story 18: Template Selection with Demo Data Toggle
 *
 * AC1: The two old Data Manager reset buttons are replaced with a single "Clear data and start again" button
 * AC2: Clicking "Clear data and start again" opens the template picker with a data-loss warning
 * AC3: Each non-blank template card shows two buttons: "With demo data" and "Without demo data"
 * AC4: The Blank template card shows only a "Start blank" button
 * AC5: "With demo data" loads asset categories, assets, initiatives, milestones, and deliverable segments
 * AC6: "Without demo data" loads only asset categories and assets — no initiatives, milestones, or segments
 * AC7: First-time onboarding flow shows the updated template picker (with/without demo data buttons)
 * AC8: After selecting a template during first run, the tutorial modal is shown
 * AC9: E2E mode is unchanged (auto-loads the RPTI catalogue with demo data, suppresses picker)
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
    localStorage.setItem('scenia_has_seen_landing', 'true');
  });
  await page.reload();
}

test.describe('US-18: Template Demo Data Toggle', () => {

  // ── AC1 ──────────────────────────────────────────────────────────────────
  test('AC1: old reset buttons removed; "Clear data and start again" button present in Data Manager', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
    await page.getByTestId('nav-data-manager').click();
    await expect(page.getByTestId('data-manager')).toBeVisible();

    // Old buttons must be gone
    await expect(page.getByText('Reset - delete all data')).not.toBeVisible();
    await expect(page.getByText('Reset - use demo data')).not.toBeVisible();

    // New button must be present
    await expect(page.getByTestId('clear-and-start-again-btn')).toBeVisible();
    await expect(page.getByTestId('clear-and-start-again-btn')).toContainText('Clear data and start again');
  });

  // ── AC2 ──────────────────────────────────────────────────────────────────
  test('AC2: "Clear data and start again" opens template picker with data-loss warning', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('clear-and-start-again-btn').click();

    await expect(page.getByTestId('template-picker-modal')).toBeVisible({ timeout: 5000 });
    // Warning copy must make data loss clear
    await expect(page.getByTestId('template-picker-modal')).toContainText(/replace.*data|data.*lost|data.*replaced/i);
  });

  // ── AC3 ──────────────────────────────────────────────────────────────────
  // AC3 (revised for #38): the per-card with/without pair is gone. Demo data now
  // lives on the start-empty path — it was previously reachable only through the
  // catalogue card, which this feature removed.
  test('AC3: the start-empty path offers both a blank workspace and demo data', async ({ page }) => {
    await page.goto('/');
    await simulateFirstRun(page);
    await page.waitForSelector('[data-testid="template-picker-modal"]', { timeout: 20000 });
    const empty = page.getByTestId('onboarding-path-empty');
    await expect(empty.getByTestId('template-start-blank-btn')).toBeVisible();
    await expect(empty.getByTestId('template-start-demo-btn')).toBeVisible();
    // The per-template pair no longer exists.
    await expect(page.getByTestId('template-select-with-demo-btn-rpti')).toHaveCount(0);
  });

  // ── AC4 ──────────────────────────────────────────────────────────────────
  test('AC4: Blank template card shows only "Start blank" — no demo data buttons', async ({ page }) => {
    await page.goto('/');
    await simulateFirstRun(page);
    await page.waitForSelector('[data-testid="template-picker-modal"]', { timeout: 20000 });

    await expect(page.getByTestId('template-start-blank-btn')).toBeVisible();
    await expect(page.getByTestId('template-select-with-demo-btn-blank')).not.toBeVisible();
    await expect(page.getByTestId('template-select-no-demo-btn-blank')).not.toBeVisible();
  });

  // ── AC5 ──────────────────────────────────────────────────────────────────
  test('AC5: RPTI catalogue "With demo data" loads categories, assets, initiatives, and segments', async ({ page }) => {
    await page.goto('/');
    await simulateFirstRun(page);
    await page.waitForSelector('[data-testid="template-picker-modal"]', { timeout: 20000 });
    await page.getByTestId('template-start-demo-btn').click();

    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });

    // At least one initiative bar rendered
    const initiativeBars = page.locator('[data-testid^="initiative-bar"]');
    await expect(initiativeBars.first()).toBeVisible({ timeout: 10000 });

    // At least one deliverable segment rendered
    const segments = page.locator('[data-testid^="segment-"]');
    await expect(segments.first()).toBeVisible({ timeout: 10000 });
  });

  // ── AC6 ──────────────────────────────────────────────────────────────────
  // AC6 (revised for #38): "catalogue structure without demo data" was one click
  // on the removed card. The capability survives but costs more: start blank —
  // which now surfaces the catalogue, since nothing else does — then prepopulate
  // an area. Asserted end to end rather than assumed.
  test('AC6: the OJK catalogue is reachable from a blank workspace without demo data', async ({ page }) => {
    await page.goto('/');
    await simulateFirstRun(page);
    await page.waitForSelector('[data-testid="template-picker-modal"]', { timeout: 20000 });
    await page.getByTestId('template-start-blank-btn').click();

    // First run shows the tutorial over everything (AC8). It must be dismissed,
    // or it covers the catalogue — a forced click would silently land on the
    // overlay instead of the button, and add nothing.
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.getByTestId('tutorial-modal')).toHaveCount(0);

    await expect(page.getByTestId('rpti-catalogue-section')).toBeVisible({ timeout: 20000 });
    // Any area will do — pinning a code would couple this to catalogue ordering.
    const prepopulate = page.locator('[data-testid^="rpti-catalogue-prepopulate-btn-"]').first();
    await expect(prepopulate).toBeVisible({ timeout: 10000 });
    await prepopulate.click();

    await expect(page.locator('[data-testid="asset-row-content"]').first()).toBeVisible({ timeout: 10000 });
    // Structure only — no fabricated work.
    await expect(page.locator('[data-testid^="initiative-bar"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="segment-"]')).toHaveCount(0);
  });

  // ── AC7 ──────────────────────────────────────────────────────────────────
  test('AC7: first-time onboarding shows the two paths', async ({ page }) => {
    await page.goto('/');
    await simulateFirstRun(page);
    await page.waitForSelector('[data-testid="template-picker-modal"]', { timeout: 20000 });

    // The updated dual-button structure must appear in the first-run context too
    await expect(page.getByTestId('onboarding-path-returns')).toBeVisible();
    await expect(page.getByTestId('onboarding-path-empty')).toBeVisible();
    await expect(page.getByTestId('template-start-blank-btn')).toBeVisible();
    await expect(page.getByTestId('template-start-demo-btn')).toBeVisible();
  });

  // ── AC8 ──────────────────────────────────────────────────────────────────
  test('AC8: selecting a template during first run shows the tutorial modal', async ({ page }) => {
    await page.goto('/');
    // Fresh DB means hasSeenTutorial = false, so tutorial auto-opens after template selection
    await simulateFirstRun(page);
    await page.waitForSelector('[data-testid="template-picker-modal"]', { timeout: 20000 });
    await page.getByTestId('template-start-demo-btn').click();

    // Tutorial modal must appear (identified by its data-testid added in implementation)
    await expect(page.getByTestId('tutorial-modal')).toBeVisible({ timeout: 10000 });
  });

  // ── AC9 ──────────────────────────────────────────────────────────────────
  test('AC9: E2E mode is unchanged — template picker is suppressed', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
    await expect(page.getByTestId('template-picker-modal')).not.toBeVisible();
  });

});
