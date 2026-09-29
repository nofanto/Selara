import type { Decision, Version } from '../types';
import { workspaceFingerprint } from './workspaceBackup';

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

interface EffectsSide {
  versions?: unknown[];
  decisions?: unknown[];
  timelineSettings?: unknown;
}

/**
 * What a replacement does to History, the decision log and settings, in words
 * shown before it is confirmed (contracts/replacement-routes.md). Every line is
 * stated even when nothing changes: "kept" must be said, not inferred from an
 * absent warning, and a settings change must show even when no counts move.
 *
 * `next.versions` undefined means the route leaves History alone.
 */
export function describeReplacementEffects(
  current: { versions: unknown[]; decisions: unknown[]; timelineSettings: unknown },
  next: EffectsSide,
): string[] {
  const effects: string[] = [];
  const n = current.versions.length;
  if (next.versions === undefined) {
    effects.push(`History: your ${n} saved version(s) are kept.`);
  } else if (next.versions.length === 0) {
    effects.push(n > 0 ? `History: all ${n} saved version(s) are removed.` : 'History: none saved before or after.');
  } else if (n === 0) {
    effects.push(`History: ${next.versions.length} saved version(s) are added from the incoming workspace.`);
  } else {
    effects.push(`History: your ${n} saved version(s) are replaced by ${next.versions.length} from the incoming workspace.`);
  }

  const before = current.decisions.length;
  const after = next.decisions ?? [];
  if (workspaceFingerprint({ decisions: current.decisions }) === workspaceFingerprint({ decisions: after })) {
    effects.push(before === 0 ? 'Decision log: empty before and after.' : `Decision log: kept (${before} decision(s)).`);
  } else if (after.length === 0) {
    effects.push(`Decision log: cleared — ${before} decision(s) removed.`);
  } else {
    effects.push(`Decision log: replaced — ${before} decision(s) now, ${after.length} after.`);
  }

  effects.push(workspaceFingerprint({ s: current.timelineSettings }) === workspaceFingerprint({ s: next.timelineSettings })
    ? 'Timeline settings: unchanged.'
    : "Timeline settings: replaced by the incoming workspace's settings.");
  return effects;
}
