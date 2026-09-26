import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import { seedReportRecords, readStore } from './report-fixtures';

const SAMPLE = path.join(process.cwd(), 'docs', 'sample-data');

async function onboard(page: Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    await new Promise<void>(resolve => {
      const req = indexedDB.deleteDatabase('it-initiative-visualiser');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => setTimeout(resolve, 200);
    });
    localStorage.removeItem('scenia-e2e');
    localStorage.setItem('scenia_has_seen_landing', 'true');
  });
  await page.reload();
  await expect(page.getByTestId('template-picker-modal')).toBeVisible({ timeout: 20000 });
  await page.getByTestId('onboarding-lkpti-file-input').setInputFiles(path.join(SAMPLE, 'sample-lkpti-2026.xlsx'));
  await page.getByTestId('onboarding-lkpti-year').fill('2026');
  await page.getByTestId('onboarding-rpti-file-input').setInputFiles(path.join(SAMPLE, 'sample-rpti-2027.xlsx'));
  await page.getByTestId('onboarding-rpti-year').fill('2027');
  await page.getByTestId('onboarding-import-btn').click();
  await expect(page.getByTestId('data-health-report-view')).toBeVisible({ timeout: 20000 });
  await page.getByTestId('import-summary-dismiss').click();
}

const repair = (page: Page) => page.getByTestId('repair-unresolved-row-rpti-import-row-14');
const finding = (page: Page) => page.getByTestId('data-health-issue-rpti-target:rpti-import-row-14');

