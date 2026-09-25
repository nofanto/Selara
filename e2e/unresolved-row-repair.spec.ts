import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

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
