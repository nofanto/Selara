import { describe, expect, it } from 'vitest';
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
    const result = deriveWorkspaceFromLkptiImport(rows);
    expect(result.assetCategories).toHaveLength(1);
    expect(result.assetCategories[0].categoryCode).toBe('01');
  });

  it('creates one placeholder Asset per row, 1:1 with the resulting Deliverable', () => {
    const result = deriveWorkspaceFromLkptiImport(rows);
    expect(result.assets).toHaveLength(2);
    expect(result.deliverables).toHaveLength(2);
    expect(result.assets.map(a => a.id).sort()).toEqual(
      result.deliverables.map(d => d.assetId).sort()
    );
  });

  it('sets Deliverable.developer to "inhouse" only when the raw text is exactly "inhouse", otherwise "PPJTI"', () => {
    const result = deriveWorkspaceFromLkptiImport(rows);
    expect(result.deliverables[0].developer).toBe('inhouse');
    expect(result.deliverables[1].developer).toBe('PPJTI');
  });

  it('creates exactly one open-ended live DeliverableSegment per row, anchored on the go-live date', () => {
    const result = deriveWorkspaceFromLkptiImport(rows);
    expect(result.deliverableSegments).toHaveLength(2);
    expect(result.deliverableSegments[0].startDate).toBe('2021-03-15');
    expect(result.deliverableSegments.every(s => s.endDate > '2021-03-15')).toBe(true);
  });

  it('creates exactly one live DeliverableStatus, shared by every segment', () => {
    const result = deriveWorkspaceFromLkptiImport(rows);
    expect(result.deliverableStatuses).toHaveLength(1);
    expect(result.deliverableStatuses[0].isLiveStatus).toBe(true);
    expect(result.deliverableSegments.every(s => s.status === result.deliverableStatuses[0].id)).toBe(true);
  });

  it('writes an LkptiDetail row per import row with all 15 columns worth of data, including the 7 manual-only fields', () => {
    const result = deriveWorkspaceFromLkptiImport(rows);
    expect(result.lkptiDetails).toHaveLength(2);
    expect(result.lkptiDetails[0]).toMatchObject({
      targetId: result.deliverables[0].id,
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
    const result = deriveWorkspaceFromLkptiImport(rows);
    expect(result.lkptiDetails[1].developer).toBe('PT Third Party Dev');
  });
});
