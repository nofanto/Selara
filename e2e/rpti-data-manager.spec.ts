import { test, expect } from '@playwright/test';
import { seedReportRecords, reportFixture, generateReport, exportedReportText } from './report-fixtures';

test.describe('RPTI stored rows and canonical sources', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-data-manager').click();
    await seedReportRecords(page, { ...reportFixture, rptiDetails: [{ id: 'stored-rpti',
      initiativeId: 'filing-initiative', targetId: 'filing-deliverable', targetType: 'deliverable',
      categoryCode: '06', developmentType: 'upgrade', developer: 'inhouse',
      plannedImplementationQuarter: 'Q1', remarks: 'Stored filing remark' }] }, ['initiatives', 'deliverableSegments', 'rptiDetails']);
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-rpti').click();
  });

  test('stored rows show names and filed values without editors or generation controls', async ({ page }) => {
    const table = page.getByTestId('rpti-readonly-table');
    for (const value of ['Filing Application', 'Filing Initiative', 'Stored filing remark', 'upgrade', 'Q1']) await expect(table).toContainText(value);
    await expect(table.locator('input, select, textarea')).toHaveCount(0);
    await expect(page.getByTestId('add-row-btn-rpti')).toHaveCount(0);
    await expect(page.getByTestId('rpti-generate-btn')).toHaveCount(0);
  });

  test('Initiatives uses the established Deliverable label for the declared filing target', async ({ page }) => {
    await page.getByTestId('data-manager-tab-initiatives').click();
    const headers = page.locator('[data-testid="data-manager"] thead');
    await expect(headers.getByText('Deliverable', { exact: true })).toBeVisible();
    await expect(headers.getByText('RPTI Target', { exact: true })).toHaveCount(0);
  });

  test('global search filters stored rows by their displayed target name', async ({ page }) => {
    const search = page.getByTestId('search-input');
    const table = page.getByTestId('rpti-readonly-table');

    await search.fill('not-a-filing-row');
    await expect(page.getByTestId('data-manager-filter-indicator')).toContainText('Filtered by “not-a-filing-row”');
    await expect(table.locator('tbody tr')).toHaveCount(0);
    await expect(table).toContainText('No report rows match the global search.');

    await search.fill('Filing Application');
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await expect(table).toContainText('Stored filing remark');
  });

  test('stored filing values persist after reload', async ({ page }) => {
    await page.reload();
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-rpti').click();
    await expect(page.getByTestId('rpti-readonly-table')).toContainText('Stored filing remark');
  });

  test('DC and DR locations are edited on the Deliverable and reach generation after reload', async ({ page }) => {
    await page.getByTestId('data-manager-tab-deliverables').click();
    const row = page.locator('tbody tr[data-real="true"]').filter({ has: page.locator('input[value="Filing Application"]') });
    for (const [key, value] of Object.entries({ dcCity: 'Bandung', dcCountry: 'Indonesia', drCity: 'Bogor', drCountry: 'Indonesia' })) {
      await row.locator(`td[data-key="${key}"] input`).fill(value);
      await row.locator(`td[data-key="${key}"] input`).press('Tab');
    }
    await page.reload();
    await generateReport(page, 'rpti');
    const exported = await exportedReportText(page, 'rpti');
    expect(exported).toContain('Bandung, Indonesia');
    expect(exported).toContain('Bogor, Indonesia');
  });

  test('deleting the linked Initiative cascades to its stored RPTI row', async ({ page }) => {
    await page.getByTestId('data-manager-tab-initiatives').click();
    const row = page.locator('tbody tr[data-real="true"]').filter({ has: page.locator('input[value="Filing Initiative"]') });
    await row.locator('[data-testid^="delete-row-btn-"]').click();
    await page.getByTestId('confirm-modal-confirm').click();
    await page.getByTestId('data-manager-tab-rpti').click();
    await expect(page.getByTestId('rpti-readonly-table').locator('tbody tr')).toHaveCount(0);
  });

  test('Reports generates the inferred live target with its quarter and initiative cost', async ({ page }) => {
    await generateReport(page, 'rpti');
    const row = page.getByTestId('rpti-detail-table').locator('tbody tr').filter({ hasText: 'Filing Application' });
    await expect(row).toContainText('upgrade');
    await expect(row).toContainText('Q1');
    await expect(row).toContainText('100');
  });

  test('Reports uses deliverable attributes and category defaults with entity remarks', async ({ page }) => {
    await generateReport(page, 'rpti');
    const row = page.getByTestId('rpti-detail-table').locator('tbody tr').filter({ hasText: 'Filing Application' });
    for (const value of ['Digital services', 'inhouse', 'Entity remarks']) await expect(row).toContainText(value);
    const exported = await exportedReportText(page, 'rpti');
    for (const value of ['Jakarta, Indonesia', 'Surabaya, Indonesia', 'n/a']) expect(exported).toContain(value);
    await expect(row).not.toContainText('Stored filing remark');
  });

  test('Default Currency is maintained in visualiser settings and persists across reload', async ({ page }) => {
    await page.getByTestId('nav-visualiser').click();
    await page.getByTestId('display-more-btn').click();
    const input = page.getByTestId('default-currency-input');
    await expect(input).toHaveValue('IDR');
    await input.fill('USD');
    await input.press('Tab');
    await page.waitForTimeout(300);

    await page.reload();
    await page.getByTestId('nav-visualiser').click();
    await page.getByTestId('display-more-btn').click();

    await expect(page.getByTestId('default-currency-input')).toHaveValue('USD');
  });
});
