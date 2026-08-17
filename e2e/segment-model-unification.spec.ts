import { test, expect } from '@playwright/test';

/**
 * US-30: Unified Deliverable Segment Model
 *
 * All DeliverableSegment records link via a Deliverable record (deliverableId)
 * rather than directly to an asset (assetId). After unification:
 *  - RPTI catalogue demo data: rc-* assets have Deliverable records visible in Data Manager
 */

test.describe('US-30: Unified segment model — RPTI catalogue Deliverable records', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-deliverables').click();
  });

  test('RPTI catalogue template: rc-* assets have Deliverable records in Data Manager', async ({ page }) => {
    const rows = page.locator('[data-testid="data-manager"] tbody tr:not(.ghost-row)');
    const count = await rows.count();

    // RPTI catalogue demo data: 8 original records (a-ciam, a-web, a-mobile apps) +
    // 9 new rc-* Deliverable records = 17 total
    expect(count).toBeGreaterThanOrEqual(17);
  });

  test('RPTI catalogue template: Deliverable record exists for Core Banking General Ledger', async ({ page }) => {
    const match = page.locator('[data-testid="data-manager"] tbody').getByText('Core Banking General Ledger', { exact: false });
    expect(await match.count()).toBeGreaterThan(0);
  });

  test('RPTI catalogue template: Deliverable record exists for Payment Gateway', async ({ page }) => {
    const match = page.locator('[data-testid="data-manager"] tbody').getByText('Payment Gateway', { exact: false });
    expect(await match.count()).toBeGreaterThan(0);
  });
});
