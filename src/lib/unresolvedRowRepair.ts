import type { Asset, AssetCategory, Deliverable, DeliverableSegment, DeliverableStatus, Initiative, RptiCategoryCode, RptiDetail, RptiDeveloper, RptiQuarter, RptiRelatedParty } from '../types';
import { continuousPriorLivePhase, INFRASTRUCTURE_CODES, openEndedDate, periodForQuarter, RPTI_CATEGORY_LABELS, UNRESOLVED_IMPORT_TARGET_PREFIX, isLiveStatusId } from './rpti';
import { IN_PRODUCTION_STATUS } from './deliverableStatusDefaults';

/**
 * Repairing an imported RPTI row the import could not attach to exactly one inventory entry
 * (#51). Everything here is pure: the dialog reads it, and App applies the result in one
 * handleUpdate. See specs/004-repair-from-finding (contracts/repair.md) and Q22 in
 * requirement-specs/report-rows-as-projections.md.
 */

/**
 * A row the import held back: its target is the importer's unresolved placeholder, and it has no
 * segment anchor. A row whose Deliverable was deleted is not one, and keeps the existing advice.
 */
export function isRepairableUnresolvedRow(row: RptiDetail): boolean {
  return row.targetId.startsWith(UNRESOLVED_IMPORT_TARGET_PREFIX) && !row.deliverableSegmentId;
}

/**
 * Creating the entry (B) is offered only for applications. An unresolved infrastructure row always
 * matched several entries (FR-019a creates it when it matches none), so B would duplicate one.
 */
export function repairOptions(row: RptiDetail): Array<'existing' | 'create'> {
  return INFRASTRUCTURE_CODES.has(row.categoryCode ?? '') ? ['existing'] : ['existing', 'create'];
}

const RELATED_PARTY_VALUES: RptiRelatedParty[] = ['yes', 'no', 'n/a'];

type DraftSource = 'stored-row' | 'initiative-name' | 'initiative-start' | 'initiative-budget' | 'needs-input';
type DraftValue<T> = { value: T; source: DraftSource; check?: boolean };

export interface UnresolvedRowRepairDraft {
  name: DraftValue<string>;
  filedYear: DraftValue<number>;
  quarter: DraftValue<RptiQuarter>;
  categoryCode: DraftValue<RptiCategoryCode | undefined>;
  developer: DraftValue<RptiDeveloper | undefined>;
  providerName: DraftValue<string>;
  ppjtiRelatedParty: DraftValue<RptiRelatedParty | undefined>;
  dcCity: DraftValue<string | undefined>;
  dcCountry: DraftValue<string | undefined>;
  drCity: DraftValue<string | undefined>;
  drCountry: DraftValue<string | undefined>;
  remarks: DraftValue<string | undefined>;
  capex: DraftValue<number>;
  opex: DraftValue<number>;
}

/** Prefills the repair from surviving filing evidence and the initiative, with provenance per field. */
export function unresolvedRowRepairDraft(
  row: RptiDetail,
  state: { initiatives: Pick<Initiative, 'id' | 'name' | 'startDate' | 'capex' | 'opex'>[] },
): UnresolvedRowRepairDraft {
  const initiative = state.initiatives.find(item => item.id === row.initiativeId);
  if (!initiative) throw new Error('The initiative for this filed row no longer exists.');
  const suffix = initiative.name.match(/ — Q[1-4] (\d{4})$/);
  const filedYear = suffix ? Number(suffix[1]) : Number(initiative.startDate.slice(0, 4));
  return {
    name: { value: suffix ? initiative.name.slice(0, suffix.index).trim() : initiative.name,
      source: 'initiative-name', ...(!suffix ? { check: true } : {}) },
    filedYear: { value: filedYear, source: suffix ? 'initiative-name' : 'initiative-start' },
    quarter: { value: row.plannedImplementationQuarter!, source: 'stored-row' },
    categoryCode: { value: row.categoryCode, source: 'stored-row' },
    developer: { value: row.developer, source: 'stored-row' },
    providerName: { value: '', source: 'needs-input' },
    ppjtiRelatedParty: { value: row.ppjtiRelatedParty, source: 'stored-row' },
    dcCity: { value: row.dcCity, source: 'stored-row' },
    dcCountry: { value: row.dcCountry, source: 'stored-row' },
    drCity: { value: row.drCity, source: 'stored-row' },
    drCountry: { value: row.drCountry, source: 'stored-row' },
    remarks: { value: row.remarks, source: 'stored-row' },
    capex: { value: initiative.capex, source: 'initiative-budget' },
    opex: { value: initiative.opex, source: 'initiative-budget' },
  };
}

export interface ConfirmedUnresolvedRowValues {
  name: string;
  filedYear: number;
  quarter: RptiQuarter;
  categoryCode?: RptiCategoryCode;
  developer?: RptiDeveloper;
  providerName: string;
  ppjtiRelatedParty?: RptiRelatedParty;
  dcCity?: string;
  dcCountry?: string;
  drCity?: string;
  drCountry?: string;
  remarks?: string;
  capex: number;
  opex: number;
}

