import type { Decision, Version } from '../types';

type WorkspaceContent = {
  assets: unknown[];
  deliverables?: unknown[];
  deliverableSegments?: unknown[];
  initiatives: unknown[];
  milestones: unknown[];
  programmes: unknown[];
  strategies: unknown[];
  dependencies: unknown[];
  assetCategories: unknown[];
  resources?: unknown[];
  deliverableStatuses?: unknown[];
};

const EMPTY_ARRAY: readonly unknown[] = [];

/**
 * Returns true only when the workspace has no user-authored data at all.
 *
 * Settings and version history are intentionally ignored here because they are
 * metadata, not evidence that the workspace has been started.
 */
export function isWorkspaceEmpty(data: WorkspaceContent): boolean {
  const buckets = [
    data.assets,
    data.deliverables ?? EMPTY_ARRAY,
    data.deliverableSegments ?? EMPTY_ARRAY,
    data.initiatives,
    data.milestones,
    data.programmes,
    data.strategies,
    data.dependencies,
    data.assetCategories,
    data.resources ?? EMPTY_ARRAY,
    data.deliverableStatuses ?? EMPTY_ARRAY,
  ];

  return buckets.every(bucket => bucket.length === 0);
}

type ReplaceableContent = WorkspaceContent & {
  decisions?: unknown[];
  rptiDetails?: unknown[];
  lkptiDetails?: unknown[];
  versions?: unknown[];
};

const REPLACEABLE_KINDS: { key: keyof ReplaceableContent; label: string }[] = [
  { key: 'assetCategories', label: 'Asset categories' },
  { key: 'assets', label: 'Assets' },
  { key: 'deliverables', label: 'Deliverables' },
  { key: 'deliverableStatuses', label: 'Deliverable statuses' },
  { key: 'deliverableSegments', label: 'Lifecycle segments' },
  { key: 'initiatives', label: 'Initiatives' },
  { key: 'programmes', label: 'Programmes' },
  { key: 'strategies', label: 'Strategies' },
  { key: 'milestones', label: 'Milestones' },
  { key: 'dependencies', label: 'Dependencies' },
  { key: 'resources', label: 'Resources' },
  { key: 'rptiDetails', label: 'RPTI rows' },
  { key: 'lkptiDetails', label: 'LKPTI rows' },
  { key: 'decisions', label: 'Decisions' },
  { key: 'versions', label: 'History snapshots' },
];

export interface ReplacementRow {
  key: string;
  label: string;
  current: number;
  incoming: number;
}

/**
 * What replacing the whole workspace with `incoming` would do, kind by kind (#62).
 *
 * Unlike isWorkspaceEmpty(), History, decisions and filed report rows count here:
 * the question is not "has this workspace been started" but "what would be
 * destroyed", and those are the records a planner can least afford to lose.
 */
export function summariseReplacement(current: ReplaceableContent, incoming: ReplaceableContent) {
  const count = (data: ReplaceableContent, key: keyof ReplaceableContent) => data[key]?.length ?? 0;
  const rows: ReplacementRow[] = REPLACEABLE_KINDS
    .map(({ key, label }) => ({ key, label, current: count(current, key), incoming: count(incoming, key) }))
    .filter(row => row.current > 0 || row.incoming > 0);

  return { rows, losesData: rows.some(row => row.current > 0) };
}

/**
 * Builds the workspace state to apply when restoring a saved version.
 *
 * The snapshot's own `decisions` array is deliberately ignored in favour of the
 * live log (ADR-0011). The decision log is an audit trail *about* the workspace,
 * not workspace state: restoring rolls back plan data within the *same*
 * workspace, where the initiatives, programmes and assets a decision references
 * still exist under the same IDs, so the reasoning stays meaningful and must
 * survive the rollback. Rolling it back would delete the very decision that
 * explains why the restore happened — and would rewind `supersededBy` chains
 * recorded since.
 *
 * Establishing a *new* workspace is the opposite case and correctly resets the
 * log; those paths (template selection, viewer import, LKPTI import) don't call
 * this.
 */
export function buildRestoredWorkspace(version: Version, currentDecisions: Decision[]) {
  return {
    ...version.data,
    deliverableStatuses: version.data.deliverableStatuses ?? [],
    rptiDetails: version.data.rptiDetails ?? [],
    lkptiDetails: version.data.lkptiDetails ?? [],
    decisions: currentDecisions,
  };
}
