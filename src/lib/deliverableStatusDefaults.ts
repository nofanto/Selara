import type { DeliverableStatus } from '../types';

/**
 * The two lifecycle statuses every seeded workspace needs, defined once.
 *
 * `DeliverableStatus` is ordinary workspace data on a user-editable Data Manager
 * tab, not an enum — so each seeding path (demo data, LKPTI import, RPTI import)
 * has to supply its own. They used to do so independently, and the LKPTI importer's
 * "Live" and the RPTI importer's "In Production" were the same concept under two
 * names: onboarding produced a workspace carrying both, each owning half the
 * segments, with nothing on screen saying which to use. Renaming one left the
 * other's segments behind, and clearing `isLiveStatus` on one silently dropped half
 * the workspace out of LKPTI generation.
 *
 * What the rules actually read is the `isLiveStatus` / `isPreLaunchStatus` flag,
 * never the name (see `classifySegmentKind`), so the duplication was invisible to
 * report generation and visible only to the user.
 *
 * The ids and names match `demoDeliverableStatuses`, which builds on these, so a
 * workspace reads the same whether it was seeded by demo data or by an import.
 */
export const PLANNED_STATUS: DeliverableStatus = {
  id: 'appstatus-planned',
  name: 'Planned',
  color: 'bg-slate-400',
  isPreLaunchStatus: true,
};

export const IN_PRODUCTION_STATUS: DeliverableStatus = {
  id: 'appstatus-in-production',
  name: 'In Production',
  color: 'bg-emerald-500',
  isLiveStatus: true,
};

/** Canonical display order: pre-launch before live, as the lifecycle runs. */
export const SEEDED_DELIVERABLE_STATUSES: DeliverableStatus[] = [PLANNED_STATUS, IN_PRODUCTION_STATUS];

/**
 * Merges status lists from several seeding paths, keeping the first definition of
 * each id. Both importers now name the same statuses, so a straight concatenation
 * would reintroduce duplicates from the other direction.
 */
export function mergeDeliverableStatuses(...lists: (DeliverableStatus[] | undefined)[]): DeliverableStatus[] {
  const byId = new Map<string, DeliverableStatus>();
  for (const list of lists) {
    for (const status of list ?? []) {
      if (!byId.has(status.id)) byId.set(status.id, status);
    }
  }
  return [...byId.values()];
}
