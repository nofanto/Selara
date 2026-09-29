import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as XLSX from 'xlsx';
import type { PortableWorkspace } from '../src/lib/workspaceBackup';

/**
 * Shared plumbing for the workspace-recovery suites (specs/005-workspace-recovery).
 *
 * The database is read raw — straight from IndexedDB, not from React state — so
 * "nothing changed" and "everything survived" are claims about what is stored,
 * which is what reload and a fresh profile depend on.
 */

export const DB_NAME = 'it-initiative-visualiser';
const ENTITY_STORES = [
  'assets', 'deliverables', 'deliverableSegments', 'deliverableStatuses', 'decisions', 'rptiDetails', 'lkptiDetails',
  'initiatives', 'milestones', 'programmes', 'strategies', 'dependencies', 'assetCategories', 'resources',
] as const;

export type StoredWorkspace = Omit<PortableWorkspace, 'timelineSettings'> & { timelineSettings: PortableWorkspace['timelineSettings'] | undefined };

/** Every store, settings and History, read in one transaction. */
export async function readStored(page: Page): Promise<StoredWorkspace> {
  return page.evaluate(async ({ name, stores }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(name);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction([...stores, 'settings', 'versions'], 'readonly');
    const get = <T>(req: IDBRequest<T>) => new Promise<T>((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    const out: Record<string, unknown> = {};
    for (const store of stores) out[store] = await get(tx.objectStore(store).getAll());
    out.timelineSettings = await get(tx.objectStore('settings').get('timelineSettings'));
    out.versions = await get(tx.objectStore('versions').getAll());
    db.close();
    return out;
  }, { name: DB_NAME, stores: [...ENTITY_STORES] }) as Promise<StoredWorkspace>;
}

/**
 * Writes a workspace straight into IndexedDB — as another tab, or a previous
 * session, would have left it. Does not broadcast: the app only learns of it by
 * reading the database.
 */
export async function writeStored(page: Page, ws: Partial<StoredWorkspace>) {
  await page.evaluate(async ({ name, stores, ws }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(name);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const tx = db.transaction([...stores, 'settings', 'versions'], 'readwrite');
    const data = ws as Record<string, unknown>;
    for (const store of stores) {
      if (!(store in data)) continue;
      tx.objectStore(store).clear();
      for (const item of data[store] as object[]) tx.objectStore(store).put(item);
    }
    if ('timelineSettings' in data) {
      tx.objectStore('settings').clear();
      if (data.timelineSettings) tx.objectStore('settings').put(data.timelineSettings, 'timelineSettings');
    }
    if ('versions' in data) {
      tx.objectStore('versions').clear();
      for (const v of data.versions as object[]) tx.objectStore('versions').put(v);
    }
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
    db.close();
  }, { name: DB_NAME, stores: [...ENTITY_STORES], ws });
}

/**
 * Fault injection, installed before the app loads. `window.__selaraFaults`:
 * - `idbAbortAfterPuts: n` — the next readwrite transaction aborts after n puts
 *   are queued (a quota failure part-way through a write); cleared after firing
 *   unless `idbAbortRepeat` is true.
 * - `failDownload` — creating the download's object URL throws.
 * - `failTimestampWrite` — storing the backup timestamp throws.
 */
export async function installFaultHooks(page: Page) {
  await page.addInitScript(() => {
    type Faults = { idbAbortAfterPuts?: number; idbAbortRepeat?: boolean; failDownload?: boolean; failTimestampWrite?: boolean };
    const w = window as unknown as { __selaraFaults: Faults };
    w.__selaraFaults = {};
    const seen = new WeakMap<IDBTransaction, number>();
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
      const limit = w.__selaraFaults.idbAbortAfterPuts;
      const request = originalPut.apply(this, args);
      if (limit !== undefined && this.transaction.mode === 'readwrite') {
        const count = (seen.get(this.transaction) ?? 0) + 1;
        seen.set(this.transaction, count);
        if (count > limit) {
          if (!w.__selaraFaults.idbAbortRepeat) delete w.__selaraFaults.idbAbortAfterPuts;
          try { this.transaction.abort(); } catch { /* already aborting */ }
        }
      }
      return request;
    };
    const originalCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (obj: Blob | MediaSource) => {
      if (w.__selaraFaults.failDownload) throw new Error('Injected download failure');
      return originalCreate(obj);
    };
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
      if (w.__selaraFaults.failTimestampWrite && key === 'selara-last-backup-started') throw new Error('Injected storage failure');
      return originalSetItem.call(this, key, value);
    };
  });
}

