import { test, expect } from '@playwright/test';

// User Story 24 §AC2 (capture at save) and §AC3 (payoff in the difference
// report) — the trigger and reinforcement that §6 of the design notes exists to
// create. See requirement-specs/decision-version-history-merge.md.
test.describe('History capture loop', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('scenia-e2e', 'true');
      localStorage.setItem('scenia_has_seen_landing', 'true');
    });
    await page.reload();
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
  });

  const openSaveDialog = async (page: import('@playwright/test').Page) => {
    await page.getByTestId('nav-history').click();
    await page.getByRole('button', { name: 'Save Current State' }).click();
  };

  test('AC2: recording a decision at save time creates it, linked and accepted', async ({ page }) => {
    const versionName = `Vendor switch ${Date.now()}`;
    const why = `Vendor withdrew from the RFP ${Date.now()}`;

    await openSaveDialog(page);
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', versionName);
    await page.getByTestId('capture-decision-toggle').check();
    await page.getByTestId('capture-decision-title').fill(why);
    await page.getByRole('button', { name: 'Save Version' }).click();

    await expect(page.getByText(versionName)).toBeVisible();
    await page.getByTestId('close-version-manager').click();

    // The decision exists, and defaults to Accepted — it describes work already done.
    await page.getByTestId('nav-decisions').click();
    await page.getByTestId('decisions-list').getByText(why).click();
    await expect(page.getByTestId('decision-status-badge')).toHaveText('Accepted');
  });

  test('AC2: saving without opting in creates no decision, and never blocks the save', async ({ page }) => {
    const versionName = `Routine snapshot ${Date.now()}`;

    await openSaveDialog(page);
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', versionName);
    await page.getByRole('button', { name: 'Save Version' }).click();

    await expect(page.getByText(versionName)).toBeVisible();
    await page.getByTestId('close-version-manager').click();

    await page.getByTestId('nav-decisions').click();
    await expect(page.getByTestId('decisions-list')).toContainText('No decisions recorded yet');
  });

  test('AC2: opting in but leaving the title empty creates no half-written record', async ({ page }) => {
    const versionName = `Abandoned capture ${Date.now()}`;

    await openSaveDialog(page);
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', versionName);
    await page.getByTestId('capture-decision-toggle').check();
    await page.getByRole('button', { name: 'Save Version' }).click();

    // The save still succeeds — AC6, nothing gates a save.
    await expect(page.getByText(versionName)).toBeVisible();
    await page.getByTestId('close-version-manager').click();

    await page.getByTestId('nav-decisions').click();
    await expect(page.getByTestId('decisions-list')).toContainText('No decisions recorded yet');
  });

  test('AC3: the difference report lists decisions covering the span', async ({ page }) => {
    const versionName = `Baseline ${Date.now()}`;
    const why = `Deferred the mobile programme ${Date.now()}`;

    await openSaveDialog(page);
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', versionName);
    await page.getByTestId('capture-decision-toggle').check();
    await page.getByTestId('capture-decision-title').fill(why);
    await page.getByRole('button', { name: 'Save Version' }).click();
    await expect(page.getByText(versionName)).toBeVisible();

    await page.getByText(versionName).click();
    await page.getByRole('button', { name: 'Run Difference Report' }).click();

    await expect(page.getByTestId('diff-decisions')).toContainText(why);
  });

  test('AC3: a span with no decisions says so, so the gap is visible', async ({ page }) => {
    const versionName = `Undocumented ${Date.now()}`;

    await openSaveDialog(page);
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', versionName);
    await page.getByRole('button', { name: 'Save Version' }).click();
    await expect(page.getByText(versionName)).toBeVisible();

    await page.getByText(versionName).click();
    await page.getByRole('button', { name: 'Run Difference Report' }).click();

    await expect(page.getByTestId('diff-decisions')).toContainText('No decisions recorded');
  });
});
