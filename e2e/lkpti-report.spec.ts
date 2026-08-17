import { test, expect } from '@playwright/test';

test.describe('LKPTI Data Manager tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('scenia-e2e', 'true');
      localStorage.setItem('scenia_has_seen_landing', 'true');
    });
    await page.reload();
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-lkpti').click();
  });

  test('LKPTI tab appears in Data Manager with the expected columns', async ({ page }) => {
    await expect(page.getByTestId('data-manager-tab-lkpti')).toBeVisible();
    const headerText = (await page.locator('[data-testid="data-manager"] thead').innerText()).toLowerCase();
    for (const label of ['Deliverable', 'Category', 'Function Description', 'Platform', 'Database', 'DC City', 'DR City', 'Backup Strategy', 'System Owner', 'Developer', 'Go-Live Date', 'Ownership']) {
      expect(headerText).toContain(label.toLowerCase());
    }
  });

  test('Adding a row inline persists after reload', async ({ page }) => {
    await page.getByTestId('add-row-btn-lkpti').click();
    const row = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').last();

    const targetSelect = row.locator('td[data-key="targetId"] select');
    const targetLabel = await targetSelect.locator('option').nth(1).textContent();
    await targetSelect.selectOption({ index: 1 });

    await row.locator('td[data-key="categoryCode"] select').selectOption('06');
    await row.locator('td[data-key="platform"] input').fill('Linux RHEL 9');
    await row.locator('td[data-key="platform"] input').press('Tab');
    await page.waitForTimeout(300);

    await page.reload();
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-lkpti').click();

    const platformInputs = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"] td[data-key="platform"] input');
    const count = await platformInputs.count();
    let matchIndex = -1;
    for (let i = 0; i < count; i++) {
      if ((await platformInputs.nth(i).inputValue()) === 'Linux RHEL 9') { matchIndex = i; break; }
    }
    expect(matchIndex).toBeGreaterThanOrEqual(0);
    const reloadedRow = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').nth(matchIndex);
    const reloadedTargetText = await reloadedRow.locator('td[data-key="targetId"] select').locator('option:checked').textContent();
    expect(reloadedTargetText).toBe(targetLabel);
  });

  test('Editing and deleting a row inline works like any other Data Manager tab', async ({ page }) => {
    await page.getByTestId('add-row-btn-lkpti').click();
    const row = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').last();
    await row.locator('td[data-key="targetId"] select').selectOption({ index: 1 });
    await row.locator('td[data-key="systemOwner"] input').fill('Initial owner');
    await row.locator('td[data-key="systemOwner"] input').press('Tab');

    await row.locator('td[data-key="systemOwner"] input').fill('Updated owner');
    await row.locator('td[data-key="systemOwner"] input').press('Tab');
    await expect(row.locator('td[data-key="systemOwner"] input')).toHaveValue('Updated owner');

    const rowCountBefore = await page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').count();
    await row.locator('[data-testid^="delete-row-btn-"]').click();
    await page.waitForTimeout(300);
    const rowCountAfter = await page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').count();
    expect(rowCountAfter).toBe(rowCountBefore - 1);
  });

  test('Deleting the linked Deliverable cascades to remove its LKPTI row', async ({ page }) => {
    await page.getByTestId('add-row-btn-lkpti').click();
    const row = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').last();
    const targetSelect = row.locator('td[data-key="targetId"] select');
    const targetLabel = await targetSelect.locator('option').nth(1).textContent();
    await targetSelect.selectOption({ index: 1 });
    await row.locator('td[data-key="systemOwner"] input').fill('Cascade test owner');
    await row.locator('td[data-key="systemOwner"] input').press('Tab');
    await page.waitForTimeout(300);
    const countBefore = await page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').count();

    await page.getByTestId('data-manager-tab-deliverables').click();
    const nameInputs = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"] td[data-key="name"] input');
    const count = await nameInputs.count();
    let matchIndex = -1;
    for (let i = 0; i < count; i++) {
      if ((await nameInputs.nth(i).inputValue()) === targetLabel) { matchIndex = i; break; }
    }
    expect(matchIndex).toBeGreaterThanOrEqual(0);
    const delivRow = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').nth(matchIndex);
    await delivRow.locator('[data-testid^="delete-row-btn-"]').click();
    const confirmModal = page.getByTestId('confirm-modal-confirm');
    if (await confirmModal.isVisible().catch(() => false)) await confirmModal.click();
    await page.waitForTimeout(300);

    await page.getByTestId('data-manager-tab-lkpti').click();
    const countAfter = await page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').count();
    expect(countAfter).toBe(countBefore - 1);
  });

  test('Generate button only builds a row for a deliverable with a live (in-production) segment, not a planned one', async ({ page }) => {
    // Seed two deliverables: one with only a planned segment (should NOT generate a
    // row), one with an in-production segment (should generate a row) — directly via
    // IndexedDB since demo data has no controlled not-yet-live deliverable to test against.
    const { plannedId, liveId } = await page.evaluate(() => {
      return new Promise<{ plannedId: string; liveId: string }>((resolve, reject) => {
        const req = indexedDB.open('it-initiative-visualiser');
        req.onsuccess = () => {
          const db = req.result;
          const readTx = db.transaction(['assets'], 'readonly');
          const assetCursor = readTx.objectStore('assets').openCursor();
          assetCursor.onsuccess = () => {
            const assetId = assetCursor.result?.value.id;
            if (!assetId) { reject(new Error('No assets found')); return; }

            const plannedId = `deliv-planned-test-${Date.now()}`;
            const liveId = `deliv-live-test-${Date.now()}`;
            const writeTx = db.transaction(['deliverables', 'deliverableSegments'], 'readwrite');
            writeTx.objectStore('deliverables').put({ id: plannedId, assetId, name: 'Planned Only Deliverable' });
            writeTx.objectStore('deliverables').put({ id: liveId, assetId, name: 'Live Test Deliverable' });
            writeTx.objectStore('deliverableSegments').put({
              id: `seg-planned-test-${Date.now()}`,
              deliverableId: plannedId,
              status: 'appstatus-planned',
              startDate: '2026-01-01',
              endDate: '2026-06-30',
            });
            writeTx.objectStore('deliverableSegments').put({
              id: `seg-live-test-${Date.now()}`,
              deliverableId: liveId,
              status: 'appstatus-in-production',
              startDate: '2026-03-15',
              endDate: '2026-12-31',
            });
            writeTx.oncomplete = () => { db.close(); resolve({ plannedId, liveId }); };
            writeTx.onerror = () => reject(writeTx.error);
          };
          assetCursor.onerror = () => reject(assetCursor.error);
        };
        req.onerror = () => reject(req.error);
      });
    });

    await page.reload();
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-lkpti').click();

    await page.getByTestId('lkpti-generate-btn').click();
    await page.getByTestId('confirm-modal-confirm').click();
    await page.waitForTimeout(300);

    const targetSelects = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"] td[data-key="targetId"] select');
    const count = await targetSelects.count();
    const values = await Promise.all(Array.from({ length: count }, (_, i) => targetSelects.nth(i).inputValue()));

    expect(values).toContain(liveId);
    expect(values).not.toContain(plannedId);

    const rowIndex = values.indexOf(liveId);
    const row = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').nth(rowIndex);
    await expect(row.locator('td[data-key="goLiveDate"] input')).toHaveValue('15-03-2026');
  });
});

