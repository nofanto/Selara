import type { Asset, Deliverable, DeliverableSegment, Initiative } from '../types';

/**
 * Which deliverables an initiative drives, and what to highlight when one end is selected.
 *
 * Nothing here is stored. Since #52 the link lives on each lifecycle segment, which names
 * both its application (`deliverableId`) and the initiative behind it (`initiativeId`), so
 * every answer is derived from segments at render time. See
 * requirement-specs/initiative-deliverable-links.md and User Story 26.
 */

export type LinkState = 'highlighted' | 'dimmed';

/**
 * How a bar looks while a highlight is on. Shared by initiative and segment bars so both ends
 * of a link read the same. The sky ring is chosen to differ from the two emphases a bar already
 * has: the amber critical-path ring and the dashed selection outline.
 */
export function linkStateClass(state: LinkState | undefined): string | undefined {
  if (state === 'dimmed') return 'opacity-25 saturate-50';
  if (state === 'highlighted') return 'ring-2 ring-sky-400 ring-offset-1 z-10';
  return undefined;
}

/** Whichever of an initiative or a segment was selected most recently. */
export type LinkFocus =
  | { kind: 'initiative'; id: string }
  | { kind: 'segment'; id: string };

export interface HighlightSet {
  initiativeId: string;
  /** For membership checks while rendering each bar. */
  segmentIds: Set<string>;
  /** The segments themselves, so a consumer can locate them without being handed them again. */
  segments: DeliverableSegment[];
}

export interface LinkedDeliverable {
  deliverable: Deliverable;
  asset?: Asset;
  /** Where the jump goes; the highlight already shows the rest. */
  earliestSegmentId: string;
}

/**
 * The distinct deliverables an initiative's segments name, ordered by each one's earliest
 * linked segment. Counts applications, not implementations: three go-lives on one
 * application is one entry. A segment whose deliverable has been deleted is skipped rather
 * than listed as a blank — segment-deliverable already reports it in Data Health.
 */
/**
 * Whether a segment counts as linking its initiative to a deliverable. The badge's count and
 * the list it opens both go through this, so they cannot disagree about what is linked.
 */
const isCountedLink = (segment: DeliverableSegment, deliverableIds: Set<string>): segment is DeliverableSegment & { initiativeId: string } =>
  !!segment.initiativeId && deliverableIds.has(segment.deliverableId);

export function linkedDeliverables(
  initiativeId: string,
  segments: DeliverableSegment[],
  deliverables: Deliverable[],
  assets: Asset[],
): LinkedDeliverable[] {
  const deliverableById = new Map(deliverables.map(d => [d.id, d]));
  const deliverableIds = new Set(deliverableById.keys());
  const assetById = new Map(assets.map(a => [a.id, a]));
  const earliest = new Map<string, DeliverableSegment>();
  for (const segment of segments) {
    if (segment.initiativeId !== initiativeId || !isCountedLink(segment, deliverableIds)) continue;
    const current = earliest.get(segment.deliverableId);
    if (!current || segment.startDate < current.startDate
      || (segment.startDate === current.startDate && segment.id < current.id)) {
      earliest.set(segment.deliverableId, segment);
    }
  }
  return [...earliest.values()]
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id))
    .map(segment => {
      const deliverable = deliverableById.get(segment.deliverableId)!;
      return { deliverable, asset: assetById.get(deliverable.assetId), earliestSegmentId: segment.id };
    });
}

/**
 * The badge count for every initiative in one pass over the segments: distinct deliverables
 * per initiative, with the same rule as linkedDeliverables. Initiatives with none are absent.
 */
export function linkedDeliverableCounts(
  segments: DeliverableSegment[],
  deliverables: Deliverable[],
): Map<string, number> {
  const deliverableIds = new Set(deliverables.map(d => d.id));
  const byInitiative = new Map<string, Set<string>>();
  for (const segment of segments) {
    if (!isCountedLink(segment, deliverableIds)) continue;
    let set = byInitiative.get(segment.initiativeId);
    if (!set) byInitiative.set(segment.initiativeId, set = new Set());
    set.add(segment.deliverableId);
  }
  return new Map([...byInitiative].map(([id, set]) => [id, set.size]));
}

/**
 * The one highlight set, whichever end was selected: the initiative plus all of its
 * segments. Selecting a segment asks "whose work is this?", and the answer is the same
 * picture as asking the initiative what it delivers.
 *
 * Null whenever nothing is linked — an initiative with no segments, a segment with no
 * initiative, or a reference to something that no longer exists. Null means the timeline
 * behaves exactly as it does without this feature: dimming everything to highlight one bar
 * would say nothing.
 */
export function highlightSet(
  focus: LinkFocus | null,
  segments: DeliverableSegment[],
  initiatives: Initiative[],
): HighlightSet | null {
  if (!focus) return null;
  let initiativeId: string | undefined;
  if (focus.kind === 'initiative') {
    initiativeId = focus.id;
  } else {
    initiativeId = segments.find(s => s.id === focus.id)?.initiativeId;
  }
  if (!initiativeId || !initiatives.some(i => i.id === initiativeId)) return null;
  const linked = segments.filter(s => s.initiativeId === initiativeId);
  if (linked.length === 0) return null;
  return { initiativeId, segmentIds: new Set(linked.map(s => s.id)), segments: linked };
}

/** The category key the timeline uses for an asset — `'uncategorized'` when it has none. */
const categoryKey = (asset: Asset | undefined): string | undefined =>
  asset ? (asset.categoryId || 'uncategorized') : undefined;

/**
 * Collapsed categories hiding either end of the highlight: the focused initiative's own
 * asset, or the asset of any of its segments' deliverables. Revealing them is temporary —
 * the caller treats them as expanded while the highlight lasts and never writes the saved
 * collapse state.
 */
export function categoriesToReveal(
  set: HighlightSet | null,
  initiatives: Initiative[],
  deliverables: Deliverable[],
  assets: Asset[],
  collapsed: Set<string>,
): Set<string> {
  const reveal = new Set<string>();
  if (!set || collapsed.size === 0) return reveal;
  const assetById = new Map(assets.map(a => [a.id, a]));
  const deliverableById = new Map(deliverables.map(d => [d.id, d]));
  const consider = (assetId: string | undefined) => {
    const key = categoryKey(assetId ? assetById.get(assetId) : undefined);
    if (key && collapsed.has(key)) reveal.add(key);
  };
  consider(initiatives.find(i => i.id === set.initiativeId)?.assetId);
  for (const segment of set.segments) consider(deliverableById.get(segment.deliverableId)?.assetId);
  return reveal;
}

/**
 * Collapsed group bars holding the focused initiative, keyed exactly as the timeline keys
 * them: the group's initiative ids, sorted, joined with `|`. Sorts a copy — the timeline's
 * own `g.sort()` mutates the group it is given, and this must not.
 */
export function groupsToReveal(
  set: HighlightSet | null,
  groups: string[][],
  collapsedGroupKeys: string[] | undefined,
): Set<string> {
  const reveal = new Set<string>();
  if (!set || !collapsedGroupKeys?.length) return reveal;
  for (const group of groups) {
    if (!group.includes(set.initiativeId)) continue;
    const key = [...group].sort().join('|');
    if (collapsedGroupKeys.includes(key)) reveal.add(key);
  }
  return reveal;
}
