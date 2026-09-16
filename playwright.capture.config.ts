import { defineConfig, devices } from '@playwright/test';

/**
 * Config for the documentation screenshot captures in `scripts/`.
 *
 * The main config sets `testDir: './e2e'` and `testIgnore: ['**\/capture-*.spec.ts']`,
 * which correctly keeps captures out of the test suite — but also left them with no
 * way to be run at all. They were undocumented and effectively unrunnable, which is
 * part of how the user-guide screenshots came to be several UI generations stale
 * (issue #27).
 *
 *   npx playwright test --config=playwright.capture.config.ts
 *
 * Captures write into `public/features/`. Review the diff before committing: these
 * overwrite the images the user guide points at.
 */
export default defineConfig({
  testDir: './scripts',
  testMatch: ['**/capture-*.spec.ts'],
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 60000,
  expect: { timeout: 10000 },
  use: {
    baseURL: 'http://localhost:3000',
    // Deliberately no `scenia-e2e` storageState here, unlike the main config. That
    // flag suppresses the first-run picker, so a capture of it is impossible with it
    // set. Captures that do want it set it themselves.
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
