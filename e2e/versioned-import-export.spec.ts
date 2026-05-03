import { test, expect } from '@playwright/test';

test.describe('Versioned Import/Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#timeline-visualiser');
  });

  test('should preserve version history through an export and re-import cycle', async ({ page }) => {
    // 1. Create a version snapshot
    await page.getByTestId('nav-history').click();
    await page.getByRole('button', { name: 'Save Current State' }).click();
    const versionName = `Export-Import-Test-${Date.now()}`;
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', versionName);
    await page.getByRole('button', { name: 'Save Version' }).click();
    await expect(page.locator('h4', { hasText: versionName })).toBeVisible();
    await page.getByTestId('close-version-manager').click();

    // 2. Trigger the export
    await page.getByTestId('nav-data-manager').click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-excel').click();
    const download = await downloadPromise;
    const exportPath = await download.path();
    expect(exportPath).not.toBeNull();

    // 3. Clear all data (reset workspace)
    await page.getByTestId('clear-and-start-again-btn').click();
    await page.getByTestId('template-start-blank-btn').click();
    
    // Verify it's empty
    await page.getByTestId('nav-history').click();
    await expect(page.locator('h4', { hasText: versionName })).not.toBeVisible();
    await expect(page.getByText('No versions saved yet')).toBeVisible();
    await page.getByTestId('close-version-manager').click();

    // 4. Import the file we just exported
    await page.getByTestId('nav-data-manager').click();
    await page.setInputFiles('input[type="file"]', exportPath!);
    
    // Verify the preview shows the version count
    const previewModal = page.locator('.import-preview-modal');
    await expect(previewModal).toBeVisible();
    await expect(previewModal.getByText('1 History Snapshots')).toBeVisible();

    // 5. Select "Overwrite" mode
    await page.getByRole('button', { name: 'Overwrite All Data' }).click();
    await expect(page.getByTestId('import-success-notification')).toBeVisible();

    // 6. Verify the version history is restored
    await page.getByTestId('nav-history').click();
    await expect(page.locator('h4', { hasText: versionName })).toBeVisible();
    
    // 7. Verify we can restore from that version
    await page.locator('h4', { hasText: versionName }).click();
    await page.getByRole('button', { name: 'Restore to Current' }).click();
    await page.locator('[data-testid="confirm-modal-confirm"]').click();
    
    // If the modal closed, we restored successfully
    await expect(page.getByText('Version History')).not.toBeVisible();
  });

  test('should correctly merge versions during a merge import', async ({ page }) => {
    // 1. Create one version
    await page.getByTestId('nav-history').click();
    await page.getByRole('button', { name: 'Save Current State' }).click();
    const v1Name = `Merge-V1-${Date.now()}`;
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', v1Name);
    await page.getByRole('button', { name: 'Save Version' }).click();
    await page.getByTestId('close-version-manager').click();

    // 2. Export
    await page.getByTestId('nav-data-manager').click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-excel').click();
    const download = await downloadPromise;
    const exportPath = await download.path();

    // 3. Create a second version locally
    await page.getByTestId('nav-history').click();
    await page.getByRole('button', { name: 'Save Current State' }).click();
    const v2Name = `Merge-V2-${Date.now()}`;
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', v2Name);
    await page.getByRole('button', { name: 'Save Version' }).click();
    
    // Delete V1 locally before merging
    // Scope the delete button to the V1 item
    const v1Item = page.locator('div.rounded-xl', { has: page.locator('h4', { hasText: v1Name }) });
    await v1Item.getByTestId('delete-version-btn').click();
    await page.locator('[data-testid="confirm-modal-confirm"]').click();
    await expect(page.locator('h4', { hasText: v1Name })).not.toBeVisible();
    await page.getByTestId('close-version-manager').click();

    // 4. Merge import back in (it contains V1)
    await page.getByTestId('nav-data-manager').click();
    await page.setInputFiles('input[type="file"]', exportPath!);
    await page.getByRole('button', { name: 'Merge Data' }).click();

    // 5. Verify both versions now exist
    await page.getByTestId('nav-history').click();
    await expect(page.locator('h4', { hasText: v1Name })).toBeVisible();
    await expect(page.locator('h4', { hasText: v2Name })).toBeVisible();
  });
});
