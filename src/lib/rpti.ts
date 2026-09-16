import * as XLSX from 'xlsx';
import { RptiDetail, RptiCategoryCode, RptiQuarter, Initiative, Deliverable, Asset, AssetCategory, DeliverableSegment, DeliverableStatus } from '../types';

export const RPTI_CATEGORY_LABELS: Record<RptiCategoryCode, string> = {
  '01': 'Customer management',
  '02': 'Third-party funds (current accounts, savings, deposits)',
  '03': 'Credit / financing',
  '04': 'General Ledger (GL)',
  '05': 'Payments',
  '06': 'Digital services',
  '07': 'Treasury',
  '08': 'Trade finance',
  '09': 'AML-CFT and PPPSPM',
  '10': 'Management information/reporting systems',
  '11': 'Risk management',
  '12': 'Internal management',
  '49': 'Other deliverables',
  '51': 'Data Center / Disaster Recovery Center',
  '52': 'Servers and/or platforms',
  '53': 'Data communication network',
  '54': 'Security systems',
  '99': 'Other infrastructure',
};

const LIVE_STATUS_FALLBACK_ID = 'appstatus-in-production';
const LIVE_STATUS_FALLBACK_PATTERN = /production|live/i;

export function deriveQuarterFromDate(iso: string): RptiQuarter {
  const month = Number(iso.slice(5, 7));
  if (month <= 3) return 'Q1';
  if (month <= 6) return 'Q2';
  if (month <= 9) return 'Q3';
  return 'Q4';
}

/**
 * The calendar span of a quarter within a given year — the inverse of
 * `deriveQuarterFromDate`.
 *
 * A filed RPTI return states `Waktu Rencana Implementasi` as a quarter with no
 * year and no dates (see `exportRptiReportToExcel`'s columns), so importing one
 * has to turn that back into a period before the planned work can be placed on
 * a timeline. Kept as a named function rather than inline arithmetic so the
 * boundary dates are testable, and so the round trip
 * `deriveQuarterFromDate(periodForQuarter(q, y).startDate) === q` can be
 * asserted — if that ever broke, an imported row would regenerate into a
 * different quarter than the bank filed.
 */
export function periodForQuarter(quarter: RptiQuarter, year: number): { startDate: string; endDate: string } {
  const spans: Record<RptiQuarter, [string, string]> = {
    Q1: ['01-01', '03-31'],
    Q2: ['04-01', '06-30'],
    Q3: ['07-01', '09-30'],
    Q4: ['10-01', '12-31'],
  };
  const [start, end] = spans[quarter];
  return { startDate: `${year}-${start}`, endDate: `${year}-${end}` };
}

export function isLiveStatusId(statusId: string, deliverableStatuses: DeliverableStatus[]): boolean {
  const status = deliverableStatuses.find(s => s.id === statusId);
  if (status) return !!status.isLiveStatus || (!deliverableStatuses.some(s => s.isLiveStatus) && (statusId === LIVE_STATUS_FALLBACK_ID || LIVE_STATUS_FALLBACK_PATTERN.test(status.name)));
  // No matching DeliverableStatus record (e.g. legacy default id with no record) — fall back to id/name pattern.
  return statusId === LIVE_STATUS_FALLBACK_ID;
}

const PRE_LAUNCH_STATUS_FALLBACK_IDS = new Set(['appstatus-planned', 'appstatus-funded']);
const PRE_LAUNCH_STATUS_FALLBACK_PATTERN = /planned|funded/i;

// Mirrors isLiveStatusId's shape: an explicit isPreLaunchStatus flag always wins. Only
// when no status in the workspace has that flag explicitly set does a legacy/demo id or
// a "planned"/"funded" name get trusted instead, so existing workspaces keep working
// without a migration.
export function isPreLaunchStatusId(statusId: string, deliverableStatuses: DeliverableStatus[]): boolean {
  const status = deliverableStatuses.find(s => s.id === statusId);
  if (status) return !!status.isPreLaunchStatus || (!deliverableStatuses.some(s => s.isPreLaunchStatus) && (PRE_LAUNCH_STATUS_FALLBACK_IDS.has(statusId) || PRE_LAUNCH_STATUS_FALLBACK_PATTERN.test(status.name)));
  return PRE_LAUNCH_STATUS_FALLBACK_IDS.has(statusId);
}

type SegmentKind = 'new' | 'live' | 'excluded';

