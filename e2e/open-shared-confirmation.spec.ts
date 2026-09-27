import { test, expect, type Page } from '@playwright/test';
import * as XLSX from 'xlsx';

/**
 * US-DA-13 (#62): Open shared replaces the whole workspace, so it must say what
 * it will replace and let the planner back out. A single Undo reverses it,
 * History snapshots included.
 */

const SHARED_ASSET = 'Shared Core Ledger';

function sharedWorkbook() {
  const wb = XLSX.utils.book_new();
  const sheet = (rows: object[], name: string) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
  sheet([{ id: 'cat-shared', name: 'Shared Category' }], 'AssetCategories');
  sheet([{ id: 'a-shared', name: SHARED_ASSET, categoryId: 'cat-shared' }], 'Assets');
  sheet([{ id: 'prog-shared', name: 'Shared Programme', color: '#6366f1' }], 'Programmes');
  sheet([{
    id: 'i-shared', name: 'Shared Initiative', programmeId: 'prog-shared', assetId: 'a-shared',
    startDate: '2027-01-01', endDate: '2027-06-30', capex: 1000, opex: 0,
  }], 'Initiatives');
  return {
    name: 'bank-a-plan.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer,
  };
}

const assetRows = (page: Page) => page.locator('[data-testid="asset-row-content"]');

async function openDemo(page: Page) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
}

async function saveVersion(page: Page, name: string) {
  await page.getByTestId('nav-history').click();
  await page.getByRole('button', { name: 'Save Current State' }).click();
  await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', name);
  await page.getByRole('button', { name: 'Save Version' }).click();
  await expect(page.locator('h4', { hasText: name })).toBeVisible();
  await page.getByTestId('nav-visualiser').click();
}

test.describe('Open shared asks before replacing the workspace (US-DA-13)', () => {
  test('AC1/AC2: shows current and incoming counts; Cancel changes nothing, even after reload', async ({ page }) => {
    await openDemo(page);
    const demoAssetCount = await assetRows(page).count();
    await saveVersion(page, 'Before opening a shared file');

    await page.getByTestId('viewer-file-input').setInputFiles(sharedWorkbook());

    const modal = page.getByTestId('confirm-modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('bank-a-plan.xlsx');
    const history = page.getByTestId('replacement-count-versions');
    await expect(history.getByTestId('replacement-current')).toHaveText('1');
    await expect(history.getByTestId('replacement-incoming')).toHaveText('0');
    await expect(page.getByTestId('replacement-count-assets').getByTestId('replacement-incoming')).toHaveText('1');

    await page.getByTestId('confirm-modal-cancel').click();
    await expect(modal).not.toBeVisible();
    await expect(assetRows(page)).toHaveCount(demoAssetCount);
    await expect(page.getByText(SHARED_ASSET)).toHaveCount(0);

    await page.reload();
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
    await expect(assetRows(page)).toHaveCount(demoAssetCount);
    await page.getByTestId('nav-history').click();
    await expect(page.locator('h4', { hasText: 'Before opening a shared file' })).toBeVisible();
  });

  test('AC3/AC4: confirming replaces; one Undo restores records and History, and that survives reload', async ({ page }) => {
    await openDemo(page);
    const demoAssetCount = await assetRows(page).count();
    await saveVersion(page, 'Keep me');

    await page.getByTestId('viewer-file-input').setInputFiles(sharedWorkbook());
    await page.getByTestId('confirm-modal-confirm').click();

    await expect(assetRows(page)).toHaveCount(1);
    await expect(page.getByText(SHARED_ASSET).first()).toBeVisible();
    await page.getByTestId('nav-history').click();
    await expect(page.locator('h4', { hasText: 'Keep me' })).toHaveCount(0);

    await page.getByTitle('Undo').click();

    await expect(page.locator('h4', { hasText: 'Keep me' })).toBeVisible();
    await page.getByTestId('nav-visualiser').click();
    await expect(assetRows(page)).toHaveCount(demoAssetCount);

    await page.reload();
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
    await expect(assetRows(page)).toHaveCount(demoAssetCount);
    await page.getByTestId('nav-history').click();
    await expect(page.locator('h4', { hasText: 'Keep me' })).toBeVisible();
  });

  test('AC5: an empty workspace opens the file without asking', async ({ page }) => {
    await openDemo(page);
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('clear-and-start-again-btn').click();
    await page.getByTestId('template-start-blank-btn').click();
    await page.getByTestId('nav-visualiser').click();
    await expect(assetRows(page)).toHaveCount(0);

    await page.getByTestId('viewer-file-input').setInputFiles(sharedWorkbook());

    await expect(assetRows(page)).toHaveCount(1);
    await expect(page.getByTestId('confirm-modal')).toHaveCount(0);
  });

  test('AC6: an unreadable file never reaches the confirmation and changes nothing', async ({ page }) => {
    await openDemo(page);
    const demoAssetCount = await assetRows(page).count();

    await page.getByTestId('viewer-file-input').setInputFiles({
      name: 'broken.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('not a real spreadsheet'),
    });

    await expect(page.getByText(/Failed to import the file|No valid data found/)).toBeVisible();
    await expect(page.getByTestId('confirm-modal')).toHaveCount(0);
    await expect(assetRows(page)).toHaveCount(demoAssetCount);
  });

  test('AC7: undoing Import → Overwrite All Data also restores History', async ({ page }) => {
    await openDemo(page);
    await saveVersion(page, 'Survives an undone overwrite');

    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('import-file-input').setInputFiles(sharedWorkbook());
    await page.getByRole('button', { name: 'Overwrite All Data' }).click();
    await expect(page.getByTestId('import-success-notification')).toBeVisible();

    await page.getByTitle('Undo').click();

    await page.getByTestId('nav-history').click();
    await expect(page.locator('h4', { hasText: 'Survives an undone overwrite' })).toBeVisible();
  });
});
