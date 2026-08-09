import { test, expect } from '@playwright/test';

/**
 * User Story: Single Deliverables Swimlane Per Asset
 *
 * As a Selara user I want one consolidated Deliverables swimlane per IT Asset
 * (rather than one row per deliverable) so that I can add lifecycle segments
 * for any technology on a single row, and the IT Asset label spans both
 * the Initiatives and Deliverables swimlanes.
 *
 * Acceptance Criteria:
 *  AC1  There is exactly one Deliverables swimlane per asset that has deliverables
 *       (3 for demo data: Customer CIAM, Web Channel, Mobile Channel).
 *  AC2  Demo segments from all deliverables within an asset appear on the single
 *       merged swimlane.
 *  AC3  Display mode "Both" shows both the initiatives row and the deliverables row
 *       for each asset.
 *  AC4  Display mode "Initiatives" shows the initiatives row and hides the
 *       deliverables swimlane.
 *  AC5  Display mode "Deliverables" hides the initiatives row and shows the
 *       deliverables swimlane.
 *  AC6  Double-clicking the deliverables swimlane opens the segment creation panel.
 *  AC7  An asset with no deliverables has no deliverables swimlane.
 */
test.describe('Single Deliverables Swimlane Per Asset', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
  });

  test('AC1 – one deliverables swimlane per asset with deliverables (3 in demo data)', async ({ page }) => {
    // Demo data has 3 assets with deliverables: a-ciam, a-web, a-mobile
    const appSwimlanes = page.locator('[data-testid^="deliverable-swimlane-"]');
    await expect(appSwimlanes).toHaveCount(3);
  });

  test('AC2 – segments from all apps on the asset appear on the single swimlane', async ({ page }) => {
    // a-ciam has 3 apps × multiple segments each — more than 1 bar on its swimlane
    const ciamSwimlane = page.locator('[data-testid="deliverable-swimlane-a-ciam"]');
    await expect(ciamSwimlane).toBeVisible();
    const bars = ciamSwimlane.locator('[data-testid^="segment-bar-"]');
    const count = await bars.count();
    expect(count).toBeGreaterThan(1);
  });

  test('AC3 – display Both shows initiatives row AND deliverables swimlane', async ({ page }) => {
    // Default is "Both"
    await expect(page.locator('[data-testid="asset-row-content"]').first()).toBeVisible();
    await expect(page.locator('[data-testid^="deliverable-swimlane-"]').first()).toBeVisible();
  });

  test('AC4 – display Initiatives hides the deliverables swimlane', async ({ page }) => {
    await page.getByTestId('view-options-btn').click();
    await page.getByTestId('show-initiatives').click();
    await page.mouse.click(100, 100); // close popover

    await expect(page.locator('[data-testid="asset-row-content"]').first()).toBeVisible();
    await expect(page.locator('[data-testid^="deliverable-swimlane-"]')).toHaveCount(0);
  });

  test('AC5 – display Deliverables hides the initiatives row', async ({ page }) => {
    await page.getByTestId('view-options-btn').click();
    await page.getByTestId('show-deliverables').click();
    await page.mouse.click(100, 100); // close popover

    await expect(page.locator('[data-testid="asset-row-content"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="deliverable-swimlane-"]').first()).toBeVisible();
  });

  test('AC6 – double-clicking the deliverables swimlane opens segment creation panel', async ({ page }) => {
    // Navigate to 2030 so no demo segments block the double-click
    const startInput = page.getByTestId('timeline-start-input');
    await startInput.fill('2030-01-01');
    await startInput.press('Enter');
    await page.waitForTimeout(300);

    const rowContent = page.locator('[data-testid="deliverable-row-content"]').first();
    await rowContent.dblclick({ position: { x: 200, y: 20 } });

    const panel = page.getByTestId('segment-panel');
    await expect(panel.getByRole('button', { name: 'Add Segment' })).toBeVisible({ timeout: 5000 });
  });

  test('AC7 – asset with no deliverables has no deliverables swimlane', async ({ page }) => {
    // a-k8s (Kubernetes Platform) has no deliverables in demo data
    await expect(page.locator('[data-testid="deliverable-swimlane-a-k8s"]')).toHaveCount(0);
  });

  test('AC8 – overlapping segments shift down instead of rendering on top of each other', async ({ page }) => {
    // The a-ciam swimlane has overlapping segments (Okta spans the full window
    // and overlaps with Azure AD B2C and Keycloak segments). The swimlane must
    // grow taller than a single bar row to accommodate them.
    const ciamSwimlane = page.locator('[data-testid="deliverable-swimlane-a-ciam"]');
    await expect(ciamSwimlane).toBeVisible();

    // Single-row height is 52px. With overlapping segments the swimlane must be taller.
    const box = await ciamSwimlane.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(52);

    // Two segment bars that overlap in time must have different vertical positions.
    const oktaBar = ciamSwimlane.locator('[data-testid="segment-bar-seg-okta-prod"]');
    const azureBar = ciamSwimlane.locator('[data-testid="segment-bar-seg-azuread-prod"]');
    await expect(oktaBar).toBeVisible();
    await expect(azureBar).toBeVisible();

    const oktaBox = await oktaBar.boundingBox();
    const azureBox = await azureBar.boundingBox();
    expect(oktaBox).not.toBeNull();
    expect(azureBox).not.toBeNull();
    // The top edges must differ — they are on different rows
    expect(Math.abs(oktaBox!.y - azureBox!.y)).toBeGreaterThan(10);
  });
});
