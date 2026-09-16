import { test, expect } from '@playwright/test';

/**
 * Deliverable Segment — Label Visible When Segment Starts Before Timeline
 *
 * User Story:
 *   As an IT portfolio manager viewing the timeline, I want lifecycle segment
 *   labels to remain visible at the left edge of the timeline even when the
 *   segment starts before the visible window, so I can always identify what
 *   each segment represents.
 *
 * Acceptance Criteria:
 *   AC1: When a segment starts before the visible timeline window and its bar
 *        extends into the visible area, the segment label is visible at the
 *        left edge of the content area (not clipped off-screen to the left).
 *   AC2: When a segment is fully within the visible window, its label is
 *        positioned normally (at the start of the bar).
 */
test.describe('Segment label clamps to visible edge', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
  });

  test('AC1: Label is visible when segment starts before the timeline window', async ({ page }) => {
    // The demo "Okta In Production" segment starts Jan 1 of last year (relDate(-1,1,1)).
    // Navigate to mid-current-year so the segment's start is well off-screen to the left
    // but its bar still extends into the visible window.
    const startInput = page.getByTestId('timeline-start-input');
    await startInput.fill('2026-06-01');
    await startInput.press('Enter');
    await page.waitForTimeout(300);

    // The Okta segment bar should still be visible (its end is 2027-12-31)
    const segBar = page.locator('[data-testid="segment-bar-seg-okta-prod"]');
    await expect(segBar).toBeVisible({ timeout: 5000 });

    // Get the timeline content area left edge (after the sidebar)
    const contentArea = page.locator('[data-testid="deliverable-row-content"]').first();
    const contentBox = await contentArea.boundingBox();
    expect(contentBox).not.toBeNull();

    // The label inside the bar should be within the visible content area
    const label = segBar.locator('[data-testid="segment-label"]');
    await expect(label).toBeVisible();
    const labelBox = await label.boundingBox();
    expect(labelBox).not.toBeNull();

    // Label should not be clipped off to the left of the content area
    expect(labelBox!.x).toBeGreaterThanOrEqual(contentBox!.x - 1); // -1px tolerance
  });

  test('AC2: Label is at the bar start when segment is fully within the window', async ({ page }) => {
    // Navigate to 2026-01-01: Keycloak "Planned" segment starts relDate(0,1,1) = 2026-01-01
    // so it is within the visible window
    const startInput = page.getByTestId('timeline-start-input');
    await startInput.fill('2026-01-01');
    await startInput.press('Enter');
    await page.waitForTimeout(300);

    const segBar = page.locator('[data-testid="segment-bar-seg-keycloak-planned"]');
    await expect(segBar).toBeVisible({ timeout: 5000 });

    const label = segBar.locator('[data-testid="segment-label"]');
    await expect(label).toBeVisible();

    // Label x should be close to the bar's left edge (within the bar, near its start)
    const labelBox = await label.boundingBox();
    const barBox = await segBar.boundingBox();
    expect(labelBox).not.toBeNull();
    expect(barBox).not.toBeNull();

    // Label should start within a few pixels of the bar's left edge (the px-2 = 8px padding)
    expect(labelBox!.x - barBox!.x).toBeLessThan(20);
  });
});

/**
 * Issue #41 — segments on one deliverable were indistinguishable.
 *
 * Every bar was labelled with its deliverable's name, so a deliverable carrying
 * several lifecycle segments read as several copies of itself. In the demo
 * workspace that is 11 of 17 deliverables, up to four bars deep. The status name
 * existed as a fallback in the code but was unreachable, because the deliverable
 * name always won.
 *
 * The label now says what distinguishes one bar from its neighbours: the
 * initiative driving it, else its lifecycle stage.
 */
test.describe('Segment labels distinguish segments on one deliverable', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
  });

  test('three segments on one deliverable read differently', async ({ page }) => {
    // Azure AD B2C runs In Production, then Sunset, then Out of Support.
    const labels = await page.locator('[data-testid="segment-label"]').allInnerTexts();
    const azure = labels.filter(l => l.includes('Azure AD B2C'));

    expect(azure.length).toBeGreaterThanOrEqual(3);
    expect(new Set(azure).size).toBe(azure.length); // all distinct, not N copies of one name
  });

  test('a segment driven by an initiative is labelled with it', async ({ page }) => {
    const labels = await page.locator('[data-testid="segment-label"]').allInnerTexts();
    expect(labels.some(l => l.includes('Passkey Rollout'))).toBe(true);
  });

  test('the status pill is not repeated when the label already is the status', async ({ page }) => {
    // Otherwise a bar with no initiative printed "Sunset" twice side by side.
    const bars = page.locator('[data-testid^="segment-bar-"]');
    const count = await bars.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const bar = bars.nth(i);
      const label = await bar.getByTestId('segment-label').innerText();
      const pill = bar.getByTestId('segment-status-label');
      if (await pill.count()) {
        expect(label, `bar ${i}`).not.toBe(await pill.innerText());
      }
    }
  });
});
