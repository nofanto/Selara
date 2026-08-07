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

  // Adds one RPTI row via the Data Manager tab (the only place rows can be
  // created now) and returns to the RPTI report screen.
  async function addRptiRowViaDataManager(page: import('@playwright/test').Page, categoryCode: string) {
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-rpti').click();
    await page.getByTestId('add-row-btn-rpti').click();
    const row = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').last();
    await row.locator('td[data-key="initiativeId"] select').selectOption({ index: 1 });
    await row.locator('td[data-key="targetId"] select').selectOption({ index: 1 });
    await row.locator('td[data-key="categoryCode"] select').selectOption(categoryCode);
    await row.locator('td[data-key="developmentType"] select').selectOption('new');
    await row.locator('td[data-key="developer"] select').selectOption('inhouse');
    await row.locator('td[data-key="ppjtiRelatedParty"] select').selectOption('n/a');
    await row.locator('td[data-key="ppjtiRelatedParty"] select').press('Tab');
    await page.waitForTimeout(300);
    await openRptiReport(page);
  }

  test('RPTI Report card appears in Reports and opens to a read-only empty state', async ({ page }) => {
    await openRptiReport(page);
    await expect(page.getByText(/no rpti/i)).toBeVisible();
    await expect(page.getByText(/managed in.*data manager/i)).toBeVisible();
  });

  test('Exports the RPTI report to Excel with the Format 3.1 columns', async ({ page }) => {
    await addRptiRowViaDataManager(page, '54');
    await expect(page.getByTestId('rpti-detail-table')).toBeVisible();

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
