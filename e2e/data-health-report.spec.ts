import { test, expect } from '@playwright/test';

test.describe('Data Health report', () => {
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

  // ── Phase 2: validity checks ───────────────────────────────────────────────
  // See docs/user-stories/23-data-health-phase-2.md AC1 and AC5.

  /** Seeds one LKPTI row holding an impossible calendar date — a single validity error. */
  async function seedInvalidGoLiveDate(page: import('@playwright/test').Page, id: string) {
    await page.evaluate((rowId) => {
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('it-initiative-visualiser');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(['lkptiDetails'], 'readwrite');
          tx.objectStore('lkptiDetails').put({ id: rowId, targetId: 'ghost-deliverable', goLiveDate: '31-02-2021' });
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    }, id);
    await page.reload();
  }

  test('the report is titled Data Health and shows a filing verdict', async ({ page }) => {
    await page.getByTestId('nav-reports').click();
    await expect(page.getByTestId('report-card-data-health')).toContainText('Data Health');
    await page.getByTestId('report-card-data-health').click();
    await expect(page.getByTestId('data-health-verdict')).toBeVisible();
  });

  test('a value that is present but illegal is reported as a validity error', async ({ page }) => {
    const rowId = `lkpti-bad-date-${Date.now()}`;
    await seedInvalidGoLiveDate(page, rowId);

    await page.getByTestId('nav-reports').click();
    await page.getByTestId('report-card-data-health').click();

    await expect(page.getByTestId('data-health-issue-list')).toContainText('31-02-2021');
    await expect(page.getByTestId('data-health-verdict')).toContainText('Not ready to file');
  });

  test('the phase filter narrows the list, and composes with the severity filter', async ({ page }) => {
    const rowId = `lkpti-bad-date-${Date.now()}`;
    await seedInvalidGoLiveDate(page, rowId);

    await page.getByTestId('nav-reports').click();
    await page.getByTestId('report-card-data-health').click();

    const list = page.getByTestId('data-health-issue-list');
    // Absence is asserted against the report view, not the list: a filter combination
    // that matches nothing renders the empty state *instead of* the list, and
    // `not.toContainText` fails on a missing element rather than passing.
    const view = page.getByTestId('data-health-report-view');

    // Completeness-only hides the validity error...
    await page.getByTestId('data-health-phase-filter-completeness').click();
    await expect(view).not.toContainText('31-02-2021');

    // ...validity-only shows it.
    await page.getByTestId('data-health-phase-filter-validity').click();
    await expect(list).toContainText('31-02-2021');

    // And the two axes compose: it is an error, so it survives the error filter...
    await page.getByTestId('data-health-filter-error').click();
    await expect(list).toContainText('31-02-2021');

    // ...and disappears under the warning filter, with no matching issues left at all.
    await page.getByTestId('data-health-filter-warning').click();
    await expect(view).not.toContainText('31-02-2021');
    await expect(view).toContainText('No issues match the current filters.');
  });
});

/**
 * Issue-kind grouping and the report filter.
 *
 * A flat list is legible at the 26 issues a sample workspace produces and unusable
 * at the 1,990 a 300-application one does — where those 1,990 carry only nine
 * distinct kinds between them. Grouping is what makes the volume readable; the
 * report filter alone does not, since selecting RPTI still leaves roughly 1,330.
 */
test.describe('Data Health — grouping and the report filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
    await page.getByTestId('nav-reports').click();
    await page.getByTestId('report-card-data-health').click();
    await expect(page.getByTestId('data-health-report-view')).toBeVisible();
  });

  test('shows one row per kind of problem, not one per affected record', async ({ page }) => {
    const groups = page.locator('[data-testid^="data-health-group-"]:not([data-testid*="count"]):not([data-testid*="items"])');
    const groupCount = await groups.count();
    expect(groupCount).toBeGreaterThan(0);

    // Every group states how many records it covers, and at least one covers several —
    // otherwise grouping is doing nothing and this passes vacuously.
    const counts = await page.locator('[data-testid^="data-health-group-count-"]').allInnerTexts();
    expect(counts).toHaveLength(groupCount);
    expect(counts.some(c => Number(c) > 1)).toBe(true);
  });

  test('an error group is open by default; a warning group is not', async ({ page }) => {
    const groups = page.locator('[data-testid^="data-health-group-"]:not([data-testid*="count"]):not([data-testid*="items"])');
    for (let i = 0; i < await groups.count(); i++) {
      const g = groups.nth(i);
      const isError = (await g.innerText()).includes('ERROR');
      await expect(g, `group ${i}`).toHaveAttribute('aria-expanded', isError ? 'true' : 'false');
    }
  });

  test('expanding a group reveals its records, each still navigating on click', async ({ page }) => {
    const warning = page.locator('[data-testid^="data-health-group-"]:not([data-testid*="count"]):not([data-testid*="items"])')
      .filter({ hasText: 'WARNING' }).first();
    const testId = await warning.getAttribute('data-testid');
    const check = testId!.replace('data-health-group-', '');

    await expect(page.getByTestId(`data-health-group-items-${check}`)).toHaveCount(0);
    await warning.click();
    const items = page.getByTestId(`data-health-group-items-${check}`);
    await expect(items).toBeVisible();
    expect(await items.locator('button').count()).toBeGreaterThan(0);

    await items.locator('button').first().click();
    await expect(page.getByTestId('data-manager')).toBeVisible();
  });

  test('the report filter narrows to what affects one return, and composes with severity', async ({ page }) => {
    const groups = page.locator('[data-testid^="data-health-group-"]:not([data-testid*="count"]):not([data-testid*="items"])');
    const all = await groups.count();

    await page.getByTestId('data-health-report-filter-rpti').click();
    const rptiGroups = await groups.allInnerTexts();
    expect(rptiGroups.length).toBeGreaterThan(0);
    // Nothing badged LKPTI-only or Neither survives an RPTI filter.
    for (const g of rptiGroups) expect(g).not.toContain('NEITHER');

    await page.getByTestId('data-health-report-filter-none').click();
    for (const g of await groups.allInnerTexts()) expect(g).toContain('NEITHER');

    await page.getByTestId('data-health-report-filter-all').click();
    await expect(groups).toHaveCount(all);
  });

  test('a badge says which returns a kind affects', async ({ page }) => {
    const text = await page.getByTestId('data-health-issue-list').innerText();
    expect(/RPTI|LKPTI|BOTH|NEITHER/.test(text)).toBe(true);
  });
});
