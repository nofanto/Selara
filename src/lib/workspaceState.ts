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
