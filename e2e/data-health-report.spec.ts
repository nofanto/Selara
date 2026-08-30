import { test, expect } from '@playwright/test';

test.describe('Data Completeness report', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('scenia-e2e', 'true');
      localStorage.setItem('scenia_has_seen_landing', 'true');
    });
    await page.reload();
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
  });

  test('report card is visible and opens the report view', async ({ page }) => {
    await page.getByTestId('nav-reports').click();
    await expect(page.getByTestId('report-card-data-health')).toBeVisible();
    await page.getByTestId('report-card-data-health').click();
    await expect(page.getByTestId('data-health-report-view')).toBeVisible();
  });

  test('flags a Deliverable with a dangling Asset reference and jumps to the Deliverables tab on click', async ({ page }) => {
    // Seed a Deliverable pointing at an Asset that doesn't exist — deterministic, unlike
    // relying on whatever gaps happen to already be in the demo dataset.
    const deliverableName = `Dangling Deliverable ${Date.now()}`;
    await page.evaluate((name) => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('it-initiative-visualiser');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(['deliverables'], 'readwrite');
          tx.objectStore('deliverables').put({ id: `deliv-dangling-${Date.now()}`, assetId: 'ghost-asset', name, type: 'application' });
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    }, deliverableName);

    await page.reload();
    await page.getByTestId('nav-reports').click();
    await page.getByTestId('report-card-data-health').click();

    const issueList = page.getByTestId('data-health-issue-list');
    await expect(issueList).toBeVisible();
    await expect(issueList).toContainText(deliverableName);

    const issue = issueList.locator('button', { hasText: deliverableName }).first();
    await issue.click();

    await expect(page.getByTestId('data-manager')).toBeVisible();
    await expect(page.getByTestId('data-manager-tab-deliverables')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('search-input')).toHaveValue(deliverableName);
  });

  test('severity filter buttons narrow the issue list', async ({ page }) => {
    // A Milestone with a dangling assetId only ever produces one issue, at 'error'
    // severity — unlike a bare Deliverable, which would also trip the "no lifecycle
    // segments" warning check and appear under both filters.
    const milestoneName = `Filter Test Milestone ${Date.now()}`;
    await page.evaluate((name) => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('it-initiative-visualiser');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(['milestones'], 'readwrite');
          tx.objectStore('milestones').put({ id: `mile-filter-${Date.now()}`, assetId: 'ghost-asset-2', name, date: '2026-01-01', type: 'info' });
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    }, milestoneName);

    await page.reload();
    await page.getByTestId('nav-reports').click();
    await page.getByTestId('report-card-data-health').click();

    await page.getByTestId('data-health-filter-warning').click();
    await expect(page.getByTestId('data-health-issue-list')).not.toContainText(milestoneName);

    await page.getByTestId('data-health-filter-error').click();
    await expect(page.getByTestId('data-health-issue-list')).toContainText(milestoneName);
  });
});
