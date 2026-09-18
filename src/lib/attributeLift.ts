import type { Deliverable, Initiative, LkptiDetail, RptiDetail } from '../types';

/**
 * Carries the attributes that used to live on report rows onto the entities that
 * describe them.
 *
 * `LkptiDetail` was the only record able to hold a deliverable's platform, database,
 * providers, backup strategy, system owner, ownership and the vendor's name, so it
 * held them by default rather than by design. They now live on `Deliverable`
 * (ADR-0013), and `RptiDetail.remarks` lives on `Initiative` as `rptiRemarks`.
 *
 * Migration tooling is deliberately out of scope — see
 * `requirement-specs/report-rows-as-projections.md` Q4. Deferring it is safe only
 * because IndexedDB is schemaless within a store: dropping the fields from the
 * TypeScript type does not delete them, so a workspace imported before the change
 * still carries them as properties nothing reads.
 *
 * That safety ends at the first press of Generate, which rebuilds rows from the
 * deliverable and would discard them permanently. This runs on load, before any
 * generation can, and is the whole of FR-019.
 *
 * Pure, and deliberately non-destructive:
 *   - a value already on the entity always wins — it is the newer home and the one
 *     the preparer edits, so the old row must never overwrite a deliberate edit;
 *   - the orphaned properties are left where they are, so a proper migration tool
 *     written later can still find them.
 */

/** Fields that moved from `LkptiDetail` to `Deliverable`. */
const LKPTI_ATTRIBUTES = [
  'platform', 'database', 'dcProvider', 'drcProvider',
  'backupStrategy', 'systemOwner', 'ownership', 'developer',
] as const;

export interface AttributeLiftInput {
  deliverables: Deliverable[];
  initiatives: Initiative[];
  lkptiDetails: LkptiDetail[];
  rptiDetails: RptiDetail[];
}

export interface AttributeLiftResult {
  deliverables: Deliverable[];
  initiatives: Initiative[];
  /** False when nothing moved, so a caller can skip a pointless save. */
  changed: boolean;
}

export function liftReportRowAttributes(input: AttributeLiftInput): AttributeLiftResult {
  const { deliverables, initiatives, lkptiDetails, rptiDetails } = input;
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

  // An initiative's remarks come from whichever of its report rows carries one.
  const remarksByInitiative = new Map<string, string>();
  for (const row of rptiDetails) {
    const remarks = asRecord(row).remarks;
    if (typeof remarks === 'string' && remarks !== '' && !remarksByInitiative.has(row.initiativeId)) {
      remarksByInitiative.set(row.initiativeId, remarks);
    }
  }

  const liftedInitiatives = initiatives.map(initiative => {
    const remarks = remarksByInitiative.get(initiative.id);
    const legacy = rptiDetails.find(row => row.initiativeId === initiative.id && (
      (typeof asRecord(row).capexAmount === 'number' && asRecord(row).capexAmount !== initiative.capex)
      || (typeof asRecord(row).opexAmount === 'number' && asRecord(row).opexAmount !== initiative.opex)
    ));
    const legacyRecord = legacy ? asRecord(legacy) : undefined;
    const capex = typeof legacyRecord?.capexAmount === 'number' ? legacyRecord.capexAmount : initiative.capex;
    const opex = typeof legacyRecord?.opexAmount === 'number' ? legacyRecord.opexAmount : initiative.opex;
    const rptiRemarks = initiative.rptiRemarks !== undefined && initiative.rptiRemarks !== ''
      ? initiative.rptiRemarks
      : remarks;

    if (capex === initiative.capex && opex === initiative.opex && rptiRemarks === initiative.rptiRemarks) return initiative;
    changed = true;
    return { ...initiative, capex, opex, rptiRemarks };
  });

  return { deliverables: liftedDeliverables, initiatives: liftedInitiatives, changed };
}
