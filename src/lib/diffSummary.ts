import { COSMETIC_CHANGE_PREFIXES, DiffOwner, DiffResult, DiffSectionKey } from './diff';

/**
 * Pivots a DiffResult from "what kind of thing changed" to "what happened to each
 * system" — the read model behind the difference report's Summary tab.
 *
 * Design notes: requirement-specs/diff-summary.md §§2-3 (asset-primary grouping and
 * the significance ranking) and §§6-8 (clustering, cosmetic handling, collapsed
 * asset adds and removes). The audit-trail view over the same DiffResult is
 * unchanged and remains the All changes tab; this supplements, it does not replace.
 */

/**
 * §3's ranking. 1 = anything on the OJK filing (a one-character RPTI edit outranks
 * a large edit elsewhere); 2 = scope, things created or deleted; 3 = everything else.
 */
export type SummaryTier = 1 | 2 | 3;

export type SummaryChangeKind = 'added' | 'removed' | 'modified';

export type SummaryChange = {
  section: DiffSectionKey;
  kind: SummaryChangeKind;
  id: string;
  name: string;
  /** Empty for adds and removes, where the entity's existence is the change. */
  changes: string[];
  tier: SummaryTier;
};

/** Changes about one deliverable, kept adjacent so its story reads as one thing (§6). */
export type SummaryCluster = {
  deliverable: DiffOwner;
  title: string;
  tier: SummaryTier;
  changes: SummaryChange[];
};

export type SummaryChildCount = {
  section: DiffSectionKey;
  count: number;
  /** Pluralised and composed here so both the view and its test read one string. */
  label: string;
};

export type SummaryGroup = {
  /** Unset for the portfolio-level bucket. */
  asset?: DiffOwner;
  title: string;
  tier: SummaryTier;
  changeCount: number;
  /**
   * Set when the asset itself was added or removed. The group then states that one
   * fact with counts of what came with it and leaves `changes` and `clusters` empty:
   * if the asset is gone, so is everything under it, and no reader learns anything
   * from the fifteenth line restating it (§8). The rows remain under All changes.
   */
  assetChange?: { kind: 'added' | 'removed'; childCounts: SummaryChildCount[] };
  /** Changes with no deliverable: the asset's own row, initiatives, milestones, asset-targeted RPTI. */
  changes: SummaryChange[];
  clusters: SummaryCluster[];
};

export type DiffSummary = {
  groups: SummaryGroup[];
  /**
   * How many changes §3 dropped as cosmetic. Surfaced rather than discarded because
   * a cosmetic-only diff summarises to zero groups while computeDiff still reports
   * hasChanges — the view has to say where they went instead of rendering blank (§7).
   */
  cosmeticCount: number;
};

export const PORTFOLIO_GROUP_TITLE = 'Portfolio-level';

/** Every section computeDiff produces, in its order — which is the order rows keep within a group. */
const SECTIONS: DiffSectionKey[] = [
  'assets', 'programmes', 'strategies', 'initiatives', 'dependencies', 'milestones',
  'deliverables', 'deliverableSegments', 'deliverableStatuses', 'resources',
  'assetCategories', 'decisions', 'rptiDetails', 'lkptiDetails',
];

const FILING_SECTIONS: DiffSectionKey[] = ['rptiDetails', 'lkptiDetails'];

const SECTION_NOUNS: Record<DiffSectionKey, [singular: string, plural: string]> = {
  assets: ['asset', 'assets'],
  programmes: ['programme', 'programmes'],
  strategies: ['strategy', 'strategies'],
  initiatives: ['initiative', 'initiatives'],
  dependencies: ['relationship', 'relationships'],
  milestones: ['milestone', 'milestones'],
  deliverables: ['deliverable', 'deliverables'],
  deliverableSegments: ['segment', 'segments'],
  deliverableStatuses: ['app status', 'app statuses'],
  resources: ['resource', 'resources'],
  assetCategories: ['category', 'categories'],
  decisions: ['decision', 'decisions'],
  rptiDetails: ['RPTI row', 'RPTI rows'],
  lkptiDetails: ['LKPTI row', 'LKPTI rows'],
};

function tierOf(section: DiffSectionKey, kind: SummaryChangeKind): SummaryTier {
  if (FILING_SECTIONS.includes(section)) return 1;
  if (kind !== 'modified') return 2;
  return 3;
}

/**
 * True only when *every* change on the entry is cosmetic. A programme renamed and
 * recoloured in one edit is a substantive change that happens to carry a colour with
 * it, and dropping it would lose the rename.
 */
