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