// The discriminant leaves room for option A's chosen entry and field decisions in US2.
export type UnresolvedRowRepairRequest =
  | { rowId: string; option: 'create'; confirmed: ConfirmedUnresolvedRowValues }
  | { rowId: string; option: 'existing'; deliverableId: string; confirmed: ConfirmedUnresolvedRowValues; choices: Record<string, 'update' | 'keep'> };

export interface UnresolvedRowRepairState {
  assets: Asset[];
  assetCategories: AssetCategory[];
  deliverables: Deliverable[];
  deliverableSegments: DeliverableSegment[];
  deliverableStatuses: DeliverableStatus[];
  initiatives: Initiative[];
  rptiDetails: RptiDetail[];
}

/** Applies option B as a pure, all-or-nothing source-side change; the filed row is never edited. */
export function applyUnresolvedRowRepair<S extends UnresolvedRowRepairState>(
  state: S,
  request: UnresolvedRowRepairRequest,
): { ok: true; state: S } | { ok: false; reason: string } {
  const row = state.rptiDetails.find(item => item.id === request.rowId);
  if (!row || !isRepairableUnresolvedRow(row)) return { ok: false, reason: 'This unresolved filed row is no longer available for repair.' };
  const initiative = state.initiatives.find(item => item.id === row.initiativeId);
  if (!initiative) return { ok: false, reason: 'The initiative for this filed row no longer exists.' };
  if (state.deliverableSegments.some(segment => segment.initiativeId === initiative.id
      && isLiveStatusId(segment.status, state.deliverableStatuses))) {
    return { ok: false, reason: 'This initiative already has a live implementation. Refresh the finding before repairing it.' };
  }
  if (request.option !== 'create') return { ok: false, reason: 'Repairing an existing entry is not available yet.' };
  if (!repairOptions(row).includes('create')) return { ok: false, reason: 'This row requires an existing inventory entry.' };
  const values = request.confirmed;
  // B creates an application, so the code must be a known, non-infrastructure one.
  const knownApplicationCode = !!values.categoryCode && values.categoryCode in RPTI_CATEGORY_LABELS
    && !INFRASTRUCTURE_CODES.has(values.categoryCode);
  if (!values.name.trim() || !knownApplicationCode || !Number.isInteger(values.filedYear)
      || values.quarter !== row.plannedImplementationQuarter || !Number.isFinite(values.capex)
      || !Number.isFinite(values.opex)) {
    return { ok: false, reason: 'Check the required name, filed period, category and budget values.' };
  }
  if (values.ppjtiRelatedParty !== undefined && !RELATED_PARTY_VALUES.includes(values.ppjtiRelatedParty)) {
    return { ok: false, reason: 'The related party must be yes, no or n/a.' };
  }
  if (row.developer === 'PPJTI' && (values.developer !== 'PPJTI'
      || !values.providerName.trim() || values.providerName.trim().toUpperCase() === 'PPJTI')) {
    return { ok: false, reason: 'Enter the provider’s name; PPJTI is a classification, not a provider name.' };
  }
  const existingCategory = state.assetCategories.find(category => category.categoryCode === values.categoryCode);
  const categoryId = existingCategory?.id ?? `rpti-import-cat-${values.categoryCode}`;
  const assetId = `rpti-repair-asset-${row.id}`;
  const deliverableId = `rpti-repair-deliv-${row.id}`;
  if (state.assets.some(asset => asset.id === assetId) || state.deliverables.some(deliverable => deliverable.id === deliverableId)) {
    return { ok: false, reason: 'This row has already created an inventory entry.' };
  }
  const live = state.deliverableStatuses.find(status => status.isLiveStatus) ?? IN_PRODUCTION_STATUS;
  const category: AssetCategory = existingCategory ?? {
    id: categoryId, name: RPTI_CATEGORY_LABELS[values.categoryCode], categoryCode: values.categoryCode,
  };
  const asset: Asset = { id: assetId, name: values.name.trim(), categoryId, maturity: 1 };
  const deliverable: Deliverable = {
    id: deliverableId, assetId, name: values.name.trim(), type: 'application',
    ...(values.categoryCode !== category.categoryCode ? { categoryCode: values.categoryCode } : {}),
    developer: values.developer === 'PPJTI' ? values.providerName.trim() : values.developer,
    ppjtiRelatedParty: values.ppjtiRelatedParty,
    dcCity: values.dcCity, dcCountry: values.dcCountry, drCity: values.drCity, drCountry: values.drCountry,
  };
  const { startDate, endDate } = periodForQuarter(values.quarter, values.filedYear);
  const prior = continuousPriorLivePhase(deliverableId, values.filedYear, live.id, `rpti-repair-seg-prior-${row.id}`);
  const implementation: DeliverableSegment = {
    id: `rpti-repair-seg-${row.id}`, deliverableId, startDate, endDate, status: live.id,
    initiativeId: initiative.id, capexAmount: values.capex, opexAmount: values.opex, rptiRemarks: values.remarks,
  };
  return { ok: true, state: {
    ...state,
    assetCategories: existingCategory ? state.assetCategories : [...state.assetCategories, category],
    assets: [...state.assets, asset],
    deliverables: [...state.deliverables, deliverable],
    deliverableSegments: [...state.deliverableSegments, prior, implementation],
    deliverableStatuses: state.deliverableStatuses.some(status => status.isLiveStatus)
      ? state.deliverableStatuses : [...state.deliverableStatuses, IN_PRODUCTION_STATUS],
    initiatives: state.initiatives.map(item => item.id === initiative.id ? { ...item, assetId } : item),
  } };
}