// Classifies a segment's status for RPTI generation as an allow-list: only a status
// recognized as live or pre-launch (planned/funded) qualifies — everything else,
// including any custom status a workspace adds later (Cancelled, On Hold, ...), is
// excluded by default. See requirement-specs/rpti-auto-generation.md rule 3 / ADR-0009.
function classifySegmentKind(statusId: string, deliverableStatuses: DeliverableStatus[]): SegmentKind {
  if (isLiveStatusId(statusId, deliverableStatuses)) return 'live';
  if (isPreLaunchStatusId(statusId, deliverableStatuses)) return 'new';
  return 'excluded';
}

export interface GenerateRptiDetailsInput {
  deliverableSegments: DeliverableSegment[];
  deliverableStatuses: DeliverableStatus[];
  initiatives: Initiative[];
  deliverables: Deliverable[];
  assets: Asset[];
  assetCategories: AssetCategory[];
  /**
   * Rows already in the workspace. Supplying them makes generation merge-preserving
   * instead of wipe-and-rebuild; omitting them keeps the old behaviour of returning
   * only what could be generated.
   */
  existingDetails?: RptiDetail[];
}

// Resolves the AssetCategory backing a Deliverable's auto-fill defaults, via
// Deliverable.assetId -> Asset.categoryId. Undefined when any link is missing.
export function resolveAssetCategory(
  deliverable: Deliverable | undefined,
  assets: Asset[],
  assetCategories: AssetCategory[],
): AssetCategory | undefined {
  const asset = deliverable && assets.find(a => a.id === deliverable.assetId);
  return asset ? assetCategories.find(c => c.id === asset.categoryId) : undefined;
}

/**
 * Generates RptiDetail rows for a single report year from DeliverableSegment data —
 * see requirement-specs/rpti-auto-generation.md for the row-generation rule and
 * requirement-specs/rpti-auto-fill-improvements.md for the categoryCode/developer/
 * location auto-fill rules below. Wipe-and-rebuild: callers replace the existing
 * rptiDetails for the year with this function's output, there's no reconciliation
 * with prior manual edits (v1).
 */
