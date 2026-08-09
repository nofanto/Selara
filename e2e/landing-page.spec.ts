import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  // Clear local storage before tests to ensure landing page shows
  test.beforeEach(async ({ page }) => {
    // To clear local storage we need to go to the page first
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    // Reload so the clear takes effect
    await page.reload();
  });

  test('should show landing page on first visit and dismiss on Get Started click', async ({ page }) => {
    // Verify landing page is visible
    const getStartedButton = page.getByRole('button', { name: "Get Started — It's Free" });
    await expect(getStartedButton).toBeVisible();

    // Verify hero text
    await expect(page.getByText('Your IT Portfolio,')).toBeVisible();

    // Verify app elements are fundamentally hiding beneath / not focusable while landing page is up
    // Actually the landing page is over them within the DOM, but let's just make sure
    // Selara header is in the landing page too so we look for 'Visualiser' nav
    const visualiserButton = page.getByTestId('nav-visualiser');

    // Click Get Started
    await getStartedButton.click();

    // Verify landing page is gone
    await expect(page.getByRole('button', { name: "Get Started — It's Free" })).not.toBeVisible();

    // Verify app is visible and interactive
    await expect(visualiserButton).toBeVisible();

    // Reload page to verify local storage persistence
    await page.reload();

    // Landing page should NOT be visible
    await expect(page.getByRole('button', { name: "Get Started — It's Free" })).not.toBeVisible();
    await expect(visualiserButton).toBeVisible();
  });

  test('should display open source badge and GitHub link', async ({ page }) => {
    await expect(page.getByText('Free & Open Source')).toBeVisible();

    // GitHub link in nav header
    const navGitHubLink = page.getByRole('link', { name: 'GitHub' }).first();
    await expect(navGitHubLink).toBeVisible();
    await expect(navGitHubLink).toHaveAttribute('href', 'https://github.com/nofanto/Selara');

    // "No signup" tagline under CTA
    await expect(page.getByText('No signup. No servers. Instantly ready.').first()).toBeVisible();
  });

  test('should display all six feature cards', async ({ page }) => {
    await expect(page.getByText('Dependency Mapping')).toBeVisible();
    await expect(page.getByText('Intuitive Canvas')).toBeVisible();
    await expect(page.getByText('Conflict Detection')).toBeVisible();
    await expect(page.getByText('Version History')).toBeVisible();
    await expect(page.getByText('Excel & PDF Export')).toBeVisible();
    await expect(page.getByText('100% Private')).toBeVisible();
  });

  test('feature cards mention key current capabilities', async ({ page }) => {
    // Dependency Mapping card mentions milestone dependencies and critical path
    const depCard = page.locator('div').filter({ hasText: /^Dependency Mapping/ }).first();
    await expect(depCard).toContainText(/milestone/i);
    await expect(depCard).toContainText(/critical path/i);

    // Intuitive Canvas card mentions resource assignment
    const canvasCard = page.locator('div').filter({ hasText: /^Intuitive Canvas/ }).first();
    await expect(canvasCard).toContainText(/resource/i);

    // Excel & PDF Export card mentions capacity report
    const exportCard = page.locator('div').filter({ hasText: /^Excel & PDF Export/ }).first();
    await expect(exportCard).toContainText(/capacity/i);
  });

  test('should display fork attribution link in landing page footer', async ({ page }) => {
    // The landing page is rendered after the app in the DOM, so its Scenia link is last
    await expect(page.getByText('Forked from').last()).toBeVisible();
    const sceniaLink = page.getByRole('link', { name: 'Scenia' }).last();
    await expect(sceniaLink).toBeVisible();
    await expect(sceniaLink).toHaveAttribute('href', 'https://github.com/waylonkenning/scenia');
  });
});

test.describe('App Footer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('scenia_has_seen_landing', 'true');
      localStorage.setItem('scenia-e2e', 'true');
    });
    await page.reload();
  });

  test('should display correct text and links in app footer', async ({ page }) => {
    const footer = page.locator('footer').last();

    // Static text
    await expect(footer).toContainText('Selara IT Portfolio Planner');
    await expect(footer).toContainText('an open source tool, forked from');
    await expect(footer).toContainText('by Waylon Kenning');

    // "open source" links to this fork's GitHub repo
    const openSourceLink = footer.getByRole('link', { name: 'open source' });
    await expect(openSourceLink).toBeVisible();
    await expect(openSourceLink).toHaveAttribute('href', 'https://github.com/nofanto/Selara');

    // "Scenia" links to the original upstream repo
    const sceniaLink = footer.getByRole('link', { name: 'Scenia' });
    await expect(sceniaLink).toBeVisible();
    await expect(sceniaLink).toHaveAttribute('href', 'https://github.com/waylonkenning/scenia');
  });
});
