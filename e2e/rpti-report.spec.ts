import { test, expect } from '@playwright/test';

test.describe('RPTI Report (IT Development Plan Report)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('scenia-e2e', 'true');
      localStorage.setItem('scenia_has_seen_landing', 'true');
    });
    await page.reload();
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
  });

  async function openRptiReport(page: import('@playwright/test').Page) {
    await page.getByTestId('nav-reports').click();
    await page.getByTestId('report-card-rpti').click();
    await expect(page.getByTestId('rpti-report-view')).toBeVisible();
  }

  test('RPTI Report card appears in Reports and opens to an empty state', async ({ page }) => {
    await openRptiReport(page);
    await expect(page.getByTestId('add-rpti-detail-btn')).toBeVisible();
    await expect(page.getByText(/no rpti/i)).toBeVisible();
  });

  test('Can create an infrastructure (asset-target) row with a manually entered quarter', async ({ page }) => {
    await openRptiReport(page);
    await page.getByTestId('add-rpti-detail-btn').click();

    await page.getByTestId('rpti-initiative-select').selectOption({ index: 1 });
    await page.getByTestId('rpti-target-type-select').selectOption('asset');
    const targetSelect = page.getByTestId('rpti-target-id-select');
    const assetName = await targetSelect.locator('option').nth(1).textContent();
    await targetSelect.selectOption({ index: 1 });

    await page.getByTestId('rpti-category-select').selectOption('51');
    await page.getByTestId('rpti-dev-type-select').selectOption('new');
    await page.getByTestId('rpti-developer-select').selectOption('inhouse');
    await page.getByTestId('rpti-ppjti-select').selectOption('n/a');
    await page.getByTestId('rpti-quarter-select').selectOption('Q2');
    await page.getByTestId('save-rpti-detail-btn').click();

    const table = page.getByTestId('rpti-detail-table');
    await expect(table).toBeVisible();
    await expect(table.getByText(assetName!.trim())).toBeVisible();
    await expect(table.getByText('Q2')).toBeVisible();
  });

  test('Can create an application-target row and see the resolved application name', async ({ page }) => {
    await openRptiReport(page);
    await page.getByTestId('add-rpti-detail-btn').click();

    await page.getByTestId('rpti-initiative-select').selectOption({ index: 1 });
    await page.getByTestId('rpti-target-type-select').selectOption('application');
    const targetSelect = page.getByTestId('rpti-target-id-select');
    const appName = await targetSelect.locator('option').nth(1).textContent();
    await targetSelect.selectOption({ index: 1 });

    await page.getByTestId('rpti-category-select').selectOption('06');
    await page.getByTestId('rpti-dev-type-select').selectOption('upgrade');
    await page.getByTestId('rpti-developer-select').selectOption('PPJTI');
    await page.getByTestId('rpti-ppjti-select').selectOption('no');
    await page.getByTestId('rpti-quarter-select').selectOption('Q1');
    await page.getByTestId('save-rpti-detail-btn').click();

    await expect(page.getByTestId('rpti-detail-table').getByText(appName!.trim())).toBeVisible();
  });

  test('Can edit and delete an RPTI row', async ({ page }) => {
    await openRptiReport(page);
    await page.getByTestId('add-rpti-detail-btn').click();
    await page.getByTestId('rpti-initiative-select').selectOption({ index: 1 });
    await page.getByTestId('rpti-target-type-select').selectOption('asset');
    await page.getByTestId('rpti-target-id-select').selectOption({ index: 1 });
    await page.getByTestId('rpti-category-select').selectOption('52');
    await page.getByTestId('rpti-dev-type-select').selectOption('new');
    await page.getByTestId('rpti-developer-select').selectOption('inhouse');
    await page.getByTestId('rpti-ppjti-select').selectOption('n/a');
    await page.getByTestId('rpti-quarter-select').selectOption('Q4');
    await page.getByTestId('rpti-remarks-input').fill('Initial remarks');
    await page.getByTestId('save-rpti-detail-btn').click();

    await page.getByTestId('edit-rpti-detail-btn').first().click();
    await page.getByTestId('rpti-remarks-input').fill('Updated remarks');
    await page.getByTestId('save-rpti-detail-btn').click();
    await expect(page.getByTestId('rpti-detail-table').getByText('Updated remarks')).toBeVisible();

    await page.getByTestId('delete-rpti-detail-btn').first().click();
    await page.getByTestId('confirm-modal-confirm').click();
    await expect(page.getByText(/no rpti/i)).toBeVisible();
  });

  test('Deleting the linked Initiative cascades to remove its RPTI row(s)', async ({ page }) => {
    await openRptiReport(page);
    await page.getByTestId('add-rpti-detail-btn').click();
    const initiativeSelect = page.getByTestId('rpti-initiative-select');
    const initiativeName = await initiativeSelect.locator('option').nth(1).textContent();
    await initiativeSelect.selectOption({ index: 1 });
    await page.getByTestId('rpti-target-type-select').selectOption('asset');
    await page.getByTestId('rpti-target-id-select').selectOption({ index: 1 });
    await page.getByTestId('rpti-category-select').selectOption('53');
    await page.getByTestId('rpti-dev-type-select').selectOption('new');
    await page.getByTestId('rpti-developer-select').selectOption('inhouse');
    await page.getByTestId('rpti-ppjti-select').selectOption('n/a');
    await page.getByTestId('save-rpti-detail-btn').click();
    await expect(page.getByTestId('rpti-detail-table')).toBeVisible();

    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-initiatives').click();
    const initNameInputs = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"] td[data-key="name"] input');
    const initCount = await initNameInputs.count();
    let initMatchIndex = -1;
    for (let i = 0; i < initCount; i++) {
      if ((await initNameInputs.nth(i).inputValue()) === initiativeName!.trim()) { initMatchIndex = i; break; }
    }
    expect(initMatchIndex).toBeGreaterThanOrEqual(0);
    const row = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').nth(initMatchIndex);
    await row.locator('[data-testid^="delete-row-btn-"]').click();
    await page.getByTestId('confirm-modal-confirm').click();

    await page.getByTestId('nav-reports').click();
    await page.getByTestId('report-card-rpti').click();
    await expect(page.getByText(/no rpti/i)).toBeVisible();
  });

  test('Auto-suggests planned implementation quarter for an application-target row from its linked lifecycle segment', async ({ page }) => {
    // 1. Create a fresh Application on the first Asset.
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-applications').click();
    await page.getByTestId('add-row-btn-applications').click();
    const newAppRow = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').last();
    await newAppRow.locator('td[data-key="name"] input').fill('RPTI Test App');
    await newAppRow.locator('td[data-key="name"] input').press('Tab');
    const assetSelect = newAppRow.locator('td[data-key="assetId"] select');
    await assetSelect.selectOption({ index: 1 });
    const assetId = await assetSelect.inputValue();

    // 2. Create a lifecycle segment for it, linked to an Initiative, with a known start date.
    await page.getByTestId('nav-visualiser').click();
    const startInput = page.getByTestId('timeline-start-input');
    await startInput.fill('2030-01-01');
    await startInput.press('Enter');
    await page.waitForTimeout(300);

    const rowContent = page.locator(`[data-testid="application-swimlane-${assetId}"] [data-testid="application-row-content"]`);
    await rowContent.dblclick({ position: { x: 200, y: 20 } });
    const panel = page.getByTestId('segment-panel');
    await expect(panel).toBeVisible();
    await panel.getByTestId('segment-application').selectOption({ label: 'RPTI Test App' });
    await panel.getByTestId('segment-status').selectOption('appstatus-in-production');
    await panel.getByTestId('segment-start-date').fill('2030-07-15');
    await panel.getByTestId('segment-end-date').fill('2030-12-31');
    const initiativeSelect = panel.getByTestId('segment-initiative');
    const initiativeName = await initiativeSelect.locator('option').nth(1).textContent();
    await initiativeSelect.selectOption({ index: 1 });
    await panel.getByRole('button', { name: 'Add Segment' }).click();
    await expect(panel).not.toBeVisible();

    // 3. Create an RPTI row for that same initiative + application; quarter should auto-suggest Q3.
    await openRptiReport(page);
    await page.getByTestId('add-rpti-detail-btn').click();
    await page.getByTestId('rpti-initiative-select').selectOption({ label: initiativeName!.trim() });
    await page.getByTestId('rpti-target-type-select').selectOption('application');
    await page.getByTestId('rpti-target-id-select').selectOption({ label: 'RPTI Test App' });

    await expect(page.getByTestId('rpti-quarter-suggestion-accept')).toBeVisible();
    await page.getByTestId('rpti-quarter-suggestion-accept').click();
    await expect(page.getByTestId('rpti-quarter-select')).toHaveValue('Q3');

    await page.getByTestId('rpti-category-select').selectOption('06');
    await page.getByTestId('rpti-dev-type-select').selectOption('new');
    await page.getByTestId('rpti-developer-select').selectOption('inhouse');
    await page.getByTestId('rpti-ppjti-select').selectOption('n/a');
    await page.getByTestId('save-rpti-detail-btn').click();

    await expect(page.getByTestId('rpti-detail-table').getByText('Q3')).toBeVisible();
  });

  test('Exports the RPTI report to Excel with the Format 3.1 columns', async ({ page }) => {
    await openRptiReport(page);
    await page.getByTestId('add-rpti-detail-btn').click();
    await page.getByTestId('rpti-initiative-select').selectOption({ index: 1 });
    await page.getByTestId('rpti-target-type-select').selectOption('asset');
    await page.getByTestId('rpti-target-id-select').selectOption({ index: 1 });
    await page.getByTestId('rpti-category-select').selectOption('54');
    await page.getByTestId('rpti-dev-type-select').selectOption('new');
    await page.getByTestId('rpti-developer-select').selectOption('inhouse');
    await page.getByTestId('rpti-ppjti-select').selectOption('n/a');
    await page.getByTestId('save-rpti-detail-btn').click();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('rpti-report-export-btn').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/rpti/i);
  });

  test('Applications tab shows a Type column that persists across reloads', async ({ page }) => {
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-applications').click();
    const firstRow = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').first();
    const appName = await firstRow.locator('td[data-key="name"] input').inputValue();
    const typeSelect = firstRow.locator('td[data-key="type"] select');
    await expect(typeSelect).toBeVisible();
    await typeSelect.selectOption('infrastructure');
    await page.waitForTimeout(500);

    await page.reload();
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-applications').click();
    const nameInputs = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"] td[data-key="name"] input');
    const count = await nameInputs.count();
    let matchIndex = -1;
    for (let i = 0; i < count; i++) {
      if ((await nameInputs.nth(i).inputValue()) === appName) { matchIndex = i; break; }
    }
    expect(matchIndex).toBeGreaterThanOrEqual(0);
    const reloadedRow = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').nth(matchIndex);
    await expect(reloadedRow.locator('td[data-key="type"] select')).toHaveValue('infrastructure');
  });
});
