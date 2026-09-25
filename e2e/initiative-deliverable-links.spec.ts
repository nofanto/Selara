import { test, expect, type Page } from '@playwright/test';
import { seedReportRecords } from './report-fixtures';

/**
 * User Story 26 — which deliverables an initiative drives, shown on the Visualiser.
 *
 * Seeded rather than demo-based on purpose: of the demo's 48 initiatives none links to more
 * than one deliverable or crosses assets, so a demo-based test of this feature passes
 * vacuously (requirement-specs/initiative-deliverable-links.md, *Verification needs*).
 *
 * The fixture is the shape the feature exists for: `i-api` on the Payments asset drives the
 * Gateway there AND the Mobile App under a different asset in a different category, with two
 * implementations on the app. Dates are relative to the current year, as the demo's are, so
 * the fixture stays inside the timeline's 36-month window.
 */
const Y = new Date().getFullYear();
const d = (yearOffset: number, mmdd: string) => `${Y + yearOffset}-${mmdd}`;

const fixture = {
  assetCategories: [
    { id: 'cat-core', name: 'Core Systems' },
    { id: 'cat-channel', name: 'Channels' },
  ],
  assets: [
    { id: 'a-pay', name: 'Payments', categoryId: 'cat-core', maturity: 1 },
    { id: 'a-other', name: 'Back Office', categoryId: 'cat-core', maturity: 1 },
    // Twenty-five empty rows ahead of Mobile, inside its own category. The timeline fits all
    // 36 months across the viewport, so nothing is ever off screen sideways; these push the
    // Mobile App below the fold so the AC2 jump has something to scroll to. They sit in the
    // same category because category order is not reliable for categories with no saved
    // position, whereas assets within a category keep the store's key order — and the AC2
    // guard fails loudly if Mobile is ever on screen at load anyway.
    ...Array.from({ length: 25 }, (_, n) => ({
      id: `a-0-filler-${String(n).padStart(2, '0')}`, name: `Kiosk ${n + 1}`, categoryId: 'cat-channel', maturity: 1,
    })),
    { id: 'a-mob', name: 'Mobile', categoryId: 'cat-channel', maturity: 1 },
  ],
  programmes: [{ id: 'p1', name: 'Digital', color: 'bg-blue-500' }],
  deliverables: [
    { id: 'd-gw', assetId: 'a-pay', name: 'Gateway', type: 'application' },
    { id: 'd-app', assetId: 'a-mob', name: 'Mobile App', type: 'application' },
    { id: 'd-other', assetId: 'a-other', name: 'Ledger Tool', type: 'application' },
  ],
  initiatives: [
    { id: 'i-api', name: 'Open API', programmeId: 'p1', assetId: 'a-pay', startDate: d(0, '01-01'), endDate: d(0, '06-30'), capex: 0, opex: 0 },
    { id: 'i-sibling', name: 'API Hardening', programmeId: 'p1', assetId: 'a-pay', startDate: d(0, '07-01'), endDate: d(0, '12-31'), capex: 0, opex: 0 },
    { id: 'i-idle', name: 'Idle Study', programmeId: 'p1', assetId: 'a-other', startDate: d(0, '02-01'), endDate: d(0, '08-31'), capex: 0, opex: 0 },
    { id: 'i-other', name: 'Ledger Refresh', programmeId: 'p1', assetId: 'a-other', startDate: d(0, '03-01'), endDate: d(0, '09-30'), capex: 0, opex: 0 },
  ],
  // i-api and i-sibling are linked by a dependency, which is what makes them a group.
  dependencies: [{ id: 'dep-1', sourceId: 'i-api', targetId: 'i-sibling', type: 'blocks' }],
  deliverableSegments: [
    { id: 's-gw', deliverableId: 'd-gw', initiativeId: 'i-api', status: 'appstatus-in-production', startDate: d(0, '03-01'), endDate: d(1, '12-31') },
    // The earliest Mobile App segment — the AC2 jump target.
    { id: 's-app-1', deliverableId: 'd-app', initiativeId: 'i-api', status: 'appstatus-in-production', startDate: d(2, '06-01'), endDate: d(2, '12-31') },
    { id: 's-app-2', deliverableId: 'd-app', initiativeId: 'i-api', status: 'appstatus-in-production', startDate: d(2, '09-01'), endDate: d(2, '12-31') },
    { id: 's-other', deliverableId: 'd-other', initiativeId: 'i-other', status: 'appstatus-in-production', startDate: d(0, '02-01'), endDate: d(0, '12-31') },
    { id: 's-loose', deliverableId: 'd-other', status: 'appstatus-in-production', startDate: d(0, '06-01'), endDate: d(1, '06-30') },
  ],
  milestones: [],
  strategies: [],
};

