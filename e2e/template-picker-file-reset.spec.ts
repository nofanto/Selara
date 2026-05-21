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

test.describe('Template Picker viewer import', () => {
  test.beforeEach(async ({ page }) => {
    await clearWorkspace(page);
  });

  test('resets the viewer file input after choosing a file', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="template-picker-modal"]', { timeout: 20000 });

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByTestId('template-viewer-upload-btn').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'dummy.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('not a real spreadsheet'),
    });

    const input = page.getByTestId('template-viewer-file-input');
    await expect(input).toHaveValue('');
  });
});
