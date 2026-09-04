import { test, expect } from '@playwright/test';

async function loadRptiTemplate(page: import('@playwright/test').Page) {
  await page.goto('/');
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
  await page.waitForSelector('[data-testid="template-picker-modal"]', { timeout: 20000 });
  await page.getByTestId('template-select-with-demo-btn-rpti').click();
  await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
  const tutorialModal = page.getByTestId('tutorial-modal');
  if (await tutorialModal.isVisible()) {
    await tutorialModal.getByRole('button', { name: 'Close' }).click();
  }
}

/**
 * The Reports view includes a "History Differences" section where
 * the user can select a saved version and run a diff report inline.
 */
test.describe('History Differences report', () => {
  test.beforeEach(async ({ page }) => {
    await loadRptiTemplate(page);
  });

  test('Reports view shows History Differences section', async ({ page }) => {
    await page.getByTestId('nav-reports').click();
    await page.getByTestId('report-card-version-history').click();
    await expect(page.getByTestId('report-history-diff')).toBeVisible();
  });

  test('shows empty state when no versions are saved', async ({ page }) => {
    await page.getByTestId('nav-reports').click();
    await page.getByTestId('report-card-version-history').click();
    const section = page.getByTestId('report-history-diff');
    await expect(section).toBeVisible();
    await expect(section).toContainText('No saved versions');
  });

  test('shows version selector after saving a version', async ({ page }) => {
    await page.getByTestId('nav-history').click();
    await page.getByRole('button', { name: 'Save Current State' }).click();
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', 'Test Snapshot');
    await page.getByRole('button', { name: 'Save Version' }).click();
    await page.getByTestId('close-version-manager').click();

    await page.getByTestId('nav-reports').click();
    await page.getByTestId('report-card-version-history').click();
    const section = page.getByTestId('report-history-diff');
    await expect(section).toBeVisible();
    await expect(section.getByTestId('version-select')).toBeVisible();
    await expect(section).toContainText('Test Snapshot');
  });

  test('running the diff report shows results inline', async ({ page }) => {
    await page.getByTestId('nav-history').click();
    await page.getByRole('button', { name: 'Save Current State' }).click();
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', 'Baseline Snapshot');
    await page.getByRole('button', { name: 'Save Version' }).click();
    await page.getByTestId('close-version-manager').click();

    await page.getByTestId('nav-data-manager').click();
    await page.waitForSelector('input[data-testid^="real-input-name"]', { timeout: 10000 });
    const initiativeNameInput = page.locator('input[data-testid^="real-input-name"]').first();
    const originalInitiativeName = await initiativeNameInput.inputValue();
    const renamedInitiativeName = `${originalInitiativeName} MODIFIED`;
    await initiativeNameInput.fill(renamedInitiativeName);
    await initiativeNameInput.press('Enter');

    await page.getByTestId('nav-reports').click();
    await page.getByTestId('report-card-version-history').click();
    const section = page.getByTestId('report-history-diff');
    await section.getByTestId('version-select').selectOption({ label: 'Baseline Snapshot' });
    await section.getByRole('button', { name: 'Run Difference Report' }).click();

    const diffResult = section.getByTestId('diff-result');
    await expect(diffResult).toBeVisible({ timeout: 5000 });
    await expect(diffResult).toContainText('MODIFIED');
  });

  test('diff report includes asset, programme, and strategy changes', async ({ page }) => {
    await page.getByTestId('nav-history').click();
    await page.getByRole('button', { name: 'Save Current State' }).click();
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', 'Category Baseline');
    await page.getByRole('button', { name: 'Save Version' }).click();
    await page.getByTestId('close-version-manager').click();

    await page.getByTestId('nav-data-manager').click();

    await page.getByRole('button', { name: /Assets\s*\d*/ }).click();
    await page.waitForSelector('input[data-testid^="real-input-name"]', { timeout: 10000 });
    const assetNameInput = page.locator('input[data-testid^="real-input-name"]').first();
    const originalAssetName = await assetNameInput.inputValue();
    const renamedAssetName = `${originalAssetName} ASSET MOD`;
    await assetNameInput.fill(renamedAssetName);
    await assetNameInput.press('Enter');

    await page.getByRole('button', { name: /Programmes\s*\d*/ }).click();
    await page.waitForSelector('input[data-testid^="real-input-name"]', { timeout: 10000 });
    const programmeNameInput = page.locator('input[data-testid^="real-input-name"]').first();
    const originalProgrammeName = await programmeNameInput.inputValue();
    const renamedProgrammeName = `${originalProgrammeName} PROG MOD`;
    await programmeNameInput.fill(renamedProgrammeName);
    await programmeNameInput.press('Enter');

    await page.getByRole('button', { name: /Strategies\s*\d*/ }).click();
    await page.waitForSelector('input[data-testid^="real-input-name"]', { timeout: 10000 });
    const strategyNameInput = page.locator('input[data-testid^="real-input-name"]').first();
    const originalStrategyName = await strategyNameInput.inputValue();
    const renamedStrategyName = `${originalStrategyName} STRAT MOD`;
    await strategyNameInput.fill(renamedStrategyName);
    await strategyNameInput.press('Enter');

    await page.getByTestId('nav-reports').click();
    await page.getByTestId('report-card-version-history').click();
    const section = page.getByTestId('report-history-diff');
    await section.getByTestId('version-select').selectOption({ label: 'Category Baseline' });
    await section.getByRole('button', { name: 'Run Difference Report' }).click();

    const diffResult = section.getByTestId('diff-result');
    await expect(diffResult).toBeVisible({ timeout: 5000 });
    // Entity-type headings live in the All changes view; the report opens on Summary.
    await diffResult.getByTestId('diff-view-all').click();
    await expect(diffResult).toContainText('Assets');
    await expect(diffResult).toContainText('Programmes');
    await expect(diffResult).toContainText('Strategies');
    await expect(diffResult).toContainText(`Renamed from "${originalAssetName}" to "${renamedAssetName}"`);
    await expect(diffResult).toContainText(`Renamed from "${originalProgrammeName}" to "${renamedProgrammeName}"`);
    await expect(diffResult).toContainText(`Renamed from "${originalStrategyName}" to "${renamedStrategyName}"`);
  });
});

