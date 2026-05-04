import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as XLSX from 'xlsx';

test.describe('Resource Assignment Sync', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('scenia-e2e', 'true');
    });
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
  });

  test('US-RC-04: Resource assignments are preserved in Excel export/import', async ({ page }) => {
    // 1. Assign a resource to an initiative
    const bar = page.locator('[data-initiative-id]').first();
    await bar.click({ force: true });
    await page.getByTestId('initiative-action-edit').click();
    
    // Check first resource
    const firstResourceCheckbox = page.getByTestId('initiative-resources-section').locator('input[type="checkbox"]').first();
    await firstResourceCheckbox.check();
    
    // Save/Close panel
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // 2. Export to Excel
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-excel').click(),
    ]);
    const filePath = await download.path();
    if (!filePath) throw new Error('Download path is null');

    // 3. Clear local data (to ensure import is what restores it)
    await page.evaluate(() => {
      const DB_NAME = 'it-initiative-visualiser';
      indexedDB.deleteDatabase(DB_NAME);
      localStorage.clear();
      window.location.reload();
    });
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });

    // 4. Import the Excel file
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Import' }).click(),
    ]);
    await fileChooser.setFiles(filePath);
    
    // Click Overwrite All Data in preview
    await page.getByRole('button', { name: 'Overwrite All Data' }).click();

    // 5. Verify the assignment is back
    const importedBar = page.locator('[data-initiative-id]').first();
    await importedBar.click({ force: true });
    await page.getByTestId('initiative-action-edit').click();
    
    const restoredResourceCheckbox = page.getByTestId('initiative-resources-section').locator('input[type="checkbox"]').first();
    await expect(restoredResourceCheckbox).toBeChecked();
  });
});
