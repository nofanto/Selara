import { test, expect, type Page } from '@playwright/test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBackup, describeDifferences } from '../src/lib/workspaceBackup';
import { decisionsOnlyWorkspace, fieldCompleteWorkspace, historyOnlyWorkspace } from '../src/lib/workspaceBackup.fixture';
import {
  chooseRestoreFile, downloadBackup, freshProfile, installFaultHooks, makeOrdinaryEdit, openApp, openWithWorkspace,
  readStored, replacementModal, setFaults, writeStored, type StoredWorkspace,
} from './workspace-recovery-helpers';

/**
 * US-28 / specs/005-workspace-recovery, User Story 1 and the backup outcome matrix.
 *
 * The recovery proof uses the file the browser actually downloaded, restored into
 * a separate, fresh browser profile after the source profile is gone — never a
 * copied in-memory object (SC-001, SC-003).
 */

const expectSameWorkspace = (actual: StoredWorkspace, expected: StoredWorkspace) => {
  expect(describeDifferences(actual, expected, 10)).toEqual([]);
};

async function restoreInFreshProfile(browser: import('@playwright/test').Browser, file: string) {
  const context = await freshProfile(browser);
  const page = await context.newPage();
  await page.goto('/');
  // A first visit lands on the template picker; recovery must be reachable from there.
  await expect(page.getByTestId('template-picker-modal')).toBeVisible();
  await chooseRestoreFile(page, file);
  await expect(replacementModal(page)).toBeVisible();
  await expect(replacementModal(page)).toContainText('Restore backup');
  await page.getByTestId('confirm-modal-confirm').click();
  await expect(page.getByTestId('workspace-notice')).toContainText('Backup restored');
  await expect(page.getByTestId('template-picker-modal')).toHaveCount(0);
  return { context, page };
}

test.describe('Backup and fresh-profile recovery (US1)', () => {
  test('a field-complete workspace with History survives download → profile deletion → fresh profile → reload', async ({ browser }) => {
    const source = await browser.newContext();
    const sourcePage = await source.newPage();
    await openWithWorkspace(sourcePage, fieldCompleteWorkspace());
    const stored = await readStored(sourcePage);
    const file = await downloadBackup(sourcePage);
    await source.close(); // the disposable source profile, and its IndexedDB, are gone

    const { context, page } = await restoreInFreshProfile(browser, file);
    expectSameWorkspace(await readStored(page), stored);

    // Skip the first-visit tutorial on reload; it would cover the History tab.
    await page.evaluate(() => localStorage.setItem('scenia-e2e', 'true'));
    await page.reload();
    await page.waitForSelector('[data-testid="app-ready"]', { state: 'attached' });
    expectSameWorkspace(await readStored(page), stored);
    await page.getByTestId('nav-history').click();
    for (const version of stored.versions) await expect(page.locator('h4', { hasText: version.name })).toBeVisible();
    await context.close();
  });

  for (const [label, make] of [['History-only', historyOnlyWorkspace], ['decisions-only', decisionsOnlyWorkspace]] as const) {
    test(`a ${label} workspace is backed up from the welcome screen and recovered faithfully`, async ({ browser }) => {
      // With no current records a workspace opens on the template picker, which
      // covers the header — so the picker itself must offer the backup.
      const source = await freshProfile(browser);
      const sourcePage = await source.newPage();
      await sourcePage.goto('/');
      await expect(sourcePage.getByTestId('template-picker-modal')).toBeVisible();
      await writeStored(sourcePage, make());
      await sourcePage.reload();
      await expect(sourcePage.getByTestId('template-picker-modal')).toBeVisible();
      const stored = await readStored(sourcePage);
      const [download] = await Promise.all([sourcePage.waitForEvent('download'), sourcePage.getByTestId('template-backup-download').click()]);
      await expect(sourcePage.getByTestId('template-backup-status')).toHaveAttribute('data-outcome', 'started');
      const file = join(mkdtempSync(join(tmpdir(), 'selara-backup-')), download.suggestedFilename());
      await download.saveAs(file);
      await source.close();

      const { context, page } = await restoreInFreshProfile(browser, file);
      expectSameWorkspace(await readStored(page), stored);
      await context.close();
    });
  }

  test('an empty workspace is backed up and restored as empty', async ({ browser }) => {
    const source = await browser.newContext();
    const sourcePage = await source.newPage();
    await openApp(sourcePage);
    await sourcePage.getByTestId('nav-data-manager').click();
    await sourcePage.getByTestId('clear-and-start-again-btn').click();
    await sourcePage.getByTestId('template-start-blank-btn').click();
    await sourcePage.getByTestId('confirm-modal-confirm').click();
    await expect(sourcePage.getByTestId('template-picker-modal')).toHaveCount(0);
    const stored = await readStored(sourcePage);
    const file = await downloadBackup(sourcePage);
    await source.close();

    const { context, page } = await restoreInFreshProfile(browser, file);
    expectSameWorkspace(await readStored(page), stored);
    await context.close();
  });

  test('the backup is a clearly named workbook, distinct from report and timeline exports', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('backup-menu-button').click();
    const panel = page.getByTestId('backup-panel');
    await expect(panel).toContainText('History');
    await expect(panel).toContainText(/not.*(proof|prove|confirm)/i);
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('backup-download').click()]);
    expect(download.suggestedFilename()).toMatch(/^selara-backup-\d{4}-\d{2}-\d{2}\.xlsx$/);
    const bytes = readFileSync(await download.path());
    expect(bytes.subarray(0, 2).toString()).toBe('PK'); // an xlsx (zip) container
    // Ordinary spreadsheet interchange stays available beside it (FR-014).
    await expect(page.getByTestId('export-excel')).toBeVisible();
  });
});

