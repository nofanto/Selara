import type { Decision, Version } from '../types';

/**
 * One row of the History tab's chronological stream.
 *
 * Versions are generated (a snapshot the app diffs for you); decisions are
 * authored (the reasoning only a person can supply). Interleaving them is the
 * point: a large version with no decision beside it reads as a visible gap
 * rather than an absence nobody notices — see requirement-specs/
 * decision-version-history-merge.md §6c.
 */
export type HistoryEntry =
  | { kind: 'version'; id: string; timestamp: string; version: Version; decisions: Decision[] }
  | { kind: 'decision'; id: string; timestamp: string; decision: Decision };

/** Either end of a comparison: a saved Version, or the live workspace "now". */
export type VersionEndpoint = { id: string; timestamp: string };

const newestFirst = (a: { timestamp: string }, b: { timestamp: string }) =>
  b.timestamp.localeCompare(a.timestamp);

/**
 * The decisions that explain the change between two snapshots.
 *
 * Deliberately a *union* of two rules rather than a choice between them
 * (§6b): matching `createdAt` against the window alone would miss a decision
 * written later about an earlier change, while following `versionId` alone
 * would miss everything nobody bothered to link. Either rule on its own leaves
 * the report quietly incomplete, which is the failure mode that makes people
 * stop trusting it.
 *
 * The two endpoints may be passed in either order. They are taken as
 * `{ id, timestamp }` rather than full `Version`s so the live workspace — which
 * has a timestamp but no version record — can serve as one end of the span.
 */
export function decisionsForSpan(
  decisions: Decision[],
  a: VersionEndpoint,
  b: VersionEndpoint,
): Decision[] {
  const [earlier, later] = a.timestamp <= b.timestamp ? [a, b] : [b, a];

  return decisions
    .filter(d =>
      (d.versionId === earlier.id || d.versionId === later.id)
      // Inclusive on both boundaries: a decision captured at save time shares
      // its version's instant, and should surface for that version's spans.
      || (d.createdAt >= earlier.timestamp && d.createdAt <= later.timestamp),
    )
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
}

/**
 * Builds the History tab's stream, newest first.
 *
 * A decision linked to a version is attached to that version's entry rather
 * than repeated as its own row, so the association is visible and nothing is
 * listed twice. A decision whose `versionId` no longer resolves still gets its
 * own row — versions can be deleted, and the reasoning must not disappear with
 * the snapshot it happened to reference.
 */
export function buildHistoryStream(versions: Version[], decisions: Decision[]): HistoryEntry[] {
  const versionIds = new Set(versions.map(v => v.id));
  const attached = new Map<string, Decision[]>();

  for (const decision of decisions) {
    if (decision.versionId && versionIds.has(decision.versionId)) {
      const existing = attached.get(decision.versionId);
      if (existing) existing.push(decision);
      else attached.set(decision.versionId, [decision]);
    }
  }

  const versionEntries: HistoryEntry[] = versions.map(version => ({
    kind: 'version',
    id: version.id,
    timestamp: version.timestamp,
    version,
    decisions: (attached.get(version.id) ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  }));

  const standaloneEntries: HistoryEntry[] = decisions
    .filter(d => !d.versionId || !versionIds.has(d.versionId))
    .map(decision => ({ kind: 'decision', id: decision.id, timestamp: decision.createdAt, decision }));

  return [...versionEntries, ...standaloneEntries].sort(newestFirst);
}
