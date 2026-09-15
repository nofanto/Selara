import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import {
  RPTI_IMPORT_SHEET_NAME,
  parseRptiImportWorkbook,
  deriveWorkspaceFromRptiImport,
} from './rptiImport';
import { RPTI_CATEGORY_LABELS, generateRptiDetails } from './rpti';
import type { Asset, AssetCategory, Deliverable } from '../types';

const HEADERS = [
  'No.', 'Nama Aplikasi/Infrastruktur Bank', 'Deskripsi', 'Kategori', 'Jenis Pengembangan',
  'Pengembang', 'PPJTI Pihak Terkait', 'Lokasi Data Center', 'Lokasi Disaster Recovery Center',
  'Waktu Rencana Implementasi', 'Estimasi Biaya CapEx', 'Estimasi Biaya OpEx', 'Keterangan',
];

/** Build a workbook the way exportRptiReportToExcel does, so tests exercise the real inverse. */
function wb(rows: unknown[][], sheetName = RPTI_IMPORT_SHEET_NAME, headers = HEADERS) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([headers, ...rows]), sheetName);
  return book;
}

const row = (over: Partial<Record<string, unknown>> = {}) => {
  const base = {
    no: 1, name: 'Core Banking GL', description: 'Ledger replacement',
    kategori: RPTI_CATEGORY_LABELS['04'], jenis: 'new', pengembang: 'inhouse', ppjti: 'n/a',
    dc: 'Jakarta, Indonesia', dr: 'Surabaya, Indonesia', quarter: 'Q3', capex: 1000, opex: 200, remarks: '',
    ...over,
  };
  return [base.no, base.name, base.description, base.kategori, base.jenis, base.pengembang,
    base.ppjti, base.dc, base.dr, base.quarter, base.capex, base.opex, base.remarks];
};

const EMPTY = { deliverables: [] as Deliverable[], assets: [] as Asset[], assetCategories: [] as AssetCategory[] };

describe('parseRptiImportWorkbook — format', () => {
  it('rejects a workbook with no RPTI sheet, naming the expected format', () => {
    const book = wb([row()], 'Some Other Sheet');
    expect(() => parseRptiImportWorkbook(book)).toThrowError(/RPTI Format 3\.1/);
  });

  it('rejects a sheet whose header row does not match the layout exactly', () => {
    const book = wb([row()], RPTI_IMPORT_SHEET_NAME, ['No.', 'Wrong', ...HEADERS.slice(2)]);
    expect(() => parseRptiImportWorkbook(book)).toThrowError(/header row/i);
  });

  it('puts every input row in exactly one of rows or skipped — none vanish', () => {
    const book = wb([
      row({ name: 'Good One' }),
      row({ name: '' }),                                   // unusable: no name
      row({ name: 'Bad Category', kategori: 'Nonsense' }), // unusable: unknown category
      row({ name: 'Good Two' }),
    ]);
    const { rows, skipped } = parseRptiImportWorkbook(book);
    expect(rows.length + skipped.length).toBe(4);
  });

  it('skips a bad value rather than throwing, and reports its row number', () => {
    const book = wb([row({ name: 'Fine' }), row({ name: 'Broken', capex: 'not-a-number' })]);
    const { rows, skipped } = parseRptiImportWorkbook(book);
    expect(rows).toHaveLength(1);
    expect(skipped[0].rowNumber).toBe(3); // header is row 1
    expect(skipped[0].reason).toBeTruthy();
  });

  it('ignores a blank trailing row without calling it an error', () => {
    const book = wb([row(), ['', '', '', '', '', '', '', '', '', '', '', '', '']]);
    const { rows, skipped } = parseRptiImportWorkbook(book);
    expect(rows).toHaveLength(1);
    expect(skipped).toHaveLength(0);
  });

  it('reads the category back from its label, since the export writes labels not codes', () => {
    const { rows } = parseRptiImportWorkbook(wb([row({ kategori: RPTI_CATEGORY_LABELS['52'] })]));
    expect(rows[0].categoryCode).toBe('52');
  });

  it('splits the combined location cells back into city and country', () => {
    const { rows } = parseRptiImportWorkbook(wb([row({ dc: 'Jakarta, Indonesia' })]));
    expect(rows[0].dcCity).toBe('Jakarta');
    expect(rows[0].dcCountry).toBe('Indonesia');
  });
});