/**
 * A synthetic prior phase an importer created before FR-017, still in its original one-year
 * shape, that leaves its application out of an LKPTI inventory year. `segmentYear` is the year
 * the phase covers; the import that created it was for the year after, so the horizon it should
 * have run to under the continuous rule is `openEndedDate(segmentYear + 1)`.
 */
export interface PriorPhaseGap {
  segmentId: string;
  deliverableId: string;
  segmentYear: number;
  missingYears: number[];
}

export interface PriorPhaseGapState {
  deliverables: Deliverable[];
  deliverableSegments: DeliverableSegment[];
  deliverableStatuses: DeliverableStatus[];
}

/** The importer's original prior-phase id prefix (research R10). */
const IMPORT_PRIOR_SEGMENT_PREFIX = 'rpti-import-seg-prior-';

/** The year covered by the importer's exact one-year shape, or null if the segment is not it. */
function originalPriorSegmentYear(segment: DeliverableSegment): number | null {
  const match = /^(\d{4})-01-01$/.exec(segment.startDate);
  if (!match) return null;
  const year = Number(match[1]);
  return segment.endDate === `${year}-12-31` ? year : null;
}

/**
 * The years an imported prior phase leaves its application out of, as an inventory. Contract 20:
 * only a segment still in the importer's exact original shape counts — id prefix, both dates, the
 * importer's live status and no initiative link, on an application. A phase the preparer edited is
 * their decision, not a gap (FR-018/FR-018a, Q22, research R10). The years are Y+1…Y+6, the
 * 31 Decembers the continuous phase would have covered from the filing year Y+1.
 */
export function priorPhaseGaps(state: PriorPhaseGapState): PriorPhaseGap[] {
  const { deliverables, deliverableSegments, deliverableStatuses } = state;
  const deliverableById = new Map(deliverables.map(deliverable => [deliverable.id, deliverable]));
  const gaps: PriorPhaseGap[] = [];
  for (const segment of deliverableSegments) {
    if (!segment.id.startsWith(IMPORT_PRIOR_SEGMENT_PREFIX)) continue;
    const segmentYear = originalPriorSegmentYear(segment);
    if (segmentYear === null) continue;
    if (segment.status !== IN_PRODUCTION_STATUS.id) continue;
    if (segment.initiativeId) continue;
    const deliverable = deliverableById.get(segment.deliverableId);
    // LKPTI is Daftar Aplikasi — it never lists infrastructure, so there is no inventory gap.
    if (!deliverable || (deliverable.type ?? 'application') !== 'application') continue;
    const missingYears: number[] = [];
    for (let year = segmentYear + 1; year <= segmentYear + 6; year++) {
      const asAt = `${year}-12-31`;
      const live = deliverableSegments.some(other =>
        other.deliverableId === deliverable.id
        && isLiveStatusId(other.status, deliverableStatuses)
        && other.startDate <= asAt && other.endDate >= asAt);
      if (!live) missingYears.push(year);
    }
    // Omitted when nothing is missing, so a phase already covered by the application's own
    // inventory history raises no warning (contract 20).
    if (missingYears.length > 0) {
      gaps.push({ segmentId: segment.id, deliverableId: segment.deliverableId, segmentYear, missingYears });
    }
  }
  return gaps;
}

/**
 * The preparer-confirmed extension (FR-018a). One segment's `endDate` moves to the horizon the
 * continuous rule would have given it — `openEndedDate(segmentYear + 1)` — and nothing else
 * changes, so the caller applies it in one undoable handleUpdate. Only a segment still in the
 * importer's original shape is extended: an edited phase is the preparer's decision. A missing or
 * already-edited segment is left exactly as it was.
 */
export function extendImportPriorPhase<S extends { deliverableSegments: DeliverableSegment[] }>(
  state: S,
  segmentId: string,
): S {
  const segment = state.deliverableSegments.find(item => item.id === segmentId);
  const segmentYear = segment ? originalPriorSegmentYear(segment) : null;
  if (!segment || segmentYear === null) return state;
  return {
    ...state,
    deliverableSegments: state.deliverableSegments.map(item =>
      item.id === segmentId ? { ...item, endDate: openEndedDate(segmentYear + 1) } : item),
  };
}
