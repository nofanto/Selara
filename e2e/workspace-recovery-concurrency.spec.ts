import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { createBackup, describeDifferences, readBackupWorkbook } from '../src/lib/workspaceBackup';
import { fieldCompleteWorkspace } from '../src/lib/workspaceBackup.fixture';
import {
  DB_NAME, chooseRestoreFile, currentCount, downloadBackup, installFaultHooks, makeOrdinaryEdit, openApp, readStored,
  replacementModal, saveVersionViaUi, writeStored,
} from './workspace-recovery-helpers';

/**
 * specs/005-workspace-recovery, contracts/replacement-routes.md — X01–X08.
 *
 * Two pages in one browser context share IndexedDB and the sync channel, which is
 * exactly two tabs of one planner's browser.
 */

const backupFile = () => ({
  name: 'bank-backup.xlsx',
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  buffer: Buffer.from(createBackup(fieldCompleteWorkspace()).bytes),
});

/**
 * Holds a readwrite transaction on the assets store open, so every workspace
 * write queues behind it — a save that is deterministically "still pending".
 */
async function holdWrites(page: Page) {
  await page.evaluate(async name => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(name);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const w = window as unknown as { __releaseWrites?: boolean };
    w.__releaseWrites = false;
    const store = db.transaction(['assets'], 'readwrite').objectStore('assets');
    const spin = () => { if (!w.__releaseWrites) store.get('__hold__').onsuccess = spin; };
    spin();
  }, DB_NAME);
}
const releaseWrites = (page: Page) => page.evaluate(() => { (window as unknown as { __releaseWrites: boolean }).__releaseWrites = true; });

test.describe('Replacement concurrency (FR-015 / FR-016 / SC-006)', () => {
  test('X01: backup waits for a pending save and includes it', async ({ page }) => {
    await openApp(page);
    const was = (await readStored(page)).timelineSettings?.conflictDetection;
    await holdWrites(page);
    await makeOrdinaryEdit(page);
    await page.getByTestId('backup-menu-button').click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('backup-download').click();
    await page.waitForTimeout(300);
    await releaseWrites(page);

    const download = await downloadPromise;
    const restored = readBackupWorkbook(XLSX.read(readFileSync(await download.path()), { type: 'buffer' }));
    expect(restored.status).toBe('complete');
    expect(restored.status === 'complete' && restored.workspace.timelineSettings.conflictDetection).not.toBe(was);
  });

  test('X03: a local change while the preview is open makes it stale until refreshed', async ({ page }) => {
    await openApp(page);
    await makeOrdinaryEdit(page);
    await chooseRestoreFile(page, backupFile());
    await expect(replacementModal(page)).toBeVisible();

    await page.keyboard.press('Control+z');

    await expect(page.getByTestId('replacement-stale')).toBeVisible();
    await expect(page.getByTestId('confirm-modal-confirm')).toBeDisabled();
    await page.getByTestId('replacement-refresh').click();
    await expect(page.getByTestId('replacement-stale')).toHaveCount(0);
    await page.getByTestId('confirm-modal-confirm').click();
    await expect(page.getByTestId('workspace-notice')).toContainText('Backup restored');
  });

  test('X04: a change in another tab — records or History — makes an open preview stale and refreshes History', async ({ context }) => {
    const tab1 = await context.newPage();
    const tab2 = await context.newPage();
    await openApp(tab1);
    await openApp(tab2);
    await chooseRestoreFile(tab1, backupFile());
    await expect(currentCount(tab1, 'versions')).toHaveCount(0);

    await saveVersionViaUi(tab2, 'Saved in the other tab');

    await expect(tab1.getByTestId('replacement-stale')).toBeVisible();
    await tab1.getByTestId('replacement-refresh').click();
    await expect(currentCount(tab1, 'versions')).toHaveText('1');
    await tab1.getByTestId('confirm-modal-cancel').click();
    await tab1.getByTestId('nav-history').click();
    await expect(tab1.locator('h4', { hasText: 'Saved in the other tab' })).toBeVisible();
  });

  test('X05: a commit from another tab between preview and confirm is refused atomically, even without a broadcast', async ({ context }) => {
    const tab1 = await context.newPage();
    const tab2 = await context.newPage();
    await openApp(tab1);
    await openApp(tab2);
    await chooseRestoreFile(tab1, backupFile());
    await expect(replacementModal(tab1)).toBeVisible();

    // Written straight to the database: no sync message is sent.
    const stored = await readStored(tab2);
    const remote = { ...stored, assets: [...stored.assets, { id: 'asset-remote', name: 'Added elsewhere', categoryId: stored.assetCategories[0].id }] };
    await writeStored(tab2, remote);

    await tab1.getByTestId('confirm-modal-confirm').click();
    await expect(tab1.getByTestId('replacement-error')).toContainText(/changed/);
    await expect(tab1.getByTestId('workspace-notice')).toHaveCount(0);
    expect(describeDifferences(await readStored(tab1), remote)).toEqual([]);
    await expect(tab1.getByTestId('replacement-stale')).toBeVisible();
  });

  test('X06: while a replacement saves, a second confirmation, an edit or an Undo cannot race it', async ({ page }) => {
    await openApp(page);
    const before = await readStored(page);
    await chooseRestoreFile(page, backupFile());
    await holdWrites(page);
    await page.getByTestId('confirm-modal-confirm').click();

    await expect(page.getByTestId('operation-busy')).toBeVisible();
    await expect(page.getByTestId('confirm-modal-confirm')).toBeDisabled();
    await page.keyboard.press('Control+z');
    await releaseWrites(page);

    await expect(page.getByTestId('workspace-notice')).toContainText('Backup restored');
    await expect(page.getByTestId('operation-busy')).toHaveCount(0);
    // Exactly one replacement is on the Undo stack, and undoing it restores the original.
    await page.getByTitle('Undo').click();
    await expect.poll(async () => describeDifferences(await readStored(page), before)).toEqual([]);
    await expect(page.getByTitle('Undo')).toBeDisabled();
  });

  test('X08: after a replacement in one tab, the other shows its History and backs it up', async ({ context }) => {
    const tab1 = await context.newPage();
    const tab2 = await context.newPage();
    await installFaultHooks(tab2);
    await openApp(tab1);
    await openApp(tab2);

    await chooseRestoreFile(tab1, backupFile());
    await tab1.getByTestId('confirm-modal-confirm').click();
    await expect(tab1.getByTestId('workspace-notice')).toContainText('Backup restored');

    await expect(tab2.getByTestId('sync-toast')).toBeVisible();
    await tab2.getByTestId('nav-history').click();
    await expect(tab2.locator('h4', { hasText: 'Before consolidation' })).toBeVisible();
    await tab2.getByTestId('nav-visualiser').click();
    const file = await downloadBackup(tab2);
    const restored = readBackupWorkbook(XLSX.read(readFileSync(file), { type: 'buffer' }));
    expect(restored.status === 'complete' && restored.workspace.versions.map(v => v.id).sort()).toEqual(['ver-1', 'ver-2', 'ver-3']);
  });
});
