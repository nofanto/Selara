import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { parseLkptiImportWorkbook, deriveWorkspaceFromLkptiImport, LkptiImportRow } from './lkptiImport';
import { LKPTI_EXPORT_HEADERS, LKPTI_SHEET_NAME } from './lkpti';

function makeWorkbook(rows: any[][], sheetName = LKPTI_SHEET_NAME, headers = LKPTI_EXPORT_HEADERS): XLSX.WorkBook {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

const VALID_ROW: any[] = [
  1,
  '01 — Customer management',
  'Core Banking App',
  'Handles customer onboarding.',
  'Java/Spring',
  'PostgreSQL',
  'Jakarta, Indonesia',
  'Self',
  'Surabaya, Indonesia',
  'Self',
  'High Availability Active - Active',
  'Jane Doe',
  'inhouse',
  '15-03-2021',
  'Beli Putus',
];

describe('parseLkptiImportWorkbook', () => {
  it('parses a well-formed row into an LkptiImportRow', () => {
    const wb = makeWorkbook([VALID_ROW]);
    const result = parseLkptiImportWorkbook(wb);

    expect(result.rows).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
    expect(result.rows[0]).toMatchObject({
      categoryCode: '01',
      name: 'Core Banking App',
      description: 'Handles customer onboarding.',
      platform: 'Java/Spring',
      database: 'PostgreSQL',
      dcCity: 'Jakarta',
      dcCountry: 'Indonesia',
      dcProvider: 'Self',
      drCity: 'Surabaya',
      drCountry: 'Indonesia',
      drcProvider: 'Self',
      backupStrategy: 'HA_ACTIVE_ACTIVE',
      systemOwner: 'Jane Doe',
      developerRaw: 'inhouse',
      goLiveDateIso: '2021-03-15',
      ownership: 'OUTRIGHT_PURCHASE',
    });
  });

  it('accepts a real Excel date cell for the go-live date column, not just dd-mm-yyyy text', () => {
    const row = [...VALID_ROW];
    row[13] = new Date(Date.UTC(2022, 5, 1)); // 2022-06-01
    const wb = makeWorkbook([row]);
    const result = parseLkptiImportWorkbook(wb);

    expect(result.rows[0].goLiveDateIso).toBe('2022-06-01');
  });

  it('fails the whole import when the workbook has no LKPTI Format 3.2.6 sheet', () => {
    const wb = makeWorkbook([VALID_ROW], 'Some Other Sheet');
    expect(() => parseLkptiImportWorkbook(wb)).toThrow(/LKPTI Format 3\.2\.6/);
  });

  it('fails the whole import when the header row does not match exactly', () => {
    const badHeaders = [...LKPTI_EXPORT_HEADERS];
    badHeaders[2] = 'Application Name'; // should be 'Nama Aplikasi'
    const wb = makeWorkbook([VALID_ROW], LKPTI_SHEET_NAME, badHeaders);
    expect(() => parseLkptiImportWorkbook(wb)).toThrow();
  });

  it('skips (not fails) a row with an unrecognized category code', () => {
    const row = [...VALID_ROW];
    row[1] = '99 — Other infrastructure'; // not one of the 13 LKPTI-eligible codes
    const wb = makeWorkbook([row]);
    const result = parseLkptiImportWorkbook(wb);

    expect(result.rows).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toMatch(/category/i);
  });

  it('skips a row with an unrecognized backup strategy label', () => {
    const row = [...VALID_ROW];
    row[10] = 'Some Made Up Strategy';
    const wb = makeWorkbook([row]);
    const result = parseLkptiImportWorkbook(wb);

    expect(result.rows).toHaveLength(0);
    expect(result.skipped[0].reason).toMatch(/backup/i);
  });

  it('skips a row with an unrecognized ownership label', () => {
    const row = [...VALID_ROW];
    row[14] = 'Not A Real Ownership Type';
    const wb = makeWorkbook([row]);
    const result = parseLkptiImportWorkbook(wb);

    expect(result.rows).toHaveLength(0);
    expect(result.skipped[0].reason).toMatch(/ownership/i);
  });

  it('skips a row whose go-live date is neither dd-mm-yyyy text nor a date cell', () => {
    const row = [...VALID_ROW];
    row[13] = 'not a date';
    const wb = makeWorkbook([row]);
    const result = parseLkptiImportWorkbook(wb);

    expect(result.rows).toHaveLength(0);
    expect(result.skipped[0].reason).toMatch(/go-live|date/i);
  });

  it('skips a row with a blank application name', () => {
    const row = [...VALID_ROW];
    row[2] = '';
    const wb = makeWorkbook([row]);
    const result = parseLkptiImportWorkbook(wb);

    expect(result.rows).toHaveLength(0);
    expect(result.skipped[0].reason).toMatch(/name/i);
  });

  it('leaves optional fields (platform, description, DC/DRC location) undefined when their cells are blank', () => {
    const row = [...VALID_ROW];
    row[3] = ''; // description
    row[4] = ''; // platform
    row[6] = ''; // Lokasi DC
    const wb = makeWorkbook([row]);
    const result = parseLkptiImportWorkbook(wb);

    expect(result.rows[0].description).toBeUndefined();
    expect(result.rows[0].platform).toBeUndefined();
    expect(result.rows[0].dcCity).toBeUndefined();
    expect(result.rows[0].dcCountry).toBeUndefined();
  });

  it('processes remaining rows after skipping a bad one, and numbers skipped rows by sheet row', () => {
    const badRow = [...VALID_ROW];
    badRow[2] = '';
    const goodRow = [...VALID_ROW];
    const wb = makeWorkbook([badRow, goodRow]);
    const result = parseLkptiImportWorkbook(wb);

    expect(result.rows).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].rowNumber).toBe(2); // header is row 1, badRow is the first data row -> sheet row 2
  });
});

