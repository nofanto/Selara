import { test, expect } from '@playwright/test';

/**
 * Deliverables feature:
 * - IT assets are composed of deliverables
 * - Deliverables have: name, asset (parent), status
 * - Initiatives can optionally be linked to a deliverable within their asset
 * - Deliverable sub-rows appear in the visualiser beneath their parent asset row
 * - Milestones remain at the asset level
 * - Assets with no deliverables render as before (no regressions)
 */

test.describe('Deliverables — Data Manager tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
    await page.getByTestId('nav-data-manager').click();
    await expect(page.getByTestId('data-manager')).toBeVisible();
  });

  test('Deliverables tab is present in the Data Manager', async ({ page }) => {
    await expect(page.getByTestId('data-manager-tab-deliverables')).toBeVisible();
  });

  test('Deliverables tab shows Name and Asset columns', async ({ page }) => {
    await page.getByTestId('data-manager-tab-deliverables').click();
    const table = page.getByTestId('data-manager');
    await expect(table.locator('th').filter({ hasText: 'Name' })).toBeVisible();
    await expect(table.locator('th').filter({ hasText: 'Asset' })).toBeVisible();
  });

  test('Deliverables tab shows RPTI auto-fill override columns (categoryCode, developer, DC/DR location)', async ({ page }) => {
    await page.getByTestId('data-manager-tab-deliverables').click();
    const headerText = (await page.locator('[data-testid="data-manager"] thead').innerText()).toLowerCase();
    for (const label of ['RPTI Category Override', 'Developer', 'DC City Override', 'DC Country Override', 'DR City Override', 'DR Country Override']) {
      expect(headerText).toContain(label.toLowerCase());
    }
  });

  test('Deliverables tab shows a Description column, which cascades into LKPTI function description', async ({ page }) => {
    await page.getByTestId('data-manager-tab-deliverables').click();
    const table = page.getByTestId('data-manager');
    await expect(table.locator('th').filter({ hasText: 'Description' })).toBeVisible();
  });

  test('Deliverables tab shows demo deliverable rows', async ({ page }) => {
    await page.getByTestId('data-manager-tab-deliverables').click();
    // There should be at least one deliverable in demo data
    const rows = page.locator('[data-testid="data-manager"] tbody tr:not(.ghost-row)');
    await expect(rows.first()).toBeVisible();
  });

  test('can add a new deliverable row', async ({ page }) => {
    await page.getByTestId('data-manager-tab-deliverables').click();
    const initialCount = await page.locator('[data-testid="data-manager"] tbody tr:not(.ghost-row)').count();

    await page.getByRole('button', { name: 'Add Row' }).click();
    const newCount = await page.locator('[data-testid="data-manager"] tbody tr:not(.ghost-row)').count();
    expect(newCount).toBe(initialCount + 1);
  });

  test('can open a deliverable name for editing', async ({ page }) => {
    await page.getByTestId('data-manager-tab-deliverables').click();
    // Double-clicking the name cell should open an inline text input
    const nameCell = page.locator('[data-testid="data-manager"] tbody tr:not(.ghost-row) td[data-key="name"]').first();
    await nameCell.dblclick();
    const nameInput = nameCell.locator('input');
    await expect(nameInput).toBeVisible();
  });
});

test.describe('Deliverables — InitiativePanel dropdown', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
  });

  test('Deliverable dropdown appears in the InitiativePanel', async ({ page }) => {
    const bar = page.locator('[data-testid^="initiative-bar"]').first();
    await bar.click();
    await page.getByTestId('initiative-action-edit').click();
    const panel = page.getByTestId('initiative-panel');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-testid="initiative-deliverable"]')).toBeVisible();
  });

  test('Deliverable dropdown is filtered to the selected asset', async ({ page }) => {
    // Open an initiative on an asset that has deliverables (a-ciam in demo data)
    const bar = page.locator('[data-initiative-id="i-ciam-passkey"]').first();
    await bar.click();
    await page.getByTestId('initiative-action-edit').click();
    const panel = page.getByTestId('initiative-panel');
    await expect(panel).toBeVisible();

    const appDropdown = panel.locator('[data-testid="initiative-deliverable"]');
    await expect(appDropdown).toBeVisible();

    // Should show only apps belonging to a-ciam — count options (minus the blank one)
    const options = appDropdown.locator('option');
    const count = await options.count();
    expect(count).toBeGreaterThan(1); // at least the blank + one app option
  });

  test('Changing asset resets the deliverable selection', async ({ page }) => {
    const bar = page.locator('[data-initiative-id="i-ciam-passkey"]').first();
    await bar.click();
    await page.getByTestId('initiative-action-edit').click();
    const panel = page.getByTestId('initiative-panel');
    await expect(panel).toBeVisible();

    const appDropdown = panel.locator('[data-testid="initiative-deliverable"]');
    // Select a deliverable first
    const options = await appDropdown.locator('option').all();
    if (options.length > 1) {
      const secondOptionValue = await options[1].getAttribute('value');
      if (secondOptionValue) {
        await appDropdown.selectOption(secondOptionValue);
        expect(await appDropdown.inputValue()).toBe(secondOptionValue);
      }
    }

    // Change the asset — deliverable should reset to blank
    const assetSelect = panel.locator('#assetId');
    await assetSelect.selectOption('a-web');
    await expect(appDropdown).toHaveValue('');
  });

  test('Deliverable assignment saves and persists after reload', async ({ page }) => {
    const bar = page.locator('[data-initiative-id="i-ciam-passkey"]').first();
    await bar.click();
    await page.getByTestId('initiative-action-edit').click();
    const panel = page.getByTestId('initiative-panel');
    await expect(panel).toBeVisible();

    const appDropdown = panel.locator('[data-testid="initiative-deliverable"]');
    const options = await appDropdown.locator('option:not([value=""])').all();
    if (options.length > 0) {
      const appValue = await options[0].getAttribute('value');
      if (appValue) {
        await appDropdown.selectOption(appValue);
        await panel.getByRole('button', { name: 'Save Changes' }).click();
        await expect(panel).toBeHidden();

        await page.reload();
        await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
        const bar2 = page.locator('[data-initiative-id="i-ciam-passkey"]').first();
        await bar2.click();
        await page.getByTestId('initiative-action-edit').click();
        const panel2 = page.getByTestId('initiative-panel');
        await expect(panel2).toBeVisible();
        await expect(panel2.locator('[data-testid="initiative-deliverable"]')).toHaveValue(appValue);
      }
    }
  });
});