describe('deriveWorkspaceFromRptiImport — category decides type', () => {
  const APPLICATION = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '49'] as const;
  const INFRASTRUCTURE = ['51', '52', '53', '54', '99'] as const;

  // Asserted per code rather than per range: getting one wrong files
  // infrastructure as an application, or makes a code unreachable entirely.
  it.each(APPLICATION)('code %s produces an application', (code) => {
    const { rows } = parseRptiImportWorkbook(wb([row({ kategori: RPTI_CATEGORY_LABELS[code] })]));
    const out = deriveWorkspaceFromRptiImport(rows, 2027, EMPTY);
    expect(out.deliverables[0].type).toBe('application');
  });

  it.each(INFRASTRUCTURE)('code %s produces infrastructure', (code) => {
    const { rows } = parseRptiImportWorkbook(wb([row({ kategori: RPTI_CATEGORY_LABELS[code] })]));
    const out = deriveWorkspaceFromRptiImport(rows, 2027, EMPTY);
    expect(out.deliverables[0].type).toBe('infrastructure');
  });
});

describe('deriveWorkspaceFromRptiImport — placement', () => {
  const parse = (over = {}) => parseRptiImportWorkbook(wb([row(over)])).rows;
  // An upgrade only produces segments when it resolves to something in the
  // inventory — with an empty one it is unresolved by design (FR-019), which
  // would make these assertions pass vacuously on an empty array.
  const inventory = {
    deliverables: [{ id: 'd-existing', assetId: 'a-1', name: 'Core Banking GL', type: 'application', categoryCode: '04' } as Deliverable],
    assets: [{ id: 'a-1', name: 'Core Banking GL', categoryId: 'c-1' } as Asset],
    assetCategories: [{ id: 'c-1', name: 'Area', categoryCode: '04' } as AssetCategory],
  };

  it('places a new build as pre-launch up to the quarter close, then live', () => {
    const out = deriveWorkspaceFromRptiImport(parse({ jenis: 'new', quarter: 'Q3' }), 2027, EMPTY);
    const segs = out.deliverableSegments.sort((a, b) => a.startDate.localeCompare(b.startDate));
    expect(segs).toHaveLength(2);
    expect(segs[0].endDate).toBe('2027-09-30');
    expect(segs[1].startDate).toBe('2027-09-30');
  });

  it('gives an upgrade a preceding live period, because it targets something already running', () => {
    const out = deriveWorkspaceFromRptiImport(parse({ jenis: 'upgrade', quarter: 'Q3' }), 2027, inventory);
    expect(out.unresolved).toHaveLength(0); // guard: otherwise the next assertion is vacuous
    expect(out.deliverableSegments).toHaveLength(3);
    const earliest = out.deliverableSegments.map(s => s.startDate).sort()[0];
    expect(earliest < '2027-01-01').toBe(true);
  });

  it('gives every derived segment an initiativeId, or regeneration would omit the work', () => {
    const out = deriveWorkspaceFromRptiImport(parse({ jenis: 'upgrade' }), 2027, inventory);
    expect(out.deliverableSegments.length).toBeGreaterThan(0); // guard against a vacuous every()
    expect(out.deliverableSegments.every(s => !!s.initiativeId)).toBe(true);
  });

  it('creates one initiative per row carrying that row cost', () => {
    const { rows } = parseRptiImportWorkbook(wb([row({ name: 'A', capex: 500, opex: 50 }), row({ no: 2, name: 'B', capex: 900, opex: 90 })]));
    const out = deriveWorkspaceFromRptiImport(rows, 2027, EMPTY);
    expect(out.initiatives).toHaveLength(2);
    expect(out.initiatives.map(i => i.capex).sort()).toEqual([500, 900]);
  });
});