test.describe('LKPTI Report View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('scenia-e2e', 'true');
      localStorage.setItem('scenia_has_seen_landing', 'true');
    });
    await page.reload();
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
  });

  async function openLkptiReport(page: import('@playwright/test').Page) {
    await page.getByTestId('nav-reports').click();
    await page.getByTestId('report-card-lkpti').click();
    await expect(page.getByTestId('lkpti-report-view')).toBeVisible();
  }

  test('LKPTI card appears in Reports and opens to a read-only empty state', async ({ page }) => {
    await openLkptiReport(page);
    await expect(page.getByText(/no lkpti rows/i)).toBeVisible();
    await expect(page.getByText(/managed in.*data manager/i)).toBeVisible();
  });

  test('Exports the LKPTI Report to Excel', async ({ page }) => {
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-lkpti').click();
    await page.getByTestId('add-row-btn-lkpti').click();
    const row = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').last();
    await row.locator('td[data-key="targetId"] select').selectOption({ index: 1 });
    await row.locator('td[data-key="systemOwner"] input').fill('Export test owner');
    await row.locator('td[data-key="systemOwner"] input').press('Tab');
    await page.waitForTimeout(300);

    await openLkptiReport(page);
    await expect(page.getByTestId('lkpti-detail-table')).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('lkpti-report-export-btn').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/lkpti-report/i);
  });
});