describe('deriveWorkspaceFromLkptiImport', () => {
  const rows: LkptiImportRow[] = [
    {
      categoryCode: '01', name: 'Core Banking App', description: 'Handles onboarding.',
      platform: 'Java/Spring', database: 'PostgreSQL',
      dcCity: 'Jakarta', dcCountry: 'Indonesia', dcProvider: 'Self',
      drCity: 'Surabaya', drCountry: 'Indonesia', drcProvider: 'Self',
      backupStrategy: 'HA_ACTIVE_ACTIVE', systemOwner: 'Jane Doe',
      developerRaw: 'inhouse', goLiveDateIso: '2021-03-15', ownership: 'OUTRIGHT_PURCHASE',
    },
    {
      categoryCode: '01', name: 'Second App', description: undefined,
      platform: 'Node.js', database: 'MongoDB',
      dcCity: undefined, dcCountry: undefined, dcProvider: 'PT Cloud Provider',
      drCity: undefined, drCountry: undefined, drcProvider: 'PT Cloud Provider',
      backupStrategy: 'BACKUP_PERIODIC', systemOwner: 'John Roe',
      developerRaw: 'PT Third Party Dev', goLiveDateIso: '2022-06-01', ownership: 'LEASE',
    },
  ];

  it('creates one AssetCategory per distinct category code, shared across rows', () => {
    const result = deriveWorkspaceFromLkptiImport(rows, 2026);
    expect(result.assetCategories).toHaveLength(1);
    expect(result.assetCategories[0].categoryCode).toBe('01');
  });

  it('creates one placeholder Asset per row, 1:1 with the resulting Deliverable', () => {
    const result = deriveWorkspaceFromLkptiImport(rows, 2026);
    expect(result.assets).toHaveLength(2);
    expect(result.deliverables).toHaveLength(2);
    expect(result.assets.map(a => a.id).sort()).toEqual(
      result.deliverables.map(d => d.assetId).sort()
    );
  });

  it('sets Deliverable.developer to "inhouse", or to the provider\'s name', () => {
    // Changed by ADR-0013. This used to collapse any third party to 'PPJTI', which
    // discarded the one thing the LKPTI column actually asks for — who built it. The
    // classification is now derived where the RPTI needs it ("not inhouse" => PPJTI),
    // so one field serves both returns and the name survives a regeneration.
    const result = deriveWorkspaceFromLkptiImport(rows, 2026);
    expect(result.deliverables[0].developer).toBe('inhouse');
    expect(result.deliverables[1].developer).toBe('PT Third Party Dev');
  });

  it('creates exactly one open-ended live DeliverableSegment per row, anchored on the go-live date', () => {
    const result = deriveWorkspaceFromLkptiImport(rows, 2026);
    expect(result.deliverableSegments).toHaveLength(2);
    expect(result.deliverableSegments[0].startDate).toBe('2021-03-15');
    expect(result.deliverableSegments.every(s => s.endDate > '2021-03-15')).toBe(true);
  });

  it('creates exactly one live DeliverableStatus, shared by every segment', () => {
    const result = deriveWorkspaceFromLkptiImport(rows, 2026);
    expect(result.deliverableStatuses).toHaveLength(1);
    expect(result.deliverableStatuses[0].isLiveStatus).toBe(true);
    expect(result.deliverableSegments.every(s => s.status === result.deliverableStatuses[0].id)).toBe(true);
  });

  it('writes an LkptiDetail row per import row with all 15 columns worth of data, including the 7 manual-only fields', () => {
    const result = deriveWorkspaceFromLkptiImport(rows, 2026);
    expect(result.lkptiDetails).toHaveLength(2);
    expect(result.lkptiDetails[0]).toMatchObject({
      targetId: result.deliverables[0].id,
      targetName: 'Core Banking App',
      categoryCode: '01',
      platform: 'Java/Spring',
      database: 'PostgreSQL',
      dcProvider: 'Self',
      drcProvider: 'Self',
      backupStrategy: 'HA_ACTIVE_ACTIVE',
      systemOwner: 'Jane Doe',
      ownership: 'OUTRIGHT_PURCHASE',
      goLiveDate: '15-03-2021',
      functionDescription: 'Handles onboarding.',
    });
  });

  it('preserves the raw developer text on LkptiDetail.developer even for third-party developers', () => {
    const result = deriveWorkspaceFromLkptiImport(rows, 2026);
    expect(result.lkptiDetails[1].developer).toBe('PT Third Party Dev');
  });
});