describe('deriveWorkspaceFromRptiImport — relating upgrades to the inventory', () => {
  const existing = (name: string, code: string) => ({
    deliverables: [{ id: 'd-existing', assetId: 'a-1', name, type: 'application', categoryCode: code } as Deliverable],
    assets: [{ id: 'a-1', name, categoryId: 'c-1' } as Asset],
    assetCategories: [{ id: 'c-1', name: 'Area', categoryCode: code } as AssetCategory],
  });
  const parse = (over = {}) => parseRptiImportWorkbook(wb([row(over)])).rows;

  it('attaches an upgrade to an exact name+category match rather than duplicating it', () => {
    const rows = parse({ jenis: 'upgrade', name: 'Core Banking GL', kategori: RPTI_CATEGORY_LABELS['04'] });
    const out = deriveWorkspaceFromRptiImport(rows, 2027, existing('Core Banking GL', '04'));
    expect(out.deliverables).toHaveLength(0);
    expect(out.rptiDetails[0].targetId).toBe('d-existing');
    expect(out.unresolved).toHaveLength(0);
  });

  it('reports an upgrade with no match and creates nothing for it', () => {
    const rows = parse({ jenis: 'upgrade', name: 'Nowhere To Be Found' });
    const out = deriveWorkspaceFromRptiImport(rows, 2027, existing('Core Banking GL', '04'));
    expect(out.deliverables).toHaveLength(0);
    expect(out.unresolved).toHaveLength(1);
    expect(out.unresolved[0].name).toBe('Nowhere To Be Found');
  });

  it('does not match on name alone when the category differs', () => {
    const rows = parse({ jenis: 'upgrade', name: 'Core Banking GL', kategori: RPTI_CATEGORY_LABELS['05'] });
    const out = deriveWorkspaceFromRptiImport(rows, 2027, existing('Core Banking GL', '04'));
    expect(out.unresolved).toHaveLength(1);
  });

  it('treats an ambiguous match as unresolved rather than picking one', () => {
    const two = existing('Core Banking GL', '04');
    two.deliverables.push({ id: 'd-other', assetId: 'a-1', name: 'Core Banking GL', type: 'application', categoryCode: '04' } as Deliverable);
    const out = deriveWorkspaceFromRptiImport(parse({ jenis: 'upgrade' }), 2027, two);
    expect(out.unresolved).toHaveLength(1);
    expect(out.rptiDetails).toHaveLength(1);
  });

  it('creates a new entry for a new-build row without consulting the inventory', () => {
    const out = deriveWorkspaceFromRptiImport(parse({ jenis: 'new', name: 'Core Banking GL' }), 2027, existing('Core Banking GL', '04'));
    expect(out.deliverables).toHaveLength(1);
    expect(out.unresolved).toHaveLength(0);
  });
});

describe('deriveWorkspaceFromRptiImport — purity', () => {
  it('produces identical output for identical input', () => {
    const { rows } = parseRptiImportWorkbook(wb([row(), row({ no: 2, name: 'Second' })]));
    expect(deriveWorkspaceFromRptiImport(rows, 2027, EMPTY))
      .toEqual(deriveWorkspaceFromRptiImport(rows, 2027, EMPTY));
  });

  it('derives ids from row position, not the clock', () => {
    const { rows } = parseRptiImportWorkbook(wb([row()]));
    const out = deriveWorkspaceFromRptiImport(rows, 2027, EMPTY);
    const ids = [...out.deliverables, ...out.initiatives, ...out.rptiDetails].map(x => x.id);
    expect(ids.every(id => !/\d{13}/.test(id))).toBe(true); // no epoch millis
  });
});

