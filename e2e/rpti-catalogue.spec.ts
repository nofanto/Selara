import { test, expect } from '@playwright/test';

test.describe('RPTI Catalogue Demo Data', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 10000 });
  });

  test('AC1: pre-populated RPTI catalogue assets appear on first load', async ({ page }) => {
    // Spot-check four different RPTI areas
    for (const text of [
      'Customer Relationship Management (CRM)',
      'Payment Gateway',
      'SIEM Platform',
      'Business Intelligence & Analytics Platform',
    ]) {
      await expect(
        page.locator('[data-testid="asset-swimlane-label"]').filter({ hasText: text })
      ).toBeVisible();
    }
  });

  test('AC2: pre-populated areas have no area row and show a remove-all button', async ({ page }) => {
    // 01 (Customer management) is pre-populated
    await expect(page.locator('[data-testid="rpti-catalogue-area-row-01"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="rpti-catalogue-remove-btn-01"]')).toBeVisible();

    // 05 (Payments) is also pre-populated
    await expect(page.locator('[data-testid="rpti-catalogue-area-row-05"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="rpti-catalogue-remove-btn-05"]')).toBeVisible();
  });

  test('AC3: unpopulated areas still show collapsed area rows', async ({ page }) => {
    for (const code of ['02', '03', '49']) {
      await expect(page.locator(`[data-testid="rpti-catalogue-area-row-${code}"]`)).toBeVisible();
    }
  });
});

