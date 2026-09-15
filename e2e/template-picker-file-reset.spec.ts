import { test, expect } from '@playwright/test';

async function clearWorkspace(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.removeItem('scenia-e2e');
    localStorage.setItem('scenia_has_seen_landing', 'true');
    const req = indexedDB.deleteDatabase('it-initiative-visualiser');
    req.onsuccess = () => {};
    req.onerror = () => {};
  });
}

const DUMMY = {
  name: 'dummy.xlsx',
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  buffer: Buffer.from('not a real spreadsheet'),
};

/**
 * A file input that keeps its value cannot be given the same file twice — the
 * change event never fires, so a user who fixes a spreadsheet and retries the
 * identical filename gets silence. This guarantee used to live on the template
 * picker's viewer card; that card moved to the import/share surface (#38), so
 * the test moves with it rather than being deleted, and now also covers the two
 * onboarding slots, which reset the same way.
 */
test.describe('File inputs reset after a choice', () => {
  test('the shared-file input on the import controls resets', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });

    await page.getByTestId('viewer-file-input').setInputFiles(DUMMY);
    await expect(page.getByTestId('viewer-file-input')).toHaveValue('');
  });

  test('both onboarding slots reset, so the same file can be retried', async ({ page }) => {
    await clearWorkspace(page);
    await page.goto('/');
    await page.waitForSelector('[data-testid="template-picker-modal"]', { timeout: 20000 });

    await page.getByTestId('onboarding-lkpti-file-input').setInputFiles(DUMMY);
    await expect(page.getByTestId('onboarding-lkpti-file-input')).toHaveValue('');
    // The filename is still shown, so clearing the input must not look like
    // nothing was chosen.
    await expect(page.getByTestId('onboarding-lkpti-filename')).toContainText('dummy.xlsx');

    await page.getByTestId('onboarding-rpti-file-input').setInputFiles(DUMMY);
    await expect(page.getByTestId('onboarding-rpti-file-input')).toHaveValue('');
  });
});