describe('a blank developer cell is accepted, not a reason to drop the row', () => {
  // Selara's own LKPTI export leaves this cell empty for anything not marked
  // in-house (generateLkptiDetails only ever sets 'inhouse'), so rejecting blank
  // meant the app could not read back a file it had just written — a real import
  // of 13 rows kept 1. A missing developer is a completeness gap, which
  // computeDataHealth already reports; dropping the row loses the application.
  const blankDeveloperRow = () => {
    const row = [...VALID_ROW];
    row[12] = '';
    return row;
  };

  it('keeps a row whose developer is blank', () => {
    const result = parseLkptiImportWorkbook(makeWorkbook([blankDeveloperRow()]));
    expect(result.skipped).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].developerRaw).toBe('');
  });

  it('leaves the developer unknown rather than defaulting it to PPJTI', () => {
    const { rows } = parseLkptiImportWorkbook(makeWorkbook([blankDeveloperRow()]));
    const derived = deriveWorkspaceFromLkptiImport(rows, 2026);
    expect(derived.deliverables[0].developer).toBeUndefined();
    expect(derived.lkptiDetails[0].developer).toBeUndefined();
  });

  it('still reads an explicit developer', () => {
    const { rows } = parseLkptiImportWorkbook(makeWorkbook([VALID_ROW]));
    const derived = deriveWorkspaceFromLkptiImport(rows, 2026);
    expect(derived.deliverables[0].developer).toBe('inhouse');
    expect(derived.lkptiDetails[0].developer).toBe('inhouse');
  });
});

