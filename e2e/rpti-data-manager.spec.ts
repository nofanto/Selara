import { test, expect } from '@playwright/test';

test.describe('RPTI Data Manager tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('scenia-e2e', 'true');
      localStorage.setItem('scenia_has_seen_landing', 'true');
    });
    await page.reload();
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-rpti').click();
  });

  test('RPTI tab appears in Data Manager with the expected columns', async ({ page }) => {
    await expect(page.getByTestId('data-manager-tab-rpti')).toBeVisible();
    const headerText = (await page.locator('[data-testid="data-manager"] thead').innerText()).toLowerCase();
    for (const label of ['Initiative', 'Target', 'Category', 'Dev Type', 'Developer', 'Quarter', 'DC City', 'DR City', 'Remarks']) {
      expect(headerText).toContain(label.toLowerCase());
    }
  });

  test('Adding a row inline persists after reload', async ({ page }) => {
    await page.getByTestId('add-row-btn-rpti').click();
    const row = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').last();

    const initiativeSelect = row.locator('td[data-key="initiativeId"] select');
    const initiativeName = await initiativeSelect.locator('option').nth(1).textContent();
    await initiativeSelect.selectOption({ index: 1 });

    const targetSelect = row.locator('td[data-key="targetId"] select');
    const targetLabel = await targetSelect.locator('option').nth(1).textContent();
    await targetSelect.selectOption({ index: 1 });

    await row.locator('td[data-key="categoryCode"] select').selectOption('06');
    await row.locator('td[data-key="developmentType"] select').selectOption('new');
    await row.locator('td[data-key="developer"] select').selectOption('inhouse');
    await row.locator('td[data-key="ppjtiRelatedParty"] select').selectOption('n/a');
    await row.locator('td[data-key="remarks"] textarea').fill('Persisted remark');
    await row.locator('td[data-key="remarks"] textarea').press('Tab');
    await page.waitForTimeout(300);

    await page.reload();
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-rpti').click();

    const remarkCells = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"] td[data-key="remarks"] textarea');
    const count = await remarkCells.count();
    let matchIndex = -1;
    for (let i = 0; i < count; i++) {
      if ((await remarkCells.nth(i).inputValue()) === 'Persisted remark') { matchIndex = i; break; }
    }
    expect(matchIndex).toBeGreaterThanOrEqual(0);
    const reloadedRow = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').nth(matchIndex);
    const reloadedInitiativeText = await reloadedRow.locator('td[data-key="initiativeId"] select').locator('option:checked').textContent();
    expect(reloadedInitiativeText?.trim()).toBe(initiativeName!.trim());
    const reloadedTargetText = await reloadedRow.locator('td[data-key="targetId"] select').locator('option:checked').textContent();
    expect(reloadedTargetText).toBe(targetLabel);
  });

  test('Editing and deleting a row inline works like any other Data Manager tab', async ({ page }) => {
    await page.getByTestId('add-row-btn-rpti').click();
    const row = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').last();
    await row.locator('td[data-key="initiativeId"] select').selectOption({ index: 1 });
    await row.locator('td[data-key="targetId"] select').selectOption({ index: 1 });
    await row.locator('td[data-key="categoryCode"] select').selectOption('52');
    await row.locator('td[data-key="developmentType"] select').selectOption('new');
    await row.locator('td[data-key="developer"] select').selectOption('inhouse');
    await row.locator('td[data-key="ppjtiRelatedParty"] select').selectOption('n/a');
    await row.locator('td[data-key="remarks"] textarea').fill('Initial remarks');
    await row.locator('td[data-key="remarks"] textarea').press('Tab');

    await row.locator('td[data-key="remarks"] textarea').fill('Updated remarks');
    await row.locator('td[data-key="remarks"] textarea').press('Tab');
    await expect(row.locator('td[data-key="remarks"] textarea')).toHaveValue('Updated remarks');

    const rowCountBefore = await page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').count();
    await row.locator('[data-testid^="delete-row-btn-"]').click();
    await page.waitForTimeout(300);
    const rowCountAfter = await page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').count();
    expect(rowCountAfter).toBe(rowCountBefore - 1);
  });

  test('The flattened DC/DR location fields are independently editable and persist', async ({ page }) => {
    await page.getByTestId('add-row-btn-rpti').click();
    const row = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').last();
    await row.locator('td[data-key="initiativeId"] select').selectOption({ index: 1 });
    await row.locator('td[data-key="targetId"] select').selectOption({ index: 1 });
    await row.locator('td[data-key="categoryCode"] select').selectOption('51');
    await row.locator('td[data-key="developmentType"] select').selectOption('new');
    await row.locator('td[data-key="developer"] select').selectOption('inhouse');
    await row.locator('td[data-key="ppjtiRelatedParty"] select').selectOption('n/a');

    await row.locator('td[data-key="dcCity"] input').fill('Jakarta');
    await row.locator('td[data-key="dcCountry"] input').fill('Indonesia');
    await row.locator('td[data-key="drCity"] input').fill('Surabaya');
    await row.locator('td[data-key="drCountry"] input').fill('Indonesia');
    await row.locator('td[data-key="drCountry"] input').press('Tab');
    await page.waitForTimeout(300);

    await page.reload();
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-rpti').click();

    const dcCityInputs = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"] td[data-key="dcCity"] input');
    const count = await dcCityInputs.count();
    let matchIndex = -1;
    for (let i = 0; i < count; i++) {
      if ((await dcCityInputs.nth(i).inputValue()) === 'Jakarta') { matchIndex = i; break; }
    }
    expect(matchIndex).toBeGreaterThanOrEqual(0);
    const reloadedRow = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').nth(matchIndex);
    await expect(reloadedRow.locator('td[data-key="dcCountry"] input')).toHaveValue('Indonesia');
    await expect(reloadedRow.locator('td[data-key="drCity"] input')).toHaveValue('Surabaya');
    await expect(reloadedRow.locator('td[data-key="drCountry"] input')).toHaveValue('Indonesia');
  });

  test('Deleting the linked Initiative cascades to remove its RPTI row', async ({ page }) => {
    await page.getByTestId('add-row-btn-rpti').click();
    const row = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').last();
    const initiativeSelect = row.locator('td[data-key="initiativeId"] select');
    const initiativeName = await initiativeSelect.locator('option').nth(1).textContent();
    await initiativeSelect.selectOption({ index: 1 });
    await row.locator('td[data-key="targetId"] select').selectOption({ index: 1 });
    await row.locator('td[data-key="categoryCode"] select').selectOption('53');
    await row.locator('td[data-key="developmentType"] select').selectOption('new');
    await row.locator('td[data-key="developer"] select').selectOption('inhouse');
    await row.locator('td[data-key="ppjtiRelatedParty"] select').selectOption('n/a');
    await row.locator('td[data-key="ppjtiRelatedParty"] select').press('Tab');
    await page.waitForTimeout(300);
    const rptiCountBefore = await page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').count();

    await page.getByTestId('data-manager-tab-initiatives').click();
    const initNameInputs = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"] td[data-key="name"] input');
    const initCount = await initNameInputs.count();
    let initMatchIndex = -1;
    for (let i = 0; i < initCount; i++) {
      if ((await initNameInputs.nth(i).inputValue()) === initiativeName!.trim()) { initMatchIndex = i; break; }
    }
    expect(initMatchIndex).toBeGreaterThanOrEqual(0);
    const initRow = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').nth(initMatchIndex);
    await initRow.locator('[data-testid^="delete-row-btn-"]').click();
    await page.getByTestId('confirm-modal-confirm').click();

    await page.getByTestId('data-manager-tab-rpti').click();
    const rptiCountAfter = await page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').count();
    expect(rptiCountAfter).toBe(rptiCountBefore - 1);
  });

  test('Changing a row\'s target from an Asset to a Deliverable re-derives targetType, verified via cascade-delete', async ({ page }) => {
    // Create a brand-new Asset with no initiatives/milestones pointing to it, so
    // deleting it later can only affect an RPTI row through targetType/targetId —
    // never through the separate "initiative belongs to this asset" cascade path.
    await page.getByTestId('data-manager-tab-assets').click();
    await page.getByTestId('add-row-btn-assets').click();
    const newAssetRow = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').last();
    await newAssetRow.locator('td[data-key="name"] input').fill('RPTI Retarget Test Asset');
    await newAssetRow.locator('td[data-key="name"] input').press('Tab');
    await page.waitForTimeout(300);

    await page.getByTestId('data-manager-tab-rpti').click();
    await page.getByTestId('add-row-btn-rpti').click();
    const row = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').last();
    await row.locator('td[data-key="initiativeId"] select').selectOption({ index: 1 });

    const targetSelect = row.locator('td[data-key="targetId"] select');
    const options = await targetSelect.locator('option').all();
    let assetOptionValue: string | null = null;
    let appOptionValue: string | null = null;
    for (const opt of options) {
      const label = await opt.textContent();
      if (label === 'Asset: RPTI Retarget Test Asset') assetOptionValue = await opt.getAttribute('value');
      if (!appOptionValue && label?.startsWith('Deliverable:')) appOptionValue = await opt.getAttribute('value');
    }
    expect(assetOptionValue).not.toBeNull();
    expect(appOptionValue).not.toBeNull();

    // Start pointed at the new Asset.
    await targetSelect.selectOption(assetOptionValue!);
    await row.locator('td[data-key="categoryCode"] select').selectOption('51');
    await row.locator('td[data-key="developmentType"] select').selectOption('new');
    await row.locator('td[data-key="developer"] select').selectOption('inhouse');
    await row.locator('td[data-key="ppjtiRelatedParty"] select').selectOption('n/a');
    await row.locator('td[data-key="ppjtiRelatedParty"] select').press('Tab');
    await page.waitForTimeout(300);

    // Switch the target to the Deliverable option — targetType should re-derive to 'deliverable'.
    await targetSelect.selectOption(appOptionValue!);
    await targetSelect.press('Tab');
    await page.waitForTimeout(300);
    const rptiCountAfterRetarget = await page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').count();

    // Deleting the (initiative-unrelated) Asset must NOT remove this row any more.
    await page.getByTestId('data-manager-tab-assets').click();
    const assetNameInputs = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"] td[data-key="name"] input');
    const assetCount = await assetNameInputs.count();
    let assetMatchIndex = -1;
    for (let i = 0; i < assetCount; i++) {
      if ((await assetNameInputs.nth(i).inputValue()) === 'RPTI Retarget Test Asset') { assetMatchIndex = i; break; }
    }
    expect(assetMatchIndex).toBeGreaterThanOrEqual(0);
    const assetRow = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]').nth(assetMatchIndex);
    await assetRow.locator('[data-testid^="delete-row-btn-"]').click();
    const confirmModal = page.getByTestId('confirm-modal-confirm');
    if (await confirmModal.isVisible().catch(() => false)) await confirmModal.click();
    await page.waitForTimeout(300);

    await page.getByTestId('data-manager-tab-rpti').click();
    await expect(page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]')).toHaveCount(rptiCountAfterRetarget);
  });

  test('Generate button builds a row from a current-year in-production segment linked to an initiative', async ({ page }) => {
    const currentYear = new Date().getFullYear();

    // Seed a Deliverable + a current-year in-production DeliverableSegment linked to an
    // existing demo initiative, directly via IndexedDB — demo data never links segments
    // to initiatives, so nothing would qualify for generation without this.
    const deliverableId = await page.evaluate(({ year }) => {
      return new Promise<string>((resolve, reject) => {
        const req = indexedDB.open('it-initiative-visualiser');
        req.onsuccess = () => {
          const db = req.result;
          const readTx = db.transaction(['assets', 'initiatives'], 'readonly');
          const assetCursor = readTx.objectStore('assets').openCursor();
          assetCursor.onsuccess = () => {
            const assetId = assetCursor.result?.value.id;
            if (!assetId) { reject(new Error('No assets found')); return; }
            const initCursor = readTx.objectStore('initiatives').openCursor();
            initCursor.onsuccess = () => {
              const initiativeId = initCursor.result?.value.id;
              if (!initiativeId) { reject(new Error('No initiatives found')); return; }

              const deliverableId = `deliv-gen-test-${Date.now()}`;
              const writeTx = db.transaction(['deliverables', 'deliverableSegments'], 'readwrite');
              writeTx.objectStore('deliverables').put({ id: deliverableId, assetId, name: 'Generate Test Deliverable' });
              writeTx.objectStore('deliverableSegments').put({
                id: `seg-gen-test-${Date.now()}`,
                deliverableId,
                initiativeId,
                status: 'appstatus-in-production',
                startDate: `${year}-08-01`,
                endDate: `${year}-12-31`,
              });
              writeTx.oncomplete = () => { db.close(); resolve(deliverableId); };
              writeTx.onerror = () => reject(writeTx.error);
            };
            initCursor.onerror = () => reject(initCursor.error);
          };
          assetCursor.onerror = () => reject(assetCursor.error);
        };
        req.onerror = () => reject(req.error);
      });
    }, { year: currentYear });

    await page.reload();
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-rpti').click();

    await page.getByTestId('rpti-generate-btn').click();
    await page.getByTestId('confirm-modal-confirm').click();
    await page.waitForTimeout(300);

    const rows = page.locator('[data-testid="data-manager"] tbody tr[data-real="true"]');
    await expect(rows).toHaveCount(1);
    const row = rows.first();
    await expect(row.locator('td[data-key="targetId"] select')).toHaveValue(deliverableId);
    await expect(row.locator('td[data-key="developmentType"] select')).toHaveValue('upgrade');
    await expect(row.locator('td[data-key="plannedImplementationQuarter"] select')).toHaveValue('Q3');
  });
});
