import * as XLSX from 'xlsx';
import {
  Asset, AssetCategory, Deliverable, DeliverableSegment, DeliverableStatus,
  Initiative, Programme, RptiCategoryCode, RptiDetail, RptiDeveloper, RptiDevelopmentType,
  RptiQuarter, RptiRelatedParty,
} from '../types';
import { RPTI_CATEGORY_LABELS, periodForQuarter } from './rpti';
import { PLANNED_STATUS, IN_PRODUCTION_STATUS, SEEDED_DELIVERABLE_STATUSES } from './deliverableStatusDefaults';

/**
 * Strict-format parser for a filed RPTI Format 3.1 return — the inverse of
 * `exportRptiReportToExcel`, and a sibling of `lkptiImport.ts`.
 *
 * Split into a pure workbook parser and a pure derivation so every rule that can
 * be wrong is unit-testable without a File, a FileReader, or a DOM. The only
 * part that cannot be tested that way is the thin `File` wrapper, which holds no
 * logic on purpose.
 */
export const RPTI_IMPORT_SHEET_NAME = 'RPTI Format 3.1';

/** Column order as written by exportRptiReportToExcel. Must match exactly. */
export const RPTI_IMPORT_HEADERS = [
  'No.', 'Nama Aplikasi/Infrastruktur Bank', 'Deskripsi', 'Kategori', 'Jenis Pengembangan',
  'Pengembang', 'PPJTI Pihak Terkait', 'Lokasi Data Center', 'Lokasi Disaster Recovery Center',
  'Waktu Rencana Implementasi', 'Estimasi Biaya CapEx', 'Estimasi Biaya OpEx', 'Keterangan',
];

/**
 * The five codes that describe infrastructure rather than an application.
 * RPTI carries both; LKPTI (Daftar Aplikasi) carries only applications, which is
 * why `generateLkptiDetails` filters by type and `generateRptiDetails` must not.
 */
const INFRASTRUCTURE_CODES = new Set<string>(['51', '52', '53', '54', '99']);

export interface RptiImportRow {
  rowNumber: number;
  name: string;
  description?: string;
  categoryCode: RptiCategoryCode;
  developmentType: RptiDevelopmentType;
  developer?: RptiDeveloper;
  ppjtiRelatedParty?: RptiRelatedParty;
  dcCity?: string;
  dcCountry?: string;
  drCity?: string;
  drCountry?: string;
  plannedQuarter: RptiQuarter;
  capexAmount?: number;
  opexAmount?: number;
  remarks?: string;
}

export interface RptiImportSkippedRow {
  rowNumber: number;
  reason: string;
}

export interface ParseRptiImportResult {
  rows: RptiImportRow[];
  skipped: RptiImportSkippedRow[];
}

/** A plan row describing an upgrade to something the inventory does not contain. */
export interface UnresolvedRptiReference {
  rowNumber: number;
  name: string;
  categoryCode: RptiCategoryCode;
}

export interface DerivedRptiWorkspace {
  programmes: Programme[];
  assetCategories: AssetCategory[];
  assets: Asset[];
  deliverables: Deliverable[];
  deliverableSegments: DeliverableSegment[];
  deliverableStatuses: DeliverableStatus[];
  initiatives: Initiative[];
  rptiDetails: RptiDetail[];
  unresolved: UnresolvedRptiReference[];
}

const cellText = (value: unknown): string =>
  value === undefined || value === null ? '' : String(value).trim();

/**
 * The export writes the category's *label*, not its code, so importing has to
 * invert the map. Built once rather than per row.
 */
const CODE_BY_LABEL = new Map<string, RptiCategoryCode>(
  (Object.entries(RPTI_CATEGORY_LABELS) as [RptiCategoryCode, string][])
    .map(([code, label]) => [label.toLowerCase(), code]),
);

/** `formatPlace` joins as "City, Country"; split on the first comma to recover both. */
function splitPlace(text: string): { city?: string; country?: string } {
  if (!text) return {};
  const comma = text.indexOf(',');
  if (comma === -1) return { city: text };
  return { city: text.slice(0, comma).trim() || undefined, country: text.slice(comma + 1).trim() || undefined };
}

