import { test, expect, type Page } from '@playwright/test';

/**
 * ADR-0016: a v19 database can be missing a store the atomic workspace read/write
 * needs (a database that reached v19 without passing the upgrade step that creates
 * it). The v20 upgrade creates every missing store and leaves every existing store
 * and record as it was. Seeds from a static page on the same origin, where the app
 * is not running (see unresolved-row-repair.spec.ts).
 */

const DB_NAME = 'it-initiative-visualiser';
const STATIC_PAGE = '/features/adding-applications.png';
const KEYED_STORES = [
  'assets', 'initiatives', 'milestones', 'programmes', 'strategies', 'dependencies', 'assetCategories', 'versions',
  'resources', 'deliverables', 'deliverableSegments', 'deliverableStatuses', 'decisions', 'rptiDetails', 'lkptiDetails',
];
/** Orphaned since ADR-0004; an existing store the repair must leave alone. */
const ORPHAN = { store: 'dtsPhases', record: { id: 'phase-1', name: 'Phase 1' } };

type Stores = Record<string, unknown[]>;
interface Seed { stores: Stores; settings: unknown }

/** The app's own template workspace, read raw once it is stored, plus one saved Version. */
async function realWorkspace(page: Page): Promise<Seed> {
  await page.goto('/');
  await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
  await page.goto(STATIC_PAGE);
  const { stores, settings } = await readDatabase(page);
  delete stores[ORPHAN.store];
  // Distinguishable from the built-in template the app falls back to when a load fails.
  stores.initiatives = stores.initiatives.map((r, i) => (i === 0 ? { ...(r as object), name: 'Seeded initiative' } : r));
  const data = Object.fromEntries(KEYED_STORES.filter(s => s !== 'versions').map(s => [s, stores[s] ?? []]));
  stores.versions = [{ id: 'ver-seed', name: 'Seeded snapshot', timestamp: '2026-09-01T00:00:00.000Z', data: { ...data, timelineSettings: settings } }];
  return { stores, settings };
}

async function readDatabase(page: Page): Promise<{ version: number; keyPaths: Record<string, unknown>; stores: Stores; settings: unknown }> {
  return page.evaluate(name => new Promise((resolve, reject) => {
    const req = indexedDB.open(name);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const names = [...db.objectStoreNames];
      const tx = db.transaction(names, 'readonly');
      const keyPaths: Record<string, unknown> = {};
      const stores: Record<string, unknown[]> = {};
      let settings: unknown;
      for (const s of names) {
        const store = tx.objectStore(s);
        keyPaths[s] = store.keyPath;
        if (s === 'settings') store.get('timelineSettings').onsuccess = e => { settings = (e.target as IDBRequest).result; };
        else store.getAll().onsuccess = e => { stores[s] = (e.target as IDBRequest).result; };
      }
      tx.oncomplete = () => { const version = db.version; db.close(); resolve({ version, keyPaths, stores, settings }); };
      tx.onerror = () => reject(tx.error);
    };
  }), DB_NAME);
}

/** Recreates the database at v19 with only the given stores, holding `seed`'s records. */
async function seedV19(page: Page, seed: Seed, missing: string[]) {
  await page.goto(STATIC_PAGE);
  await page.evaluate(async ({ name, seed, missing, keyed, orphan }) => {
    await new Promise<void>((resolve, reject) => {
      const del = indexedDB.deleteDatabase(name);
      del.onsuccess = () => resolve();
      del.onerror = () => reject(del.error);
      del.onblocked = () => reject(new Error('deleteDatabase blocked'));
    });
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(name, 19);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of keyed) if (!missing.includes(s)) db.createObjectStore(s, { keyPath: 'id' });
        if (!missing.includes('settings')) db.createObjectStore('settings');
        db.createObjectStore(orphan.store, { keyPath: 'id' });
      };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction([...db.objectStoreNames], 'readwrite');
        for (const s of keyed) if (!missing.includes(s)) for (const r of seed.stores[s] ?? []) tx.objectStore(s).put(r);
        if (!missing.includes('settings')) tx.objectStore('settings').put(seed.settings, 'timelineSettings');
        tx.objectStore(orphan.store).put(orphan.record);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, { name: DB_NAME, seed, missing, keyed: KEYED_STORES, orphan: ORPHAN });
}

const byId = (records: unknown[] = []) => [...records].sort((a, b) => String((a as { id: string }).id).localeCompare(String((b as { id: string }).id)));

async function expectUpgradedAndLoaded(page: Page, seed: Seed, missing: string[]) {
  const errors: string[] = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().split('\n')[0]); });

  await page.goto('/');
  await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
  await expect(page.getByText('Seeded initiative').first()).toBeVisible();
  expect(errors.filter(e => /Failed to (load|save) data/.test(e))).toEqual([]);
  await page.getByTestId('nav-history').click();
  await expect(page.getByText('Seeded snapshot')).toBeVisible();

  // Upgraded: every required store exists with its key path, and nothing was lost or rewritten.
  await page.goto(STATIC_PAGE);
  const stored = await readDatabase(page);
  expect(stored.version).toBe(20);
  for (const s of KEYED_STORES) expect(stored.keyPaths[s], s).toBe('id');
  expect(stored.keyPaths.settings).toBeNull();
  for (const s of KEYED_STORES) {
    if (missing.includes(s)) expect(stored.stores[s], s).toEqual([]);
    else expect(byId(stored.stores[s]), s).toEqual(byId(seed.stores[s]));
  }
  expect(stored.settings).toEqual(seed.settings);
  expect(stored.stores[ORPHAN.store]).toEqual([ORPHAN.record]);

  // A later save succeeds and survives a reload.
  await page.goto('/');
  await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
  await page.getByTestId('nav-data-manager').click();
  await page.getByTestId('data-manager').getByRole('button', { name: /Initiatives/ }).click();
  const nameCell = page.locator('tbody tr').first().locator('td').first().locator('input[type="text"]');
  await nameCell.fill('Renamed after upgrade');
  await nameCell.press('Tab');
  await expect(page.getByText(/Failed to save changes/)).toHaveCount(0);
  await page.reload();
  await page.getByTestId('nav-data-manager').click();
  await page.getByTestId('data-manager').getByRole('button', { name: /Initiatives/ }).click();
  await expect(nameCell).toHaveValue('Renamed after upgrade');
  await expect(page.getByText(/Failed to save changes/)).toHaveCount(0);

  expect(errors.filter(e => /Failed to (load|save) data/.test(e))).toEqual([]);
}

test.describe('IndexedDB schema repair (ADR-0016)', () => {
  test('a v19 database missing required stores is upgraded, keeps every record, loads and saves', async ({ page }) => {
    test.setTimeout(60000);
    const seed = await realWorkspace(page);
    const missing = ['decisions', 'lkptiDetails'];
    await seedV19(page, seed, missing);
    await expectUpgradedAndLoaded(page, seed, missing);
  });

  test('a complete v19 database is upgraded without changing any store or record', async ({ page }) => {
    test.setTimeout(60000);
    const seed = await realWorkspace(page);
    await seedV19(page, seed, []);
    await expectUpgradedAndLoaded(page, seed, []);
  });
});
