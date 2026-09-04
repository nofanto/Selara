import { test, expect } from '@playwright/test';

test.describe('Version History & Snapshotting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#timeline-visualiser');
  });

  test('should allow saving a version and viewing it in the list', async ({ page }) => {
    await page.getByTestId('nav-history').click();
    await expect(page.getByText('Version History')).toBeVisible();

    await page.getByRole('button', { name: 'Save Current State' }).click();
    const versionName = `Test Version ${Date.now()}`;
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', versionName);
    await page.fill('textarea[placeholder="What changes does this version capture?"]', 'Test description');
    await page.getByRole('button', { name: 'Save Version' }).click();

    await expect(page.getByText(versionName)).toBeVisible();
    await page.getByText(versionName).click();
    await expect(page.locator('h3', { hasText: versionName })).toBeVisible();
    await expect(page.getByText('Test description')).toBeVisible();
  });

  test('should generate a difference report for renames', async ({ page }) => {
    await page.getByTestId('nav-history').click();
    await page.getByRole('button', { name: 'Save Current State' }).click();
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', 'Baseline');
    await page.getByRole('button', { name: 'Save Version' }).click();
    await page.getByTestId('close-version-manager').click();

    await page.getByTestId('nav-data-manager').click();
    const firstInitName = page.locator('input[data-testid^="real-input-name"]').first();
    const originalName = await firstInitName.inputValue();
    const newName = originalName + ' MODIFIED';
    await firstInitName.click();
    await firstInitName.fill(newName);
    await firstInitName.press('Enter');

    await page.getByTestId('nav-history').click();
    await page.getByText('Baseline').click();
    await page.getByRole('button', { name: 'Run Difference Report' }).click();

    await expect(page.getByRole('heading', { name: 'Difference Report' })).toBeVisible();
    await expect(page.getByText(newName).first()).toBeVisible();
    await expect(page.getByText(`Renamed from "${originalName}" to "${newName}"`)).toBeVisible();

    await page.getByTestId('close-report-btn').click();
    await expect(page.getByRole('heading', { name: 'Difference Report' })).not.toBeVisible();
  });

  test('should show additions, deletions, and budget changes in the report', async ({ page }) => {
    await page.getByTestId('nav-history').click();
    await page.getByRole('button', { name: 'Save Current State' }).click();
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', 'Complex Baseline');
    await page.getByRole('button', { name: 'Save Version' }).click();
    await page.getByTestId('close-version-manager').click();

    await page.getByTestId('nav-data-manager').click();
    const firstInitName = await page.locator('input[data-testid^="real-input-name"]').first().inputValue();
    await page.locator('button[title="Delete row"]').first().click();
    await page.locator('[data-testid="confirm-modal-confirm"]').click();

    await page.getByRole('button', { name: 'Add Row' }).first().click();
    const addedInitName = 'Brand New Initiative';
    await page.locator('input[data-testid^="real-input-name"]').last().fill(addedInitName);
    await page.locator('input[data-testid^="real-input-name"]').last().press('Enter');

    const secondInitName = await page.locator('input[data-testid^="real-input-name"]').nth(1).inputValue();
    await page.locator('input[data-testid^="real-input-capex"]').nth(1).fill('999999');
    await page.locator('input[data-testid^="real-input-capex"]').nth(1).press('Enter');

    await page.getByTestId('nav-history').click();
    await page.getByText('Complex Baseline').click();
    await page.getByRole('button', { name: 'Run Difference Report' }).click();

    await expect(page.getByText('Removed').first()).toBeVisible();
    await expect(page.getByText(firstInitName, { exact: true })).toBeVisible();
    await expect(page.getByText('Added').first()).toBeVisible();
    await expect(page.getByText(addedInitName, { exact: true })).toBeVisible();
    await expect(page.getByText('Changed').first()).toBeVisible();
    await expect(page.getByText(secondInitName, { exact: true })).toBeVisible();
    await expect(page.getByText(/CapEx: .*\d+ → IDR 999,999/)).toBeVisible();
  });

  test('should not crash when selected version is deleted while comparison report is open', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.getByTestId('nav-history').click();
    await page.getByRole('button', { name: 'Save Current State' }).click();
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', 'Crash Test Version');
    await page.getByRole('button', { name: 'Save Version' }).click();

    await page.getByText('Crash Test Version').click();
    await page.getByRole('button', { name: 'Run Difference Report' }).click();
    await expect(page.getByRole('heading', { name: 'Difference Report' })).toBeVisible();

    await page.evaluate(() => {
      const btn = document.querySelector('button[title="Delete version"]') as HTMLButtonElement;
      if (!btn) throw new Error('Delete button not found in DOM');
      btn.click();
    });
    await page.locator('[data-testid="confirm-modal-confirm"]').click();

    await expect(page.getByRole('heading', { name: 'Difference Report' })).not.toBeVisible({ timeout: 3000 });
    expect(pageErrors.filter(e => e.includes('Cannot read') || e.includes('undefined'))).toHaveLength(0);

    await page.getByTestId('close-version-manager').click();
    await expect(page.locator('#timeline-visualiser')).toBeVisible();
  });

  test('should allow restoring a previous version', async ({ page }) => {
    await page.getByTestId('nav-history').click();
    await page.getByRole('button', { name: 'Save Current State' }).click();
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', 'To Restore');
    await page.getByRole('button', { name: 'Save Version' }).click();
    await page.getByTestId('close-version-manager').click();

    await page.getByTestId('nav-data-manager').click();
    await page.waitForSelector('input[data-testid^="real-input-name"]', { timeout: 10000 });
    const countBefore = await page.locator('input[data-testid^="real-input-name"]').count();
    const firstInitName = await page.locator('input[data-testid^="real-input-name"]').first().inputValue();

    await page.locator('button[title="Delete row"]').first().click();
    await page.locator('[data-testid="confirm-modal-confirm"]').click();
    await expect(page.locator('input[data-testid^="real-input-name"]')).toHaveCount(countBefore - 1);

    await page.getByTestId('nav-history').click();
    await page.getByText('To Restore').click();
    await page.getByRole('button', { name: 'Restore to Current' }).click();
    await page.locator('[data-testid="confirm-modal-confirm"]').click();

    await expect(page.getByText('Version History')).not.toBeVisible();
    await page.getByTestId('nav-data-manager').click();
    await expect(page.locator('input[data-testid^="real-input-name"]')).toHaveCount(countBefore);
    await expect(page.locator('input[data-testid^="real-input-name"]').first()).toHaveValue(firstInitName);
  });

  test('saved version is unaffected by mutations made after saving (deep clone)', async ({ page }) => {
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 10000 });
    await page.getByTestId('nav-history').click();
    await page.getByRole('button', { name: 'Save Current State' }).click();
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', 'Integrity Check');
    await page.getByRole('button', { name: 'Save Version' }).click();
    await page.getByTestId('close-version-manager').click();

    const passkeyBar = page.locator('[data-initiative-id="i-ciam-passkey"]').first();
    await passkeyBar.click();
    await page.getByTestId('initiative-action-edit').click();
    const panel = page.getByTestId('initiative-panel');
    await expect(panel).toBeVisible({ timeout: 5000 });
    await expect(panel.getByLabel('Initiative Name')).toHaveValue('Passkey Rollout', { timeout: 3000 });
    await panel.getByLabel('Initiative Name').fill('Passkey Rollout MUTATED');
    await panel.getByRole('button', { name: 'Save Changes' }).click();

    await page.getByTestId('nav-history').click();
    await page.getByText('Integrity Check').click();
    await page.getByRole('button', { name: 'Run Difference Report' }).click();
    await expect(page.getByText('Renamed from "Passkey Rollout" to "Passkey Rollout MUTATED"')).toBeVisible({ timeout: 5000 });
  });

  test('difference report includes resource and deliverable changes, not just initiatives', async ({ page }) => {
    await page.getByTestId('nav-history').click();
    await page.getByRole('button', { name: 'Save Current State' }).click();
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', 'Pre-Resource Baseline');
    await page.getByRole('button', { name: 'Save Version' }).click();
    await page.getByTestId('close-version-manager').click();

    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-resources').click();
    await page.getByTestId('add-row-btn-resources').click();
    const newResourceName = `Diff Test Resource ${Date.now()}`;
    const nameInput = page.locator('table tbody tr[data-real="true"]').last().locator('[data-testid="real-input-name"]');
    await nameInput.fill(newResourceName);
    await nameInput.press('Tab');
    await expect(page.locator('table tbody tr[data-real="true"]').last().locator('[data-testid="real-input-name"]')).toHaveValue(newResourceName);

    await page.getByTestId('nav-history').click();
    await page.getByText('Pre-Resource Baseline').click();
    await page.getByRole('button', { name: 'Run Difference Report' }).click();

    await expect(page.getByRole('heading', { name: 'Difference Report' })).toBeVisible();
    // The "Resources" heading is part of the entity-type breakdown, which sits
    // behind the All changes tab now that the report opens on the summary.
    await page.getByTestId('diff-view-all').click();
    await expect(page.getByText('Resources', { exact: true })).toBeVisible();
    await expect(page.getByText(newResourceName)).toBeVisible();
  });

  test('snapshot stored in IndexedDB contains all initiative data', async ({ page }) => {
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 10000 });
    await page.getByTestId('nav-history').click();
    await page.getByRole('button', { name: 'Save Current State' }).click();
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', 'DB Integrity Check');
    await page.getByRole('button', { name: 'Save Version' }).click();
    await page.getByTestId('close-version-manager').click();

    const savedInitiativeCount = await page.evaluate((): Promise<number> => {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('it-initiative-visualiser');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('versions', 'readonly');
          const req = tx.objectStore('versions').getAll();
          req.onsuccess = () => {
            const versions = req.result;
            const latest = versions.sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp))[0];
            resolve(latest?.data?.initiatives?.length ?? 0);
          };
        };
      });
    });

    expect(savedInitiativeCount).toBeGreaterThan(0);
  });
});