export function generateRptiDetails(
  input: GenerateRptiDetailsInput,
  reportYear: number,
): RptiDetail[] {
  const { deliverableSegments, deliverableStatuses, initiatives, deliverables, assets, assetCategories, existingDetails = [] } = input;

  // Overlap, not "starts in": a segment qualifies if any part of its
  // [startDate, endDate] range falls within the report year, even if it
  // started in an earlier year or continues into the next one.
  const yearStart = `${reportYear}-01-01`;
  const yearEnd = `${reportYear}-12-31`;
  const overlapsReportYear = (seg: DeliverableSegment) => seg.startDate <= yearEnd && seg.endDate >= yearStart;
  // Deleting an Initiative doesn't clean up DeliverableSegment.initiativeId, so a segment
  // can carry a dangling reference to an initiative that no longer exists — skip those.
  // Placeholder initiatives (empty markers, not real work) are excluded the same way.
  const initiativeIds = new Set(initiatives.filter(i => i.isPlaceholder !== true).map(i => i.id));

  // A deliverable that was already live before the report year already exists — a
  // planned/funded segment this year is an upgrade to it, not a first-ever "new"
  // build, regardless of which initiative is now touching it.
  // Deliberately deliverable-wide (not filtered by initiativeId): "has this ever
  // gone live" is a fact about the deliverable, not about who's working on it now.
  //
  // Tested on startDate, not endDate. An application the bank actually runs is
  // *continuously* live — that is what an LKPTI entry means, "live as at 31
  // December" — so its segment straddles the report year and would never satisfy
  // "ended before it". Requiring the live run to have finished first classified
  // every ongoing application's enhancement as a brand-new build, which is
  // precisely the misclassification this product exists to avoid. A genuine new
  // build is still 'new': none of its live segments start before the year.
  const hasPriorLiveSegment = (deliverableId: string): boolean =>
    deliverableSegments.some(seg =>
      seg.deliverableId === deliverableId &&
      seg.startDate < yearStart &&
      classifySegmentKind(seg.status, deliverableStatuses) === 'live'
    );

  const qualifying = deliverableSegments
    .filter(seg => !!seg.initiativeId && initiativeIds.has(seg.initiativeId) && overlapsReportYear(seg))
    .map(seg => ({ segment: seg, kind: classifySegmentKind(seg.status, deliverableStatuses) }))
    .filter((s): s is { segment: DeliverableSegment; kind: 'new' | 'live' } => s.kind !== 'excluded');

  const groups = new Map<string, { segment: DeliverableSegment; kind: 'new' | 'live' }[]>();
  for (const item of qualifying) {
    const key = `${item.segment.initiativeId}::${item.segment.deliverableId}`;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  const byStartDateAsc = (a: { segment: DeliverableSegment }, b: { segment: DeliverableSegment }) =>
    a.segment.startDate.localeCompare(b.segment.startDate);

  const results: RptiDetail[] = [];
  for (const [key, items] of groups) {
    const [initiativeId, deliverableId] = key.split('::');
    const newItems = items.filter(i => i.kind === 'new').sort(byStartDateAsc);
    const liveItems = items.filter(i => i.kind === 'live').sort(byStartDateAsc);

    const developmentType: RptiDetail['developmentType'] =
      newItems.length > 0 && !hasPriorLiveSegment(deliverableId) ? 'new' : 'upgrade';
    const anchor = newItems.length > 0
      ? (liveItems.length > 0 ? liveItems[liveItems.length - 1] : newItems[newItems.length - 1])
      : liveItems[liveItems.length - 1];

    const deliverable = deliverables.find(d => d.id === deliverableId);
    const category = resolveAssetCategory(deliverable, assets, assetCategories);
    const developer = deliverable?.developer;

    results.push({
      id: `rpti-gen-${initiativeId}-${deliverableId}-${reportYear}`,
      initiativeId,
      targetType: 'deliverable',
      targetId: deliverableId,
      categoryCode: deliverable?.categoryCode ?? category?.categoryCode,
      developmentType,
      developer,
      // 'n/a' by definition whenever the resolved developer isn't PPJTI — including
      // when developer itself is unset, since there's no category-level default for
      // it. Only genuinely ambiguous, so left blank for manual entry, when it's PPJTI.
      ppjtiRelatedParty: developer !== 'PPJTI' ? 'n/a' : undefined,
      dcCity: deliverable?.dcCity ?? category?.dcCity,
      dcCountry: deliverable?.dcCountry ?? category?.dcCountry,
      drCity: deliverable?.drCity ?? category?.drCity,
      drCountry: deliverable?.drCountry ?? category?.drCountry,
      plannedImplementationQuarter: deriveQuarterFromDate(anchor.segment.startDate),
      deliverableSegmentId: anchor.segment.id,
    });
  }

  return mergeWithExisting(results, existingDetails);
}

/**
 * Folds freshly generated rows into the rows already present, rather than replacing
 * them wholesale.
 *
 * Wipe-and-rebuild was the shipped v1 (see requirement-specs/rpti-auto-generation.md,
 * "Regeneration behavior"), on the grounds that losing manual edits could be revisited
 * if it hurt. It does. A row that generation cannot reproduce is not necessarily stale:
 * an imported upgrade whose target was not found in the inventory has no segment to
 * regenerate from, so a wipe silently deleted the filed CapEx, OpEx, quarter and
 * remarks of the very row most needing attention — and took its data-health warning
 * with it, so the problem looked solved. Generation is also year-scoped, so rebuilding
 * one year used to destroy every other year's rows.
 *
 * A row is matched to its regenerated counterpart by (initiative, target) rather than
 * by id, because an imported row and a generated one for the same work carry different
 * ids. On a match the derived fields refresh and the row keeps its id and the fields
 * generation has no source for. With no existing rows supplied this returns the
 * generated list unchanged.
 */
function mergeWithExisting(generated: RptiDetail[], existing: RptiDetail[]): RptiDetail[] {
  if (existing.length === 0) return generated;

  const key = (r: RptiDetail) => `${r.initiativeId}::${r.targetId}`;
  const freshByKey = new Map(generated.map(r => [key(r), r]));
  const merged: RptiDetail[] = [];
  const refreshed = new Set<string>();

  // Existing order first, so regenerating does not reshuffle the table under the user.
  for (const row of existing) {
    const k = key(row);
    const fresh = freshByKey.get(k);
    if (!fresh || refreshed.has(k)) {
      // Not reproduced, or a second row for the same pair — keep it exactly as it is.
      // Preserving a duplicate beats silently dropping filed data.
      merged.push(row);
      continue;
    }
    refreshed.add(k);
    merged.push({
      ...fresh,
      id: row.id,
      // Generation has no source for these: CapEx/OpEx are overrides on top of the
      // initiative's figures, and remarks is free text. Rebuilding them from segments
      // is impossible, so they survive the refresh.
      capexAmount: row.capexAmount,
      opexAmount: row.opexAmount,
      remarks: row.remarks,
    });
  }

  for (const [k, fresh] of freshByKey) {
    if (!refreshed.has(k)) merged.push(fresh);
  }
  return merged;
}

/**
 * For a deliverable-target RptiDetail, find the initiative's lifecycle segment
 * on that deliverable whose status is "live" and suggest that segment's
 * planned implementation quarter. Returns {} when nothing matches, so the
 * caller falls back to manual entry.
 */
export function suggestDeliverableQuarter(
  detail: Pick<RptiDetail, 'initiativeId' | 'targetType' | 'targetId'>,
  segments: DeliverableSegment[],
  deliverableStatuses: DeliverableStatus[],
): { quarter?: RptiQuarter; segmentId?: string } {
  if (detail.targetType !== 'deliverable') return {};
  const candidates = segments
    .filter(s => s.deliverableId === detail.targetId && s.initiativeId === detail.initiativeId)
    .filter(s => isLiveStatusId(s.status, deliverableStatuses))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const match = candidates[0];
  if (!match) return {};
  return { quarter: deriveQuarterFromDate(match.startDate), segmentId: match.id };
}

export function resolveCost(detail: RptiDetail, initiative: Initiative | undefined): { capexAmount: number; opexAmount: number } {
  return {
    capexAmount: detail.capexAmount ?? initiative?.capex ?? 0,
    opexAmount: detail.opexAmount ?? initiative?.opex ?? 0,
  };
}

export function rptiCascadeOnInitiativeDelete(rptiDetails: RptiDetail[], initiativeId: string): RptiDetail[] {
  return rptiDetails.filter(r => r.initiativeId !== initiativeId);
}

export function rptiCascadeOnDeliverableDelete(rptiDetails: RptiDetail[], deliverableId: string): RptiDetail[] {
  return rptiDetails.filter(r => !(r.targetType === 'deliverable' && r.targetId === deliverableId));
}

export function rptiCascadeOnAssetDelete(rptiDetails: RptiDetail[], assetId: string): RptiDetail[] {
  return rptiDetails.filter(r => !(r.targetType === 'asset' && r.targetId === assetId));
}

export function rptiCascadeOnSegmentDelete(rptiDetails: RptiDetail[], segmentId: string): RptiDetail[] {
  return rptiDetails.map(r => r.deliverableSegmentId === segmentId ? { ...r, deliverableSegmentId: undefined } : r);
}

function formatPlace(city?: string, country?: string): string {
  return [city, country].filter(Boolean).join(', ');
}

/**
 * Builds the RPTI Format 3.1 report as a standalone Excel file — distinct
 * from the raw "RptiDetails" backup sheet included in the general workspace
 * export/import round-trip (src/lib/excel.ts).
 */
export function exportRptiReportToExcel(
  rptiDetails: RptiDetail[],
  initiatives: Initiative[],
  deliverables: Deliverable[],
  assets: Asset[],
  deliverableSegments: DeliverableSegment[] = [],
  deliverableStatuses: DeliverableStatus[] = [],
) {
  const headers = [
    'No.',
    'Nama Aplikasi/Infrastruktur Bank',
    'Deskripsi',
    'Kategori',
    'Jenis Pengembangan',
    'Pengembang',
    'PPJTI Pihak Terkait',
    'Lokasi Data Center',
    'Lokasi Disaster Recovery Center',
    'Waktu Rencana Implementasi',
    'Estimasi Biaya CapEx',
    'Estimasi Biaya OpEx',
    'Keterangan',
  ];

  const rows = rptiDetails.map((detail, index) => {
    const initiative = initiatives.find(i => i.id === detail.initiativeId);
    const targetName = detail.targetType === 'deliverable'
      ? deliverables.find(a => a.id === detail.targetId)?.name ?? ''
      : assets.find(a => a.id === detail.targetId)?.name ?? '';
    const suggestion = detail.plannedImplementationQuarter
      ?? suggestDeliverableQuarter(detail, deliverableSegments, deliverableStatuses).quarter
      ?? '';
    const { capexAmount, opexAmount } = resolveCost(detail, initiative);
    return [
      index + 1,
      targetName,
      initiative?.description ?? '',
      detail.categoryCode ? RPTI_CATEGORY_LABELS[detail.categoryCode] : '',
      detail.developmentType,
      detail.developer ?? '',
      detail.ppjtiRelatedParty ?? '',
      formatPlace(detail.dcCity, detail.dcCountry),
      formatPlace(detail.drCity, detail.drCountry),
      suggestion,
      capexAmount,
      opexAmount,
      detail.remarks ?? '',
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'RPTI Format 3.1');
  XLSX.writeFile(wb, `rpti-report-${new Date().toISOString().split('T')[0]}.xlsx`);
}
