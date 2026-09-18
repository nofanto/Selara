import { generateReport } from './report-fixtures';
import { test, expect, Page } from '@playwright/test';

/**
 * User Story 20: Import an Existing LKPTI Report as a Workspace Template.
 * See requirement-specs/lkpti-import-onboarding.md.
 *
 * Most of this story's acceptance criteria moved to rpti-import-onboarding.spec.ts
 * when #38 replaced the four-card picker with the two-path onboarding: the card and
 * its upload button (AC1), building a workspace from a valid file (AC2-AC4), and
 * rejecting an unusable one while leaving the picker open (AC6) are all covered
 * there against the new LKPTI slot.
 *
 * AC5 is not, and it is the one that guards a silent data loss, so it stays here
 * re-pointed at the new flow: the importer writes deliverable-owned fields that no
 * cascade can reconstruct, and Reports generation must not overwrite them.
 */
const LKPTI_HEADERS = [
  'No.', 'Kategori Aplikasi', 'Nama Aplikasi', 'Deskripsi Fungsi Aplikasi', 'Platform',
  'Pangkalan Data', 'Lokasi DC', 'Penyelenggara DC', 'Lokasi DRC', 'Penyelenggara DRC',
  'Strategi Backup', 'System Owner', 'Pengembang Aplikasi',
  'Tanggal Implementasi (Go Live)', 'Kepemilikan',
];

/**
 * Built here rather than read from e2e/fixtures: that fixture is a real Selara
 * export, and Platform is a manual-only field the demo workspace never sets, so
 * every one of its rows carries a blank platform. This test needs a value that
 * a regenerate could destroy.
 */
async function lkptiWorkbookWithPlatform() {
  const { utils, write } = await import('xlsx');
  const wb = utils.book_new();
  const row = [
    1, '01 — Customer management', 'Core Banking App', 'Handles customer onboarding.',
    'Java/Spring', 'PostgreSQL', 'Jakarta, Indonesia', 'Self', 'Surabaya, Indonesia', 'Self',
    'High Availability Active - Active', 'Jane Doe', 'inhouse', '15-03-2021', 'Beli Putus',
  ];
  utils.book_append_sheet(wb, utils.aoa_to_sheet([LKPTI_HEADERS, row]), 'LKPTI Format 3.2.6');
  return write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

async function freshWorkspace(page: Page) {
  await page.goto('/');
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
  await expect(page.getByTestId('template-picker-modal')).toBeVisible({ timeout: 20000 });
}

test.describe('LKPTI Import Onboarding', () => {
  test('AC5: regenerating LKPTI rows preserves the deliverable-owned fields the import wrote', async ({ page }) => {
    const buffer = await lkptiWorkbookWithPlatform();
    await freshWorkspace(page);
    await page.getByTestId('onboarding-lkpti-file-input').setInputFiles({
      name: 'lkpti-report.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    });
    await page.getByTestId('onboarding-lkpti-year').fill('2026');
    await page.getByTestId('onboarding-import-btn').click();
    await expect(page.getByTestId('data-health-report-view')).toBeVisible({ timeout: 30000 });

    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-lkpti').click();

    await expect(page.getByTestId('lkpti-readonly-table')).toContainText('Java/Spring');
    await generateReport(page, 'lkpti');
    await expect(page.getByTestId('lkpti-detail-table')).toContainText('Java/Spring');
    await page.evaluate(() => localStorage.setItem('scenia-e2e', 'true'));
    await page.reload();
    await generateReport(page, 'lkpti');
    await expect(page.getByTestId('lkpti-detail-table')).toContainText('Java/Spring');
  });
});
