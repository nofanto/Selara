import type { Deliverable, DeliverableSegment, DeliverableStatus, Initiative, LkptiDetail, RptiDetail } from '../types';
import { isLiveStatusId } from './rpti';

/**
 * Carries the attributes that used to live on report rows onto the entities that
 * describe them.
 *
 * `LkptiDetail` was the only record able to hold a deliverable's platform, database,
 * providers, backup strategy, system owner, ownership and the vendor's name, so it
 * held them by default rather than by design. They now live on `Deliverable`
 * (ADR-0013). Legacy `RptiDetail.remarks` now lifts to its explicitly named
 * `DeliverableSegment` implementation (spec 003 Q17).
 *
 * Broad in-place migration tooling remains out of scope — see
 * `requirement-specs/report-rows-as-projections.md` Q4. Instead, this idempotent lift
 * runs at each boundary where old-shaped data can enter live state. IndexedDB is
 * schemaless within a store, so dropping the fields from the TypeScript type does not
 * delete them; old workspaces, snapshots and workbooks still carry recoverable
 * properties until that boundary is crossed.
 *
 * That safety ends at the first press of Generate, which rebuilds rows from the
 * deliverable and would discard them permanently. Callers run this before the data
 * becomes live and persist its result before any generation can run (FR-019).
 *
 * Pure, and non-destructive except for the legacy cost completion marker:
 *   - a value already on the entity always wins — it is the newer home and the one
 *     the preparer edits, so the old row must never overwrite a deliberate edit;
 *   - non-cost orphaned properties are left where they are, so a later migration
 *     tool can still find them;
 *   - legacy cost properties are removed after lifting, because leaving them would
 *     make every later load overwrite newer Initiative edits (F3/Q7).
 */

/** Fields that moved from `LkptiDetail` to `Deliverable`. */
const LKPTI_ATTRIBUTES = [
  'platform', 'database', 'dcProvider', 'drcProvider',
  'backupStrategy', 'systemOwner', 'ownership', 'developer',
] as const;

export interface AttributeLiftInput {
  deliverables: Deliverable[];
  deliverableSegments: DeliverableSegment[];
  deliverableStatuses: DeliverableStatus[];
  initiatives: Initiative[];
  lkptiDetails: LkptiDetail[];
  rptiDetails: RptiDetail[];
}

export interface AttributeLiftResult {
  deliverables: Deliverable[];
  deliverableSegments: DeliverableSegment[];
  initiatives: Initiative[];
  /** Stored rows with legacy cost overrides removed after they have been lifted. */
  rptiDetails: RptiDetail[];
  /** False when nothing moved, so a caller can skip a pointless save. */
  changed: boolean;
}