test.describe('repair unresolved RPTI row from its finding', () => {
  test.beforeEach(async ({ page }) => { await onboard(page); });

  test('shows a sourced draft, creates one faithful upgrade, and undoes in one step', async ({ page }) => {
    await expect(finding(page)).toContainText('Legacy Teller Application');
    await expect(repair(page)).toBeVisible();
    await repair(page).click();
    await expect(page.getByTestId('unresolved-row-repair-dialog')).toBeVisible();
    await page.getByTestId('repair-option-create').click();
    await expect(page.getByTestId('repair-name')).toHaveValue('Legacy Teller Application');
    await expect(page.getByTestId('repair-name-source')).toContainText(/initiative/i);
    await expect(page.getByTestId('repair-category-code')).toHaveValue('12');
    await expect(page.getByTestId('repair-category-code-source')).toContainText(/filed row/i);
    await expect(page.getByTestId('repair-developer')).toHaveValue('inhouse');
    await expect(page.getByTestId('repair-ppjti-related-party')).toHaveValue('n/a');
    await expect(page.getByTestId('repair-dc-city')).toHaveValue('Jakarta');
    await expect(page.getByTestId('repair-dc-country')).toHaveValue('Indonesia');
    await expect(page.getByTestId('repair-dr-city')).toHaveValue('Surabaya');
    await expect(page.getByTestId('repair-dr-country')).toHaveValue('Indonesia');
    await expect(page.getByTestId('repair-remarks')).toHaveValue('Not present in the 2026 LKPTI — needs a target.');
    await expect(page.getByTestId('repair-capex')).toHaveValue('2900000000');
    await expect(page.getByTestId('repair-opex')).toHaveValue('640000000');
    await expect(page.getByTestId('repair-capex-source')).toContainText(/current budget/i);
    await expect(page.getByTestId('repair-opex-source')).toContainText(/current budget/i);
    await expect(page.getByTestId('repair-quarter')).toHaveValue('Q3');
    await expect(page.getByTestId('repair-quarter')).toHaveAttribute('readonly', '');
    await expect(page.getByTestId('repair-filed-year')).toHaveValue('2027');
    await expect(page.getByTestId('repair-filed-year')).toHaveAttribute('readonly', '');
    await expect(page.getByTestId('repair-prior-note')).toContainText('2026');
    await page.getByTestId('repair-confirm').click();
    await expect(finding(page)).toHaveCount(0);
    await page.getByTestId('report-back-btn').click();
    await page.getByTestId('report-card-rpti').click();
    await page.getByTestId('rpti-generate-report-btn').click();
    await expect(page.getByTestId('rpti-pre-export-gate')).toHaveCount(0);
    await expect(page.getByTestId('rpti-detail-table')).toContainText('Legacy Teller Application');
    await page.getByTitle('Undo').click();
    await page.getByTestId('report-back-btn').click();
    await page.getByTestId('report-card-data-health').click();
    await expect(finding(page)).toBeVisible();
  });

  test('an emptied cost is refused, never filed as zero, and constrained fields are choices', async ({ page }) => {
    // Coordinator review of US1: Number('') is 0, so clearing CapEx silently filed zero,
    // and category code and related party accepted any text.
    await repair(page).click();
    await page.getByTestId('repair-option-create').click();
    await expect(page.getByTestId('repair-category-code')).toHaveJSProperty('tagName', 'SELECT');
    await expect(page.getByTestId('repair-ppjti-related-party')).toHaveJSProperty('tagName', 'SELECT');
    await expect(page.getByTestId('repair-category-code').locator('option[value="51"]')).toHaveCount(0);
    await page.getByTestId('repair-capex').fill('');
    await page.getByTestId('repair-confirm').click();
    await expect(page.getByTestId('repair-error')).toBeVisible();
    await expect(page.getByTestId('unresolved-row-repair-dialog')).toBeVisible();
    await page.getByTestId('repair-cancel').click();
    await expect(finding(page)).toBeVisible();
  });

  test('cancel keeps the finding', async ({ page }) => {
    await repair(page).click();
    await page.getByTestId('repair-option-create').click();
    await page.getByTestId('repair-cancel').click();
    await expect(finding(page)).toBeVisible();
  });

  test('the RPTI gate opens the same repair and clears after confirm', async ({ page }) => {
    await page.getByTestId('report-back-btn').click();
    await page.getByTestId('report-card-rpti').click();
    await page.getByTestId('rpti-generate-report-btn').click();
    await expect(page.getByTestId('rpti-pre-export-gate')).toContainText('Legacy Teller Application');
    await repair(page).click();
    await page.getByTestId('repair-option-create').click();
    await page.getByTestId('repair-confirm').click();
    await expect(page.getByTestId('rpti-pre-export-gate')).toHaveCount(0);
  });

  test('FR-003: adding a Deliverable directly creates no lifecycle segment', async ({ page }) => {
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-deliverables').click();
    const count = async (store: 'deliverables' | 'deliverableSegments') => page.evaluate(async (name) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('it-initiative-visualiser');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return new Promise<number>((resolve, reject) => {
        const req = db.transaction(name).objectStore(name).count();
        req.onsuccess = () => { db.close(); resolve(req.result); };
        req.onerror = () => reject(req.error);
      });
    }, store);
    const before = await count('deliverableSegments');
    const deliverablesBefore = await count('deliverables');
    await page.getByRole('button', { name: 'Add Row' }).click();
    await expect.poll(() => count('deliverables')).toBe(deliverablesBefore + 1);
    expect(await count('deliverableSegments')).toBe(before);
  });
});

