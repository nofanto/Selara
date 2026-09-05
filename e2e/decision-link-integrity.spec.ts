import { test, expect, Page } from '@playwright/test';

// Issue #31 defects 1 and 2: deleting an entity must warn that decisions
// referencing it will lose their link, and the broken link must stay visible
// afterwards instead of rendering as no link at all.
test.describe('Decision link integrity on delete', () => {
  const DECISION = 'Why we consolidated identity onto one platform';

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('scenia-e2e', 'true');
      localStorage.setItem('scenia_has_seen_landing', 'true');
    });
    await page.reload();
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
  });

  /*
   * Data Manager sorts assets by name and renders each name inside an <input>, so
   * a row can be matched neither by text nor reliably by position. Read whichever
   * asset happens to be first and link the decision to *that*, rather than
   * assuming a particular one leads — an assumption that passes in isolation and
   * fails under the full suite, where the seeded workspace differs.
   */
  const openAssetsTab = async (page: Page) => {
    await page.getByTestId('nav-data-manager').click();
    await page.getByRole('button', { name: 'Assets' }).click();
    await expect(page.locator('table tbody tr').first()).toBeVisible();
  };

  const linkDecisionTo = async (page: Page, assetName: string) => {
    await page.getByTestId('nav-decisions').click();
    await page.getByTestId('add-decision-btn').click();
    await page.getByTestId('decision-title-input').fill(DECISION);
    await page.getByTestId('decision-linked-type-select').selectOption('asset');
    await page.getByTestId('decision-linked-id-select').selectOption({ label: assetName });
    await page.getByTestId('save-decision-btn').click();
    await expect(page.getByTestId('decisions-list').getByText(DECISION)).toBeVisible();
  };

  /** Link a decision to the asset that is about to be deleted, then delete it. */
  const linkThenDeleteFirstAsset = async (page: Page) => {
    await openAssetsTab(page);
    const assetName = await page.locator('table tbody tr').first().locator('input').first().inputValue();
    await linkDecisionTo(page, assetName);
    await openAssetsTab(page);
    await page.locator('table tbody tr').first().getByRole('button', { name: 'Delete row' }).click();
  };

  test('defect 1: the cascade warning says decisions will lose their link', async ({ page }) => {
    await linkThenDeleteFirstAsset(page);

    const modal = page.getByTestId('confirm-modal');
    await expect(modal).toBeVisible();
    // Worded apart from the "will also remove" clause on purpose: decisions are
    // not deleted by a cascade, so claiming removal would be actively wrong.
    await expect(modal).toContainText('1 decision(s) will keep their record but lose their link to it');
    await expect(modal).not.toContainText('will also remove 1 decision');
  });

  test('defect 2: a broken link renders as a tombstone, not as nothing', async ({ page }) => {
    await linkThenDeleteFirstAsset(page);
    await page.getByTestId('confirm-modal-confirm').click();

    await page.getByTestId('nav-decisions').click();
    await page.getByTestId('decisions-list').getByText(DECISION).click();

    // The record survives — ADR-0011: the log outlives what it describes.
    await expect(page.getByTestId('decision-detail')).toContainText(DECISION);
    // ...and the fact that a link existed is still visible.
    await expect(page.getByTestId('decision-link-missing-detail')).toBeVisible();
    await expect(page.getByTestId('decisions-list').getByTestId('decision-link-missing')).toBeVisible();
  });

  test('a decision that was never linked shows no tombstone', async ({ page }) => {
    // The whole point of the tombstone is telling these two states apart.
    await page.getByTestId('nav-decisions').click();
    await page.getByTestId('add-decision-btn').click();
    await page.getByTestId('decision-title-input').fill('Unlinked decision');
    await page.getByTestId('save-decision-btn').click();
    await page.getByTestId('decisions-list').getByText('Unlinked decision').click();

    await expect(page.getByTestId('decision-detail')).toContainText('Unlinked decision');
    await expect(page.getByTestId('decision-link-missing-detail')).toHaveCount(0);
  });
});
