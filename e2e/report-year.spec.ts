import { seedReportRecords, reportFixture, generateReport, exportedReportText, readStore } from './report-fixtures';
import { expect, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as XLSX from 'xlsx';

test.describe('Report year', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('scenia-e2e', 'true');
      localStorage.setItem('scenia_has_seen_landing', 'true');
    });
    await page.reload();
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
    await page.getByTestId('nav-reports').click();
  });

  test('asks for a year before generating either filing and states that year in the result', async ({ page }) => {
    await page.getByTestId('report-card-rpti').click();
    await expect(page.getByTestId('rpti-report-year-input')).toBeVisible();
    await expect(page.getByTestId('rpti-generate-report-btn')).toBeDisabled();
    await page.getByTestId('rpti-report-year-input').fill('2027');
    await page.getByTestId('rpti-generate-report-btn').click();
    await expect(page.getByTestId('rpti-report-view')).toContainText('2027');

    await page.getByTestId('report-back-btn').click();
    await page.getByTestId('report-card-lkpti').click();
    await expect(page.getByTestId('lkpti-report-year-input')).toBeVisible();
    await page.getByTestId('lkpti-report-year-input').fill('2026');
    await page.getByTestId('lkpti-generate-report-btn').click();
    await expect(page.getByTestId('lkpti-report-view')).toContainText('2026');
  });

  test('states the selected year inside each downloaded workbook', async ({ page }) => {
    await seedReportRecords(page, reportFixture, [
      'assets', 'assetCategories', 'programmes', 'initiatives', 'deliverables',
      'deliverableSegments', 'rptiDetails', 'lkptiDetails',
    ]);

    await generateReport(page, 'rpti', '2026');
    expect(await exportedReportText(page, 'rpti')).toContain('2026');

    await generateReport(page, 'lkpti', '2026');
    expect(await exportedReportText(page, 'lkpti')).toContain('2026');
  });

  test('two 2027 go-lives appear as two report rows and two exported workbook rows (T012)', async ({ page }) => {
    await seedReportRecords(page, { ...reportFixture,
      initiatives: [{ ...reportFixture.initiatives[0], deliverableId: 'filing-deliverable',
        startDate: '2027-01-01', endDate: '2027-12-31' }],
      deliverableSegments: [
        { ...reportFixture.deliverableSegments[0], id: 'q2-live', startDate: '2027-04-01', endDate: '2027-09-30' },
        { ...reportFixture.deliverableSegments[0], id: 'q4-live', startDate: '2027-10-01', endDate: '2031-12-31' },
      ],
    }, ['assets', 'assetCategories', 'programmes', 'initiatives', 'deliverables', 'deliverableSegments', 'rptiDetails']);

    await generateReport(page, 'rpti', '2027');
    const visibleRows = page.getByTestId('rpti-detail-table').locator('tbody tr');
    await expect(visibleRows).toHaveCount(2);
    await expect(visibleRows.nth(0)).toContainText('Q2');
    await expect(visibleRows.nth(1)).toContainText('Q4');

    const [download] = await Promise.all([
      page.waitForEvent('download'), page.getByTestId('rpti-report-export-btn').click(),
    ]);
    const path = await download.path();
    if (!path) throw new Error('No downloaded workbook');
    const workbook = XLSX.read(fs.readFileSync(path), { type: 'buffer' });
    const exportedRows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets['RPTI Format 3.1'], { header: 1 });
    expect(exportedRows.slice(1).map(row => [row[1], row[9]])).toEqual([
      ['Filing Application', 'Q2'], ['Filing Application', 'Q4'],
    ]);
  });

  test('following the named asset-target repair clears the finding and enables export', async ({ page }) => {
    await seedReportRecords(page, {
      ...reportFixture,
      initiatives: [{ ...reportFixture.initiatives[0], deliverableId: undefined }],
      deliverableSegments: [],
      rptiDetails: [{
        id: 'legacy-asset-target', initiativeId: 'filing-initiative',
        targetType: 'asset', targetId: 'filing-asset', developmentType: 'new',
      }],
    }, ['assets', 'assetCategories', 'programmes', 'initiatives', 'deliverables', 'deliverableSegments', 'rptiDetails']);

    await generateReport(page, 'rpti', '2026');
    await expect(page.getByTestId('rpti-pre-export-gate')).toContainText(/segment panel/i);
    await expect(page.getByTestId('rpti-pre-export-gate')).toContainText(/timeline/i);
    await expect(page.getByTestId('rpti-report-export-btn')).toHaveCount(0);

    // The replacement route is now entirely on the lifecycle segment: the segment
    // panel records both the application and the initiative it implements.
    await page.getByTestId('nav-visualiser').click();
    await page.getByTestId('timeline-start-input').fill('2026-01-01');
    await page.getByTestId('timeline-start-input').press('Enter');
    const swimlane = page.getByTestId('deliverable-row-content');
    await expect(swimlane).toBeVisible();
    await swimlane.dblclick({ position: { x: 200, y: 20 } });
    const panel = page.getByTestId('segment-panel');
    await expect(panel).toBeVisible();
    await panel.getByTestId('segment-deliverable').selectOption('filing-deliverable');
    await panel.getByTestId('segment-status').selectOption('appstatus-in-production');
    await panel.getByTestId('segment-initiative').selectOption('filing-initiative');
    await panel.getByTestId('segment-start-date').fill('2026-03-15');
    await panel.getByTestId('segment-end-date').fill('2026-12-31');
    await panel.getByRole('button', { name: 'Add Segment' }).click();
    await expect(panel).toBeHidden();

    await generateReport(page, 'rpti', '2026');
    await expect(page.getByTestId('rpti-pre-export-gate')).toHaveCount(0);
    await expect(page.getByTestId('rpti-report-export-btn')).toBeVisible();
  });

  test('a lifted legacy cost cannot overwrite a newer Initiative edit on reload', async ({ page }) => {
    await seedReportRecords(page, {
      ...reportFixture,
      initiatives: [{ ...reportFixture.initiatives[0], rptiRemarks: 'Current initiative remark' }],
      deliverableSegments: [{ ...reportFixture.deliverableSegments[0], rptiRemarks: undefined }],
      rptiDetails: [{
        id: 'legacy-cost', initiativeId: 'filing-initiative', targetType: 'deliverable',
        targetId: 'filing-deliverable', developmentType: 'upgrade',
        capexAmount: 700, opexAmount: 70,
      }],
    }, ['assets', 'assetCategories', 'programmes', 'initiatives', 'deliverables', 'deliverableSegments', 'rptiDetails']);

    await expect.poll(async () => (await readStore(page, 'initiatives'))[0]?.capex).toBe(700);
    await expect.poll(async () => (await readStore(page, 'rptiDetails'))[0]?.capexAmount).toBeUndefined();
    await expect.poll(async () => (await readStore(page, 'deliverableSegments'))[0]?.rptiRemarks)
      .toBe('Current initiative remark');

    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-initiatives').click();
    const row = page.locator('tbody tr[data-real="true"]').filter({ has: page.locator('input[value="Filing Initiative"]') });
    const capex = row.getByTestId('real-input-capex');
    await capex.fill('900');
    await capex.press('Enter');
    await expect.poll(async () => (await readStore(page, 'initiatives'))[0]?.capex).toBe(900);

    await page.reload();
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-initiatives').click();
    const reloaded = page.locator('tbody tr[data-real="true"]').filter({ has: page.locator('input[value="Filing Initiative"]') });
    await expect(reloaded.getByTestId('real-input-capex')).toHaveValue('900');
  });

  test('restoring a pre-ADR-0013 version lifts its rows before generating either filing', async ({ page }) => {
    await seedReportRecords(page, reportFixture, [
      'assets', 'assetCategories', 'programmes', 'initiatives', 'deliverables',
      'deliverableSegments', 'rptiDetails', 'lkptiDetails',
    ]);

    await page.getByTestId('nav-history').click();
    await page.getByRole('button', { name: 'Save Current State' }).click();
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', 'Pre-ADR-0013');
    await page.getByRole('button', { name: 'Save Version' }).click();

    // Turn the saved snapshot into the shape Selara wrote before ADR-0013: the
    // filing values live only on report rows, not on the entities generation reads.
    await page.evaluate(() => new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('it-initiative-visualiser');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('versions', 'readwrite');
        const store = tx.objectStore('versions');
        const all = store.getAll();
        all.onsuccess = () => {
          const saved = all.result.find(version => version.name === 'Pre-ADR-0013');
          if (!saved) {
            reject(new Error('Saved version not found'));
            return;
          }
          saved.data.initiatives[0] = {
            ...saved.data.initiatives[0], capex: 100, opex: 10, rptiRemarks: undefined,
          };
          saved.data.deliverableSegments[0] = {
            ...saved.data.deliverableSegments[0], capexAmount: undefined,
            opexAmount: undefined, rptiRemarks: undefined,
          };
          saved.data.deliverables[0] = {
            ...saved.data.deliverables[0], platform: undefined, database: undefined,
          };
          saved.data.rptiDetails = [{
            id: 'legacy-rpti', initiativeId: 'filing-initiative', targetType: 'deliverable',
            targetId: 'filing-deliverable', developmentType: 'upgrade',
            deliverableSegmentId: 'filing-segment',
            capexAmount: 777777, opexAmount: 88888, remarks: 'Restored legacy filing note',
          }];
          saved.data.lkptiDetails = [{
            id: 'legacy-lkpti', targetId: 'filing-deliverable',
            platform: 'Restored legacy platform', database: 'Restored legacy database',
          }];
          store.put(saved);
        };
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    }));

    // Reload only to make the altered snapshot visible in History. After Restore,
    // generate immediately: this is the sequence that used to file un-lifted data.
    await page.reload();
    await page.getByTestId('nav-history').click();
    await page.getByText('Pre-ADR-0013').click();
    await page.getByRole('button', { name: 'Restore to Current' }).click();
    await page.getByTestId('confirm-modal-confirm').click();

    await generateReport(page, 'rpti', '2026');
    const rpti = page.getByTestId('rpti-detail-table');
    await expect(rpti).not.toContainText('777,777');
    await expect(rpti).not.toContainText('88,888');
    await expect(rpti).toContainText('Restored legacy filing note');

    await generateReport(page, 'lkpti', '2026');
    const lkpti = page.getByTestId('lkpti-detail-table');
    await expect(lkpti).toContainText('Restored legacy platform');
    await expect(lkpti).toContainText('Restored legacy database');

    // Restore persists the one-time migration marker in its existing handleUpdate
    // write, so a later reload cannot reapply the stale cost overrides.
    await expect.poll(async () => (await readStore(page, 'rptiDetails'))[0]?.capexAmount).toBeUndefined();
    await expect.poll(async () => (await readStore(page, 'initiatives'))[0]?.capex).toBe(777777);
    await expect.poll(async () => (await readStore(page, 'deliverableSegments'))[0]?.rptiRemarks)
      .toBe('Restored legacy filing note');
    await expect.poll(async () => (await readStore(page, 'deliverableSegments'))[0]?.capexAmount)
      .toBeUndefined();
  });

  /**
   * Restores the guarantee that "names a missing target even when no stored RPTI row
   * exists" used to pin. That test was deleted with initiative-rpti-no-target in
   * Phase 6, but the state it guarded did not go away: a live implementation whose
   * application has been deleted still projects a row naming a Deliverable that is
   * not there. Data Health reported it throughout as segment-deliverable; the gate
   * could not see it, so the return was exportable. Detected is not blocked.
   */
  test('blocks export when a live implementation names a Deliverable that no longer exists', async ({ page }) => {
    await seedReportRecords(page, { ...reportFixture, deliverables: [], rptiDetails: [] },
      ['initiatives', 'deliverables', 'deliverableSegments', 'rptiDetails']);
    await generateReport(page, 'rpti');
    await expect(page.getByTestId('rpti-pre-export-gate')).toContainText(/no longer exists/i);
    await expect(page.getByTestId('rpti-pre-export-gate')).toContainText(/segment panel|timeline/i);
    await expect(page.getByTestId('rpti-report-export-btn')).toHaveCount(0);
  });

  test('allows one initiative to file several segment-owned targets', async ({ page }) => {
    await seedReportRecords(page, { ...reportFixture,
      deliverables: [...reportFixture.deliverables, { ...reportFixture.deliverables[0], id: 'second-target', name: 'Second Application' }],
      deliverableSegments: [...reportFixture.deliverableSegments, { ...reportFixture.deliverableSegments[0], id: 'second-segment', deliverableId: 'second-target' }],
    }, ['initiatives', 'deliverables', 'deliverableSegments', 'rptiDetails']);
    await generateReport(page, 'rpti');
    await expect(page.getByTestId('rpti-pre-export-gate')).toHaveCount(0);
    const rows = page.getByTestId('rpti-detail-table').locator('tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Filing Application');
    await expect(rows.nth(1)).toContainText('Second Application');
    await expect(page.getByTestId('rpti-report-export-btn')).toBeVisible();
  });

  test('shows every stored field of an unresolved imported row', async ({ page }) => {
    await seedReportRecords(page, { rptiDetails: [{ id: 'unresolved', initiativeId: 'missing-initiative',
      targetType: 'deliverable', targetId: 'missing-target', developmentType: 'upgrade', categoryCode: '06',
      developer: 'PPJTI', ppjtiRelatedParty: 'related', dcCity: 'Stored Jakarta', dcCountry: 'Indonesia',
      drCity: 'Stored Surabaya', drCountry: 'Indonesia', plannedImplementationQuarter: 'Q4', remarks: 'Irreplaceable filed note' }] });
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-rpti').click();
    const table = page.getByTestId('rpti-readonly-table');
    for (const value of ['upgrade', 'PPJTI', 'Stored Jakarta', 'Stored Surabaya', 'Q4', 'Irreplaceable filed note']) {
      await expect(table).toContainText(value);
    }
    await expect(table.locator('input, select, textarea')).toHaveCount(0);
  });

  // Issue #40, option 1 + 3. The projection must be pure, and reconciliation must be
  // explicit: a valid 2027 row absent from a 2026 return is correct (no finding), while
  // an unreproducible stored row is named as a finding and never carried into the return.
  test('generating 2026 omits the 2027 plan line and names the unreproducible stored row instead of carrying it', async ({ page }) => {
    await seedReportRecords(page, {
      ...reportFixture,
      deliverableSegments: [{ ...reportFixture.deliverableSegments[0], startDate: '2027-03-15', endDate: '2027-12-31' }],
      rptiDetails: [
        { id: 'rpti-gen-filing-initiative-filing-deliverable-2027', initiativeId: 'filing-initiative',
          targetType: 'deliverable', targetId: 'filing-deliverable', developmentType: 'new',
          plannedImplementationQuarter: 'Q1', deliverableSegmentId: 'filing-segment' },
        { id: 'ghost-row', initiativeId: 'ghost-initiative', targetType: 'deliverable',
          targetId: 'ghost-deliverable', developmentType: 'upgrade' },
      ],
    }, ['initiatives', 'deliverables', 'deliverableSegments', 'rptiDetails']);

    await generateReport(page, 'rpti', '2026');
    await expect(page.getByTestId('rpti-report-view')).toContainText('2026');
    // The 2027 line stays out of the 2026 filing — under the old merge it was carried in.
    await expect(page.getByTestId('rpti-detail-table')).toHaveCount(0);
    await expect(page.getByText(/no rpti rows recorded yet/i)).toBeVisible();
    // The unreproducible row is reconciliation evidence, surfaced as a named repair...
    await expect(page.getByTestId('rpti-pre-export-gate')).toContainText(/both.*missing.*re-import/i);
    await expect(page.getByTestId('rpti-report-export-btn')).toHaveCount(0);

    // ...and generating its own year shows the 2027 line with no finding about it.
    await generateReport(page, 'rpti', '2027');
    await expect(page.getByTestId('rpti-detail-table')).toContainText('Filing Application');
    // The ghost row's repair still blocks: option 1's gate is global, not selected-year.
    await expect(page.getByTestId('rpti-pre-export-gate')).toContainText(/both.*missing.*re-import/i);
  });

  // Contract 3 / FR-021. The whole model rests on Reports deriving a transient result:
  // if generating quietly rewrote the stored rows, the "read-only" tabs would still be
  // changing underneath the preparer, just without a visible editor.
  test('generating a filing from Reports leaves the stored rows untouched', async ({ page }) => {
    const stored = {
      id: 'stored-untouched', initiativeId: 'filing-initiative', targetType: 'deliverable',
      targetId: 'filing-deliverable', categoryCode: '06', developmentType: 'upgrade',
      plannedImplementationQuarter: 'Q4', remarks: 'Stored wording, not the initiative\'s',
    };
    await seedReportRecords(page, { ...reportFixture, rptiDetails: [stored] });

    const before = await readStore(page, 'rptiDetails');
    expect(before, 'guard: the row must actually be stored, or this asserts nothing').toHaveLength(1);

    await generateReport(page, 'rpti', '2026');
    await expect(page.getByTestId('rpti-report-view')).toContainText('2026');

    expect(await readStore(page, 'rptiDetails'),
      'generating from Reports must not write to the stored rows').toEqual(before);
  });

  test('keeps imported report rows readable but does not offer report-row edits in Data Manager', async ({ page }) => {
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-rpti').click();
    await expect(page.getByTestId('rpti-readonly-table')).toBeVisible();
    await expect(page.getByTestId('add-row-btn-rpti')).toHaveCount(0);
    await expect(page.getByTestId('rpti-generate-btn')).toHaveCount(0);

    await page.getByTestId('data-manager-tab-lkpti').click();
    await expect(page.getByTestId('lkpti-readonly-table')).toBeVisible();
    await expect(page.getByTestId('add-row-btn-lkpti')).toHaveCount(0);
    await expect(page.getByTestId('lkpti-generate-btn')).toHaveCount(0);
  });
});
