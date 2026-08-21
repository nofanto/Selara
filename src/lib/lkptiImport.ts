import * as XLSX from 'xlsx';
import { Asset, AssetCategory, Deliverable, DeliverableSegment, DeliverableStatus, LkptiBackupStrategy, LkptiDetail, LkptiOwnership } from '../types';
import {
  LKPTI_BACKUP_STRATEGY_LABELS,
  LKPTI_EXPORT_HEADERS,
  LKPTI_OWNERSHIP_LABELS,
  LKPTI_SHEET_NAME,
  isLkptiCategoryCode,
  toDdMmYyyy,
} from './lkpti';
import { RPTI_CATEGORY_LABELS } from './rpti';

/**
 * Strict-format parser for an existing LKPTI Format 3.2.6 report — the inverse of
 * exportLkptiReportToExcel. See requirement-specs/lkpti-import-onboarding.md §1.
 */

export interface LkptiImportRow {
  categoryCode: string;
  name: string;
  description?: string;
  platform?: string;
  database?: string;
  dcCity?: string;
  dcCountry?: string;
  dcProvider?: string;
  drCity?: string;
  drCountry?: string;
  drcProvider?: string;
  backupStrategy?: LkptiBackupStrategy;
  systemOwner?: string;
  developerRaw: string;
  goLiveDateIso: string;
  ownership?: LkptiOwnership;
}

export interface LkptiImportSkippedRow {
  rowNumber: number; // 1-based sheet row (header is row 1, so the first data row is 2)
  reason: string;
}

export interface ParseLkptiImportResult {
  rows: LkptiImportRow[];
  skipped: LkptiImportSkippedRow[];
}

const BACKUP_STRATEGY_BY_LABEL = new Map(
  (Object.entries(LKPTI_BACKUP_STRATEGY_LABELS) as [LkptiBackupStrategy, string][]).map(([code, label]) => [label, code])
);
const OWNERSHIP_BY_LABEL = new Map(
  (Object.entries(LKPTI_OWNERSHIP_LABELS) as [LkptiOwnership, string][]).map(([code, label]) => [label, code])
);

const DDMMYYYY_PATTERN = /^(\d{2})-(\d{2})-(\d{4})$/;

function cellText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

function parseCategoryCode(cell: unknown): string | undefined {
  const text = cellText(cell);
  const code = text.split('—')[0].trim();
  return isLkptiCategoryCode(code) ? code : undefined;
}

function parseLocation(cell: unknown): { city?: string; country?: string } {
  const text = cellText(cell);
  if (!text) return {};
  const [city, country] = text.split(',').map(s => s.trim());
  return { city: city || undefined, country: country || undefined };
}

