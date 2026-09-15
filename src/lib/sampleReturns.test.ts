import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import { parseLkptiImportWorkbook, deriveWorkspaceFromLkptiImport } from './lkptiImport';
import { parseRptiImportWorkbook, deriveWorkspaceFromRptiImport } from './rptiImport';

const load = (n: string) => XLSX.read(readFileSync(new URL(`../../docs/sample-data/${n}`, import.meta.url)), { type: 'buffer' });

/**
 * Guards docs/sample-data/ against silent rot. Those files are handed to people to
 * try the importer with; if either exporter's header row or label set changes,
 * they stop parsing, and nothing else in the suite would notice. Regenerate with
 * `node scripts/generate-sample-returns.mjs`.
 */
describe('the published sample returns', () => {
  it('LKPTI parses with nothing skipped', () => {
    const { rows, skipped } = parseLkptiImportWorkbook(load('sample-lkpti-2026.xlsx'));
    expect(skipped).toEqual([]);
    expect(rows).toHaveLength(13);
    expect(rows.every(r => r.platform && r.database && r.systemOwner && r.goLiveDateIso)).toBe(true);
  });

  it('RPTI parses with nothing skipped', () => {
    const { rows, skipped } = parseRptiImportWorkbook(load('sample-rpti-2027.xlsx'));
    expect(skipped).toEqual([]);
    expect(rows).toHaveLength(12);
  });

  it('RPTI carries both applications and infrastructure', () => {
    const inv = deriveWorkspaceFromLkptiImport(parseLkptiImportWorkbook(load('sample-lkpti-2026.xlsx')).rows);
    const { rows } = parseRptiImportWorkbook(load('sample-rpti-2027.xlsx'));
    const out = deriveWorkspaceFromRptiImport(rows, 2027, {
      deliverables: inv.deliverables, assets: inv.assets, assetCategories: inv.assetCategories,
    });
    const types = out.deliverables.map(d => d.type);
    expect(types.filter(t => t === 'infrastructure').length).toBe(4);
    expect(types.filter(t => t === 'application').length).toBeGreaterThan(0);
  });

  it('the four upgrade rows attach to the 2026 inventory, and exactly one cannot', () => {
    const inv = deriveWorkspaceFromLkptiImport(parseLkptiImportWorkbook(load('sample-lkpti-2026.xlsx')).rows);
    const { rows } = parseRptiImportWorkbook(load('sample-rpti-2027.xlsx'));
    const out = deriveWorkspaceFromRptiImport(rows, 2027, {
      deliverables: inv.deliverables, assets: inv.assets, assetCategories: inv.assetCategories,
    });
    expect(out.unresolved.map(u => u.name)).toEqual(['Legacy Teller Application']);

    // The four resolvable upgrades point their report row at the 2026 deliverable
    // they upgrade, rather than creating a duplicate application.
    const inventoryIds = new Set(inv.deliverables.map(d => d.id));
    const attached = out.rptiDetails.filter(r => inventoryIds.has(r.targetId));
    expect(attached).toHaveLength(4);
    expect(out.rptiDetails.filter(r => r.targetId.startsWith('rpti-import-unresolved-'))).toHaveLength(1);
  });
});