describe('round trip against the real exporter', () => {
  // The cheapest correctness check available: what the app writes, it must read
  // back. Fixtures in e2e/fixtures/ are produced by exportRptiReportToExcel
  // itself, so this fails the moment either side drifts.
  const load = (name: string) => {
    const buf = readFileSync(new URL(`../../e2e/fixtures/${name}`, import.meta.url));
    return XLSX.read(buf, { type: 'buffer' });
  };

  it('reads back every row of a return this app exported', () => {
    const { rows, skipped } = parseRptiImportWorkbook(load('rpti-format-3.1.xlsx'));
    expect(skipped).toEqual([]);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('recovers both applications and infrastructure from that return', () => {
    const { rows } = parseRptiImportWorkbook(load('rpti-format-3.1.xlsx'));
    const out = deriveWorkspaceFromRptiImport(rows, 2027, EMPTY);
    const types = new Set(out.deliverables.map(d => d.type));
    expect(types.has('application')).toBe(true);
    expect(types.has('infrastructure')).toBe(true);
  });

  it('handles a 300-row return without skipping anything', () => {
    const { rows, skipped } = parseRptiImportWorkbook(load('rpti-format-3.1-scale-300.xlsx'));
    expect(skipped).toEqual([]);
    expect(rows).toHaveLength(300);
  });
});

describe('imported entities must not dangle', () => {
  // A 7-row import produced 14 data-health errors before this was fixed: every
  // initiative had an empty programmeId and assetId, and computeDataHealth
  // reports both. Caught by looking at the screen, not by the suite.
  const parse = (over = {}) => parseRptiImportWorkbook(wb([row(over)])).rows;

  it('gives every imported initiative a programme that exists in the result', () => {
    const out = deriveWorkspaceFromRptiImport(parse(), 2027, EMPTY);
    const programmeIds = new Set(out.programmes.map(p => p.id));
    expect(out.initiatives.length).toBeGreaterThan(0);
    expect(out.initiatives.every(i => programmeIds.has(i.programmeId))).toBe(true);
  });

  it('gives every imported initiative an asset that exists in the result', () => {
    const out = deriveWorkspaceFromRptiImport(parse(), 2027, EMPTY);
    const assetIds = new Set(out.assets.map(a => a.id));
    expect(out.initiatives.every(i => assetIds.has(i.assetId))).toBe(true);
  });

  it('attaches an upgrade initiative to the existing asset it targets', () => {
    const inventory = {
      deliverables: [{ id: 'd-1', assetId: 'a-1', name: 'Core Banking GL', type: 'application', categoryCode: '04' } as Deliverable],
      assets: [{ id: 'a-1', name: 'Core Banking GL', categoryId: 'c-1' } as Asset],
      assetCategories: [{ id: 'c-1', name: 'Area', categoryCode: '04' } as AssetCategory],
    };
    const out = deriveWorkspaceFromRptiImport(parse({ jenis: 'upgrade' }), 2027, inventory);
    expect(out.initiatives[0].assetId).toBe('a-1');
  });

  it('creates no programme when there is nothing to import', () => {
    const out = deriveWorkspaceFromRptiImport([], 2027, EMPTY);
    expect(out.programmes).toEqual([]);
  });
});

describe('colours are Tailwind classes, not hex', () => {
  // Timeline renders Programme.color and DeliverableStatus.color directly as a
  // className (Timeline.tsx:120 and :84). A hex string is not a class, so it
  // produced an invisible white bar on the white visualiser background.
  const TAILWIND_BG = /^bg-[a-z]+-\d{2,3}$/;

  it('gives the imported programme a class the visualiser can render', () => {
    const out = deriveWorkspaceFromRptiImport(parseRptiImportWorkbook(wb([row()])).rows, 2027, EMPTY);
    expect(out.programmes[0].color).toMatch(TAILWIND_BG);
  });

  it('gives every imported deliverable status a class the visualiser can render', () => {
    const out = deriveWorkspaceFromRptiImport(parseRptiImportWorkbook(wb([row()])).rows, 2027, EMPTY);
    expect(out.deliverableStatuses.length).toBeGreaterThan(0);
    for (const s of out.deliverableStatuses) expect(s.color).toMatch(TAILWIND_BG);
  });
});

describe('an upgrade to infrastructure the LKPTI cannot contain', () => {
  /**
   * LKPTI is Daftar Aplikasi — applications only. So an RPTI row upgrading
   * infrastructure the bank already runs (expand a data centre, refresh a network)
   * can never match anything in the inventory, no matter how well named.
   *
   * Holding it back as "unresolved" made that a dead end: a data-health error no
   * import could ever clear, with the row's initiative parked on an unrelated
   * application. FR-019's reasoning — that a non-match is a naming disagreement for
   * a person to judge — is about applications, which both returns list. For
   * infrastructure there is nothing to judge, so the entry is created (FR-019a).
   */
  const infraUpgrade = (over = {}) => parseRptiImportWorkbook(wb([row({
    name: 'Primary Data Center Jakarta',
    kategori: RPTI_CATEGORY_LABELS['51'],
    jenis: 'upgrade',
    ...over,
  })])).rows;

  it('creates the entry instead of stranding the row', () => {
    const out = deriveWorkspaceFromRptiImport(infraUpgrade(), 2027, EMPTY);
    expect(out.unresolved).toEqual([]);
    expect(out.deliverables).toHaveLength(1);
    expect(out.deliverables[0].type).toBe('infrastructure');
    expect(out.assets).toHaveLength(1);
    expect(out.rptiDetails[0].targetId).toBe(out.deliverables[0].id);
  });

  it('gives it the prior-live segment, so it stays an upgrade when regenerated', () => {
    const out = deriveWorkspaceFromRptiImport(infraUpgrade(), 2027, EMPTY);
    const regen = generateRptiDetails({
      deliverableSegments: out.deliverableSegments, deliverableStatuses: out.deliverableStatuses,
      initiatives: out.initiatives, deliverables: out.deliverables,
      assets: out.assets, assetCategories: out.assetCategories,
    }, 2027);
    expect(regen).toHaveLength(1);
    expect(regen[0].developmentType).toBe('upgrade');
  });

  it('attaches to the entry a previous import created rather than making a second', () => {
    const first = deriveWorkspaceFromRptiImport(infraUpgrade(), 2027, EMPTY);
    const second = deriveWorkspaceFromRptiImport(infraUpgrade(), 2028, {
      deliverables: first.deliverables, assets: first.assets, assetCategories: first.assetCategories,
    });
    expect(second.assets).toEqual([]);
    expect(second.deliverables).toEqual([]);
    expect(second.rptiDetails[0].targetId).toBe(first.deliverables[0].id);
  });

  it('leaves an unmatched application upgrade unresolved, as before', () => {
    const rows = parseRptiImportWorkbook(wb([row({ name: 'Nothing Like This', jenis: 'upgrade' })])).rows;
    const out = deriveWorkspaceFromRptiImport(rows, 2027, EMPTY);
    expect(out.unresolved).toHaveLength(1);
    expect(out.deliverables).toEqual([]);
    expect(out.assets).toEqual([]);
  });

  it('still defers to a person when several infrastructure entries share the name', () => {
    const twins = ['d-1', 'd-2'].map(id => ({
      id, assetId: `a-${id}`, name: 'Primary Data Center Jakarta',
      type: 'infrastructure', categoryCode: '51',
    } as Deliverable));
    const out = deriveWorkspaceFromRptiImport(infraUpgrade(), 2027, {
      deliverables: twins,
      assets: twins.map(d => ({ id: d.assetId, name: d.name, categoryId: 'c-1' } as Asset)),
      assetCategories: [{ id: 'c-1', name: 'DC/DRC', categoryCode: '51' } as AssetCategory],
    });
    expect(out.unresolved).toHaveLength(1);
    expect(out.deliverables).toEqual([]);
  });
});
