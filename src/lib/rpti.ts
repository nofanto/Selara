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

// Both LKPTI and RPTI importers use this planning horizon for an imported application's
// live phase. DeliverableSegment.endDate is required, though neither return knows when
// the application will retire. LKPTI anchors it to the inventory's as-at year; RPTI
// anchors a new build to its filed go-live year. Thus a 2026 LKPTI entry ends in 2031
// and a 2027 RPTI new build ends in 2032: the same rule, with different evidence dates.
const OPEN_ENDED_YEARS_OUT = 5;

/**
 * Anchored to the year the preparer stated the return covers, never to the clock.
 * Reading `new Date()` here meant the same filed return imported in 2026 and in 2030
 * produced different workspaces from identical input (lkptiImport T032).
 *
 * Shared by both importers, each anchored to the year its return establishes the
 * application is live: LKPTI's as-at year or RPTI's new-build go-live year.
 */
export function openEndedDate(fromYear: number): string {
  return `${fromYear + OPEN_ENDED_YEARS_OUT}-12-31`;
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

  // A plan line belongs to the year its implementation starts, not every
  // year an open-ended live phase happens to overlap.
  const yearStart = `${reportYear}-01-01`;
  const yearEnd = `${reportYear}-12-31`;
  const startsInReportYear = (seg: DeliverableSegment) => seg.startDate >= yearStart && seg.startDate <= yearEnd;
  // Deleting an Initiative doesn't clean up DeliverableSegment.initiativeId, so a segment
  // can carry a dangling reference to an initiative that no longer exists — skip those.
  // Placeholder initiatives (empty markers, not real work) are excluded the same way.
  const initiativeIds = new Set(initiatives.filter(i => i.isPlaceholder !== true).map(i => i.id));

  // A deliverable that was already live before this go-live already exists — this
  // go-live is an upgrade to it, not a first-ever "new" build,
  // regardless of which initiative is now touching it.
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
  //
  // Measured against *this implementation's* own start, not against the start of the
  // filing year. Two go-lives on a brand-new application in one year would otherwise
  // both be 'new', stating in a single return that the same application was built
  // from nothing twice; the second is an enhancement to what the first delivered.
  // Segments sharing a start date are both 'new' — neither precedes the other, and
  // they state the same quarter anyway.
  const wasLiveBefore = (deliverableId: string, startDate: string): boolean =>
    deliverableSegments.some(seg =>
      seg.deliverableId === deliverableId &&
      seg.startDate < startDate &&
      isLiveStatusId(seg.status, deliverableStatuses)
    );

  const qualifying = deliverableSegments
    .filter(seg => !!seg.initiativeId && initiativeIds.has(seg.initiativeId)
      && startsInReportYear(seg) && isLiveStatusId(seg.status, deliverableStatuses));

  // Each live start is an implementation. The segment itself names the
  // application; an initiative can trigger more than one application's go-live.
  const groups = new Map<string, DeliverableSegment[]>();
  for (const segment of qualifying) {
    const key = `${segment.initiativeId}\u0000${segment.deliverableId}`;
    const group = groups.get(key);
    if (group) group.push(segment);
    else groups.set(key, [segment]);
  }

  const byStartDateAsc = (a: DeliverableSegment, b: DeliverableSegment) =>
    a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id);

  const results: RptiDetail[] = [];
  for (const initiative of initiatives) {
    const initiativeId = initiative.id;
    const rowsForInitiative: { anchor: DeliverableSegment; deliverableId: string; developmentType: RptiDetail['developmentType'] }[] = [];
    for (const [key, items] of groups) {
      const [groupInitiativeId, deliverableId] = key.split('\u0000');
      if (groupInitiativeId !== initiativeId) continue;
      items.sort(byStartDateAsc).forEach(segment => rowsForInitiative.push({
        anchor: segment, deliverableId,
        developmentType: wasLiveBefore(deliverableId, segment.startDate) ? 'upgrade' : 'new',
      }));
    }
    rowsForInitiative.sort((a, b) =>
      a.anchor.startDate.localeCompare(b.anchor.startDate) || a.anchor.id.localeCompare(b.anchor.id));
    for (const { anchor, deliverableId, developmentType } of rowsForInitiative) {
      const deliverable = deliverables.find(d => d.id === deliverableId);
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
        id: `rpti-gen-${anchor.id}-${reportYear}`,
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
        plannedImplementationQuarter: deriveQuarterFromDate(anchor.startDate),
        deliverableSegmentId: anchor.id,
        // Keterangan belongs to this implementation. Deskripsi remains initiative-owned.
        remarks: anchor.rptiRemarks,
      });
    }
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

  // Each live lifecycle segment is one canonical implementation identity. The
  // segment names both the Initiative and the application; no initiative-wide
  // target is inferred. Filed values remain deliberately outside identity (Q13).
  const canonical = deliverableSegments.flatMap(segment => {
    const initiative = segment.initiativeId ? initiativeById.get(segment.initiativeId) : undefined;
    if (!initiative || initiative.isPlaceholder === true
      || !deliverableById.has(segment.deliverableId)
      || !isLiveStatusId(segment.status, deliverableStatuses)) return [];
    return [{ key: segment.id, initiative, segment, targetId: segment.deliverableId }];
  });

  const candidateFor = (row: RptiDetail) => {
    // Imported rows carry the implementation anchor. It survives target or
    // Initiative correction on that segment, so it is authoritative when present.
    if (row.deliverableSegmentId) {
      const anchored = canonical.filter(c => c.segment.id === row.deliverableSegmentId);
      if (anchored.length === 1) return { candidate: anchored[0], ambiguous: false };
      return { candidate: undefined, ambiguous: anchored.length > 1 };
    }

    // Rows from the previous model have no segment anchor. They can still be
    // accounted for only when the old (initiative, target) identity names exactly
    // one current implementation.
    const exact = canonical.filter(c =>
      row.targetType === 'deliverable'
      && c.initiative.id === row.initiativeId
      && c.targetId === row.targetId);
    if (exact.length === 1) return { candidate: exact[0], ambiguous: false };
    if (exact.length > 1) return { candidate: undefined, ambiguous: true };

    // When the target was recreated (including a legacy bare-Asset target), the
    // surviving Initiative identifies a replacement through the segment the
    // preparer corrected. More than one implementation is not enough evidence.
    const byInitiative = canonical.filter(c => {
      if (c.initiative.id !== row.initiativeId) return false;
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
      add('identity-conflict', `The stored RPTI row "${row.id}" matches more than one current implementation by identity. On the Visualiser timeline, open the relevant lifecycle segment panels and make the implementation identity unambiguous before generating the filing.`);
      continue;
    }
    if (match.candidate && claimCount.get(match.candidate.key) === 1) continue;
    if (match.candidate) {
      add('identity-conflict', `More than one stored RPTI row maps to the same current plan line for "${label}". One generated row cannot account for every stored row; repair or re-import the filing evidence before exporting.`);
      continue;
    }

    if (row.targetType === 'asset') {
      add('asset-target', `The stored RPTI row for "${label}" targets an Asset directly, which no filing year can reproduce. On the Deliverables tab, create the application or infrastructure item as a Deliverable under that Asset. Then, on the Visualiser timeline, create or open the implementation's lifecycle segment panel and select both that Deliverable and this Initiative.`);
      continue;
    }
    if (!initiative) {
      const target = deliverableById.get(row.targetId);
      if (target) {
        add('missing-initiative', `The stored RPTI row "${row.id}" points at an Initiative that no longer exists, so no filing year can reproduce it. Recreate the Initiative, then on the Visualiser timeline create or open the implementation's lifecycle segment panel and select that Initiative together with "${target.name}". If the intended Initiative cannot be identified safely, re-import the filing instead.`);
      } else {
        add('missing-initiative', `The stored RPTI row "${row.id}" has both its Initiative and Deliverable missing, so no current source pair can identify it safely. Re-import the filing it came from before generating.`);
      }
      continue;
    }
    if (row.targetType === 'deliverable' && !deliverables.some(d => d.id === row.targetId)) {
      add('missing-target', `The stored RPTI row for "${label}" points at a Deliverable that no longer exists. On the Deliverables tab, create or correct the application the filed plan refers to. Then, on the Visualiser timeline, open the implementation's lifecycle segment panel and select that Deliverable together with this Initiative, so generation has a row to derive.`);
      continue;
    }
    const targetName = deliverables.find(d => d.id === row.targetId)?.name ?? row.targetId;
    add('unanchored', `The stored RPTI row for "${label}" has no current implementation that generation could reproduce in any filing year. On the Visualiser timeline, create or open the intended lifecycle segment panel and select "${targetName}" together with this Initiative, using a live status for the implementation.`);
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

export function resolveCost(detail: RptiDetail, segments: DeliverableSegment[]): { capexAmount: number; opexAmount: number } {
  const implementation = segments.find(segment => segment.id === detail.deliverableSegmentId);
  return {
    capexAmount: implementation?.capexAmount ?? 0,
    opexAmount: implementation?.opexAmount ?? 0,
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
    const { capexAmount, opexAmount } = resolveCost(detail, deliverableSegments);
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