function parseGoLiveDate(cell: unknown): string | undefined {
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    const y = cell.getUTCFullYear();
    const m = String(cell.getUTCMonth() + 1).padStart(2, '0');
    const d = String(cell.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const text = cellText(cell);
  const match = DDMMYYYY_PATTERN.exec(text);
  if (!match) return undefined;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

function parseRow(cells: unknown[]): { row: LkptiImportRow } | { reason: string } {
  const name = cellText(cells[2]);
  if (!name) return { reason: 'Application name (Nama Aplikasi) is blank' };

  const categoryCode = parseCategoryCode(cells[1]);
  if (!categoryCode) return { reason: `Unrecognized category code in "${cellText(cells[1])}"` };

  const developerRaw = cellText(cells[12]);
  if (!developerRaw) return { reason: 'Developer (Pengembang Aplikasi) is blank' };

  const goLiveDateIso = parseGoLiveDate(cells[13]);
  if (!goLiveDateIso) return { reason: `Go-live date "${cellText(cells[13])}" is neither dd-mm-yyyy text nor a date cell` };

  let backupStrategy: LkptiBackupStrategy | undefined;
  const backupText = cellText(cells[10]);
  if (backupText) {
    backupStrategy = BACKUP_STRATEGY_BY_LABEL.get(backupText);
    if (!backupStrategy) return { reason: `Unrecognized backup strategy "${backupText}"` };
  }

  let ownership: LkptiOwnership | undefined;
  const ownershipText = cellText(cells[14]);
  if (ownershipText) {
    ownership = OWNERSHIP_BY_LABEL.get(ownershipText);
    if (!ownership) return { reason: `Unrecognized ownership "${ownershipText}"` };
  }

  const dc = parseLocation(cells[6]);
  const dr = parseLocation(cells[8]);

  return {
    row: {
      categoryCode,
      name,
      description: cellText(cells[3]) || undefined,
      platform: cellText(cells[4]) || undefined,
      database: cellText(cells[5]) || undefined,
      dcCity: dc.city,
      dcCountry: dc.country,
      dcProvider: cellText(cells[7]) || undefined,
      drCity: dr.city,
      drCountry: dr.country,
      drcProvider: cellText(cells[9]) || undefined,
      backupStrategy,
      systemOwner: cellText(cells[11]) || undefined,
      developerRaw,
      goLiveDateIso,
      ownership,
    },
  };
}

/**
 * Parses an already-loaded workbook. Throws when the workbook doesn't look like an
 * LKPTI Format 3.2.6 export at all (missing sheet, or header row mismatch) — that's a
 * whole-file failure, not a per-row one. Individual rows with bad cell data are
 * skipped and reported back, not fatal to the rest of the import.
 */
export function parseLkptiImportWorkbook(workbook: XLSX.WorkBook): ParseLkptiImportResult {
  const sheet = workbook.Sheets[LKPTI_SHEET_NAME];
  if (!sheet) {
    throw new Error(`This file has no "${LKPTI_SHEET_NAME}" sheet — it doesn't look like an LKPTI Format 3.2.6 export.`);
  }

  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' });
  const [headerRow, ...dataRows] = raw;
  const headersMatch = LKPTI_EXPORT_HEADERS.every((h, i) => cellText(headerRow?.[i]) === h);
  if (!headerRow || !headersMatch) {
    throw new Error('The header row does not match the LKPTI Format 3.2.6 layout exactly — this importer only accepts the standard OJK template.');
  }

  const rows: LkptiImportRow[] = [];
  const skipped: LkptiImportSkippedRow[] = [];

  dataRows.forEach((cells, index) => {
    if (cells.every(c => cellText(c) === '')) return; // blank trailing row — ignore, not an error
    const result = parseRow(cells);
    if ('row' in result) {
      rows.push(result.row);
    } else {
      skipped.push({ rowNumber: index + 2, reason: result.reason }); // +2: header is row 1, dataRows is 0-indexed
    }
  });

  return { rows, skipped };
}

export function parseLkptiImportFile(file: File): Promise<ParseLkptiImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        resolve(parseLkptiImportWorkbook(workbook));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

export interface DerivedLkptiWorkspace {
  assetCategories: AssetCategory[];
  assets: Asset[];
  deliverables: Deliverable[];
  deliverableSegments: DeliverableSegment[];
  deliverableStatuses: DeliverableStatus[];
  lkptiDetails: LkptiDetail[];
}

// A freshly-imported "live" segment has no known end — DeliverableSegment.endDate is a
// required field, so we anchor it several years out, matching how demo data represents
// an ongoing live segment (see src/demoData.ts) rather than inventing a null-endDate concept.
const OPEN_ENDED_YEARS_OUT = 5;

function openEndedDate(): string {
  const year = new Date().getUTCFullYear() + OPEN_ENDED_YEARS_OUT;
  return `${year}-12-31`;
}

/**
 * Derives a starter workspace from parsed LKPTI rows — see
 * requirement-specs/lkpti-import-onboarding.md §2-5.
 */
export function deriveWorkspaceFromLkptiImport(rows: LkptiImportRow[]): DerivedLkptiWorkspace {
  const assetCategories: AssetCategory[] = [];
  const categoryIdByCode = new Map<string, string>();
  const assets: Asset[] = [];
  const deliverables: Deliverable[] = [];
  const deliverableSegments: DeliverableSegment[] = [];
  const lkptiDetails: LkptiDetail[] = [];

  const liveStatus: DeliverableStatus = {
    id: 'lkpti-import-status-live',
    name: 'Live',
    color: 'green',
    isLiveStatus: true,
  };

  rows.forEach((row, i) => {
    const n = i + 1;

    let categoryId = categoryIdByCode.get(row.categoryCode);
    if (!categoryId) {
      categoryId = `lkpti-import-cat-${row.categoryCode}`;
      categoryIdByCode.set(row.categoryCode, categoryId);
      assetCategories.push({
        id: categoryId,
        name: isLkptiCategoryCode(row.categoryCode) ? RPTI_CATEGORY_LABELS[row.categoryCode] : row.categoryCode,
        categoryCode: isLkptiCategoryCode(row.categoryCode) ? row.categoryCode : undefined,
      });
    }

    const assetId = `lkpti-import-asset-${n}`;
    // Placeholder maturity — provisional, at the low end of the 1-5 scale until the
    // user re-rates it from Data Manager. See requirement-specs/lkpti-import-onboarding.md §2.
    assets.push({ id: assetId, name: row.name, categoryId, maturity: 1 });

    const deliverableId = `lkpti-import-deliv-${n}`;
    const isInhouse = row.developerRaw.toLowerCase() === 'inhouse';
    deliverables.push({
      id: deliverableId,
      assetId,
      name: row.name,
      description: row.description,
      categoryCode: isLkptiCategoryCode(row.categoryCode) ? row.categoryCode : undefined,
      developer: isInhouse ? 'inhouse' : 'PPJTI',
      dcCity: row.dcCity,
      dcCountry: row.dcCountry,
      drCity: row.drCity,
      drCountry: row.drCountry,
    });

    deliverableSegments.push({
      id: `lkpti-import-seg-${n}`,
      deliverableId,
      startDate: row.goLiveDateIso,
      endDate: openEndedDate(),
      status: liveStatus.id,
    });

    lkptiDetails.push({
      id: `lkpti-import-lk-${n}`,
      targetId: deliverableId,
      categoryCode: isLkptiCategoryCode(row.categoryCode) ? row.categoryCode : undefined,
      // Preserved verbatim, unlike generateLkptiDetails' cascade rule — the raw provider
      // name from the source report is worth keeping even for non-inhouse developers.
      developer: isInhouse ? 'inhouse' : row.developerRaw,
      dcCity: row.dcCity,
      dcCountry: row.dcCountry,
      drCity: row.drCity,
      drCountry: row.drCountry,
      platform: row.platform,
      database: row.database,
      dcProvider: row.dcProvider,
      drcProvider: row.drcProvider,
      backupStrategy: row.backupStrategy,
      systemOwner: row.systemOwner,
      goLiveDate: toDdMmYyyy(row.goLiveDateIso),
      ownership: row.ownership,
      functionDescription: row.description,
    });
  });

  return {
    assetCategories,
    assets,
    deliverables,
    deliverableSegments,
    deliverableStatuses: [liveStatus],
    lkptiDetails,
  };
}
