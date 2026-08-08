import { test, expect } from '@playwright/test';

/**
 * US-30: Unified Deliverable Segment Model
 *
 * All DeliverableSegment records link via a Deliverable record (deliverableId)
 * rather than directly to an asset (assetId). After unification:
 *  - GEANZ demo data: gz-* assets have Deliverable records visible in Data Manager
 */

test.describe('US-30: Unified segment model — GEANZ Deliverable records', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-deliverables').click();
  });

  test('GEANZ template: gz-* assets have Deliverable records in Data Manager', async ({ page }) => {
    const rows = page.locator('[data-testid="data-manager"] tbody tr:not(.ghost-row)');
    const count = await rows.count();

    // GEANZ demo data: 8 original records (a-ciam, a-web, a-mobile apps) +
    // 9 new gz-* Deliverable records = 17 total
    expect(count).toBeGreaterThanOrEqual(17);
  });

  test('GEANZ template: Deliverable record exists for Financial Management Information System', async ({ page }) => {
    const match = page.locator('[data-testid="data-manager"] tbody').getByText('Financial Management Information System', { exact: false });
    expect(await match.count()).toBeGreaterThan(0);
  });

  test('GEANZ template: Deliverable record exists for API Management', async ({ page }) => {
    const match = page.locator('[data-testid="data-manager"] tbody').getByText('API Management', { exact: false });
    expect(await match.count()).toBeGreaterThan(0);
  });
});
