import * as XLSX from 'xlsx';
import {
  Asset, AssetCategory, Deliverable, DeliverableSegment, DeliverableStatus,
  Initiative, Programme, RptiCategoryCode, RptiDetail, RptiDeveloper, RptiDevelopmentType,
  RptiQuarter, RptiRelatedParty,
} from '../types';
import { RPTI_CATEGORY_LABELS, periodForQuarter, hasLiveHistoryBefore, openEndedDate, continuousPriorLivePhase, UNRESOLVED_IMPORT_TARGET_PREFIX, INFRASTRUCTURE_CODES } from './rpti';
import { IN_PRODUCTION_STATUS, SEEDED_DELIVERABLE_STATUSES } from './deliverableStatusDefaults';

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
  /**
   * Existing deliverables that gained a value from the filed plan — today only the
   * related-party answer, which the RPTI supplies for applications the LKPTI already
   * created. The importer does not own those records, so it reports the change rather
   * than mutating its input; the caller merges by id.
   */
  updatedDeliverables: Deliverable[];
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
export const RPTI_IMPORT_LIVE_STATUS_ID = IN_PRODUCTION_STATUS.id;

/**
 * How long an imported implementation stays live depends on what it is (Q21).
 *
 * A **new** build creates the application, so its live phase is the application's
 * existence — held to the shared five-year horizon from its filed go-live year.
 * A Q3 2027 go-live is live through 2032-12-31, as is every 2027 quarter.
 *
 * An **upgrade** is an event on something already running, so only its filed quarter
 * is the implementation. The application's continued existence is carried by its own
 * inventory history — or, where it has none, by the synthetic prior phase below.
 */
