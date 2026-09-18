import * as XLSX from 'xlsx';
import { RptiDetail, RptiCategoryCode, RptiQuarter, Initiative, Deliverable, Asset, AssetCategory, DeliverableSegment, DeliverableStatus, RptiDeveloper,
} from '../types';

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

/** Q10: target ownership is initiative-wide, never inferred separately per filing year. */
export function resolveRptiTarget(
  initiative: Initiative, segments: DeliverableSegment[], deliverables: Deliverable[],
): string | undefined {
  if (initiative.deliverableId) return initiative.deliverableId;
  const targets = new Set(segments.filter(segment => segment.initiativeId === initiative.id).map(segment => segment.deliverableId));
  if (targets.size !== 1) return undefined;
  const target = [...targets][0];
  return deliverables.some(deliverable => deliverable.id === target) ? target : undefined;
}

/**
 * The complete input of the projection. Deliberately has no `existingDetails` key:
 * issue #40's defect was exactly one caller being able to hand stored rows to a
 * return that is supposed to be derived, so the type that could carry them is gone.
 * (See requirement-specs/report-rows-as-projections.md Q11 — passing stored rows to
 * the projection is now a compile error, asserted by a @ts-expect-error test.)
 */
export interface ProjectRptiInput {
  deliverableSegments: DeliverableSegment[];
  deliverableStatuses: DeliverableStatus[];
  initiatives: Initiative[];
  deliverables: Deliverable[];
  assets: Asset[];
  assetCategories: AssetCategory[];
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
 * Projects the RPTI return for a single report year from the workspace's canonical
 * planning entities — see requirement-specs/rpti-auto-generation.md for the
 * row-generation rule and requirement-specs/rpti-auto-fill-improvements.md for the
 * categoryCode/developer/location auto-fill rules below. The output is a function of
 * `(input, reportYear)` alone: stored report rows cannot enter it (issue #40,
 * contract 2), and what it cannot reproduce is named by `reconcileRptiReturn`, not
 * silently carried.
 */
export function projectRptiReturn(
  input: ProjectRptiInput,
  reportYear: number,
): RptiDetail[] {
  const { deliverableSegments, deliverableStatuses, initiatives, deliverables, assets, assetCategories } = input;

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

  const targets = new Map(initiatives.map(initiative => [initiative.id, resolveRptiTarget(initiative, deliverableSegments, deliverables)]));
  const groups = new Map<string, { segment: DeliverableSegment; kind: 'new' | 'live' }[]>();
  for (const item of qualifying) {
    const initiative = initiatives.find(candidate => candidate.id === item.segment.initiativeId);
    // The Initiative is the canonical RPTI plan line. Segments on another
    // deliverable remain timeline history but are not a second filing target.
    const target = initiative && targets.get(initiative.id);
    // Unresolved/ambiguous targets are diagnosed by data health and gate export.
    if (!initiative || !target || item.segment.deliverableId !== target) continue;
    const key = initiative.id;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  const byStartDateAsc = (a: { segment: DeliverableSegment }, b: { segment: DeliverableSegment }) =>
    a.segment.startDate.localeCompare(b.segment.startDate);

  const results: RptiDetail[] = [];
  for (const [initiativeId, items] of groups) {
    const deliverableId = targets.get(initiativeId);
    if (!deliverableId) continue;
    const newItems = items.filter(i => i.kind === 'new').sort(byStartDateAsc);
    const liveItems = items.filter(i => i.kind === 'live').sort(byStartDateAsc);

    const developmentType: RptiDetail['developmentType'] =
      newItems.length > 0 && !hasPriorLiveSegment(deliverableId) ? 'new' : 'upgrade';
    const anchor = newItems.length > 0
      ? (liveItems.length > 0 ? liveItems[liveItems.length - 1] : newItems[newItems.length - 1])
      : liveItems[liveItems.length - 1];

    const deliverable = deliverables.find(d => d.id === deliverableId);
    const initiative = initiatives.find(i => i.id === initiativeId);
    const category = resolveAssetCategory(deliverable, assets, assetCategories);
    // Deliverable.developer now carries either 'inhouse' or a provider's *name*
    // (ADR-0013). The RPTI column wants the classification, so anything that is not
    // 'inhouse' is PPJTI — a third party, whoever they are. LKPTI emits the name
    // itself, which is why one field can serve both returns.
    const rawDeveloper = deliverable?.developer;
    const developer: RptiDeveloper | undefined =
      rawDeveloper === undefined || rawDeveloper === ''
        ? undefined
        : rawDeveloper === 'inhouse' ? 'inhouse' : 'PPJTI';

    results.push({
      id: `rpti-gen-${initiativeId}-${deliverableId}-${reportYear}`,
      initiativeId,
      targetType: 'deliverable',
      targetId: deliverableId,
      categoryCode: deliverable?.categoryCode ?? category?.categoryCode,
      developmentType,
      developer,
      // 'n/a' by definition whenever the resolved developer isn't PPJTI — there is no
      // third party, so there is no relationship to disclose. When it *is* PPJTI the
      // answer is a fact about the vendor that nothing can derive, so it is read from
      // the deliverable, where the preparer records it (FR-014).
      ppjtiRelatedParty: developer !== 'PPJTI' ? 'n/a' : deliverable?.ppjtiRelatedParty,
      dcCity: deliverable?.dcCity ?? category?.dcCity,
      dcCountry: deliverable?.dcCountry ?? category?.dcCountry,
      drCity: deliverable?.drCity ?? category?.drCity,
      drCountry: deliverable?.drCountry ?? category?.drCountry,
      plannedImplementationQuarter: deriveQuarterFromDate(anchor.segment.startDate),
      deliverableSegmentId: anchor.segment.id,
      // Keterangan comes from the work it comments on, matching Deskripsi two columns
      // earlier, which has always come from the initiative (ADR-0013).
      remarks: initiative?.rptiRemarks,
    });
  }

  return results;
}

/**
 * Why a stored RPTI row cannot be reproduced by the source model — a different
 * question from whether it belongs to the selected year (see
 * requirement-specs/report-rows-as-projections.md Q11: the two axes are
 * independent). Reasons are checked in the order a repair must follow.
 */
export type RptiReconciliationReason =
  | 'asset-target'       // no repaired canonical Deliverable counterpart exists for the legacy Asset row
  | 'missing-initiative' // no unique current canonical identity replaces the missing Initiative
  | 'missing-target'     // no unique current canonical identity replaces the missing target
  | 'identity-conflict'  // zero/one canonical identity cannot account for multiple/ambiguous stored rows
  | 'unanchored';        // references resolve, but no segment pair can reproduce it in any year

export interface RptiReconciliationFinding {
  /** Stable: `rpti-reconcile-<reason>-<rowId>`. */
  id: string;
  rowId: string;
  reason: RptiReconciliationReason;
  /** Names the source-side repair (FR-025): what to fix, not what to re-key. */
  message: string;
  /**
   * The stored row, as evidence for the gate to display. Findings are not rows and
   * are never merged into a return — this exists so the preparer can see *which*
   * filed line the finding is about, and nothing may pass it to `projectRptiReturn`
   * or the exporter.
   */
  row: RptiDetail;
}

export interface ReconcileRptiInput {
  /** Stored rows (`AppState.rptiDetails`) — read as evidence, never written or returned. */
  storedDetails: RptiDetail[];
  initiatives: Initiative[];
  deliverables: Deliverable[];
  deliverableSegments: DeliverableSegment[];
  deliverableStatuses: DeliverableStatus[];
}

/**
 * Compares stored RPTI rows against the source model and returns findings, not rows
 * (FR-024, issue #40). Where the old merge turned every unmatched stored row into a
 * projection member — leaking a 2027 line into a 2026 filing — this asks only
 * "does this evidence have one current canonical row identity in *some* year?". A valid
 * other-year row produces no finding: its absence from the selected year is correct,
 * not a defect.
 *
 * The honesty limit, accepted with option 1 and fixed by the deferred option 5:
 * `RptiDetail` carries no report year, so a finding cannot say *which* year the row
 * was filed for, and these findings block every year's export, not just the row's
 * own. That global gate is the chosen policy — unaccounted-for filed evidence must never
 * leave a return silently — and the messages say "no filing year" rather than
 * inventing an attribution the data cannot support.
 */
export function reconcileRptiReturn(input: ReconcileRptiInput): RptiReconciliationFinding[] {
  const { storedDetails, initiatives, deliverables, deliverableSegments, deliverableStatuses } = input;
  const initiativeById = new Map(initiatives.map(i => [i.id, i]));
  const deliverableById = new Map(deliverables.map(d => [d.id, d]));
  const findings: RptiReconciliationFinding[] = [];

  // A canonical row identity exists independently of any selected filing year: one
  // Initiative, its resolved target, and at least one qualifying segment on that pair.
  // Filed values are deliberately not compared here (Q12); that policy remains open.
  const canonical = initiatives.flatMap(initiative => {
    if (initiative.isPlaceholder === true) return [];
    const targetId = resolveRptiTarget(initiative, deliverableSegments, deliverables);
    if (!targetId || !deliverableById.has(targetId)) return [];
    const anchored = deliverableSegments.some(seg =>
      seg.initiativeId === initiative.id
      && seg.deliverableId === targetId
      && classifySegmentKind(seg.status, deliverableStatuses) !== 'excluded');
    return anchored ? [{ key: `${initiative.id}\u0000${targetId}`, initiative, targetId }] : [];
  });

  const candidateFor = (row: RptiDetail) => {
    const exact = canonical.filter(c =>
      row.targetType === 'deliverable'
      && c.initiative.id === row.initiativeId
      && c.targetId === row.targetId);
    if (exact.length === 1) return { candidate: exact[0], ambiguous: false };

    // When the target was recreated (including a legacy bare-Asset target), the
    // surviving Initiative identifies its replacement only after the preparer has
    // explicitly selected it. Inference alone is not the named repair.
    const byInitiative = canonical.filter(c => {
      if (c.initiative.id !== row.initiativeId || c.initiative.deliverableId !== c.targetId) return false;
      if (row.targetType === 'asset') return deliverableById.get(c.targetId)?.assetId === row.targetId;
      return true;
    });
    if (byInitiative.length === 1) return { candidate: byInitiative[0], ambiguous: false };
    if (byInitiative.length > 1) return { candidate: undefined, ambiguous: true };

    // When the Initiative was recreated, the still-existing filed target identifies
    // it. More than one current row on that target is not enough evidence to choose.
    const byTarget = row.targetType === 'deliverable'
      ? canonical.filter(c => c.targetId === row.targetId)
      : [];
    if (byTarget.length === 1) return { candidate: byTarget[0], ambiguous: false };
    return { candidate: undefined, ambiguous: byTarget.length > 1 };
  };

  const matches = storedDetails.map(row => ({ row, ...candidateFor(row) }));
  const claimCount = new Map<string, number>();
  for (const match of matches) if (match.candidate) {
    claimCount.set(match.candidate.key, (claimCount.get(match.candidate.key) ?? 0) + 1);
  }

  for (const match of matches) {
    const { row } = match;
    const initiative = initiativeById.get(row.initiativeId);
    const label = initiative?.name ?? row.id;
    const add = (reason: RptiReconciliationReason, message: string) => {
      findings.push({ id: `rpti-reconcile-${reason}-${row.id}`, rowId: row.id, reason, message, row });
    };

    if (match.ambiguous) {
      add('identity-conflict', `The stored RPTI row "${row.id}" matches more than one current plan line by identity. Make the Initiative target unambiguous before generating the filing.`);
      continue;
    }
    if (match.candidate && claimCount.get(match.candidate.key) === 1) continue;
    if (match.candidate) {
      add('identity-conflict', `More than one stored RPTI row maps to the same current plan line for "${label}". One generated row cannot account for every stored row; repair or re-import the filing evidence before exporting.`);
      continue;
    }

    if (row.targetType === 'asset') {
      add('asset-target', `The stored RPTI row for "${label}" targets an Asset directly, which no filing year can reproduce. Create a Deliverable under that Asset and point the Initiative at that Deliverable before generating the filing.`);
      continue;
    }
    if (!initiative) {
      add('missing-initiative', `The stored RPTI row "${row.id}" points at an Initiative that no longer exists, so no filing year can reproduce it. Recreate the initiative — or re-import the filing it came from — before generating.`);
      continue;
    }
    if (row.targetType === 'deliverable' && !deliverables.some(d => d.id === row.targetId)) {
      add('missing-target', `The stored RPTI row for "${label}" points at a Deliverable that no longer exists. Create or correct the application the filed plan refers to on the Deliverables tab, so the next generation reproduces the row.`);
      continue;
    }
    // Reproducible in *some* year: the initiative resolves to this row's target
    // (Q10's rule, year-independent by design) and at least one of its segments on
    // that target carries a status generation accepts. The selected year is
    // deliberately not consulted — absence from it proves nothing (contract 2's
    // companion rule in Q11).
    const derivable = initiative.isPlaceholder !== true
      && resolveRptiTarget(initiative, deliverableSegments, deliverables) === row.targetId
      && deliverableSegments.some(seg =>
        seg.initiativeId === initiative.id &&
        seg.deliverableId === row.targetId &&
        classifySegmentKind(seg.status, deliverableStatuses) !== 'excluded');
    if (!derivable) {
      const targetName = deliverables.find(d => d.id === row.targetId)?.name ?? row.targetId;
      add('unanchored', `The stored RPTI row for "${label}" has no lifecycle segment on "${targetName}" that generation could reproduce in any filing year. Add that segment to the timeline for this initiative — naming the Deliverable as the initiative's RPTI Target does not on its own give generation anything to derive.`);
    }
  }

  return findings;
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

export function resolveCost(_detail: RptiDetail, initiative: Initiative | undefined): { capexAmount: number; opexAmount: number } {
  return {
    capexAmount: initiative?.capex ?? 0,
    opexAmount: initiative?.opex ?? 0,
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
  reportYear: number,
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
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Report', 'RPTI Format 3.1'],
    ['Report year', reportYear],
  ]), 'Report Metadata');
  XLSX.writeFile(wb, `rpti-report-${reportYear}.xlsx`);
}