/**
 * Regression net for issue #18 phase 1: the History Differences report used to
 * hand-roll its own diff JSX covering only 6 of the 14 entity types in
 * DiffResult, and rendered neither `dependencies.modified` nor
 * `milestones.modified` despite guarding on them. Both surfaces now share one
 * DiffSection, so every entity type the diff computes reaches this report.
 */
test.describe('History Differences report — full entity coverage', () => {
  test.beforeEach(async ({ page }) => {
    await loadRptiTemplate(page);
  });

  async function saveBaseline(page: import('@playwright/test').Page, name: string) {
    await page.getByTestId('nav-history').click();
    await page.getByRole('button', { name: 'Save Current State' }).click();
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', name);
    await page.getByRole('button', { name: 'Save Version' }).click();
    await page.getByTestId('close-version-manager').click();
  }

  async function runDiff(page: import('@playwright/test').Page, versionName: string) {
    await page.getByTestId('nav-reports').click();
    await page.getByTestId('report-card-version-history').click();
    const section = page.getByTestId('report-history-diff');
    await section.getByTestId('version-select').selectOption({ label: versionName });
    await section.getByRole('button', { name: 'Run Difference Report' }).click();
    const diffResult = section.getByTestId('diff-result');
    await expect(diffResult).toBeVisible({ timeout: 5000 });
    // The report opens on the per-asset summary (US-VH-06); these tests are about
    // the entity-type breakdown, so they ask for it.
    await diffResult.getByTestId('diff-view-all').click();
    return diffResult;
  }

  test('a milestone date change is listed, not just headed', async ({ page }) => {
    await saveBaseline(page, 'Milestone Baseline');

    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-milestones').click();
    const dateInput = page.locator('input[data-testid^="real-input-date"]').first();
    await dateInput.waitFor({ timeout: 10000 });
    const originalDate = await dateInput.inputValue();
    await dateInput.fill('2027-11-30');
    await dateInput.press('Enter');

    const diffResult = await runDiff(page, 'Milestone Baseline');
    await expect(diffResult).toContainText('Milestones');
    await expect(diffResult).toContainText(`Date: ${originalDate} → 2027-11-30`);
  });

  test('a deliverable rename reaches the report', async ({ page }) => {
    await saveBaseline(page, 'Deliverable Baseline');

    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-deliverables').click();
    const nameInput = page.locator('input[data-testid^="real-input-name"]').first();
    await nameInput.waitFor({ timeout: 10000 });
    const originalName = await nameInput.inputValue();
    await nameInput.fill(`${originalName} DELIV MOD`);
    await nameInput.press('Enter');

    const diffResult = await runDiff(page, 'Deliverable Baseline');
    await expect(diffResult).toContainText('Deliverables');
    await expect(diffResult).toContainText(`Renamed from "${originalName}" to "${originalName} DELIV MOD"`);
  });

  test('an added LKPTI row reaches the report', async ({ page }) => {
    await saveBaseline(page, 'LKPTI Baseline');

    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-lkpti').click();
    const targetSelect = page.getByTestId('ghost-select-targetId').first();
    await targetSelect.waitFor({ timeout: 10000 });
    const deliverableName = (await targetSelect.locator('option').nth(1).textContent())?.trim() ?? '';
    expect(deliverableName).not.toBe('');
    await targetSelect.selectOption({ index: 1 });

    const diffResult = await runDiff(page, 'LKPTI Baseline');
    await expect(diffResult).toContainText('LKPTI');
    await expect(diffResult).toContainText(deliverableName);
  });
});

