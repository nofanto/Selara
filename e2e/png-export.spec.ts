import { test, expect } from '@playwright/test';

test.setTimeout(90000);

test.describe('PNG Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
  });

  test('PNG button triggers a .png file download', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60000 }),
      page.getByTestId('export-png').click(),
    ]);

    expect(download.suggestedFilename()).toContain('it-roadmap');
    expect(download.suggestedFilename()).toContain('.png');
  });

  test('downloaded PNG file is valid and under 2MB', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60000 }),
      page.getByTestId('export-png').click(),
    ]);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const bytes = Buffer.concat(chunks);

    // PNG magic bytes: 89 50 4E 47
    expect(bytes[0]).toBe(0x89);
    expect(bytes[1]).toBe(0x50);
    expect(bytes[2]).toBe(0x4e);
    expect(bytes[3]).toBe(0x47);

    // Must be under 2MB
    expect(bytes.length).toBeLessThanOrEqual(2 * 1024 * 1024);
  });
});