function parseAmount(text: string): number | undefined | 'invalid' {
  if (text === '') return undefined;
  const n = Number(text.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 'invalid';
}

function parseRow(cells: unknown[], rowNumber: number): { row: RptiImportRow } | { reason: string } {
  const name = cellText(cells[1]);
  if (!name) return { reason: 'No application or infrastructure name' };

  const categoryCode = CODE_BY_LABEL.get(cellText(cells[3]).toLowerCase());
  if (!categoryCode) {
    // Category decides whether this becomes an application or infrastructure, so
    // an unrecognised one cannot be guessed at from the name.
    return { reason: `Unrecognised category "${cellText(cells[3])}"` };
  }

  const jenis = cellText(cells[4]).toLowerCase();
  if (jenis !== 'new' && jenis !== 'upgrade') {
    return { reason: `Development type must be "new" or "upgrade", found "${cellText(cells[4])}"` };
  }

  const quarter = cellText(cells[9]).toUpperCase();
  if (!['Q1', 'Q2', 'Q3', 'Q4'].includes(quarter)) {
    // Planned work cannot be positioned in time without it (FR-016).
    return { reason: `Planned implementation quarter must be Q1-Q4, found "${cellText(cells[9])}"` };
  }

  const capex = parseAmount(cellText(cells[10]));
  if (capex === 'invalid') return { reason: `CapEx "${cellText(cells[10])}" is not a number` };
  const opex = parseAmount(cellText(cells[11]));
  if (opex === 'invalid') return { reason: `OpEx "${cellText(cells[11])}" is not a number` };

  const developer = cellText(cells[5]);
  const related = cellText(cells[6]);
  const dc = splitPlace(cellText(cells[7]));
  const dr = splitPlace(cellText(cells[8]));

  return {
    row: {
      rowNumber,
      name,
      description: cellText(cells[2]) || undefined,
      categoryCode,
      developmentType: jenis as RptiDevelopmentType,
      developer: developer === 'inhouse' || developer === 'PPJTI' ? developer : undefined,
      ppjtiRelatedParty: ['yes', 'no', 'n/a'].includes(related) ? (related as RptiRelatedParty) : undefined,
      dcCity: dc.city, dcCountry: dc.country,
      drCity: dr.city, drCountry: dr.country,
      plannedQuarter: quarter as RptiQuarter,
      capexAmount: capex, opexAmount: opex,
      remarks: cellText(cells[12]) || undefined,
    },
  };
}

export function parseRptiImportWorkbook(workbook: XLSX.WorkBook): ParseRptiImportResult {
  const sheet = workbook.Sheets[RPTI_IMPORT_SHEET_NAME];
  if (!sheet) {
    throw new Error(`This file has no "${RPTI_IMPORT_SHEET_NAME}" sheet — it doesn't look like an RPTI Format 3.1 export.`);
  }

  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' });
  const [headerRow, ...dataRows] = raw;
  const headersMatch = RPTI_IMPORT_HEADERS.every((h, i) => cellText(headerRow?.[i]) === h);
  if (!headerRow || !headersMatch) {
    throw new Error('The header row does not match the RPTI Format 3.1 layout exactly — this importer only accepts the standard OJK template.');
  }

  const rows: RptiImportRow[] = [];
  const skipped: RptiImportSkippedRow[] = [];

  dataRows.forEach((cells, index) => {
    if (cells.every(c => cellText(c) === '')) return; // blank trailing row — ignore, not an error
    const rowNumber = index + 2; // header is row 1, dataRows is 0-indexed
    const result = parseRow(cells, rowNumber);
    if ('row' in result) rows.push(result.row);
    else skipped.push({ rowNumber, reason: result.reason });
  });

  return { rows, skipped };
}

export function parseRptiImportFile(file: File): Promise<ParseRptiImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        resolve(parseRptiImportWorkbook(XLSX.read(data, { type: 'array' })));
      } catch (error) { reject(error); }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

export const RPTI_IMPORT_PROGRAMME_ID = 'rpti-import-programme';
// Shared with the LKPTI importer and demo data rather than importer-specific: one
// vocabulary per workspace, whichever path seeded it. See deliverableStatusDefaults.ts.
export const RPTI_IMPORT_PRELAUNCH_STATUS_ID = PLANNED_STATUS.id;
export const RPTI_IMPORT_LIVE_STATUS_ID = IN_PRODUCTION_STATUS.id;

/**
 * Turns parsed rows into workspace entities.
 *
 * Pure: identical inputs produce identical output, and every id derives from the
 * row's position rather than the clock, so results are reproducible and a test
 * can compare two runs directly.
 */