test.describe('US2: repair onto an existing inventory entry', () => {
  test.beforeEach(async ({ page }) => {
    await onboard(page);
    await page.evaluate(() => localStorage.setItem('scenia-e2e', 'true'));
    await seedReportRecords(page, {
      assetCategories: [
        { id: 'repair-cat-12', name: 'Applications', categoryCode: '12' },
        { id: 'repair-cat-06', name: 'Other applications', categoryCode: '06' },
      ],
      assets: [
        { id: 'repair-asset-suggested', name: 'Renamed teller', categoryId: 'repair-cat-12' },
        { id: 'repair-asset-other', name: 'Payments Hub', categoryId: 'repair-cat-06' },
      ],
      deliverables: [
        { id: 'repair-suggested', assetId: 'repair-asset-suggested', name: 'Legacy Teller Platform',
          type: 'application', developer: 'inhouse', dcCity: 'Bandung', dcCountry: 'Indonesia',
          drCity: 'Surabaya', drCountry: 'Indonesia' },
        { id: 'repair-other', assetId: 'repair-asset-other', name: 'Payments Hub',
          type: 'application', developer: 'inhouse', dcCity: 'Jakarta', dcCountry: 'Indonesia',
          drCity: 'Surabaya', drCountry: 'Indonesia' },
      ],
    });
    await page.getByTestId('nav-reports').click();
    if (!await page.getByTestId('data-health-report-view').isVisible()) {
      if (await page.getByTestId('report-back-btn').isVisible()) await page.getByTestId('report-back-btn').click();
      await page.getByTestId('report-card-data-health').click();
    }
  });

  test('suggests a renamed entry without selecting it, finds another by search, and updates its filed category', async ({ page }) => {
    await repair(page).click();
    await page.getByTestId('repair-option-existing').click();
    await expect(page.getByTestId('repair-candidate-repair-suggested')).toContainText('Legacy Teller Platform');
    await expect(page.getByTestId('repair-suggested')).toContainText('Suggested');
    await expect(page.getByTestId('repair-confirm')).toBeDisabled();
    await page.getByTestId('repair-candidate-search').fill('Payments Hub');
    await expect(page.getByTestId('repair-candidate-repair-suggested')).toHaveCount(0);
    await page.getByTestId('repair-candidate-repair-other').click();
    await expect(page.getByTestId('repair-difference-categoryCode')).toContainText('12');
    await expect(page.getByTestId('repair-difference-categoryCode')).toContainText('06');
    await expect(page.getByTestId('repair-difference-categoryCode')).toContainText('LKPTI');
    await page.getByTestId('repair-choice-categoryCode-update').click();
    await page.getByTestId('repair-confirm').click();
    await expect(finding(page)).toHaveCount(0);
    const deliverables = await readStore(page, 'deliverables');
    expect(deliverables.find(item => item.id === 'repair-other')?.categoryCode).toBe('12');
    const segments = await readStore(page, 'deliverableSegments');
    expect(segments).toContainEqual(expect.objectContaining({ id: 'rpti-repair-seg-rpti-import-row-14',
      deliverableId: 'repair-other' }));
    await page.getByTestId('report-back-btn').click();
    await page.getByTestId('report-card-rpti').click();
    await page.getByTestId('rpti-generate-report-btn').click();
    await expect(page.getByTestId('rpti-detail-table').locator('tr').filter({ hasText: 'Payments Hub' }))
      .toContainText('12 —');
  });

  test('keeping a differing category leaves the entry unchanged', async ({ page }) => {
    await repair(page).click();
    await page.getByTestId('repair-option-existing').click();
    await page.getByTestId('repair-candidate-search').fill('Payments Hub');
    await page.getByTestId('repair-candidate-repair-other').click();
    await page.getByTestId('repair-choice-categoryCode-keep').click();
    await page.getByTestId('repair-confirm').click();
    await expect(finding(page)).toHaveCount(0);
    const deliverables = await readStore(page, 'deliverables');
    expect(deliverables.find(item => item.id === 'repair-other')?.categoryCode).toBeUndefined();
    await page.getByTestId('report-back-btn').click();
    await page.getByTestId('report-card-rpti').click();
    await page.getByTestId('rpti-generate-report-btn').click();
    await expect(page.getByTestId('rpti-detail-table').locator('tr').filter({ hasText: 'Payments Hub' }))
      .toContainText('06 —');
  });
});

