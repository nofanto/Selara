import { test, expect } from '@playwright/test';

/**
 * Regression coverage for sanitizeTimelineSettings() in App.tsx.
 *
 * DTS (NZ Digital Target State) was removed as a workspace feature, including
 * the 'dts-phase' groupBy render branch in Timeline.tsx. Timeline.tsx's
 * swimlane body is rendered by mutually exclusive groupBy branches with no
 * catch-all default, so any user or Version snapshot that still has
 * `groupBy: 'dts-phase'` persisted from before the removal would render a
 * completely blank timeline once the branch was deleted. sanitizeTimelineSettings()
 * coerces that stale value back to 'asset' wherever settings enter live state.
 */

async function setPersistedGroupBy(page: import('@playwright/test').Page, groupBy: string) {
  await page.evaluate((groupBy) => {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('it-initiative-visualiser');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('settings', 'readwrite');
        const store = tx.objectStore('settings');
        const getReq = store.get('timelineSettings');
        getReq.onsuccess = () => {
          const current = getReq.result || {};
          store.put({ ...current, groupBy }, 'timelineSettings');
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
  }, groupBy);
}

test.describe('Timeline settings sanitization — stale groupBy fallback', () => {
  test('normal load with a stale persisted groupBy value does not blank the timeline', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });

    // Simulate a pre-removal user whose settings still have the deleted
    // 'dts-phase' groupBy value persisted in IndexedDB.
    await setPersistedGroupBy(page, 'dts-phase');
    await page.reload();

    // The timeline must fall back to a working grouping (asset), not go blank.
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
    const rows = page.locator('[data-testid="asset-row-content"]');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('restoring a version snapshot with a stale groupBy value does not blank the timeline', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });

    // Restoring a version uses the Version object already loaded into React
    // state at page load (not a fresh IndexedDB read at restore time), so the
    // stale snapshot must be seeded into the 'versions' store *before* the
    // page loads — simulating a snapshot saved before DTS (and the
    // 'dts-phase' groupBy value) was removed.
    await page.evaluate(() => {
      return new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('it-initiative-visualiser');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('versions', 'readwrite');
          tx.objectStore('versions').put({
            id: 'ver-stale-groupby-test',
            name: 'Stale GroupBy Snapshot',
            timestamp: new Date().toISOString(),
            description: '',
            data: {
              assets: [{ id: 'asset-stale-test', name: 'Stale Test Asset', categoryId: 'cat-stale-test' }],
              applications: [],
              applicationSegments: [],
              initiatives: [],
              milestones: [],
              programmes: [],
              strategies: [],
              dependencies: [],
              assetCategories: [{ id: 'cat-stale-test', name: 'Stale Test Category', order: 0 }],
              timelineSettings: {
                startDate: '2026-01-01',
                monthsToShow: 12,
                budgetVisualisation: 'off',
                descriptionDisplay: 'off',
                emptyRowDisplay: 'show',
                snapToPeriod: 'off',
                conflictDetection: 'on',
                showRelationships: 'on',
                criticalPath: 'off',
                showResources: 'off',
                display: 'both',
                groupBy: 'dts-phase',
              },
              resources: [],
              applicationStatuses: [],
              decisions: [],
              rptiDetails: [],
            },
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      });
    });
    await page.reload();
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });

    await page.getByTestId('nav-history').click();
    await page.getByText('Stale GroupBy Snapshot').click();
    await page.getByRole('button', { name: 'Restore to Current' }).click();
    await page.getByTestId('confirm-modal-confirm').click();

    // Timeline must not go blank after restoring the corrupted snapshot.
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
    const rows = page.locator('[data-testid="asset-row-content"]');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);
  });
});
