import { seedReportRecords, reportFixture, generateReport, readStore } from './report-fixtures';
import { expect, test } from '@playwright/test';

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

  test('blocks export for a legacy asset-target RPTI row and names its repair', async ({ page }) => {
    await page.evaluate(() => new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('it-initiative-visualiser');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['assets', 'initiatives', 'rptiDetails'], 'readwrite');
        const assets = transaction.objectStore('assets').openCursor();
        const initiatives = transaction.objectStore('initiatives').openCursor();
        let assetId: string | undefined;
        let initiativeId: string | undefined;
        assets.onsuccess = () => { assetId = assets.result?.value.id; };
        initiatives.onsuccess = () => { initiativeId = initiatives.result?.value.id; };
        transaction.oncomplete = () => {
          if (!assetId || !initiativeId) { reject(new Error('Demo workspace is missing an asset or initiative')); return; }
          const write = db.transaction(['rptiDetails'], 'readwrite');
          write.objectStore('rptiDetails').put({
            id: 'legacy-asset-target', initiativeId, targetType: 'asset', targetId: assetId, developmentType: 'new',
          });
          write.oncomplete = () => { db.close(); resolve(); };
          write.onerror = () => reject(write.error);
        };
        transaction.onerror = () => reject(transaction.error);
      };
    }));

    await page.reload();
    await page.getByTestId('nav-reports').click();
    await page.getByTestId('report-card-rpti').click();
    await page.getByTestId('rpti-report-year-input').fill('2027');
    await page.getByTestId('rpti-generate-report-btn').click();
    await expect(page.getByTestId('rpti-pre-export-gate')).toContainText(/create.*deliverable/i);
    await expect(page.getByTestId('rpti-report-export-btn')).toHaveCount(0);
  });

  test('blocks an ambiguous initiative before export and permits filing after target repair', async ({ page }) => {
    await seedReportRecords(page, { ...reportFixture,
      deliverables: [...reportFixture.deliverables, { ...reportFixture.deliverables[0], id: 'second-target', name: 'Second Application' }],
      deliverableSegments: [...reportFixture.deliverableSegments, { ...reportFixture.deliverableSegments[0], id: 'second-segment', deliverableId: 'second-target' }],
    }, ['initiatives', 'deliverableSegments', 'rptiDetails']);
    await generateReport(page, 'rpti');
    await expect(page.getByTestId('rpti-pre-export-gate')).toContainText('Filing Initiative');
    await expect(page.getByTestId('rpti-pre-export-gate')).toContainText(/split/i);
    await expect(page.getByTestId('rpti-report-export-btn')).toHaveCount(0);

    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-initiatives').click();
    const row = page.locator('tbody tr[data-real="true"]').filter({ has: page.locator('input[value="Filing Initiative"]') });
    await row.locator('td[data-key="deliverableId"] select').selectOption('filing-deliverable');
    await generateReport(page, 'rpti');
    await expect(page.getByTestId('rpti-pre-export-gate')).toHaveCount(0);
    await expect(page.getByTestId('rpti-detail-table')).toContainText('Filing Application');
    await expect(page.getByTestId('rpti-report-export-btn')).toBeVisible();
  });

  test('names a missing target even when no stored RPTI row exists', async ({ page }) => {
    await seedReportRecords(page, { ...reportFixture, deliverables: [] }, ['initiatives', 'deliverables', 'deliverableSegments', 'rptiDetails']);
    await generateReport(page, 'rpti');
    await expect(page.getByTestId('rpti-pre-export-gate')).toContainText(/select.*Deliverable/);
    await expect(page.getByTestId('rpti-report-export-btn')).toHaveCount(0);
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
    await expect(page.getByTestId('rpti-pre-export-gate')).toContainText(/no longer exists/i);
    await expect(page.getByTestId('rpti-report-export-btn')).toHaveCount(0);

    // ...and generating its own year shows the 2027 line with no finding about it.
    await generateReport(page, 'rpti', '2027');
    await expect(page.getByTestId('rpti-detail-table')).toContainText('Filing Application');
    // The ghost row's repair still blocks: option 1's gate is global, not selected-year.
    await expect(page.getByTestId('rpti-pre-export-gate')).toContainText(/no longer exists/i);
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
