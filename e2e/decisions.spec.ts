import { test, expect } from '@playwright/test';

test.describe('Decisions (portfolio decision log)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('scenia-e2e', 'true');
      localStorage.setItem('scenia_has_seen_landing', 'true');
    });
    await page.reload();
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
  });

  test('Decisions tab appears in navigation and opens the Decisions view', async ({ page }) => {
    await expect(page.getByTestId('nav-decisions')).toBeVisible();
    await page.getByTestId('nav-decisions').click();
    await expect(page.getByTestId('decisions-view')).toBeVisible();
  });

  test('Can create a new decision with just a title, defaulting to Proposed status', async ({ page }) => {
    await page.getByTestId('nav-decisions').click();
    await page.getByTestId('add-decision-btn').click();

    const title = `Adopt event-driven sync ${Date.now()}`;
    await page.getByTestId('decision-title-input').fill(title);
    await page.getByTestId('save-decision-btn').click();

    await expect(page.getByTestId('decisions-list').getByText(title)).toBeVisible();
    await expect(page.getByTestId('decision-detail').getByText('Proposed')).toBeVisible();
  });

  test('Cannot save a decision without a title', async ({ page }) => {
    await page.getByTestId('nav-decisions').click();
    await page.getByTestId('add-decision-btn').click();
    await page.getByTestId('save-decision-btn').click();

    await expect(page.getByTestId('decision-title-error')).toBeVisible();
  });

  test('Can edit a decision, fill in the full MADR fields, and change its status to Accepted', async ({ page }) => {
    await page.getByTestId('nav-decisions').click();
    await page.getByTestId('add-decision-btn').click();

    const title = `Consolidate reporting pipeline ${Date.now()}`;
    await page.getByTestId('decision-title-input').fill(title);
    await page.getByTestId('decision-context-input').fill('Two overlapping reporting exports were confusing stakeholders.');
    await page.getByTestId('decision-considered-options-input').fill('Keep both\nMerge into one');
    await page.getByTestId('decision-outcome-input').fill('Merge into a single report.');
    await page.getByTestId('decision-consequences-input').fill('One less export to maintain.');
    await page.getByTestId('decision-status-select').selectOption('accepted');
    await page.getByTestId('save-decision-btn').click();

    await expect(page.getByTestId('decision-detail').getByText(title)).toBeVisible();
    await expect(page.getByTestId('decision-status-badge')).toHaveText('Accepted');
    await expect(page.getByTestId('decision-detail').getByText('Merge into a single report.')).toBeVisible();
  });

  test('Can transition a decision from Accepted to Superseded', async ({ page }) => {
    await page.getByTestId('nav-decisions').click();
    await page.getByTestId('add-decision-btn').click();
    await page.getByTestId('decision-title-input').fill(`Temporary vendor choice ${Date.now()}`);
    await page.getByTestId('decision-status-select').selectOption('accepted');
    await page.getByTestId('save-decision-btn').click();

    await page.getByTestId('edit-decision-btn').click();
    await page.getByTestId('decision-status-select').selectOption('superseded');
    await page.getByTestId('save-decision-btn').click();

    await expect(page.getByTestId('decision-status-badge')).toHaveText('Superseded');
  });

  test('Can delete a decision with confirmation', async ({ page }) => {
    await page.getByTestId('nav-decisions').click();
    await page.getByTestId('add-decision-btn').click();
    const title = `Decision to delete ${Date.now()}`;
    await page.getByTestId('decision-title-input').fill(title);
    await page.getByTestId('save-decision-btn').click();
    await expect(page.getByTestId('decisions-list').getByText(title)).toBeVisible();

    await page.getByTestId('delete-decision-btn').click();
    await page.getByTestId('confirm-modal-confirm').click();

    await expect(page.getByTestId('decisions-list').getByText(title)).not.toBeVisible();
  });

  test('Can link a decision to an existing initiative and see it surfaced on that initiative\'s panel', async ({ page }) => {
    const bar = page.locator('[data-testid^="initiative-bar"]').first();
    await expect(bar).toBeVisible({ timeout: 10000 });
    await bar.click();
    await page.getByTestId('initiative-action-edit').click();
    await page.waitForSelector('[data-testid="initiative-panel"]', { timeout: 5000 });
    const initiativeName = await page.getByLabel('Initiative Name').inputValue();
    await page.getByRole('button', { name: 'Close' }).click();

    await page.getByTestId('nav-decisions').click();
    await page.getByTestId('add-decision-btn').click();
    const title = `Link test decision ${Date.now()}`;
    await page.getByTestId('decision-title-input').fill(title);
    await page.getByTestId('decision-linked-type-select').selectOption('initiative');
    await page.getByTestId('decision-linked-id-select').selectOption({ label: initiativeName });
    await page.getByTestId('save-decision-btn').click();

    await expect(page.getByTestId('decisions-list').getByText(title)).toBeVisible();

    await page.getByTestId('nav-visualiser').click();
    await bar.click();
    await page.getByTestId('initiative-action-edit').click();
    await page.waitForSelector('[data-testid="initiative-panel"]', { timeout: 5000 });
    await expect(page.getByTestId('initiative-linked-decisions-section')).toBeVisible();
    await expect(page.getByTestId('initiative-linked-decisions-section').getByText(title)).toBeVisible();
  });
});
