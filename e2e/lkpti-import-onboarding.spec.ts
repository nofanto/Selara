import { test, expect } from '@playwright/test';

/**
 * User Story 20: Import an Existing LKPTI Report as a Workspace Template
 * See requirement-specs/lkpti-import-onboarding.md.
 *
 * AC1: 4th template card with its own upload control
 * AC5: imported rows survive a subsequent "Generate LKPTI Rows" click
 * AC6: an unrecognized file shows an error and leaves the picker open
 */

const LKPTI_HEADERS = [
  'No.',
  'Kategori Aplikasi',
  'Nama Aplikasi',
  'Deskripsi Fungsi Aplikasi',
  'Platform',
  'Pangkalan Data',
  'Lokasi DC',
  'Penyelenggara DC',
  'Lokasi DRC',
  'Penyelenggara DRC',
  'Strategi Backup',
  'System Owner',
  'Pengembang Aplikasi',
  'Tanggal Implementasi (Go Live)',
  'Kepemilikan',
];

async function simulateFirstRun(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('it-initiative-visualiser');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => setTimeout(resolve, 200);
    });
    localStorage.removeItem('scenia-e2e');
    localStorage.setItem('scenia_has_seen_landing', 'true');
  });
  await page.reload();
}

async function buildValidLkptiWorkbook(): Promise<Buffer> {
  const { utils, write } = await import('xlsx');
  const wb = utils.book_new();
  const row = [
    1,
    '01 — Customer management',
    'Core Banking App',
    'Handles customer onboarding.',
    'Java/Spring',
    'PostgreSQL',
    'Jakarta, Indonesia',
    'Self',
    'Surabaya, Indonesia',
    'Self',
    'High Availability Active - Active',
    'Jane Doe',
    'inhouse',
    '15-03-2021',
    'Beli Putus',
  ];
  utils.book_append_sheet(wb, utils.aoa_to_sheet([LKPTI_HEADERS, row]), 'LKPTI Format 3.2.6');
  return write(wb, { type: 'buffer', bookType: 'xlsx' });
}

test.describe('LKPTI Import Onboarding', () => {
  test('AC1: template picker shows a 4th "Import LKPTI Report" card with its own upload button', async ({ page }) => {
    await page.goto('/');
    await simulateFirstRun(page);
    await page.waitForSelector('[data-testid="template-picker-modal"]', { timeout: 20000 });

    const card = page.getByTestId('template-card-lkpti-import');
    await expect(card).toBeVisible();
    await expect(card.getByTestId('template-lkpti-import-upload-btn')).toBeVisible();
  });

  test('AC1/AC2/AC3/AC4: uploading a valid LKPTI file builds a workspace and closes the picker', async ({ page }) => {
    const buf = await buildValidLkptiWorkbook();

    await page.goto('/');
    await simulateFirstRun(page);
    await page.waitForSelector('[data-testid="template-picker-modal"]', { timeout: 20000 });

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByTestId('template-lkpti-import-upload-btn').click(),
    ]);
    await fileChooser.setFiles({
      name: 'lkpti-report.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: buf,
    });

    await expect(page.getByTestId('template-picker-modal')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('nav-visualiser')).toBeVisible();
    await expect(page.getByText('Core Banking App').first()).toBeVisible({ timeout: 10000 });
  });

  test('AC5: a subsequent "Generate LKPTI Rows" click preserves the manual-only fields the import wrote', async ({ page }) => {
    const buf = await buildValidLkptiWorkbook();

    await page.goto('/');
    await simulateFirstRun(page);
    await page.waitForSelector('[data-testid="template-picker-modal"]', { timeout: 20000 });

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByTestId('template-lkpti-import-upload-btn').click(),
    ]);
    await fileChooser.setFiles({
      name: 'lkpti-report.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: buf,
    });
    await expect(page.getByTestId('template-picker-modal')).not.toBeVisible({ timeout: 10000 });

    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-lkpti').click();
    const platformInput = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"] td[data-key="platform"] input').first();
    await expect(platformInput).toHaveValue('Java/Spring', { timeout: 10000 });

    await page.getByTestId('lkpti-generate-btn').click();
    await page.getByTestId('confirm-modal-confirm').click();

    // platform ("Java/Spring") has no cascade source — it must survive a regenerate
    await expect(platformInput).toHaveValue('Java/Spring', { timeout: 10000 });
  });

  test('AC6: an unrecognized file shows an error and leaves the picker open', async ({ page }) => {
    const { utils, write } = await import('xlsx');
    const wb = utils.book_new();
    utils.book_append_sheet(wb, utils.aoa_to_sheet([['Not', 'An', 'LKPTI', 'File']]), 'Sheet1');
    const buf: Buffer = write(wb, { type: 'buffer', bookType: 'xlsx' });

    await page.goto('/');
    await simulateFirstRun(page);
    await page.waitForSelector('[data-testid="template-picker-modal"]', { timeout: 20000 });

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByTestId('template-lkpti-import-upload-btn').click(),
    ]);
    await fileChooser.setFiles({
      name: 'not-lkpti.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: buf,
    });

    await expect(page.getByTestId('template-picker-modal')).toBeVisible({ timeout: 10000 });
  });
});