test.describe('RPTI Asset Catalogue', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 10000 });
  });

  const ALL_CODES = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '49', '51', '52', '53', '54', '99'];

  // AC1 — Area rows are present and visually distinct
  test('AC1: all 18 RPTI areas are represented in the visualiser', async ({ page }) => {
    for (const code of ALL_CODES) {
      await expect(page.locator(`[data-testid="rpti-catalogue-area-entry-${code}"]`)).toBeVisible();
    }
  });

  test('AC1: area rows display full names and are visually distinct from asset swimlanes', async ({ page }) => {
    const areaRow = page.locator('[data-testid="rpti-catalogue-area-row-03"]');
    await expect(areaRow).toBeVisible();
    await expect(areaRow).toContainText('Credit / financing');
    await expect(areaRow).toHaveAttribute('data-row-type', 'rpti-catalogue-area');
  });

  // AC2 — Pre-populate button shows asset count
  test('AC2: pre-populate button is visible with asset count on unpopulated area row', async ({ page }) => {
    const btn = page.locator('[data-testid="rpti-catalogue-prepopulate-btn-03"]');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText(/\+ Add all \d+ assets?/);
  });

  // AC3 — Pre-populating adds child assets and removes the area row
  test('AC3: clicking pre-populate adds child assets and hides the area row', async ({ page }) => {
    const btn = page.locator('[data-testid="rpti-catalogue-prepopulate-btn-03"]');
    await btn.click();

    await expect(
      page.locator('[data-testid="asset-swimlane-label"]').filter({ hasText: 'Loan Origination System (LOS)' })
    ).toBeVisible();
    await expect(page.locator('[data-testid="rpti-catalogue-area-row-03"]')).not.toBeVisible();
  });

  test('AC3: pre-populated assets carry the RPTI category-code attribute', async ({ page }) => {
    await page.locator('[data-testid="rpti-catalogue-prepopulate-btn-03"]').click();
    const swimlane = page.locator('[data-testid="asset-swimlane-label"]').filter({ hasText: 'Loan Origination System (LOS)' });
    await expect(swimlane).toBeVisible();
    await expect(swimlane).toHaveAttribute('data-category-code', '03');
  });

  // AC4 — Persistence across reloads
  test('AC4: pre-populated assets persist after page reload', async ({ page }) => {
    await page.locator('[data-testid="rpti-catalogue-prepopulate-btn-03"]').click();
    await expect(
      page.locator('[data-testid="asset-swimlane-label"]').filter({ hasText: 'Loan Origination System (LOS)' })
    ).toBeVisible();

    await page.reload();
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 10000 });

    await expect(
      page.locator('[data-testid="asset-swimlane-label"]').filter({ hasText: 'Loan Origination System (LOS)' })
    ).toBeVisible();
    await expect(page.locator('[data-testid="rpti-catalogue-area-row-03"]')).not.toBeVisible();

    // Unpopulated area row also survives reload
    await expect(page.locator('[data-testid="rpti-catalogue-area-row-02"]')).toBeVisible();
  });

  // AC5 — Remove all assets
  test('AC5: remove-all button appears after pre-populating an area', async ({ page }) => {
    await page.locator('[data-testid="rpti-catalogue-prepopulate-btn-03"]').click();
    await expect(
      page.locator('[data-testid="asset-swimlane-label"]').filter({ hasText: 'Loan Origination System (LOS)' })
    ).toBeVisible();
    await expect(page.locator('[data-testid="rpti-catalogue-remove-btn-03"]')).toBeVisible();
  });

  test('AC5: remove-all shows a confirmation dialog with correct copy', async ({ page }) => {
    await page.locator('[data-testid="rpti-catalogue-prepopulate-btn-03"]').click();
    await expect(
      page.locator('[data-testid="asset-swimlane-label"]').filter({ hasText: 'Loan Origination System (LOS)' })
    ).toBeVisible();

    await page.locator('[data-testid="rpti-catalogue-remove-btn-03"]').click();
    const modal = page.locator('[data-testid="confirm-modal"]');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Credit / financing');
    await expect(modal).toContainText(/initiative|segment|deleted/i);
  });

  test('AC5: cancelling remove-all leaves all assets intact', async ({ page }) => {
    await page.locator('[data-testid="rpti-catalogue-prepopulate-btn-03"]').click();
    await expect(
      page.locator('[data-testid="asset-swimlane-label"]').filter({ hasText: 'Loan Origination System (LOS)' })
    ).toBeVisible();

    await page.locator('[data-testid="rpti-catalogue-remove-btn-03"]').click();
    await page.locator('[data-testid="confirm-modal-cancel"]').click();

    await expect(
      page.locator('[data-testid="asset-swimlane-label"]').filter({ hasText: 'Loan Origination System (LOS)' })
    ).toBeVisible();
  });

  test('AC5: confirming remove-all deletes all pre-populated assets and restores area row', async ({ page }) => {
    await page.locator('[data-testid="rpti-catalogue-prepopulate-btn-03"]').click();
    await expect(
      page.locator('[data-testid="asset-swimlane-label"]').filter({ hasText: 'Loan Origination System (LOS)' })
    ).toBeVisible();

    await page.locator('[data-testid="rpti-catalogue-remove-btn-03"]').click();
    await page.locator('[data-testid="confirm-modal-confirm"]').click();

    await expect(
      page.locator('[data-testid="asset-swimlane-label"]').filter({ hasText: 'Loan Origination System (LOS)' })
    ).not.toBeVisible();
    await expect(page.locator('[data-testid="rpti-catalogue-area-row-03"]')).toBeVisible();
  });

  // AC6 — Trashcan delete on individual asset swimlane labels
  test('AC6: trashcan icon appears on hover over an asset swimlane label', async ({ page }) => {
    await page.locator('[data-testid="rpti-catalogue-prepopulate-btn-03"]').click();
    const swimlane = page.locator('[data-testid="asset-swimlane-label"]').filter({ hasText: 'Loan Origination System (LOS)' });
    await expect(swimlane).toBeVisible();
    await swimlane.hover();
    await expect(swimlane.locator('[data-testid="asset-swimlane-delete-btn"]')).toBeVisible();
  });

  test('AC6: deleting a clean asset removes it immediately without confirmation', async ({ page }) => {
    await page.locator('[data-testid="rpti-catalogue-prepopulate-btn-03"]').click();
    const swimlane = page.locator('[data-testid="asset-swimlane-label"]').filter({ hasText: 'Credit Scoring Engine' });
    await expect(swimlane).toBeVisible();
    await swimlane.hover();
    await swimlane.locator('[data-testid="asset-swimlane-delete-btn"]').click();

    await expect(page.locator('[data-testid="confirm-modal"]')).not.toBeVisible();
    await expect(
      page.locator('[data-testid="asset-swimlane-label"]').filter({ hasText: 'Credit Scoring Engine' })
    ).not.toBeVisible();
  });

  test('AC6: deleting an asset with linked initiatives shows confirmation; cancel leaves it intact', async ({ page }) => {
    const swimlane = page.locator('[data-testid="asset-swimlane-label"]').filter({ hasText: 'Customer Relationship Management (CRM)' });
    await swimlane.hover();
    await swimlane.locator('[data-testid="asset-swimlane-delete-btn"]').click();

    const modal = page.locator('[data-testid="confirm-modal"]');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Customer Relationship Management (CRM)');
    await expect(modal).toContainText(/initiative|segment/i);

    await page.locator('[data-testid="confirm-modal-cancel"]').click();
    await expect(
      page.locator('[data-testid="asset-swimlane-label"]').filter({ hasText: 'Customer Relationship Management (CRM)' })
    ).toBeVisible();
  });

  test('AC6: confirming the delete removes the asset and its linked data', async ({ page }) => {
    const swimlane = page.locator('[data-testid="asset-swimlane-label"]').filter({ hasText: 'Customer Relationship Management (CRM)' });
    await swimlane.hover();
    await swimlane.locator('[data-testid="asset-swimlane-delete-btn"]').click();
    await page.locator('[data-testid="confirm-modal-confirm"]').click();

    await expect(
      page.locator('[data-testid="asset-swimlane-label"]').filter({ hasText: 'Customer Relationship Management (CRM)' })
    ).not.toBeVisible();
  });

  // AC7 — Full names, no bare codes
  test('AC7: area rows and pre-populated swimlanes show full names without bare RPTI codes', async ({ page }) => {
    // Unpopulated area row
    const areaRow = page.locator('[data-testid="rpti-catalogue-area-row-03"]');
    await expect(areaRow).toContainText('Credit / financing');
    await expect(areaRow).not.toContainText('03 —');

    // Pre-populated swimlane
    await page.locator('[data-testid="rpti-catalogue-prepopulate-btn-03"]').click();
    const swimlane = page.locator('[data-testid="asset-swimlane-label"]').filter({ hasText: 'Loan Origination System (LOS)' });
    await expect(swimlane).toBeVisible();
    await expect(swimlane).not.toContainText('rpti-catalogue-03');

    const lms = page.locator('[data-testid="asset-swimlane-label"]').filter({ hasText: 'Loan Management System (LMS)' });
    await expect(lms).toBeVisible();
  });
});