test('US2: infrastructure unresolved row offers only an existing entry', async ({ page }) => {
  await onboard(page);
  await page.evaluate(() => localStorage.setItem('scenia-e2e', 'true'));
  const original = (await readStore(page, 'rptiDetails')).find(item => item.id === 'rpti-import-row-14');
  const originalInitiative = (await readStore(page, 'initiatives')).find(item => item.id === original?.initiativeId);
  expect(original).toBeTruthy();
  expect(originalInitiative).toBeTruthy();
  await seedReportRecords(page, {
    rptiDetails: [{ ...original, id: 'infra-unresolved', initiativeId: 'infra-init',
      targetId: 'rpti-import-unresolved-infra', categoryCode: '51' }],
    initiatives: [{ ...originalInitiative, id: 'infra-init', name: 'Primary Data Center — Q3 2027' }],
    assetCategories: [{ id: 'infra-category', name: 'Infrastructure', categoryCode: '51' }],
    assets: [{ id: 'infra-asset-a', name: 'Primary Data Center', categoryId: 'infra-category' },
      { id: 'infra-asset-b', name: 'Primary Data Center', categoryId: 'infra-category' }],
    deliverables: [{ id: 'infra-a', assetId: 'infra-asset-a', name: 'Primary Data Center', type: 'infrastructure' },
      { id: 'infra-b', assetId: 'infra-asset-b', name: 'Primary Data Center', type: 'infrastructure' }],
  });
  await page.getByTestId('nav-reports').click();
  if (!await page.getByTestId('data-health-report-view').isVisible()) {
    if (await page.getByTestId('report-back-btn').isVisible()) await page.getByTestId('report-back-btn').click();
    await page.getByTestId('report-card-data-health').click();
  }
  await page.getByTestId('repair-unresolved-row-infra-unresolved').click();
  await expect(page.getByTestId('repair-option-create')).toHaveCount(0);
  await page.getByTestId('repair-option-existing').click();
  await expect(page.getByTestId('repair-candidate-infra-a')).toBeVisible();
  await expect(page.getByTestId('repair-candidate-infra-b')).toBeVisible();
  await expect(page.getByTestId('repair-confirm')).toBeDisabled();
});