export function deriveWorkspaceFromRptiImport(
  rows: RptiImportRow[],
  reportYear: number,
  existing: { deliverables: Deliverable[]; assets: Asset[]; assetCategories: AssetCategory[] },
): DerivedRptiWorkspace {
  const programmes: Programme[] = [];
  const assetCategories: AssetCategory[] = [];
  const assets: Asset[] = [];
  const deliverables: Deliverable[] = [];
  const deliverableSegments: DeliverableSegment[] = [];
  const initiatives: Initiative[] = [];
  const rptiDetails: RptiDetail[] = [];
  const unresolved: UnresolvedRptiReference[] = [];

  const categoryIdByCode = new Map<string, string>(
    existing.assetCategories.filter(c => c.categoryCode).map(c => [c.categoryCode as string, c.id]),
  );

  const period = (q: RptiQuarter) => periodForQuarter(q, reportYear);

  rows.forEach((row, index) => {
    const n = index + 1;

    let categoryId = categoryIdByCode.get(row.categoryCode);
    if (!categoryId) {
      categoryId = `rpti-import-cat-${row.categoryCode}`;
      categoryIdByCode.set(row.categoryCode, categoryId);
      assetCategories.push({
        id: categoryId,
        name: RPTI_CATEGORY_LABELS[row.categoryCode],
        categoryCode: row.categoryCode,
      });
    }

    const initiativeId = `rpti-import-init-${n}`;
    const { startDate: qStart, endDate: qEnd } = period(row.plannedQuarter);

    // An upgrade targets something the bank already runs, so it should find an
    // existing entry. Matching is exact on name AND category: anything looser is
    // judgement, and judgement is surfaced rather than automated (FR-018/019).
    let targetId: string | undefined;
    let initiativeAssetId = '';
    if (row.developmentType === 'upgrade') {
      const matches = existing.deliverables.filter(
        d => d.name.trim().toLowerCase() === row.name.trim().toLowerCase()
          && d.categoryCode === row.categoryCode,
      );
      if (matches.length === 1) {
        targetId = matches[0].id;
        initiativeAssetId = matches[0].assetId;
      } else if (matches.length === 0 && INFRASTRUCTURE_CODES.has(row.categoryCode)) {
        // Falls through to creation below, deliberately (FR-019a).
        //
        // FR-019 holds an unmatched upgrade back because the two returns are known
        // to disagree on naming, so a non-match is a judgement call for a person.
        // That reasoning is about applications, which both returns list. LKPTI is
        // Daftar Aplikasi: it never contains infrastructure at all, so an
        // infrastructure upgrade finding no match is not a naming disagreement —
        // it is a certainty, and there is no judgement to defer.
        //
        // Leaving it unresolved created a dead end: a data-health error the user
        // could never clear by importing, because no LKPTI could ever supply the
        // target. The bank does run this infrastructure; the plan says so. Creating
        // it records that, and the prior-live segment below keeps it classified as
        // an upgrade on regeneration.
        //
        // Still only when nothing matched. A later import that does find the entry
        // this one created attaches to it rather than making a second copy.
      } else {
        // An application that matched nothing, or several matches of either kind —
        // genuine ambiguity. Create nothing, and leave the report row pointing at
        // an id that will not resolve — computeDataHealth's existing rpti-target
        // check reports it, so no new rule and no import-results store is needed.
        unresolved.push({ rowNumber: row.rowNumber, name: row.name, categoryCode: row.categoryCode });
        targetId = `rpti-import-unresolved-${n}`;
        // The report row's target is deliberately left unresolvable (that is what
        // data health reports), but the initiative must not also dangle — one
        // finding per problem, not three.
        initiativeAssetId = existing.assets[0]?.id ?? '';
      }
    }

    // A Deliverable is only ever created alongside its own Asset — the two are made
    // together here or not at all, so an imported deliverable never hangs off an
    // asset belonging to something else.
    let createdEntry = false;
    if (!targetId) {
      createdEntry = true;
      const assetId = `rpti-import-asset-${n}`;
      const deliverableId = `rpti-import-deliv-${n}`;
      assets.push({ id: assetId, name: row.name, categoryId, maturity: 1 });
      initiativeAssetId = assetId;
      deliverables.push({
        id: deliverableId,
        assetId,
        name: row.name,
        type: INFRASTRUCTURE_CODES.has(row.categoryCode) ? 'infrastructure' : 'application',
        description: row.description,
        categoryCode: row.categoryCode,
        developer: row.developer,
        dcCity: row.dcCity, dcCountry: row.dcCountry,
        drCity: row.drCity, drCountry: row.drCountry,
      });
      targetId = deliverableId;
    }

    const hasEntry = !unresolved.some(u => u.rowNumber === row.rowNumber);
    let anchorSegmentId: string | undefined;
    if (hasEntry && createdEntry) {
      // One segment for an entry this import created, and its status says whether
      // the thing exists yet — which is exactly what `Jenis Pengembangan` states.
      //
      // `upgrade` means the bank already runs it (the only way to reach this branch
      // is infrastructure, which no LKPTI can carry), so the segment is live. `new`
      // means it does not exist yet, so the segment is planned and nothing asserts
      // it ever goes live: the return files an intention, not an outcome.
      //
      // Both regenerate to the development type that was filed. A lone planned
      // segment with no prior live history reads as 'new'; a lone live segment
      // reads as 'upgrade'. The span is the filed quarter either way, so
      // deriveQuarterFromDate recovers the quarter the bank filed.
      anchorSegmentId = `rpti-import-seg-${n}`;
      deliverableSegments.push({
        id: anchorSegmentId, deliverableId: targetId,
        startDate: qStart, endDate: qEnd,
        status: row.developmentType === 'upgrade' ? RPTI_IMPORT_LIVE_STATUS_ID : RPTI_IMPORT_PRELAUNCH_STATUS_ID,
        initiativeId,
      });
    } else if (hasEntry) {
      // Attached to an entry that already existed, so this import only adds the
      // planned enhancement — plus a preceding live period.
      //
      // That prior segment is not merely belt-and-braces. Where the target came
      // from an LKPTI import it is redundant, because that live segment already
      // starts before the report year. But a target built by hand may carry no
      // live segment at all, and then nothing else would tell regeneration that
      // the thing pre-existed: the filed `upgrade` would come back as `new`.
      deliverableSegments.push({
        id: `rpti-import-seg-prior-${n}`, deliverableId: targetId,
        // Ends in the prior year, not on 1 January of this one: it records that
        // the thing already ran before the plan, so it must not also count as
        // part of the plan's own report-year activity.
        startDate: `${reportYear - 1}-01-01`, endDate: `${reportYear - 1}-12-31`,
        status: RPTI_IMPORT_LIVE_STATUS_ID, initiativeId,
      });
      anchorSegmentId = `rpti-import-seg-plan-${n}`;
      deliverableSegments.push({
        id: anchorSegmentId, deliverableId: targetId,
        startDate: qStart, endDate: qEnd,
        status: RPTI_IMPORT_PRELAUNCH_STATUS_ID, initiativeId,
      });
      deliverableSegments.push({
        id: `rpti-import-seg-live-${n}`, deliverableId: targetId,
        startDate: qEnd, endDate: `${reportYear + 3}-12-31`,
        status: RPTI_IMPORT_LIVE_STATUS_ID, initiativeId,
      });
    }

    // Created after the target is known, so it can carry a real assetId. Leaving
    // programmeId/assetId empty would dangle: computeDataHealth reports every
    // initiative whose programme or asset does not resolve, so a 7-row import
    // arrived with 14 errors before this was fixed.
    initiatives.push({
      id: initiativeId,
      name: row.name,
      programmeId: RPTI_IMPORT_PROGRAMME_ID,
      assetId: initiativeAssetId,
      startDate: `${reportYear}-01-01`,
      endDate: qEnd,
      capex: row.capexAmount ?? 0,
      opex: row.opexAmount ?? 0,
      description: row.description,
    });

    rptiDetails.push({
      id: `rpti-import-row-${n}`,
      initiativeId,
      targetType: 'deliverable',
      targetId,
      categoryCode: row.categoryCode,
      developmentType: row.developmentType,
      developer: row.developer,
      ppjtiRelatedParty: row.ppjtiRelatedParty,
      dcCity: row.dcCity, dcCountry: row.dcCountry,
      drCity: row.drCity, drCountry: row.drCountry,
      capexAmount: row.capexAmount,
      opexAmount: row.opexAmount,
      plannedImplementationQuarter: row.plannedQuarter,
      deliverableSegmentId: anchorSegmentId,
      remarks: row.remarks,
    });
  });

  if (initiatives.length > 0) {
    programmes.push({ id: RPTI_IMPORT_PROGRAMME_ID, name: `RPTI ${reportYear} plan`, color: 'bg-indigo-500' });
  }

  const deliverableStatuses: DeliverableStatus[] =
    deliverableSegments.length === 0 ? [] : [...SEEDED_DELIVERABLE_STATUSES];

  return { assetCategories, assets, deliverables, deliverableSegments, deliverableStatuses, initiatives, programmes, rptiDetails, unresolved };
}
