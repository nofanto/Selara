import { seedReportRecords, reportFixture, generateReport } from './report-fixtures';
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

  test('RPTI Report asks for a year then shows an empty filing when nothing overlaps', async ({ page }) => {
    await seedReportRecords(page, {}, ['rptiDetails']);
    await generateReport(page, 'rpti', '1900');
    await expect(page.getByText(/no rpti/i)).toBeVisible();
    await expect(page.getByTestId('rpti-report-export-btn')).toHaveCount(0);
  });

  test('exports generated RPTI rows to Excel with Format 3.1 columns', async ({ page }) => {
    await seedReportRecords(page, reportFixture, ['initiatives', 'deliverableSegments', 'rptiDetails']);
    await generateReport(page, 'rpti');
    await expect(page.getByTestId('rpti-detail-table')).toContainText('Filing Application');
    const [download] = await Promise.all([
      page.waitForEvent('download'), page.getByTestId('rpti-report-export-btn').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/rpti/i);
  });

  test('Deliverables tab shows a Type column that persists across reloads', async ({ page }) => {
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-deliverables').click();
    const firstRow = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').first();
    const appName = await firstRow.locator('td[data-key="name"] input').inputValue();
    const typeSelect = firstRow.locator('td[data-key="type"] select');
    await expect(typeSelect).toBeVisible();
    await typeSelect.selectOption('infrastructure');
    await page.waitForTimeout(500);

    await page.reload();
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-deliverables').click();
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