function importedLiveEnd(developmentType: 'new' | 'upgrade', reportYear: number, quarterEnd: string): string {
  if (developmentType === 'upgrade') return quarterEnd;
  return openEndedDate(reportYear);
}

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
  existing: {
    deliverables: Deliverable[];
    assets: Asset[];
    assetCategories: AssetCategory[];
    // Optional, and only consulted to decide whether an attached upgrade needs a
    // synthetic prior-live segment. Omit them and it always gets one, which is the
    // safe direction: a redundant segment, never a missing classification.
    deliverableSegments?: DeliverableSegment[];
    deliverableStatuses?: DeliverableStatus[];
  },
): DerivedRptiWorkspace {
  const programmes: Programme[] = [];
  const assetCategories: AssetCategory[] = [];
  const assets: Asset[] = [];
  const deliverables: Deliverable[] = [];
  const deliverableSegments: DeliverableSegment[] = [];
  const initiatives: Initiative[] = [];
  const rptiDetails: RptiDetail[] = [];
  const unresolved: UnresolvedRptiReference[] = [];
  const updatedDeliverables = new Map<string, Deliverable>();

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
      // A later row in this same return may upgrade an application an earlier
      // row created. Identical name and category within one filed return are
      // already explicit identity evidence; no cross-return naming judgement is
      // involved. Only look backward through `deliverables`, which contains the
      // entries created so far in this import.
      const matches = [...existing.deliverables, ...deliverables].filter(
        d => d.name.trim().toLowerCase() === row.name.trim().toLowerCase()
          && d.categoryCode === row.categoryCode,
      );
      if (matches.length === 1) {
        targetId = matches[0].id;
        initiativeAssetId = matches[0].assetId;
        // The plan answers the related-party question for an application the inventory
        // already created. Record it against that application, without overwriting an
        // answer already there.
        if (row.ppjtiRelatedParty !== undefined && matches[0].ppjtiRelatedParty === undefined) {
          const current = updatedDeliverables.get(matches[0].id) ?? matches[0];
          updatedDeliverables.set(matches[0].id, { ...current, ppjtiRelatedParty: row.ppjtiRelatedParty });
        }
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
        // it records that. A prior-live phase plus the filed live start below
        // keep it classified as an upgrade on regeneration.
        //
        // Still only when nothing matched. A later import that does find the entry
        // this one created attaches to it rather than making a second copy.
      } else {
        // An application that matched nothing, or several matches of either kind —
        // genuine ambiguity. Create nothing, and leave the report row pointing at
        // an id that will not resolve — computeDataHealth's existing rpti-target
        // check reports it, so no new rule and no import-results store is needed.
        unresolved.push({ rowNumber: row.rowNumber, name: row.name, categoryCode: row.categoryCode });
        targetId = `${UNRESOLVED_IMPORT_TARGET_PREFIX}${n}`;
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
        // A fact about this application's supplier, not about the row (ADR-0013).
        ppjtiRelatedParty: row.ppjtiRelatedParty,
      });
      targetId = deliverableId;
    }

    const hasEntry = !unresolved.some(u => u.rowNumber === row.rowNumber);
    let anchorSegmentId: string | undefined;
    if (hasEntry && createdEntry) {
      // Every filed implementation is a transition into production. An imported
      // upgrade with no inventory history (infrastructure cannot be in LKPTI)
      // also needs a prior live phase to preserve its filed development type.
      if (row.developmentType === 'upgrade') {
        deliverableSegments.push(continuousPriorLivePhase(
          targetId, reportYear, RPTI_IMPORT_LIVE_STATUS_ID, `rpti-import-seg-prior-${n}`));
      }
      anchorSegmentId = `rpti-import-seg-${n}`;
      deliverableSegments.push({
        id: anchorSegmentId, deliverableId: targetId,
        startDate: qStart, endDate: importedLiveEnd(row.developmentType, reportYear, qEnd),
        status: RPTI_IMPORT_LIVE_STATUS_ID,
        initiativeId,
        capexAmount: row.capexAmount,
        opexAmount: row.opexAmount,
        rptiRemarks: row.remarks,
      });
    } else if (hasEntry) {
      // A synthetic, unlinked prior-live segment is added only when the target has none of its
      // own. It exists to keep the filed `upgrade` from regenerating as `new`.
      // History includes both the incoming workspace and rows already processed in
      // this import, and is compared with this implementation's date (contract 2b),
      // not the report-year boundary. The filed quarter itself is always a live
      // start, for both new and upgrade rows.
      const targetAlreadyLiveBeforeImplementation = hasLiveHistoryBefore(
        targetId, qStart, [...(existing.deliverableSegments ?? []), ...deliverableSegments],
        existing.deliverableStatuses ?? [],
      );
      if (row.developmentType === 'upgrade' && !targetAlreadyLiveBeforeImplementation) {
        // One rule with the #51 repair (Q22, research R5): live from the year before the
        // filed year through the shared horizon, so the entry stays in the inventory for
        // every year of the plan. The original one-year shape deliberately ended in the
        // prior year, not on 1 January of this one, so it did not also count as part of the
        // plan's own report-year activity; the phase now overlaps the filed implementation,
        // and is unlinked, so it still files no row of its own in the plan's report year.
        deliverableSegments.push(continuousPriorLivePhase(
          targetId, reportYear, RPTI_IMPORT_LIVE_STATUS_ID, `rpti-import-seg-prior-${n}`));
      }
      anchorSegmentId = `rpti-import-seg-${n}`;
      deliverableSegments.push({
        id: anchorSegmentId, deliverableId: targetId,
        startDate: qStart, endDate: importedLiveEnd(row.developmentType, reportYear, qEnd),
        status: RPTI_IMPORT_LIVE_STATUS_ID, initiativeId,
        capexAmount: row.capexAmount,
        opexAmount: row.opexAmount,
        rptiRemarks: row.remarks,
      });
    }

    // Created after the target is known, so it can carry a real assetId. Leaving
    // programmeId/assetId empty would dangle: computeDataHealth reports every
    // initiative whose programme or asset does not resolve, so a 7-row import
    // arrived with 14 errors before this was fixed.
    initiatives.push({
      id: initiativeId,
      // The RPTI has no initiative-name column, so the application name is all there
      // is. The quarter keeps two rows for one application distinguishable (Q21).
      name: `${row.name} — ${row.plannedQuarter} ${reportYear}`,
      programmeId: RPTI_IMPORT_PROGRAMME_ID,
      assetId: initiativeAssetId,
      // Exactly the filed quarter. The return states when the work goes live and nothing
      // about when it began; starting on 1 January made every bar's length encode which
      // quarter was filed — Q1 three months, Q4 twelve (Q21).
      startDate: qStart,
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

  return { assetCategories, assets, deliverables, deliverableSegments, deliverableStatuses, initiatives, programmes, rptiDetails, unresolved, updatedDeliverables: [...updatedDeliverables.values()] };
}