test.describe('Backup outcome matrix (FR-011 / FR-018 / SC-007)', () => {
  test.beforeEach(async ({ page }) => {
    await installFaultHooks(page);
  });

  const lastStarted = (page: Page) => page.getByTestId('backup-last-started');

  test('a started download is recorded as initiation, and the record survives reload', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('backup-menu-button').click();
    await expect(lastStarted(page)).toContainText(/No backup download/i);
    await page.getByTestId('backup-menu-button').click();

    await downloadBackup(page);
    await expect(page.getByTestId('backup-status')).toContainText(/Download started/i);
    await expect(page.getByTestId('backup-status')).toContainText(/check/i);
    await expect(lastStarted(page)).toContainText(/started/i);

    await page.reload();
    await page.waitForSelector('[data-testid="app-ready"]', { state: 'attached' });
    await page.getByTestId('backup-menu-button').click();
    await expect(lastStarted(page)).toContainText(/Last backup download started/i);
    await expect(lastStarted(page)).not.toContainText(/No backup download/i);
  });

  test('a value that cannot be represented fails before download, naming it, and keeps the old timestamp', async ({ page }) => {
    await openApp(page);
    await downloadBackup(page);
    const before = await lastStarted(page).textContent();
    const ws = fieldCompleteWorkspace();
    ws.decisions[1].context = 'y'.repeat(40000);
    await writeStored(page, ws);
    await page.reload();
    await page.waitForSelector('[data-testid="app-ready"]', { state: 'attached' });

    let downloaded = false;
    page.on('download', () => { downloaded = true; });
    await page.getByTestId('backup-menu-button').click();
    await page.getByTestId('backup-download').click();

    await expect(page.getByTestId('backup-status')).toHaveAttribute('data-outcome', 'failed');
    await expect(page.getByTestId('backup-status')).toContainText('dec-2');
    await expect(page.getByTestId('backup-status')).toContainText('context');
    await expect(lastStarted(page)).toHaveText(before!);
    expect(downloaded).toBe(false);
  });

  test('a download that cannot be started claims nothing and keeps the old timestamp', async ({ page }) => {
    await openApp(page);
    await downloadBackup(page);
    const before = await lastStarted(page).textContent();
    await setFaults(page, { failDownload: true });

    await page.getByTestId('backup-download').click();

    await expect(page.getByTestId('backup-status')).toHaveAttribute('data-outcome', 'failed');
    await expect(page.getByTestId('backup-status')).not.toContainText(/Download started/i);
    await expect(lastStarted(page)).toHaveText(before!);
  });

  test('a started download whose time cannot be remembered says exactly that', async ({ page }) => {
    await openApp(page);
    await setFaults(page, { failTimestampWrite: true });
    await page.getByTestId('backup-menu-button').click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('backup-download').click()]);
    expect(download).toBeTruthy();

    await expect(page.getByTestId('backup-status')).toHaveAttribute('data-outcome', 'started-unrecorded');
    await expect(page.getByTestId('backup-status')).toContainText(/Download started, but its time could not be remembered/i);
    await expect(lastStarted(page)).toContainText(/No backup download/i);
  });

  test('an unreadable stored timestamp shows no invented time', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => localStorage.setItem('selara-last-backup-started', 'not a date'));
    await page.reload();
    await page.waitForSelector('[data-testid="app-ready"]', { state: 'attached' });
    await page.getByTestId('backup-menu-button').click();
    await expect(lastStarted(page)).toContainText(/No backup download/i);
    await expect(page.getByTestId('backup-download')).toBeEnabled();
  });

  test('a failed pending save blocks backup, keeping the unsaved change on screen (X02)', async ({ page }) => {
    await openApp(page);
    await setFaults(page, { idbAbortAfterPuts: 0, idbAbortRepeat: true });
    const toggle = page.getByTestId('toggle-conflicts');
    const was = await toggle.getAttribute('data-active');
    await makeOrdinaryEdit(page);
    await expect(page.getByTestId('db-error-banner')).toBeVisible();

    let downloaded = false;
    page.on('download', () => { downloaded = true; });
    await page.getByTestId('backup-menu-button').click();
    await page.getByTestId('backup-download').click();

    await expect(page.getByTestId('backup-status')).toHaveAttribute('data-outcome', 'failed');
    await expect(page.getByTestId('backup-status')).toContainText(/haven't been saved/i);
    expect(downloaded).toBe(false);
    await expect(toggle).not.toHaveAttribute('data-active', was!);

    // The same failed save blocks a replacement preview.
    await page.getByTestId('backup-restore-input').setInputFiles({
      name: 'bank-backup.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(createBackup(fieldCompleteWorkspace()).bytes),
    });
    await expect(page.getByTestId('backup-restore-error')).toContainText(/haven't been saved/i);
    await expect(replacementModal(page)).toHaveCount(0);
    await expect(toggle).not.toHaveAttribute('data-active', was!);
  });
});