const STORES = ['assetCategories', 'assets', 'programmes', 'deliverables', 'initiatives', 'dependencies', 'deliverableSegments', 'milestones', 'strategies'];

async function seed(page: Page) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 10000 });
  await page.evaluate(() => sessionStorage.removeItem('scenia_collapsed_categories'));
  await seedReportRecords(page, fixture, STORES);
  await expect(page.getByTestId('initiative-bar-i-api')).toBeAttached();
}

/** The timeline's settings are keyed, which seedReportRecords cannot write. */
async function patchSettings(page: Page, patch: Record<string, unknown>) {
  await page.evaluate(patch => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('it-initiative-visualiser');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const store = db.transaction('settings', 'readwrite').objectStore('settings');
      const get = store.get('timelineSettings');
      get.onsuccess = () => {
        store.put({ ...(get.result ?? {}), ...patch }, 'timelineSettings');
        store.transaction.oncomplete = () => { db.close(); resolve(); };
      };
    };
  }), patch);
  await page.reload();
}

const bar = (page: Page, id: string) => page.locator(`[data-initiative-id="${id}"]`).first();
const seg = (page: Page, id: string) => page.getByTestId(`segment-bar-${id}`);

async function expectHighlightOfOpenApi(page: Page) {
  await expect(bar(page, 'i-api')).toHaveAttribute('data-link', 'highlighted');
  for (const id of ['s-gw', 's-app-1', 's-app-2']) await expect(seg(page, id)).toHaveAttribute('data-link', 'highlighted');
  for (const id of ['i-idle', 'i-other', 'i-sibling']) await expect(bar(page, id)).toHaveAttribute('data-link', 'dimmed');
  for (const id of ['s-other', 's-loose']) await expect(seg(page, id)).toHaveAttribute('data-link', 'dimmed');
}

async function expectNothingDimmed(page: Page) {
  await expect(page.locator('[data-link]')).toHaveCount(0);
}