describe('round trip against the real exporter', () => {
  // The bug this guards: generateLkptiDetails only ever writes 'inhouse' into the
  // developer column, so a return Selara exported itself came back with 12 of its
  // 13 rows rejected as malformed. What the app writes, it must read back.
  const load = (name: string) => {
    const buf = readFileSync(new URL(`../../e2e/fixtures/${name}`, import.meta.url));
    return XLSX.read(buf, { type: 'buffer' });
  };

  it('reads back every row of a return this app exported', () => {
    const { rows, skipped } = parseLkptiImportWorkbook(load('lkpti-format-3.2.6.xlsx'));
    expect(skipped).toEqual([]);
    expect(rows.length).toBeGreaterThan(0);
  });

  // 240, not 300: the scale workspace holds 300 deliverables, of which 240 are
  // LKPTI-eligible applications. The number to hold onto is that none are skipped.
  it('handles a full-scale return without skipping anything', () => {
    const { rows, skipped } = parseLkptiImportWorkbook(load('lkpti-format-3.2.6-scale-300.xlsx'));
    expect(skipped).toEqual([]);
    expect(rows).toHaveLength(240);
  });

  it('turns that return into one application per filed row', () => {
    const { rows } = parseLkptiImportWorkbook(load('lkpti-format-3.2.6.xlsx'));
    const out = deriveWorkspaceFromLkptiImport(rows, 2026);
    expect(out.deliverables).toHaveLength(rows.length);
    expect(out.lkptiDetails).toHaveLength(rows.length);
  });
});

describe('a blank category cell is accepted, but a wrong one is not', () => {
  const withCategory = (value: string) => {
    const row = [...VALID_ROW];
    row[1] = value;
    return makeWorkbook([row]);
  };

  it('keeps a row that states no category, and buckets it visibly', () => {
    const { rows, skipped } = parseLkptiImportWorkbook(withCategory(''));
    expect(skipped).toEqual([]);
    const out = deriveWorkspaceFromLkptiImport(rows, 2026);
    expect(out.deliverables[0].categoryCode).toBeUndefined();
    expect(out.assetCategories[0].name).toBe('Uncategorised');
    expect(out.assetCategories[0].categoryCode).toBeUndefined();
  });

  it('still rejects a category code that is present but not an LKPTI code', () => {
    const { rows, skipped } = parseLkptiImportWorkbook(withCategory('77 — Not a thing'));
    expect(rows).toEqual([]);
    expect(skipped[0].reason).toMatch(/Unrecognized category code/);
  });
});

describe('colours are Tailwind classes, not hex or bare colour names', () => {
  // See the note on the status in lkptiImport.ts: 'green' matched no Tailwind
  // class, so every imported lifecycle segment drew with no fill.
  it('gives every imported deliverable status a class the visualiser can render', () => {
    const { rows } = parseLkptiImportWorkbook(makeWorkbook([VALID_ROW]));
    const out = deriveWorkspaceFromLkptiImport(rows, 2026);
    expect(out.deliverableStatuses.length).toBeGreaterThan(0);
    for (const s of out.deliverableStatuses) expect(s.color).toMatch(/^bg-[a-z]+-\d{2,3}$/);
  });
});

describe('imported applications state their type', () => {
  // LKPTI is Daftar Aplikasi, and the parser already rejects the infrastructure
  // codes, so every surviving row is an application. Reading code defaults an unset
  // type to 'application' anyway, but the Deliverables tab showed a blank Type
  // select on all 13 imported rows, which reads as missing data.
  it('sets type to application rather than leaving it to a fallback', () => {
    const { rows } = parseLkptiImportWorkbook(makeWorkbook([VALID_ROW]));
    const out = deriveWorkspaceFromLkptiImport(rows, 2026);
    expect(out.deliverables).toHaveLength(1);
    expect(out.deliverables[0].type).toBe('application');
  });
});