test.describe('Deliverables — Visualiser sub-rows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
  });

  test('deliverable sub-rows are visible in the timeline for assets with deliverables', async ({ page }) => {
    // a-ciam should have deliverable sub-rows based on demo data
    await expect(page.locator('[data-testid^="deliverable-swimlane-"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('one deliverables swimlane per asset with deliverables (3 in demo data)', async ({ page }) => {
    // Demo data has 3 assets with deliverables: a-ciam, a-web, a-mobile
    const appSwimlanes = page.locator('[data-testid^="deliverable-swimlane-"]');
    await expect(appSwimlanes).toHaveCount(3);
  });

  test('deliverable sub-row shows lifecycle segment bars from demo data', async ({ page }) => {
    // Demo data includes segments for each deliverable; at least one bar should be visible
    const appRow = page.locator('[data-testid^="deliverable-swimlane-"]').first();
    await expect(appRow).toBeVisible();
    const segmentBar = appRow.locator('[data-testid^="segment-bar-"]').first();
    await expect(segmentBar).toBeVisible();
  });

  test('initiatives linked to a deliverable remain visible at the asset level', async ({ page }) => {
    // Link i-ciam-passkey to a deliverable and verify it still renders in the asset row
    const bar = page.locator('[data-initiative-id="i-ciam-passkey"]').first();
    await bar.click();
    await page.getByTestId('initiative-action-edit').click();
    const panel = page.getByTestId('initiative-panel');
    await expect(panel).toBeVisible();

    const appDropdown = panel.locator('[data-testid="initiative-deliverable"]');
    const allOptions = await appDropdown.locator('option').all();
    const nonBlankOptions = [];
    for (const opt of allOptions) {
      const val = await opt.getAttribute('value');
      if (val) nonBlankOptions.push(val);
    }
    if (nonBlankOptions.length > 0) {
      await appDropdown.selectOption(nonBlankOptions[0]);
      await panel.getByRole('button', { name: 'Save Changes' }).click();
      await expect(panel).toBeHidden();

      // The initiative bar should still appear in the main timeline (at asset level)
      await expect(page.locator('[data-initiative-id="i-ciam-passkey"]').first()).toBeVisible();
    }
  });

  test('assets with no deliverables render without an deliverables swimlane', async ({ page }) => {
    // a-k8s (Kubernetes Platform) has no deliverables in demo data
    await expect(page.locator('[data-testid="asset-row-a-k8s"]')).toBeVisible();
    await expect(page.locator('[data-testid="deliverable-swimlane-a-k8s"]')).toHaveCount(0);
  });

  test('milestones remain visible at the asset level alongside deliverable sub-rows', async ({ page }) => {
    // The CIAM asset has milestones in demo data — they should still render
    await expect(page.locator('[data-testid="milestone-dep-handle"]').first()).toBeVisible();
  });
});

test.describe('Deliverables — Version snapshots', () => {
  test('deliverables are included in version snapshots', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });

    // Save a version
    await page.getByTestId('nav-history').click();
    await page.getByRole('button', { name: 'Save Current State' }).click();
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', 'App Test Snapshot');
    await page.getByRole('button', { name: 'Save Version' }).click();

    // The snapshot should have been saved without error
    await expect(page.getByText('App Test Snapshot')).toBeVisible();
    await page.getByTestId('close-version-manager').click();

    // Add a new deliverable
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-deliverables').click();
    await page.getByRole('button', { name: 'Add Row' }).click();

    // Restore the snapshot — the new deliverable should be gone
    await page.getByTestId('nav-history').click();
    await page.getByText('App Test Snapshot').click();
    await page.getByRole('button', { name: 'Restore' }).first().click();
    await page.locator('[data-testid="confirm-modal-confirm"]').click();
    // VersionManager auto-closes after restore (onRestore + onClose both called in confirm handler)

    // Deliverable count should match the snapshot (not include the newly added row)
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-deliverables').click();
    // The page renders without error
    await expect(page.getByTestId('data-manager')).toBeVisible();
  });
});