test.describe('Initiative–deliverable links (User Story 26)', () => {
  test.beforeEach(async ({ page }) => { await seed(page); });

  test('AC1 — the badge counts distinct deliverables, and is absent with none', async ({ page }) => {
    // Three implementations over two applications: 2, not 3.
    await expect(page.getByTestId('initiative-link-badge-i-api')).toHaveText(/2/);
    await expect(page.getByTestId('initiative-link-badge-i-other')).toHaveText(/1/);
    await expect(page.getByTestId('initiative-link-badge-i-idle')).toHaveCount(0);
  });

  test('AC1 — the badge still appears grouped by programme', async ({ page }) => {
    await patchSettings(page, { groupBy: 'programme' });
    await expect(page.getByTestId('initiative-link-badge-i-api')).toHaveText(/2/);
  });

  test('AC2 — the list names each deliverable with its asset, and the jump scrolls to its earliest segment', async ({ page }) => {
    // Guard: the jump target must start off screen, or this passes without scrolling anything.
    await expect(seg(page, 's-app-1')).not.toBeInViewport();

    await page.getByTestId('initiative-link-badge-i-api').click();
    const list = page.getByTestId('initiative-link-list');
    await expect(list).toBeVisible();
    await expect(list.getByTestId(/^initiative-link-item-/)).toHaveText([/Gateway.*Payments/, /Mobile App.*Mobile/]);

    await list.getByTestId('initiative-link-item-d-app').click();
    await expect(seg(page, 's-app-1')).toBeInViewport();
    await expectHighlightOfOpenApi(page);
  });

  test('AC2 — Escape closes the list', async ({ page }) => {
    await page.getByTestId('initiative-link-badge-i-api').click();
    await expect(page.getByTestId('initiative-link-list')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('initiative-link-list')).toHaveCount(0);
  });

  test('AC3 — selecting an initiative highlights it and every one of its segments, and dims the rest', async ({ page }) => {
    await expectNothingDimmed(page);
    await bar(page, 'i-api').click();
    await expectHighlightOfOpenApi(page);
  });

  test('AC3 — an initiative with no segments dims nothing', async ({ page }) => {
    await bar(page, 'i-idle').click();
    await expect(bar(page, 'i-idle')).toHaveAttribute('data-selected', 'true');
    await expectNothingDimmed(page);
  });

  test('AC4 — selecting a segment gives the same highlight as its initiative', async ({ page }) => {
    await seg(page, 's-gw').click();
    await expectHighlightOfOpenApi(page);
    await expect(seg(page, 's-gw')).toHaveAttribute('data-selected', 'true');
  });

  test('AC4 — a segment with no initiative dims nothing', async ({ page }) => {
    await seg(page, 's-loose').click();
    await expect(seg(page, 's-loose')).toHaveAttribute('data-selected', 'true');
    await expectNothingDimmed(page);
  });

  test('AC4 — the most recent selection decides the highlight', async ({ page }) => {
    await bar(page, 'i-other').click();
    await expect(bar(page, 'i-other')).toHaveAttribute('data-link', 'highlighted');
    await seg(page, 's-gw').click();
    await expectHighlightOfOpenApi(page);
  });

  test('AC5 — a collapsed category hiding a segment opens and is marked, then closes, and the saved state never changes', async ({ page }) => {
    await page.getByTestId('category-row-cat-channel').getByRole('button', { name: /Channels/ }).click();
    await expect(seg(page, 's-app-1')).toHaveCount(0);
    const saved = () => page.evaluate(() => sessionStorage.getItem('scenia_collapsed_categories'));
    expect(await saved()).toContain('cat-channel');

    await bar(page, 'i-api').click();
    await expect(seg(page, 's-app-1')).toHaveAttribute('data-link', 'highlighted');
    await expect(page.getByTestId('category-revealed-cat-channel')).toBeVisible();
    expect(await saved(), 'revealing must not write the saved collapse state').toContain('cat-channel');

    await page.keyboard.press('Escape');
    await expect(seg(page, 's-app-1')).toHaveCount(0);
    await expect(page.getByTestId('category-revealed-cat-channel')).toHaveCount(0);
    expect(await saved()).toContain('cat-channel');
  });

  test('AC5 — a collapsed category hiding the initiative itself opens too', async ({ page }) => {
    await page.getByTestId('category-row-cat-core').getByRole('button', { name: /Core Systems/ }).click();
    await expect(page.getByTestId('initiative-bar-i-api')).toHaveCount(0);
    // Reach the initiative from its other end, under Channels, which stays open.
    await seg(page, 's-app-1').click();
    await expect(bar(page, 'i-api')).toHaveAttribute('data-link', 'highlighted');
    await expect(page.getByTestId('category-revealed-cat-core')).toBeVisible();
  });

  test('AC5 — a collapsed group bar hiding the focused initiative opens, then closes, and the saved setting never changes', async ({ page }) => {
    await patchSettings(page, { collapsedGroups: ['i-api|i-sibling'] });
    await expect(page.getByTestId('project-group-bar')).toBeVisible();
    await expect(page.getByTestId('initiative-bar-i-api')).toHaveCount(0);

    await seg(page, 's-gw').click();
    await expect(page.getByTestId('initiative-bar-i-api')).toHaveAttribute('data-link', 'highlighted');

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('initiative-bar-i-api')).toHaveCount(0);
    const collapsed = await page.evaluate(() => new Promise<unknown>(resolve => {
      const r = indexedDB.open('it-initiative-visualiser');
      r.onsuccess = () => {
        const g = r.result.transaction('settings').objectStore('settings').get('timelineSettings');
        g.onsuccess = () => { r.result.close(); resolve(g.result?.collapsedGroups); };
      };
    }));
    expect(collapsed, 'revealing must not write the saved group setting').toEqual(['i-api|i-sibling']);
  });

  test('AC6 — Escape and a click on the empty timeline both end the highlight', async ({ page }) => {
    await bar(page, 'i-api').click();
    await expectHighlightOfOpenApi(page);
    await page.keyboard.press('Escape');
    await expectNothingDimmed(page);

    await bar(page, 'i-api').click();
    await expectHighlightOfOpenApi(page);
    // An empty stretch of a row: asset-row-content has no click handler of its own, so the
    // click reaches the timeline root, which is what clears selection today.
    // Centred first: the sticky period header covers a row's top edge and the legend its
    // bottom-right corner. a-other's own bars end by September of the first year — about a
    // quarter of the 36-month width — so the middle of the row is empty.
    const row = page.getByTestId(`asset-row-a-other`).getByTestId('asset-row-content');
    await row.evaluate(el => el.scrollIntoView({ block: 'center' }));
    const box = await row.boundingBox();
    await row.click({ position: { x: (box?.width ?? 800) * 0.55, y: (box?.height ?? 40) / 2 } });
    await expectNothingDimmed(page);
  });

  test('AC7 — grouped by programme, selection dims nothing', async ({ page }) => {
    await patchSettings(page, { groupBy: 'programme' });
    await bar(page, 'i-api').click();
    await expect(bar(page, 'i-api')).toHaveAttribute('data-selected', 'true');
    await expectNothingDimmed(page);
  });

  test('AC7 — with display "initiatives", selection dims nothing', async ({ page }) => {
    await patchSettings(page, { display: 'initiatives' });
    await bar(page, 'i-api').click();
    await expect(bar(page, 'i-api')).toHaveAttribute('data-selected', 'true');
    await expectNothingDimmed(page);
  });
});

