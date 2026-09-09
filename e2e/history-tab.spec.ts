import { test, expect } from '@playwright/test';

// User story 24 AC1: Version History stops being a modal and becomes one
// destination alongside the decision log, with a single chronological stream.
test.describe('History tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('scenia-e2e', 'true');
      localStorage.setItem('scenia_has_seen_landing', 'true');
    });
    await page.reload();
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
  });

  test('AC1: the tab is called History and opens a full page, not a modal', async ({ page }) => {
    await expect(page.getByTestId('nav-history')).toBeVisible();
    await page.getByTestId('nav-history').click();

    await expect(page.getByTestId('history-view')).toBeVisible();
    // The old modal shell must be gone, not merely hidden behind the tab.
  });

  test('AC1: header navigation still has exactly five destinations', async ({ page }) => {
    for (const id of ['nav-visualiser', 'nav-data-manager', 'nav-reports', 'nav-history', 'nav-guide']) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
    // The old Decisions tab is gone — merged into History, not left alongside it.
    await expect(page.getByTestId('nav-decisions')).toHaveCount(0);
  });

  test('AC1: the stream interleaves versions and decisions, newest first', async ({ page }) => {
    await page.getByTestId('nav-history').click();

    // A decision, then a version saved after it.
    await page.getByTestId('new-decision-btn').click();
    await page.getByTestId('decision-title-input').fill('Older decision');
    await page.getByTestId('save-decision-btn').click();

    await page.getByTestId('save-version-btn').click();
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', 'Newer version');
    await page.getByRole('button', { name: 'Save Version' }).click();

    const stream = page.getByTestId('history-stream');
    await expect(stream).toContainText('Newer version');
    await expect(stream).toContainText('Older decision');

    const entries = stream.getByTestId(/^history-entry-/);
    await expect(entries.first()).toContainText('Newer version');
  });

  test('AC1: the filter narrows the stream to decisions alone', async ({ page }) => {
    await page.getByTestId('nav-history').click();

    await page.getByTestId('new-decision-btn').click();
    await page.getByTestId('decision-title-input').fill('A recorded decision');
    await page.getByTestId('save-decision-btn').click();

    await page.getByTestId('save-version-btn').click();
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', 'A saved version');
    await page.getByRole('button', { name: 'Save Version' }).click();

    const stream = page.getByTestId('history-stream');
    await expect(stream).toContainText('A saved version');

    await page.getByTestId('history-filter-decisions').click();
    await expect(stream).toContainText('A recorded decision');
    await expect(stream).not.toContainText('A saved version');
  });

  test('#31 defect 3: deleting a version warns about decisions linked to it', async ({ page }) => {
    await page.getByTestId('nav-history').click();

    // Capture-at-save links the decision to this snapshot via versionId.
    await page.getByTestId('save-version-btn').click();
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', 'Snapshot with a reason');
    await page.getByTestId('capture-decision-toggle').check();
    await page.getByTestId('capture-decision-title').fill('Why this snapshot exists');
    await page.getByRole('button', { name: 'Save Version' }).click();
    await expect(page.getByTestId('history-stream')).toContainText('Snapshot with a reason');

    await page.getByTestId('history-stream').getByText('Snapshot with a reason').click();
    await page.getByTestId('delete-version-btn').click();

    const modal = page.getByTestId('confirm-modal');
    await expect(modal).toBeVisible();
    // Same wording rule as #31 defect 1: the decision survives, only its link goes.
    await expect(modal).toContainText('1 decision(s) will keep their record but lose their link to it');
  });
});

test.describe('Decision form — progressive disclosure (AC4)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('scenia-e2e', 'true');
      localStorage.setItem('scenia_has_seen_landing', 'true');
    });
    await page.reload();
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
    await page.getByTestId('nav-history').click();
  });

  test('a new decision leads with title and outcome, the rest collapsed', async ({ page }) => {
    await page.getByTestId('new-decision-btn').click();

    await expect(page.getByTestId('decision-title-input')).toBeVisible();
    await expect(page.getByTestId('decision-outcome-input')).toBeVisible();
    // ADR-0002 wanted small decisions cheap to record; seven fields at once
    // reads as an obligation, which is part of why the log stayed empty.
    await expect(page.getByTestId('decision-detail-fields')).toHaveCount(0);

    await page.getByTestId('decision-add-detail-toggle').click();
    await expect(page.getByTestId('decision-detail-fields')).toBeVisible();
    await expect(page.getByTestId('decision-context-input')).toBeVisible();
  });

  test('a title alone is still enough to save', async ({ page }) => {
    await page.getByTestId('new-decision-btn').click();
    await page.getByTestId('decision-title-input').fill('Cheap to record');
    await page.getByTestId('save-decision-btn').click();

    await expect(page.getByTestId('history-stream')).toContainText('Cheap to record');
  });

  test('editing a decision that already has detail opens the section', async ({ page }) => {
    // Otherwise the form would hide text the user had already written.
    await page.getByTestId('new-decision-btn').click();
    await page.getByTestId('decision-title-input').fill('Has context');
    await page.getByTestId('decision-add-detail-toggle').click();
    await page.getByTestId('decision-context-input').fill('Some recorded background.');
    await page.getByTestId('save-decision-btn').click();

    await page.getByTestId('history-stream').getByText('Has context').click();
    await page.getByTestId('edit-decision-btn').click();

    await expect(page.getByTestId('decision-detail-fields')).toBeVisible();
    await expect(page.getByTestId('decision-context-input')).toHaveValue('Some recorded background.');
  });
});
