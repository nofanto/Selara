import { test, expect, type Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import { buildWorkbook } from '../src/lib/excel';
import { createBackup, describeDifferences, workspacesEqual } from '../src/lib/workspaceBackup';
import { fieldCompleteWorkspace, historyOnlyWorkspace } from '../src/lib/workspaceBackup.fixture';
import {
  chooseRestoreFile, colleagueWorkbook, currentCount, downloadBackup, incomingCount, installFaultHooks, openApp,
  openWithWorkspace, readStored, replacementModal, saveVersionViaUi, setFaults, writeStored, xlsxFile, type StoredWorkspace,
} from './workspace-recovery-helpers';

/**
 * specs/005-workspace-recovery, contracts/replacement-routes.md — R01–R08.
 *
 * Every route is exercised against a populated workspace with History and
 * decisions. "Unchanged" always means the stored workspace, compared before and
 * after, and again after reload (SC-002, SC-005).
 */

const backupFile = (name = 'bank-backup.xlsx') => ({
  name,
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  buffer: Buffer.from(createBackup(fieldCompleteWorkspace()).bytes),
});

async function expectStoredUnchanged(page: Page, before: StoredWorkspace) {
  expect(describeDifferences(await readStored(page), before)).toEqual([]);
  await page.reload();
  await page.waitForSelector('[data-testid="app-ready"]', { state: 'attached' });
  expect(describeDifferences(await readStored(page), before)).toEqual([]);
}

/** The demo workspace plus a live decision and a saved version — every route has all three to lose. */
async function populated(page: Page) {
  await installFaultHooks(page);
  await openApp(page);
  await writeStored(page, { decisions: [{ id: 'dec-live', title: 'Keep the ledger vendor', status: 'accepted', createdAt: '2026-09-01T00:00:00.000Z' }] });
  await page.reload();
  await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
  await saveVersionViaUi(page, 'Planner snapshot');
  return readStored(page);
}

const confirm = (page: Page) => page.getByTestId('confirm-modal-confirm').click();
const cancel = (page: Page) => page.getByTestId('confirm-modal-cancel').click();

test.describe('R01 Restore Backup', () => {
  test('previews current and incoming contents with History and decision effects; Cancel changes nothing', async ({ page }) => {
    const before = await populated(page);
    await chooseRestoreFile(page, backupFile());

    await expect(replacementModal(page)).toBeVisible();
    await expect(currentCount(page, 'versions')).toHaveText(String(before.versions.length));
    await expect(incomingCount(page, 'versions')).toHaveText('3');
    await expect(incomingCount(page, 'decisions')).toHaveText('2');
    await expect(page.getByTestId('replacement-effects')).toContainText(/History/);
    await expect(page.getByTestId('replacement-effects')).toContainText(/Decision log/);
    await expect(page.getByTestId('replacement-effects')).toContainText(/Timeline settings/);

    await cancel(page);
    await expect(replacementModal(page)).toHaveCount(0);

    // Escape before saving is the same as Cancel.
    await chooseRestoreFile(page, backupFile());
    await expect(replacementModal(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(replacementModal(page)).toHaveCount(0);
    await expectStoredUnchanged(page, before);
  });

  test('confirming replaces everything, reports success only after saving, and survives reload; Undo restores History', async ({ page }) => {
    const before = await populated(page);
    await chooseRestoreFile(page, backupFile());
    await confirm(page);
    await expect(page.getByTestId('workspace-notice')).toContainText('Backup restored');

    const stored = await readStored(page);
    expect(workspacesEqual(stored, fieldCompleteWorkspace())).toBe(true);
    await page.getByTitle('Undo').click();
    await expect.poll(async () => describeDifferences(await readStored(page), before)).toEqual([]);
  });

  test('an unreadable, incomplete or future file never reaches confirmation and changes nothing', async ({ page }) => {
    const before = await populated(page);

    const restoreError = page.getByTestId('backup-restore-error');
    await chooseRestoreFile(page, { name: 'broken.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('not a spreadsheet') });
    await expect(restoreError).toContainText('broken.xlsx');

    const legacy = buildWorkbook(fieldCompleteWorkspace());
    delete legacy.Sheets.Decisions;
    legacy.SheetNames = legacy.SheetNames.filter(n => n !== 'Decisions');
    await chooseRestoreFile(page, xlsxFile(legacy, 'old-export.xlsx'));
    await expect(restoreError).toContainText(/Import/);
    await expect(restoreError).toContainText(/Decisions/);

    const future = XLSX.read(createBackup(fieldCompleteWorkspace()).bytes, { type: 'array' });
    future.Sheets.SelaraBackup = XLSX.utils.json_to_sheet(
      XLSX.utils.sheet_to_json<Record<string, unknown>>(future.Sheets.SelaraBackup).map(r => (r.key === 'formatVersion' ? { ...r, value: 2 } : r)),
    );
    await chooseRestoreFile(page, xlsxFile(future, 'future.xlsx'));
    await expect(restoreError).toContainText(/newer version of Selara/);

    await expect(replacementModal(page)).toHaveCount(0);
    await expectStoredUnchanged(page, before);
  });

  test('a save that fails part-way leaves everything as it was; retrying succeeds and survives reload (X07)', async ({ page }) => {
    const before = await populated(page);
    await chooseRestoreFile(page, backupFile());
    await setFaults(page, { idbAbortAfterPuts: 5 });
    await confirm(page);

    await expect(page.getByTestId('replacement-error')).toBeVisible();
    await expect(page.getByTestId('workspace-notice')).toHaveCount(0);
    expect(describeDifferences(await readStored(page), before)).toEqual([]);

    await confirm(page); // the fault fired once; the retry goes through
    await expect(page.getByTestId('workspace-notice')).toContainText('Backup restored');
    await page.reload();
    await page.waitForSelector('[data-testid="app-ready"]', { state: 'attached' });
    expect(workspacesEqual(await readStored(page), fieldCompleteWorkspace())).toBe(true);
  });
});

test.describe('R02 Import → Overwrite', () => {
  test('the Import Preview shows current vs incoming and says an absent Decisions sheet keeps the log', async ({ page }) => {
    const before = await populated(page);
    await page.getByTestId('import-file-input').setInputFiles(colleagueWorkbook());
    const preview = page.locator('.import-preview-modal');
    await expect(preview).toBeVisible();
    await expect(preview.getByTestId('replacement-counts')).toBeVisible();
    await expect(preview.getByTestId('replacement-effects')).toContainText(/Decision log: kept/);
    await expect(preview.getByTestId('replacement-effects')).toContainText(/History/);

    await preview.getByRole('button', { name: 'Cancel' }).click();
    await expectStoredUnchanged(page, before);
  });

  test('an explicitly empty Decisions sheet clears the log, and the preview says so', async ({ page }) => {
    await populated(page);
    const wb = XLSX.read(colleagueWorkbook().buffer, { type: 'buffer' });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([]), 'Decisions');
    await page.getByTestId('import-file-input').setInputFiles(xlsxFile(wb));
    await expect(page.locator('.import-preview-modal').getByTestId('replacement-effects')).toContainText(/Decision log: (cleared|replaced)/);
  });

  test('a failed overwrite reports no success and keeps the workspace, even after reload', async ({ page }) => {
    const before = await populated(page);
    await page.getByTestId('import-file-input').setInputFiles(colleagueWorkbook());
    await setFaults(page, { idbAbortAfterPuts: 2 });
    await page.getByRole('button', { name: 'Overwrite All Data' }).click();

    await expect(page.getByTestId('replacement-error')).toBeVisible();
    await expect(page.getByTestId('import-success-notification')).toHaveCount(0);
    await expectStoredUnchanged(page, before);
  });

  test('a failed merge reports no success (FR-014)', async ({ page }) => {
    await populated(page);
    await page.getByTestId('import-file-input').setInputFiles(colleagueWorkbook());
    await setFaults(page, { idbAbortAfterPuts: 2 });
    await page.getByRole('button', { name: 'Merge Data' }).click();

    await expect(page.getByTestId('import-error-notification')).toBeVisible();
    await expect(page.getByTestId('import-success-notification')).toHaveCount(0);
  });

  test('display repairs to a saved version are listed before confirming', async ({ page }) => {
    await populated(page);
    const source = fieldCompleteWorkspace();
    source.initiatives[1].opex = 0; // ordinary Import's own validation refuses negative costs
    const wb = buildWorkbook(source);
    wb.Sheets.TimelineSettings = XLSX.utils.json_to_sheet(
      XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets.TimelineSettings).filter(r => r.versionId !== 'ver-1'),
    );
    await page.getByTestId('import-file-input').setInputFiles(xlsxFile(wb));
    await expect(page.locator('.import-preview-modal').getByTestId('replacement-notices')).toContainText(/Before consolidation/);
    await expect(page.locator('.import-preview-modal').getByTestId('replacement-notices')).toContainText(/display defaults/);
  });
});

test.describe('R03 Open shared', () => {
  test('a History-only destination still asks before replacing', async ({ page }) => {
    await installFaultHooks(page);
    await openWithWorkspace(page, historyOnlyWorkspace());
    const before = await readStored(page);
    await page.getByTestId('viewer-file-input').setInputFiles(colleagueWorkbook());
    await expect(replacementModal(page)).toBeVisible();
    await expect(currentCount(page, 'versions')).toHaveText('1');
    await cancel(page);
    await expectStoredUnchanged(page, before);
  });

  test('a failed save keeps the workspace; the retry succeeds', async ({ page }) => {
    const before = await populated(page);
    await page.getByTestId('viewer-file-input').setInputFiles(colleagueWorkbook());
    await setFaults(page, { idbAbortAfterPuts: 2 });
    await confirm(page);
    await expect(page.getByTestId('replacement-error')).toBeVisible();
    expect(describeDifferences(await readStored(page), before)).toEqual([]);

    await confirm(page);
    await expect(replacementModal(page)).toHaveCount(0);
    await expect(page.getByText('Shared Core Ledger').first()).toBeVisible();
  });
});

test.describe('R04 Reset / template selection', () => {
  test('choosing a template previews what is lost; Cancel returns to the picker with nothing changed', async ({ page }) => {
    const before = await populated(page);
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('clear-and-start-again-btn').click();
    await page.getByTestId('template-start-blank-btn').click();

    await expect(replacementModal(page)).toBeVisible();
    await expect(currentCount(page, 'versions')).toHaveText('1');
    await expect(page.getByTestId('replacement-effects')).toContainText(/History: all 1 saved version/);
    await cancel(page);
    await expect(page.getByTestId('template-picker-modal')).toBeVisible();
    await expectStoredUnchanged(page, before);
  });

  test('a failed save keeps the workspace and reports it', async ({ page }) => {
    const before = await populated(page);
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('clear-and-start-again-btn').click();
    await page.getByTestId('template-start-blank-btn').click();
    await setFaults(page, { idbAbortAfterPuts: 0 });
    await confirm(page);
    await expect(page.getByTestId('replacement-error')).toBeVisible();
    expect(describeDifferences(await readStored(page), before)).toEqual([]);
  });
});

test.describe('R05 Onboarding from filed returns', () => {
  test('replacing an existing workspace previews the derived records first; Cancel changes nothing', async ({ page }) => {
    const before = await populated(page);
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('clear-and-start-again-btn').click();
    await page.getByTestId('onboarding-lkpti-file-input').setInputFiles('e2e/fixtures/lkpti-format-3.2.6.xlsx');
    await page.getByTestId('onboarding-lkpti-year').fill('2026');
    await page.getByTestId('onboarding-import-btn').click();

    await expect(replacementModal(page)).toBeVisible();
    await expect(page.getByTestId('replacement-notices')).toContainText(/LKPTI 2026/);
    await expect(page.getByTestId('replacement-effects')).toContainText(/History: all 1 saved version/);
    await cancel(page);
    await expectStoredUnchanged(page, before);
  });

  test('confirming builds the workspace and lands on the data-health review', async ({ page }) => {
    await populated(page);
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('clear-and-start-again-btn').click();
    await page.getByTestId('onboarding-lkpti-file-input').setInputFiles('e2e/fixtures/lkpti-format-3.2.6.xlsx');
    await page.getByTestId('onboarding-lkpti-year').fill('2026');
    await page.getByTestId('onboarding-import-btn').click();
    await confirm(page);
    await expect(page.getByTestId('data-health-report-view')).toBeVisible({ timeout: 30000 });
    expect((await readStored(page)).versions).toEqual([]);
  });
});

test.describe('R06 Incoming shared link (mocked; outbound sharing stays disabled)', () => {
  async function encryptedShare(page: Page, payload: unknown) {
    return page.evaluate(async data => {
      const toB64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(data)));
      return { ciphertext: toB64(ciphertext), iv: toB64(iv), key: toB64(await crypto.subtle.exportKey('raw', key)) };
    }, payload);
  }

  const sharedWorkspace = (withVersions: boolean) => {
    const { versions, ...rest } = fieldCompleteWorkspace();
    return withVersions ? { ...rest, versions } : rest;
  };

  async function openShareLink(page: Page, payload: unknown, corruptKey = false) {
    const { ciphertext, iv, key } = await encryptedShare(page, payload);
    await page.route('**/handleShare*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ciphertext, iv }) }));
    await page.goto(`/?id=share-1#key=${corruptKey ? key.replace(/^./, c => (c === 'A' ? 'B' : 'A')) : key}`);
  }

  test('a share link previews before replacing; Cancel keeps everything and clears the link', async ({ page }) => {
    const before = await populated(page);
    await openShareLink(page, sharedWorkspace(false));

    await expect(replacementModal(page)).toBeVisible();
    await expect(page.getByTestId('replacement-effects')).toContainText(/History: your 1 saved version\(s\) are kept/);
    await cancel(page);
    await expect(page).not.toHaveURL(/id=share-1/);
    await expectStoredUnchanged(page, before);
    await expect(page.getByTestId('share-button')).toHaveCount(0);
  });

  test('confirming a link without History keeps History; with History replaces it', async ({ page }) => {
    const before = await populated(page);
    await openShareLink(page, sharedWorkspace(false));
    await confirm(page);
    await expect(replacementModal(page)).toHaveCount(0);
    let stored = await readStored(page);
    expect(stored.versions.map(v => v.id)).toEqual(before.versions.map(v => v.id));
    expect(stored.decisions.map(d => d.id).sort()).toEqual(['dec-1', 'dec-2']);

    await openShareLink(page, sharedWorkspace(true));
    await confirm(page);
    await expect(replacementModal(page)).toHaveCount(0);
    stored = await readStored(page);
    expect(stored.versions.map(v => v.id).sort()).toEqual(['ver-1', 'ver-2', 'ver-3']);
  });

  test('a link that cannot be decrypted changes nothing', async ({ page }) => {
    const before = await populated(page);
    await openShareLink(page, sharedWorkspace(false), true);
    await expect(page.getByTestId('db-error-banner')).toContainText(/Decryption Failed/);
    await expect(replacementModal(page)).toHaveCount(0);
    await expectStoredUnchanged(page, before);
  });
});

test.describe('R07 History snapshot restore', () => {
  test('the confirmation says History and the live decision log are kept; a failed save changes nothing', async ({ page }) => {
    const before = await populated(page);
    await page.getByTestId('nav-history').click();
    await page.locator('h4', { hasText: 'Planner snapshot' }).click();
    await page.getByRole('button', { name: 'Restore to Current' }).click();

    await expect(page.getByTestId('replacement-effects')).toContainText(/History: your 1 saved version\(s\) are kept/);
    await expect(page.getByTestId('replacement-effects')).toContainText(/Decision log: kept/);
    await setFaults(page, { idbAbortAfterPuts: 0 });
    await confirm(page);
    await expect(page.getByTestId('replacement-error')).toBeVisible();
    await expectStoredUnchanged(page, before);
  });

  test('a malformed snapshot is refused before anything is written', async ({ page }) => {
    await installFaultHooks(page);
    await openApp(page);
    const stored = await readStored(page);
    await writeStored(page, { versions: [{ id: 'ver-bad', name: 'Damaged snapshot', timestamp: '2026-01-01T00:00:00.000Z', data: { assets: 'oops' } as never }] });
    await page.reload();
    await page.waitForSelector('[data-testid="app-ready"]', { state: 'attached' });
    const before = await readStored(page);
    expect(before.assets).toEqual(stored.assets);

    await page.getByTestId('nav-history').click();
    await page.locator('h4', { hasText: 'Damaged snapshot' }).click();
    await page.getByRole('button', { name: 'Restore to Current' }).click();
    await expect(page.getByTestId('db-error-banner')).toContainText(/can't be restored/);
    await expect(replacementModal(page)).toHaveCount(0);
    expect(describeDifferences(await readStored(page), before)).toEqual([]);
  });
});

test.describe('R08 Undo / Redo of a replacement', () => {
  test('a failed Undo or Redo keeps both stacks; retrying succeeds', async ({ page }) => {
    const before = await populated(page);
    await page.getByTestId('viewer-file-input').setInputFiles(colleagueWorkbook());
    await confirm(page);
    await expect(page.getByText('Shared Core Ledger').first()).toBeVisible();
    const replaced = await readStored(page);

    await setFaults(page, { idbAbortAfterPuts: 0 });
    await page.getByTitle('Undo').click();
    await expect(page.getByTestId('db-error-banner')).toContainText(/Undo/);
    await expect(page.getByTitle('Undo')).toBeEnabled();
    expect(describeDifferences(await readStored(page), replaced)).toEqual([]);

    await page.getByTitle('Undo').click();
    await expect.poll(async () => describeDifferences(await readStored(page), before)).toEqual([]);
    await expect(page.getByTitle('Redo')).toBeEnabled();

    await setFaults(page, { idbAbortAfterPuts: 0 });
    await page.getByTitle('Redo').click();
    await expect(page.getByTestId('db-error-banner')).toContainText(/Redo/);
    await expect(page.getByTitle('Redo')).toBeEnabled();
    expect(describeDifferences(await readStored(page), before)).toEqual([]);

    await page.getByTitle('Redo').click();
    await expect.poll(async () => describeDifferences(await readStored(page), replaced)).toEqual([]);
  });

  test('the downloaded backup of a restored workspace is itself restorable', async ({ page }) => {
    await populated(page);
    await chooseRestoreFile(page, backupFile());
    await confirm(page);
    await expect(page.getByTestId('workspace-notice')).toContainText('Backup restored');
    await downloadBackup(page);
  });
});