export const setFaults = (page: Page, faults: Record<string, unknown>) =>
  page.evaluate(f => { (window as unknown as { __selaraFaults: Record<string, unknown> }).__selaraFaults = f; }, faults);

/** A context that looks like a first visit: no E2E seeding, landing page already dismissed. */
export async function freshProfile(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    storageState: { cookies: [], origins: [{ origin: 'http://localhost:3000', localStorage: [{ name: 'scenia_has_seen_landing', value: 'true' }] }] },
  });
}

export async function openApp(page: Page) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
}

/** Replace the stored workspace, then reload so the app starts from it. */
export async function openWithWorkspace(page: Page, ws: Partial<StoredWorkspace>) {
  await openApp(page);
  await writeStored(page, ws);
  await page.reload();
  await page.waitForSelector('[data-testid="app-ready"]', { state: 'attached', timeout: 20000 });
}

export async function downloadBackup(page: Page): Promise<string> {
  if (!(await page.getByTestId('backup-panel').isVisible())) await page.getByTestId('backup-menu-button').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('backup-download').click()]);
  const path = join(mkdtempSync(join(tmpdir(), 'selara-backup-')), download.suggestedFilename());
  await download.saveAs(path);
  await expect(page.getByTestId('backup-status')).toHaveAttribute('data-outcome', 'started');
  return path;
}

export async function chooseRestoreFile(page: Page, file: string | { name: string; mimeType: string; buffer: Buffer }) {
  const picker = page.getByTestId('template-restore-backup-input');
  if (await picker.count()) {
    await picker.setInputFiles(file);
    return;
  }
  if (!(await page.getByTestId('backup-panel').isVisible())) await page.getByTestId('backup-menu-button').click();
  await page.getByTestId('backup-restore-input').setInputFiles(file);
}

export const xlsxFile = (wb: XLSX.WorkBook, name = 'file.xlsx') => ({
  name,
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer,
});

/** A small, valid ordinary export — what Open shared and Import receive from a colleague. */
export function colleagueWorkbook(assetName = 'Shared Core Ledger') {
  const wb = XLSX.utils.book_new();
  const sheet = (rows: object[], name: string) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
  sheet([{ id: 'cat-shared', name: 'Shared Category' }], 'AssetCategories');
  sheet([{ id: 'a-shared', name: assetName, categoryId: 'cat-shared' }], 'Assets');
  sheet([{ id: 'prog-shared', name: 'Shared Programme', color: '#6366f1' }], 'Programmes');
  sheet([{
    id: 'i-shared', name: 'Shared Initiative', programmeId: 'prog-shared', assetId: 'a-shared',
    startDate: '2027-01-01', endDate: '2027-06-30', capex: 1000, opex: 0,
  }], 'Initiatives');
  return xlsxFile(wb, 'colleague-plan.xlsx');
}

export async function saveVersionViaUi(page: Page, name: string) {
  await page.getByTestId('nav-history').click();
  await page.getByRole('button', { name: 'Save Current State' }).click();
  await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', name);
  await page.getByRole('button', { name: 'Save Version' }).click();
  await expect(page.locator('h4', { hasText: name })).toBeVisible();
  await page.getByTestId('nav-visualiser').click();
}

/** Toggles a persisted timeline setting — the smallest ordinary edit that saves the workspace. */
export async function makeOrdinaryEdit(page: Page) {
  await page.getByTestId('nav-visualiser').click();
  await page.getByTestId('toggle-conflicts').click();
}

export const replacementModal = (page: Page) => page.getByTestId('confirm-modal');
export const incomingCount = (page: Page, key: string) => page.getByTestId(`replacement-count-${key}`).getByTestId('replacement-incoming');
export const currentCount = (page: Page, key: string) => page.getByTestId(`replacement-count-${key}`).getByTestId('replacement-current');