describe('the importer records attributes on the application, not only on the report row', () => {
  /**
   * ADR-0013. The filed return is the only source for platform, database, the two
   * providers, backup strategy, system owner, ownership and the vendor's name. They
   * now live on the Deliverable so a regenerated LKPTI can read them; before this,
   * regenerating lost all eight on every row.
   */
  it('writes all eight onto the Deliverable', () => {
    const { rows } = parseLkptiImportWorkbook(makeWorkbook([VALID_ROW]));
    const out = deriveWorkspaceFromLkptiImport(rows, 2026);
    expect(out.deliverables[0]).toMatchObject({
      platform: 'Java/Spring',
      database: 'PostgreSQL',
      dcProvider: 'Self',
      drcProvider: 'Self',
      backupStrategy: 'HA_ACTIVE_ACTIVE',
      systemOwner: 'Jane Doe',
      ownership: 'OUTRIGHT_PURCHASE',
      developer: 'inhouse',
    });
  });

  it('carries a provider name onto the Deliverable, not just the classification', () => {
    const row = [...VALID_ROW];
    row[12] = 'PT Anabatic Technologies';
    const { rows } = parseLkptiImportWorkbook(makeWorkbook([row]));
    const out = deriveWorkspaceFromLkptiImport(rows, 2026);
    // The name itself — the RPTI derives 'PPJTI' from it, the LKPTI emits it verbatim.
    expect(out.deliverables[0].developer).toBe('PT Anabatic Technologies');
  });

  it('leaves an attribute the return did not supply unset rather than inventing one', () => {
    const row = [...VALID_ROW];
    row[4] = '';  // Platform
    const { rows } = parseLkptiImportWorkbook(makeWorkbook([row]));
    const out = deriveWorkspaceFromLkptiImport(rows, 2026);
    expect(out.deliverables[0].platform).toBeUndefined();
  });
});

/**
 * T032 / FR-009. The LKPTI is a point-in-time inventory, and onboarding asks which
 * point that is — then, until now, threw the answer away and asked the system clock
 * instead. `openEndedDate()` read `new Date()`, so importing the same filed return in
 * 2026 and again in 2030 produced different workspaces from identical input. That is
 * the same class of defect as the report year #40 was raised for: a regulatory artefact
 * whose meaning depends on when you happened to open the app.
 */
describe('the stated as-at year, not the clock, anchors an imported inventory (T032)', () => {
  const row: LkptiImportRow = {
    categoryCode: '01', name: 'Core Banking App', description: 'Ledger',
    platform: 'Java/Spring', database: 'PostgreSQL',
    dcCity: 'Jakarta', dcCountry: 'Indonesia', dcProvider: 'Self',
    drCity: 'Surabaya', drCountry: 'Indonesia', drcProvider: 'Self',
    backupStrategy: 'HA_ACTIVE_ACTIVE', systemOwner: 'Jane Doe',
    developerRaw: 'inhouse', goLiveDateIso: '2020-03-01', ownership: 'LEASE',
  };

  it('derives the open-ended live segment from the stated year', () => {
    const a = deriveWorkspaceFromLkptiImport([row], 2026);
    const b = deriveWorkspaceFromLkptiImport([row], 2030);

    expect(a.deliverableSegments[0].endDate).toBe('2031-12-31');
    expect(b.deliverableSegments[0].endDate).toBe('2035-12-31');
  });

  it('gives the same workspace for the same file and year, whenever it is run', () => {
    const first = deriveWorkspaceFromLkptiImport([row], 2026);
    const second = deriveWorkspaceFromLkptiImport([row], 2026);
    expect(first.deliverableSegments.map(s => s.endDate))
      .toEqual(second.deliverableSegments.map(s => s.endDate));
  });
});
