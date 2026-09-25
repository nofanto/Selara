import type { RptiDetail } from '../types';
import { INFRASTRUCTURE_CODES, UNRESOLVED_IMPORT_TARGET_PREFIX } from './rpti';

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
