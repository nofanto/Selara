import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import { parseLkptiImportWorkbook, deriveWorkspaceFromLkptiImport } from './lkptiImport';
import { parseRptiImportWorkbook, deriveWorkspaceFromRptiImport } from './rptiImport';
import { generateRptiDetails } from './rpti';
import { mergeDeliverableStatuses } from './deliverableStatusDefaults';

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
    expect(rows).toHaveLength(13);
  });

  it('RPTI carries both applications and infrastructure', () => {
    const inv = deriveWorkspaceFromLkptiImport(parseLkptiImportWorkbook(load('sample-lkpti-2026.xlsx')).rows);
    const { rows } = parseRptiImportWorkbook(load('sample-rpti-2027.xlsx'));
    const out = deriveWorkspaceFromRptiImport(rows, 2027, {
      deliverables: inv.deliverables, assets: inv.assets, assetCategories: inv.assetCategories,
    });
    const types = out.deliverables.map(d => d.type);
    expect(types.filter(t => t === 'infrastructure').length).toBe(5);
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

describe('a planned enhancement to an application the bank already runs', () => {
  /**
   * Payment Gateway is in the 2026 LKPTI as a live application and in the 2027
   * RPTI as an upgrade. That pairing is the normal case, and it must survive the
   * round trip: filed as `upgrade`, imported as `upgrade`, and — critically —
   * still `upgrade` after the user clicks "Generate RPTI Rows", which is what
   * actually produces the return. It regenerated as `new` before the prior-live
   * rule was corrected: a brand-new payment gateway declared to OJK.
   */
  const merged = () => {
    const inv = deriveWorkspaceFromLkptiImport(parseLkptiImportWorkbook(load('sample-lkpti-2026.xlsx')).rows);
    const { rows } = parseRptiImportWorkbook(load('sample-rpti-2027.xlsx'));
    const out = deriveWorkspaceFromRptiImport(rows, 2027, {
      deliverables: inv.deliverables, assets: inv.assets, assetCategories: inv.assetCategories,
    });
    return {
      out,
      deliverables: [...inv.deliverables, ...out.deliverables],
      assets: [...inv.assets, ...out.assets],
      assetCategories: [...inv.assetCategories, ...out.assetCategories],
      deliverableSegments: [...inv.deliverableSegments, ...out.deliverableSegments],
      deliverableStatuses: [...inv.deliverableStatuses, ...out.deliverableStatuses],
    };
  };

  it('does not duplicate the application it enhances', () => {
    const w = merged();
    expect(w.deliverables.filter(d => d.name === 'Payment Gateway')).toHaveLength(1);
    expect(w.assets.filter(a => a.name === 'Payment Gateway')).toHaveLength(1);
  });

  it('stays an upgrade after regeneration, and yields exactly one row', () => {
    const w = merged();
    const pg = w.deliverables.find(d => d.name === 'Payment Gateway')!;

    expect(w.out.rptiDetails.find(r => r.targetId === pg.id)?.developmentType).toBe('upgrade');

    const regen = generateRptiDetails({
      deliverableSegments: w.deliverableSegments, deliverableStatuses: w.deliverableStatuses,
      initiatives: w.out.initiatives, deliverables: w.deliverables,
      assets: w.assets, assetCategories: w.assetCategories,
    }, 2027);

    const forPg = regen.filter(r => r.targetId === pg.id);
    expect(forPg).toHaveLength(1);
    expect(forPg[0].developmentType).toBe('upgrade');
    expect(forPg[0].plannedImplementationQuarter).toBe('Q1');
  });

  it('keeps the three new applications classified as new', () => {
    const w = merged();
    const regen = generateRptiDetails({
      deliverableSegments: w.deliverableSegments, deliverableStatuses: w.deliverableStatuses,
      initiatives: w.out.initiatives, deliverables: w.deliverables,
      assets: w.assets, assetCategories: w.assetCategories,
    }, 2027);
    const byName = (n: string) => regen.find(r => w.deliverables.find(d => d.id === r.targetId)?.name === n);
    for (const n of ['Open API Banking Platform', 'Digital Onboarding (eKYC)', 'Syariah Financing Module']) {
      expect(byName(n)?.developmentType, n).toBe('new');
    }
  });
});

describe('an imported workspace has one vocabulary, not two', () => {
  /**
   * The LKPTI importer used to mint "Live" and the RPTI importer "In Production" —
   * the same concept under two names, both landing in the same workspace with half
   * the segments each. Nothing said which to use, renaming one left the other
   * behind, and clearing isLiveStatus on one silently dropped half the workspace out
   * of LKPTI generation. The flags are what the rules read, so generation stayed
   * correct and only the user ever saw the problem.
   */
  const statuses = () => {
    const inv = deriveWorkspaceFromLkptiImport(parseLkptiImportWorkbook(load('sample-lkpti-2026.xlsx')).rows);
    const out = deriveWorkspaceFromRptiImport(parseRptiImportWorkbook(load('sample-rpti-2027.xlsx')).rows, 2027, {
      deliverables: inv.deliverables, assets: inv.assets, assetCategories: inv.assetCategories,
    });
    return {
      merged: mergeDeliverableStatuses(inv.deliverableStatuses, out.deliverableStatuses),
      segments: [...inv.deliverableSegments, ...out.deliverableSegments],
    };
  };

  it('defines exactly one live status and one pre-launch status', () => {
    const { merged } = statuses();
    expect(merged.filter(s => s.isLiveStatus)).toHaveLength(1);
    expect(merged.filter(s => s.isPreLaunchStatus)).toHaveLength(1);
  });

  it('gives each status a distinct id, with both importers naming the same ones', () => {
    const { merged } = statuses();
    expect(new Set(merged.map(s => s.id)).size).toBe(merged.length);
    expect(merged.map(s => s.name).sort()).toEqual(['In Production', 'Planned']);
  });

  it('leaves no segment pointing at a status the workspace does not define', () => {
    const { merged, segments } = statuses();
    const ids = new Set(merged.map(s => s.id));
    expect(segments.length).toBeGreaterThan(0);
    for (const seg of segments) expect(ids.has(seg.status), `${seg.id} → ${seg.status}`).toBe(true);
  });
});

describe('the sample plan upgrades infrastructure the LKPTI cannot hold', () => {
  // Primary Data Center Jakarta is filed as an upgrade but appears in no LKPTI,
  // because LKPTI is applications only. It must be created rather than stranded.
  it('creates it, and leaves only the application mismatch unresolved', () => {
    const inv = deriveWorkspaceFromLkptiImport(parseLkptiImportWorkbook(load('sample-lkpti-2026.xlsx')).rows);
    const out = deriveWorkspaceFromRptiImport(parseRptiImportWorkbook(load('sample-rpti-2027.xlsx')).rows, 2027, {
      deliverables: inv.deliverables, assets: inv.assets, assetCategories: inv.assetCategories,
    });

    expect(out.unresolved.map(u => u.name)).toEqual(['Legacy Teller Application']);

    const dc = out.deliverables.find(d => d.name === 'Primary Data Center Jakarta');
    expect(dc?.type).toBe('infrastructure');

    const regen = generateRptiDetails({
      deliverableSegments: [...inv.deliverableSegments, ...out.deliverableSegments],
      deliverableStatuses: mergeDeliverableStatuses(inv.deliverableStatuses, out.deliverableStatuses),
      initiatives: out.initiatives,
      deliverables: [...inv.deliverables, ...out.deliverables],
      assets: [...inv.assets, ...out.assets],
      assetCategories: [...inv.assetCategories, ...out.assetCategories],
    }, 2027);
    expect(regen.find(r => r.targetId === dc!.id)?.developmentType).toBe('upgrade');
  });
});

describe('every imported deliverable states its type', () => {
  // Nothing in the lib layer would have caught this: every read uses
  // `d.type ?? 'application'`. The gap was only visible in the Deliverables tab,
  // as an empty Type select on all 13 LKPTI rows.
  it('LKPTI gives every row an explicit application type', () => {
    const inv = deriveWorkspaceFromLkptiImport(parseLkptiImportWorkbook(load('sample-lkpti-2026.xlsx')).rows);
    expect(inv.deliverables).toHaveLength(13);
    expect(inv.deliverables.every(d => d.type === 'application')).toBe(true);
  });

  it('no deliverable from either importer is left without a type', () => {
    const inv = deriveWorkspaceFromLkptiImport(parseLkptiImportWorkbook(load('sample-lkpti-2026.xlsx')).rows);
    const out = deriveWorkspaceFromRptiImport(parseRptiImportWorkbook(load('sample-rpti-2027.xlsx')).rows, 2027, {
      deliverables: inv.deliverables, assets: inv.assets, assetCategories: inv.assetCategories,
    });
    const all = [...inv.deliverables, ...out.deliverables];
    expect(all.length).toBeGreaterThan(13);
    expect(all.filter(d => d.type === undefined)).toEqual([]);
  });
});