/**
 * The difference report opens on a per-asset summary rather than the entity-type
 * breakdown (US-VH-06, requirement-specs/diff-summary.md §§2-3, 6-8). The pivot
 * itself is unit-tested in src/lib/diffSummary.test.ts; what needs cover here is
 * the interaction — which view a reader lands on, and that the other is one click away.
 */
test.describe('History Differences report — summary by asset', () => {
  test.beforeEach(async ({ page }) => {
    await loadRptiTemplate(page);
  });

  async function diffAfterMilestoneChange(page: import('@playwright/test').Page) {
    await page.getByTestId('nav-history').click();
    await page.getByRole('button', { name: 'Save Current State' }).click();
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', 'Summary Baseline');
    await page.getByRole('button', { name: 'Save Version' }).click();
    await page.getByTestId('close-version-manager').click();

    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-milestones').click();
    const dateInput = page.locator('input[data-testid^="real-input-date"]').first();
    await dateInput.waitFor({ timeout: 10000 });
    const originalDate = await dateInput.inputValue();
    await dateInput.fill('2027-11-30');
    await dateInput.press('Enter');

    await page.getByTestId('nav-reports').click();
    await page.getByTestId('report-card-version-history').click();
    const section = page.getByTestId('report-history-diff');
    await section.getByTestId('version-select').selectOption({ label: 'Summary Baseline' });
    await section.getByRole('button', { name: 'Run Difference Report' }).click();
    const diffResult = section.getByTestId('diff-result');
    await expect(diffResult).toBeVisible({ timeout: 5000 });
    return { diffResult, originalDate };
  }

  test('opens on the summary, grouped by asset rather than by entity type', async ({ page }) => {
    const { diffResult, originalDate } = await diffAfterMilestoneChange(page);

    const group = diffResult.getByTestId('summary-group').first();
    await expect(group).toBeVisible();
    // The group is headed by the asset the milestone belongs to...
    await expect(group.getByTestId('summary-group-title')).not.toBeEmpty();
    // ...and the change itself is still reported in full.
    await expect(diffResult).toContainText(`Date: ${originalDate} → 2027-11-30`);
    // The entity-type heading belongs to the other view.
    await expect(diffResult).not.toContainText('Milestones');
  });

  test('All changes restores the entity-type breakdown, and Summary comes back', async ({ page }) => {
    const { diffResult } = await diffAfterMilestoneChange(page);

    await diffResult.getByTestId('diff-view-all').click();
    await expect(diffResult).toContainText('Milestones');
    await expect(diffResult.getByTestId('summary-group')).toHaveCount(0);

    await diffResult.getByTestId('diff-view-summary').click();
    await expect(diffResult.getByTestId('summary-group').first()).toBeVisible();
    await expect(diffResult).not.toContainText('Milestones');
  });
});
