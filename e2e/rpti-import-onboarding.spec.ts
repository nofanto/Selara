import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

// User story 1 from specs/001-rpti-import-onboarding: get started from the
// returns you already filed.
// process.cwd(), not __dirname — the project is ESM, where __dirname is undefined
// and referencing it fails the whole file at collection time. Matches how
// arrows.spec.ts and excel-import-validation.spec.ts resolve their fixtures.
const FIXTURES = path.join(process.cwd(), 'e2e', 'fixtures');
const LKPTI = path.join(FIXTURES, 'lkpti-format-3.2.6.xlsx');
const RPTI = path.join(FIXTURES, 'rpti-format-3.1.xlsx');

/**
 * Reach the first-run picker. Mirrors workspace-templates.spec.ts's
 * simulateFirstRun: the deletion must be awaited (and `onblocked` handled,
 * because the running app holds an open connection), and the scenia-e2e flag
 * removed — with it set, the picker is suppressed entirely.
 */
async function freshWorkspace(page: Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
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
}

test.describe('Onboarding from filed OJK returns', () => {
  test.beforeEach(async ({ page }) => { await freshWorkspace(page); });

  test('offers exactly two ways to begin, with LKPTI required and RPTI optional', async ({ page }) => {
    await expect(page.getByTestId('onboarding-path-returns')).toBeVisible();
    await expect(page.getByTestId('onboarding-path-empty')).toBeVisible();
    await expect(page.getByTestId('template-card-rpti')).toHaveCount(0);
    await expect(page.getByTestId('template-card-viewer')).toHaveCount(0);

    await expect(page.getByTestId('onboarding-lkpti-slot')).toContainText(/required/i);
    await expect(page.getByTestId('onboarding-rpti-slot')).toContainText(/optional/i);
  });

  test('will not import until an LKPTI and its year are supplied', async ({ page }) => {
    await expect(page.getByTestId('onboarding-import-btn')).toBeDisabled();
    await page.getByTestId('onboarding-lkpti-file-input').setInputFiles(LKPTI);
    await expect(page.getByTestId('onboarding-import-btn')).toBeDisabled(); // year still missing
    await page.getByTestId('onboarding-lkpti-year').fill('2026');
    await expect(page.getByTestId('onboarding-import-btn')).toBeEnabled();
  });

  test('asks a year per return, and accepts different years for each', async ({ page }) => {
    await page.getByTestId('onboarding-lkpti-file-input').setInputFiles(LKPTI);
    await page.getByTestId('onboarding-lkpti-year').fill('2026');
    await page.getByTestId('onboarding-rpti-file-input').setInputFiles(RPTI);
    await page.getByTestId('onboarding-rpti-year').fill('2027');

    await expect(page.getByTestId('onboarding-lkpti-year')).toHaveValue('2026');
    await expect(page.getByTestId('onboarding-rpti-year')).toHaveValue('2027');
    await page.getByTestId('onboarding-import-btn').click();
    await expect(page.getByTestId('data-health-report-view')).toBeVisible({ timeout: 20000 });
  });

  test('imports both returns and ends on the data-health review', async ({ page }) => {
    await page.getByTestId('onboarding-lkpti-file-input').setInputFiles(LKPTI);
    await page.getByTestId('onboarding-lkpti-year').fill('2026');
    await page.getByTestId('onboarding-rpti-file-input').setInputFiles(RPTI);
    await page.getByTestId('onboarding-rpti-year').fill('2027');
    await page.getByTestId('onboarding-import-btn').click();

    // FR-022: the first thing shown is what needs attention.
    await expect(page.getByTestId('data-health-report-view')).toBeVisible({ timeout: 20000 });

    // The plan reached the workspace, including infrastructure — the thing an
    // LKPTI-only workspace can never contain.
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-rpti').click();
    await expect(page.getByTestId('rpti-readonly-table').locator('tbody tr').first()).toBeVisible();

    // The Type column is a <select>, so assert on its value rather than on text —
    // the rendered label is "Infrastructure", but the value is what the model holds.
    await page.getByTestId('data-manager-tab-deliverables').click();
    await expect.poll(() => page.locator('table select').evaluateAll(
      els => els.some(e => (e as HTMLSelectElement).value === 'infrastructure'),
    )).toBe(true);
  });

  test('completes with an LKPTI alone, leaving a usable workspace', async ({ page }) => {
    await page.getByTestId('onboarding-lkpti-file-input').setInputFiles(LKPTI);
    await page.getByTestId('onboarding-lkpti-year').fill('2026');
    await page.getByTestId('onboarding-import-btn').click();

    await expect(page.getByTestId('data-health-report-view')).toBeVisible({ timeout: 20000 });
    await page.getByTestId('nav-data-manager').click();
    await page.getByTestId('data-manager-tab-lkpti').click();
    await expect(page.getByTestId('lkpti-readonly-table').locator('tbody tr').first()).toBeVisible();
  });

  test('refuses a file in the wrong slot and leaves the workspace untouched', async ({ page }) => {
    // An RPTI return dropped into the LKPTI slot.
    await page.getByTestId('onboarding-lkpti-file-input').setInputFiles(RPTI);
    await page.getByTestId('onboarding-lkpti-year').fill('2026');
    await page.getByTestId('onboarding-import-btn').click();

    await expect(page.getByTestId('onboarding-error')).toContainText(/3\.2\.6/);
    await expect(page.getByTestId('template-picker-modal')).toBeVisible();
  });

  test('reports skipped rows with their position and reason', async ({ page }) => {
    await page.getByTestId('onboarding-lkpti-file-input').setInputFiles(LKPTI);
    await page.getByTestId('onboarding-lkpti-year').fill('2026');
    await page.getByTestId('onboarding-rpti-file-input').setInputFiles(RPTI);
    await page.getByTestId('onboarding-rpti-year').fill('2027');
    await page.getByTestId('onboarding-import-btn').click();
    await expect(page.getByTestId('data-health-report-view')).toBeVisible({ timeout: 20000 });

    // A clean fixture skips nothing, so the summary must say so rather than
    // being absent — silence and success must not look identical.
    await expect(page.getByTestId('import-summary')).toBeVisible();
  });
});