function isCosmetic(section: DiffSectionKey, kind: SummaryChangeKind, changes: string[]): boolean {
  if (kind !== 'modified') return false;
  const prefixes = COSMETIC_CHANGE_PREFIXES[section];
  if (!prefixes || changes.length === 0) return false;
  return changes.every(change => prefixes.some(prefix => change.startsWith(prefix)));
}

const bestTier = (tiers: SummaryTier[]): SummaryTier =>
  tiers.reduce<SummaryTier>((best, tier) => (tier < best ? tier : best), 3);

/** Tier first, then volume, then title — so equal-significance groups still order deterministically. */
function byRank<T extends { tier: SummaryTier; title: string }>(count: (item: T) => number) {
  return (a: T, b: T) => a.tier - b.tier || count(b) - count(a) || a.title.localeCompare(b.title);
}

type FlatChange = SummaryChange & { asset?: DiffOwner; deliverable?: DiffOwner };

export function summarizeDiff(diff: DiffResult): DiffSummary {
  const flat: FlatChange[] = [];
  let cosmeticCount = 0;

  for (const section of SECTIONS) {
    const entity = diff[section];
    const collect = (kind: SummaryChangeKind, entries: { id: string; name: string; asset?: DiffOwner; deliverable?: DiffOwner; changes?: string[] }[]) => {
      for (const entry of entries) {
        const changes = entry.changes ?? [];
        if (isCosmetic(section, kind, changes)) {
          cosmeticCount += 1;
          continue;
        }
        flat.push({
          section, kind, id: entry.id, name: entry.name, changes,
          tier: tierOf(section, kind),
          asset: entry.asset,
          deliverable: entry.deliverable,
        });
      }
    };
    collect('added', entity.added);
    collect('removed', entity.removed);
    collect('modified', entity.modified);
  }

  // Insertion order is computeDiff's section order, which is what rows keep within a
  // group — §6 ranks groups and clusters, not the rows inside one.
  const byAsset = new Map<string, FlatChange[]>();
  for (const change of flat) {
    const key = change.asset?.id ?? '';
    const existing = byAsset.get(key);
    if (existing) existing.push(change);
    else byAsset.set(key, [change]);
  }

  const groups: SummaryGroup[] = [];
  for (const [assetId, changes] of byAsset) {
    const asset = assetId ? changes.find(c => c.asset)?.asset : undefined;
    const title = asset?.name ?? PORTFOLIO_GROUP_TITLE;
    const tier = bestTier(changes.map(c => c.tier));

    // §8: the asset itself was added or removed, so its children are implied by it.
    const assetRow = assetId ? changes.find(c => c.section === 'assets' && c.kind !== 'modified') : undefined;
    if (assetRow) {
      const counts = new Map<DiffSectionKey, number>();
      for (const change of changes) {
        if (change === assetRow) continue;
        counts.set(change.section, (counts.get(change.section) ?? 0) + 1);
      }
      groups.push({
        asset, title, tier, changeCount: changes.length,
        assetChange: {
          kind: assetRow.kind as 'added' | 'removed',
          childCounts: SECTIONS.filter(section => counts.has(section)).map(section => {
            const count = counts.get(section)!;
            const [singular, plural] = SECTION_NOUNS[section];
            return { section, count, label: `${count} ${count === 1 ? singular : plural}` };
          }),
        },
        changes: [],
        clusters: [],
      });
      continue;
    }

    const head: SummaryChange[] = [];
    const byDeliverable = new Map<string, FlatChange[]>();
    for (const change of changes) {
      if (!change.deliverable) {
        head.push(change);
        continue;
      }
      const existing = byDeliverable.get(change.deliverable.id);
      if (existing) existing.push(change);
      else byDeliverable.set(change.deliverable.id, [change]);
    }

    const clusters: SummaryCluster[] = [...byDeliverable.values()].map(clusterChanges => {
      const deliverable = clusterChanges[0].deliverable!;
      return {
        deliverable,
        title: deliverable.name,
        tier: bestTier(clusterChanges.map(c => c.tier)),
        changes: clusterChanges,
      };
    });
    clusters.sort(byRank<SummaryCluster>(cluster => cluster.changes.length));

    groups.push({ asset, title, tier, changeCount: changes.length, changes: head, clusters });
  }

  // The portfolio bucket is the leftovers, not a ranked peer, so it always sorts last.
  groups.sort((a, b) => {
    if (!a.asset !== !b.asset) return a.asset ? -1 : 1;
    return byRank<SummaryGroup>(group => group.changeCount)(a, b);
  });

  return { groups, cosmeticCount };
}