test.describe('US3: an importer prior phase that leaves an application out of inventory years', () => {
  const OLD_PRIOR_ID = 'rpti-import-seg-prior-1';
  const GAP_ID = `rpti-import-prior-phase-gap:${OLD_PRIOR_ID}`;

  // An application the bank already ran, left by an older import with its synthetic prior
  // phase in the original one-year shape, plus the Q1 2027 implementation that was filed.
  // The prior ends on 2026-12-31, so from 2027 on the application drops out of the LKPTI.
  const oldShapeFixture = {
    programmes: [{ id: 'gap-programme', name: 'Plan', color: 'blue' }],
    assetCategories: [{ id: 'gap-category', name: 'Internal management', categoryCode: '12' }],
    assets: [{ id: 'a-gap', name: 'Core Teller System', categoryId: 'gap-category', maturity: 1 }],
    deliverables: [{ id: 'gap-app', assetId: 'a-gap', name: 'Core Teller System', type: 'application', developer: 'inhouse' }],
    initiatives: [{ id: 'gap-init', name: 'Core Teller System — Q1 2027', programmeId: 'gap-programme', assetId: 'a-gap',
      startDate: '2027-01-01', endDate: '2027-03-31', capex: 100, opex: 10 }],
    deliverableStatuses: [{ id: 'appstatus-in-production', name: 'In Production', color: 'bg-emerald-500', isLiveStatus: true }],
    deliverableSegments: [
      { id: OLD_PRIOR_ID, deliverableId: 'gap-app', startDate: '2026-01-01', endDate: '2026-12-31',
        status: 'appstatus-in-production' },
      { id: 'gap-impl', deliverableId: 'gap-app', initiativeId: 'gap-init', startDate: '2027-01-01', endDate: '2027-03-31',
        status: 'appstatus-in-production', capexAmount: 100, opexAmount: 10, rptiRemarks: 'Filed remark' },
    ],
  };

  const endDateOfOldPrior = async (page: Page) => {
    const stored = await readStore(page, 'deliverableSegments');
    return (stored.find(row => row.id === OLD_PRIOR_ID) as { endDate?: string } | undefined)?.endDate;
  };

  const openReport = async (page: Page, slug: string) => {
    if (await page.getByTestId('report-back-btn').isVisible().catch(() => false)) {
      await page.getByTestId('report-back-btn').click();
    }
    await page.getByTestId(`report-card-${slug}`).click();
  };

  const expandGapGroup = (page: Page) => page.getByTestId('data-health-group-rpti-import-prior-phase-gap').click();

  const expectRptiExportsWithNoGate = async (page: Page) => {
    await openReport(page, 'rpti');
    await page.getByTestId('rpti-report-year-input').fill('2027');
    await page.getByTestId('rpti-generate-report-btn').click();
    await expect(page.getByTestId('rpti-pre-export-gate')).toHaveCount(0);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('rpti-report-export-btn').click(),
    ]);
    expect(download).toBeTruthy();
  };

  const TEMPLATE_STORES = [
    'assets', 'initiatives', 'milestones', 'programmes', 'strategies', 'dependencies',
    'assetCategories', 'resources', 'deliverables', 'deliverableSegments', 'deliverableStatuses',
    'decisions', 'rptiDetails', 'lkptiDetails',
  ];

  test.beforeEach(async ({ page }) => {
    // The config injects `scenia-e2e` to bypass the tutorial modal, but that also makes an
    // empty workspace auto-load the RPTI catalogue template. Wait for that save, then seed
    // the fixture with a full clear so it is the whole workspace.
    await page.addInitScript(() => localStorage.setItem('scenia_has_seen_landing', 'true'));
    await page.goto('/');
    await page.waitForFunction(async () => {
      return await new Promise<boolean>(resolve => {
        const req = indexedDB.open('it-initiative-visualiser');
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('assets')) { db.close(); resolve(false); return; }
          const count = db.transaction('assets', 'readonly').objectStore('assets').count();
          count.onsuccess = () => { db.close(); resolve(count.result > 0); };
          count.onerror = () => { db.close(); resolve(false); };
        };
        req.onerror = () => resolve(false);
      });
    }, null, { timeout: 20000 });
    await seedReportRecords(page, oldShapeFixture, [...TEMPLATE_STORES, ...Object.keys(oldShapeFixture)]);
    await expect(page.getByTestId('nav-reports')).toBeVisible({ timeout: 20000 });
  });

  test('warns about the old shape, extends only on demand, never blocks the RPTI, and undoes in one step', async ({ page }) => {
    await page.getByTestId('nav-reports').click();
    await page.getByTestId('report-card-data-health').click();
    await expect(page.getByTestId('data-health-report-view')).toBeVisible();

    // FR-018: loading the workspace and rendering Data Health must not touch the stored phase.
    expect(await endDateOfOldPrior(page)).toBe('2026-12-31');

    // The non-blocking warning names the entry and the years it is missing from.
    await expandGapGroup(page);
    const warning = page.getByTestId(`data-health-issue-${GAP_ID}`);
    await expect(warning).toContainText('Core Teller System');
    await expect(warning).toContainText('2027');
    await expect(warning).toContainText('2032');

    // Not blocked before the extension.
    await expectRptiExportsWithNoGate(page);

    // Extend clears the warning and writes only the one end date.
    await openReport(page, 'data-health');
    await expandGapGroup(page);
    await page.getByTestId(`extend-import-prior-phase-${OLD_PRIOR_ID}`).click();
    await expect(page.getByTestId(`data-health-issue-${GAP_ID}`)).toHaveCount(0);
    await expect.poll(() => endDateOfOldPrior(page)).toBe('2032-12-31');

    // Not blocked after either.
    await expectRptiExportsWithNoGate(page);

    // Undo restores the warning and the old shape in one step.
    await page.getByTitle('Undo').click();
    await openReport(page, 'data-health');
    await expandGapGroup(page);
    await expect(page.getByTestId(`data-health-issue-${GAP_ID}`)).toBeVisible();
    await expect.poll(() => endDateOfOldPrior(page)).toBe('2026-12-31');
  });
});
