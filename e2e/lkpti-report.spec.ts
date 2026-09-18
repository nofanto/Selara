import { test, expect } from '@playwright/test';
import { seedReportRecords, reportFixture, generateReport } from './report-fixtures';

test.describe('LKPTI stored rows and Reports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('nav-data-manager').click();
    await seedReportRecords(page, { ...reportFixture, lkptiDetails: [{ id: 'stored-lkpti', targetId: 'filing-deliverable',
      platform: 'Stored platform', systemOwner: 'Stored owner', goLiveDate: '15-03-2026' }] });
  });

  test('stored rows remain readable without row editors', async ({ page }) => {
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-lkpti').click();
    const table = page.getByTestId('lkpti-readonly-table');
    for (const value of ['Filing Application', 'Stored platform', 'Stored owner', '15-03-2026']) await expect(table).toContainText(value);
    await expect(table.locator('input, select, textarea')).toHaveCount(0);
    await expect(page.getByTestId('add-row-btn-lkpti')).toHaveCount(0);
    await expect(page.getByTestId('lkpti-generate-btn')).toHaveCount(0);
  });

  test('stored rows persist across reload', async ({ page }) => {
    await page.reload();
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-lkpti').click();
    await expect(page.getByTestId('lkpti-readonly-table')).toContainText('Stored owner');
  });

  test('deleting a linked Deliverable cascades to its stored LKPTI row', async ({ page }) => {
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-deliverables').click();
    const row = page.locator('tbody tr[data-real="true"]').filter({ has: page.locator('input[value="Filing Application"]') });
    await row.locator('[data-testid^="delete-row-btn-"]').click();
    await page.getByTestId('confirm-modal-confirm').click();
    await page.getByTestId('data-manager-tab-lkpti').click();
    await expect(page.getByTestId('lkpti-readonly-table')).not.toContainText('Stored owner');
  });

  test('Reports includes live applications as at year end and reads canonical attributes', async ({ page }) => {
    await seedReportRecords(page, { deliverables: [{ ...reportFixture.deliverables[0], id: 'planned-only', name: 'Planned Only Application' }],
      deliverableSegments: [{ ...reportFixture.deliverableSegments[0], id: 'planned-only-seg', deliverableId: 'planned-only', status: 'appstatus-planned' }] });
    await generateReport(page, 'lkpti');
    const table = page.getByTestId('lkpti-detail-table');
    await expect(table).toContainText('Filing Application');
    await expect(table).toContainText('Linux RHEL 9');
    await expect(table).toContainText('15-03-2026');
    await expect(table).not.toContainText('Planned Only Application');
    await expect(table).not.toContainText('Stored platform');
  });

  test('a year with no live applications shows an empty filing', async ({ page }) => {
    await generateReport(page, 'lkpti', '1900');
    await expect(page.getByText(/no lkpti rows/i)).toBeVisible();
    await expect(page.getByTestId('lkpti-report-export-btn')).toHaveCount(0);
  });

  test('exports the generated LKPTI to Excel', async ({ page }) => {
    await generateReport(page, 'lkpti');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('lkpti-report-export-btn').click()]);
    expect(download.suggestedFilename()).toMatch(/lkpti-report/i);
  });
});