export function liftReportRowAttributes(input: AttributeLiftInput): AttributeLiftResult {
  const { deliverables, deliverableSegments, deliverableStatuses, initiatives, lkptiDetails, rptiDetails } = input;
  let changed = false;

  // Read through an index rather than the declared type: these properties are exactly
  // the ones the type no longer describes, which is the situation being repaired.
  const asRecord = (v: unknown) => v as Record<string, unknown>;

  const lkptiByTarget = new Map<string, LkptiDetail>();
  for (const row of lkptiDetails) if (!lkptiByTarget.has(row.targetId)) lkptiByTarget.set(row.targetId, row);

  const rptiByTarget = new Map<string, RptiDetail>();
  for (const row of rptiDetails) if (!rptiByTarget.has(row.targetId)) rptiByTarget.set(row.targetId, row);

  const liftedDeliverables = deliverables.map(deliverable => {
    const lkpti = lkptiByTarget.get(deliverable.id);
    const rpti = rptiByTarget.get(deliverable.id);
    if (!lkpti && !rpti) return deliverable;

    const patch: Record<string, unknown> = {};
    const carry = (field: string, value: unknown) => {
      if (value === undefined || value === '') return;
      if (asRecord(deliverable)[field] !== undefined && asRecord(deliverable)[field] !== '') return;
      patch[field] = value;
    };

    if (lkpti) for (const field of LKPTI_ATTRIBUTES) carry(field, asRecord(lkpti)[field]);
    if (rpti) carry('ppjtiRelatedParty', asRecord(rpti).ppjtiRelatedParty);

    if (Object.keys(patch).length === 0) return deliverable;
    changed = true;
    return { ...deliverable, ...patch };
  });

  const remarksBySegment = new Map<string, string>();
  for (const row of rptiDetails) {
    const remarks = asRecord(row).remarks;
    if (typeof remarks === 'string' && remarks !== '' && row.deliverableSegmentId
      && !remarksBySegment.has(row.deliverableSegmentId)) {
      remarksBySegment.set(row.deliverableSegmentId, remarks);
    }
  }

  // The ADR-0013 home carried no implementation pointer, so it is placed only when
  // the initiative has exactly one live implementation across all years. An absent
  // status vocabulary is uncertainty, not proof that there is no work — place
  // nothing rather than guess (Q20).
  const currentRemarksBySegment = new Map<string, string>();
  if (deliverableStatuses.length > 0) for (const initiative of initiatives) {
    const remarks = asRecord(initiative).rptiRemarks;
    if (typeof remarks !== 'string' || remarks === '') continue;
    const implementations = deliverableSegments.filter(segment =>
      segment.initiativeId === initiative.id && isLiveStatusId(segment.status, deliverableStatuses));
    if (implementations.length === 1) currentRemarksBySegment.set(implementations[0].id, remarks);
  }

  // Both sources can name the same segment, and then their order decides what is
  // filed. The initiative's own value is the newer home and the one the preparer
  // types into; a legacy row is evidence of an older filing. Newer wins, which is
  // this file's standing rule — old evidence must never overwrite a deliberate edit.
  const liftedDeliverableSegments = deliverableSegments.map(segment => {
    if (segment.rptiRemarks !== undefined && segment.rptiRemarks !== '') return segment;
    const remarks = currentRemarksBySegment.get(segment.id) ?? remarksBySegment.get(segment.id);
    if (!remarks) return segment;
    changed = true;
    return { ...segment, rptiRemarks: remarks };
  });

  const liftedInitiatives = initiatives.map(initiative => {
    const legacy = rptiDetails.find(row => row.initiativeId === initiative.id && (
      (typeof asRecord(row).capexAmount === 'number' && asRecord(row).capexAmount !== initiative.capex)
      || (typeof asRecord(row).opexAmount === 'number' && asRecord(row).opexAmount !== initiative.opex)
    ));
    const legacyRecord = legacy ? asRecord(legacy) : undefined;
    const capex = typeof legacyRecord?.capexAmount === 'number' ? legacyRecord.capexAmount : initiative.capex;
    const opex = typeof legacyRecord?.opexAmount === 'number' ? legacyRecord.opexAmount : initiative.opex;
    if (capex === initiative.capex && opex === initiative.opex) return initiative;
    changed = true;
    return { ...initiative, capex, opex };
  });

  // Cost fields are the exception to the otherwise non-destructive lift. They used
  // to override Initiative costs, so leaving them behind is not a harmless archive:
  // every later load would mistake them for an unfinished migration and overwrite a
  // newer canonical edit. Their absence is the durable, per-row completion signal.
  const cleanedRptiDetails = rptiDetails.map(row => {
    const record = asRecord(row);
    if (!Object.prototype.hasOwnProperty.call(record, 'capexAmount')
      && !Object.prototype.hasOwnProperty.call(record, 'opexAmount')) return row;
    const { capexAmount: _capexAmount, opexAmount: _opexAmount, ...cleaned } = record;
    changed = true;
    return cleaned as unknown as RptiDetail;
  });

  return { deliverables: liftedDeliverables, deliverableSegments: liftedDeliverableSegments,
    initiatives: liftedInitiatives, rptiDetails: cleanedRptiDetails, changed };
}
