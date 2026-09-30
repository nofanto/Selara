import { test, expect, Page } from '@playwright/test';
import { seedReportRecords, readStore } from './report-fixtures';

// User story 29: Data Manager stays usable at bank scale (#36). Onboarding creates one
// asset per application, so every row's Asset <select> used to list every asset —
// rows × assets <option> elements. These assertions count DOM nodes rather than time
// anything, so they hold on a slow CI runner.
const N = 150;
const pad = (i: number) => String(i).padStart(3, '0');

const scaleWorkspace = {
  assetCategories: [{ id: 'scale-category', name: 'Scale Category' }],
  assets: Array.from({ length: N }, (_, i) => ({ id: `scale-asset-${pad(i)}`, name: `Scale Asset ${pad(i)}`, categoryId: 'scale-category' })),
  programmes: [{ id: 'scale-programme', name: 'Scale Programme', color: 'bg-blue-500' }],
  deliverables: [
    ...Array.from({ length: N }, (_, i) => ({ id: `scale-deliverable-${pad(i)}`, assetId: `scale-asset-${pad(i)}`, name: `Scale Application ${pad(i)}`, type: 'application' })),
    { id: 'scale-deliverable-dangling', assetId: 'scale-asset-deleted', name: 'Scale Orphan Application', type: 'application' },
  ],
  initiatives: Array.from({ length: N }, (_, i) => ({ id: `scale-initiative-${pad(i)}`, name: `Scale Initiative ${pad(i)}`,
    programmeId: 'scale-programme', assetId: `scale-asset-${pad(i)}`, startDate: '2026-01-01', endDate: '2026-12-31', capex: 0, opex: 0 })),
};

const assetSelect = (page: Page, rowId: string) =>
  page.locator(`tbody tr[data-id="${rowId}"] td[data-key="assetId"] select`);

async function openTab(page: Page, tab: 'deliverables' | 'initiatives', rows: number) {
  await page.getByTestId('nav-data-manager').click();
  await page.getByTestId(`data-manager-tab-${tab}`).click();
  await expect(page.locator('tbody tr[data-real="true"]')).toHaveCount(rows);
}

test.describe('Data Manager at bank scale', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for first-run loading to finish, or its demo-data save can land after the
    // seed and overwrite it.
    await page.getByTestId('nav-data-manager').click();
    await expect(page.getByTestId('data-manager')).toBeVisible();
    await seedReportRecords(page, scaleWorkspace,
      ['assetCategories', 'assets', 'programmes', 'deliverables', 'deliverableSegments', 'initiatives', 'dependencies', 'milestones', 'rptiDetails', 'lkptiDetails']);
  });

  for (const [tab, rows] of [['deliverables', N + 1], ['initiatives', N]] as const) {
    test(`${tab}: Asset column renders at most two options per row until opened`, async ({ page }) => {
      await openTab(page, tab, rows);
      const options = await page.locator('tbody tr[data-real="true"] td[data-key="assetId"] option').count();
      expect(options, `${rows} rows × ${N + 1} options would be quadratic`).toBeLessThanOrEqual(2 * rows);

      const select = assetSelect(page, `scale-${tab === 'deliverables' ? 'deliverable' : 'initiative'}-007`);
      await expect(select).toHaveValue('scale-asset-007');
      await expect(select.locator('option:checked')).toHaveText('Scale Asset 007');
      await expect(select.locator('xpath=ancestor::td[1]')).toHaveAttribute('title', 'Scale Asset 007');
    });
  }

  test('opening a dropdown by mouse offers every asset, and the choice persists', async ({ page }) => {
    await openTab(page, 'deliverables', N + 1);
    const select = assetSelect(page, 'scale-deliverable-003');
    // The native dropdown opens as the default action of mousedown, which runs after
    // every listener. A window-level listener runs after React's root listener, so
    // what it sees is what the dropdown opens with — it must already be the full list.
    await page.evaluate(() => window.addEventListener('mousedown', (e) => {
      (window as unknown as { optionsAtMousedown: number }).optionsAtMousedown = (e.target as HTMLSelectElement).options.length;
    }, { once: true }));
    await select.click();
    expect(await page.evaluate(() => (window as unknown as { optionsAtMousedown: number }).optionsAtMousedown)).toBe(N + 1);
    await expect(select.locator('option')).toHaveCount(N + 1); // placeholder + every asset
    // Opening the native dropdown must not blur the select, or it would collapse
    // underneath the open list.
    await expect(select).toBeFocused();
    await select.selectOption({ label: 'Scale Asset 120' });
    await expect(select).toHaveValue('scale-asset-120');

    // Leaving the cell collapses it again, keeping the new choice.
    await select.press('Tab');
    await expect(select.locator('option')).toHaveCount(2);
    await expect(select.locator('option:checked')).toHaveText('Scale Asset 120');

    await expect.poll(async () => (await readStore(page, 'deliverables'))
      .find(d => d.id === 'scale-deliverable-003')?.assetId).toBe('scale-asset-120');
    await page.reload();
    await openTab(page, 'deliverables', N + 1);
    await expect(assetSelect(page, 'scale-deliverable-003')).toHaveValue('scale-asset-120');
  });

  test('keyboard focus also offers every asset', async ({ page }) => {
    await openTab(page, 'initiatives', N);
    const select = assetSelect(page, 'scale-initiative-010');
    await select.focus();
    await expect(select.locator('option')).toHaveCount(N + 1);
    await expect(select).toHaveValue('scale-asset-010');
  });

  // Review of #71: an expanded select that never collapsed let a keyboard user tabbing
  // down the column rebuild rows × assets options one row at a time.
  test('a select collapses when focus leaves it, so walking a column stays bounded', async ({ page }) => {
    await openTab(page, 'initiatives', N);
    const walked = 12;
    const allOptions = page.locator('tbody tr[data-real="true"] td[data-key="assetId"] option');
    for (let i = 0; i < walked; i++) {
      const select = assetSelect(page, `scale-initiative-${pad(i)}`);
      await select.focus();
      await expect(select.locator('option')).toHaveCount(N + 1);
      // Only the focused select may hold the full list.
      expect(await allOptions.count()).toBeLessThanOrEqual(2 * (N - 1) + N + 1);
    }

    await page.getByTestId('search-input').focus();
    expect(await allOptions.count(), 'nothing is focused in the table, so nothing stays expanded').toBeLessThanOrEqual(2 * N);

    const first = assetSelect(page, 'scale-initiative-000');
    await expect(first.locator('option')).toHaveCount(2);
    await expect(first).toHaveValue('scale-asset-000');
    await expect(first.locator('option:checked')).toHaveText('Scale Asset 000');
    await expect(first.locator('xpath=ancestor::td[1]')).toHaveAttribute('title', 'Scale Asset 000');
  });

  test('a deleted asset shows the placeholder, and small fixed lists stay complete', async ({ page }) => {
    await openTab(page, 'deliverables', N + 1);
    const orphan = assetSelect(page, 'scale-deliverable-dangling');
    await expect(orphan).toHaveValue('');
    await expect(orphan.locator('option:checked')).toHaveText('Select...');

    // Type is a five-value enumeration: it does not grow with the workspace, so it
    // keeps rendering every option up front.
    const type = page.locator('tbody tr[data-id="scale-deliverable-003"] td[data-key="type"] select');
    await expect(type.locator('option')).toHaveCount(6);
  });
});
