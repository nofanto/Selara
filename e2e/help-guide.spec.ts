import { test, expect } from '@playwright/test';

/**
 * User Story: As a Selara user, I want to access an in-app User Guide
 * so I can learn how to use the app without leaving it.
 *
 * AC:
 * 1. A "Guide" tab is visible in the nav bar.
 * 2. Clicking it renders a sidebar with collapsible sections.
 * 3. Clicking a page in the sidebar loads its markdown content.
 * 4. Images in the rendered content use /features/ paths (not ../../public/...).
 * 5. Navigating back to another view works.
 * 6. Every section and page in the on-disk guide is reachable from the sidebar —
 *    including the OJK reporting sections, which are the reason this fork exists.
 */
test.describe('In-app User Guide', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
  });

  test('Guide tab is visible in the nav bar', async ({ page }) => {
    await expect(page.getByTestId('nav-guide')).toBeVisible();
  });

  test('clicking Guide tab shows sidebar with sections', async ({ page }) => {
    await page.getByTestId('nav-guide').click();

    // Sidebar section headings are uppercase buttons
    await expect(page.getByRole('button', { name: 'Getting Started', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Timeline', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dependencies', exact: true })).toBeVisible();
  });

  test('first page loads markdown content on open', async ({ page }) => {
    await page.getByTestId('nav-guide').click();

    // Default page "What is Selara?" should render an h1 inside the guide content area
    const guideContent = page.locator('[data-testid="guide-content"]');
    await expect(guideContent).toBeVisible({ timeout: 5000 });
    const heading = guideContent.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
    const text = await heading.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test('clicking a different page loads new content', async ({ page }) => {
    await page.getByTestId('nav-guide').click();

    // Navigate to "Creating Initiatives"
    await page.getByRole('button', { name: 'Creating Initiatives' }).click();

    const guideContent = page.locator('[data-testid="guide-content"]');
    const heading = guideContent.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
    expect(await heading.textContent()).toMatch(/creat/i);
  });

  test('images in rendered content use /features/ path not ../../public/', async ({ page }) => {
    await page.getByTestId('nav-guide').click();

    // Navigate to a page that has an image (Creating Initiatives)
    await page.getByRole('button', { name: 'Creating Initiatives' }).click();
    await page.waitForSelector('[data-testid="guide-content"]');

    const images = page.locator('[data-testid="guide-content"] img');
    const count = await images.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const src = await images.nth(i).getAttribute('src');
        expect(src).not.toContain('../../public/');
        expect(src).toMatch(/^\/(features|tutorial)\//);
      }
    }
  });

  test('OJK reporting sections are reachable from the sidebar', async ({ page }) => {
    await page.getByTestId('nav-guide').click();
    const sidebar = page.getByTestId('guide-sidebar');

    // These sections exist under docs/user-guide/ but were missing from the
    // in-app guide, leaving the fork's regulatory features undocumented in-product.
    await expect(sidebar.getByRole('button', { name: 'RPTI Report', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'LKPTI Report', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'Decisions', exact: true })).toBeVisible();
  });

  test('reports section lists every report page that exists on disk', async ({ page }) => {
    await page.getByTestId('nav-guide').click();

    const sidebar = page.getByTestId('guide-sidebar');
    await expect(sidebar.getByRole('button', { name: 'Maturity Heatmap', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'Data Health Report', exact: true })).toBeVisible();
  });

  test('import & export section lists the catalogue and sharing pages', async ({ page }) => {
    await page.getByTestId('nav-guide').click();

    const sidebar = page.getByTestId('guide-sidebar');
    await expect(sidebar.getByRole('button', { name: 'RPTI Catalogue', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'Sharing Links', exact: true })).toBeVisible();
  });

  test('an OJK guide page renders its markdown content', async ({ page }) => {
    await page.getByTestId('nav-guide').click();
    await page.getByTestId('guide-sidebar').getByRole('button', { name: 'Recording an RPTI Row', exact: true }).click();

    const guideContent = page.locator('[data-testid="guide-content"]');
    const heading = guideContent.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
    expect(await heading.textContent()).toMatch(/RPTI/i);
  });

  test('can navigate back to Visualiser from Guide', async ({ page }) => {
    await page.getByTestId('nav-guide').click();
    await expect(page.getByTestId('nav-guide')).toBeVisible();

    await page.getByTestId('nav-visualiser').click();
    await expect(page.locator('[data-testid="asset-row-content"]').first()).toBeVisible({ timeout: 10000 });
  });
});
