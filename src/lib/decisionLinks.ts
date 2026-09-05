import type { Decision } from '../types';

/** An entity a decision can point at, identified by the pair that makes the link. */
export type LinkedEntityRef = {
  type: NonNullable<Decision['linkedEntityType']>;
  id: string;
};

/**
 * The decisions whose `linkedEntityId` would stop resolving if `removed` were deleted.
 *
 * These decisions are **not** deleted by a cascade, and must not be: per ADR-0011
 * the decision log is an audit trail about the workspace, so a decision about a
 * since-deleted initiative is still valid history. This exists so a cascade can
 * *warn* that the reference is about to break — the entities in `removed` go
 * away, the reasoning about them stays.
 *
 * Matches on type *and* id. Ids are prefixed by convention (`i-`, `a-`, `prog-`),
 * but the pair is what constitutes the link, and leaning on the prefixes would be
 * a latent bug the first time one changes.
 */
export function decisionsStrandedBy(decisions: Decision[], removed: LinkedEntityRef[]): Decision[] {
  if (removed.length === 0) return [];

  const keys = new Set(removed.map(r => `${r.type}:${r.id}`));

  return decisions.filter(d =>
    d.linkedEntityType !== undefined
    && d.linkedEntityId !== undefined
    && keys.has(`${d.linkedEntityType}:${d.linkedEntityId}`),
  );
}
