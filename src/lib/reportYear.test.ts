import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('report-year generation', () => {
  it('does not take a report year from the system clock in Data Manager', () => {
    const dataManager = readFileSync('src/components/DataManager.tsx', 'utf8');
    expect(dataManager).not.toContain('new Date().getFullYear()');
  });
});
