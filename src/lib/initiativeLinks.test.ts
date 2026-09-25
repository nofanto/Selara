import { describe, expect, it } from 'vitest';
import type { Asset, Deliverable, DeliverableSegment, Initiative } from '../types';
import {
  categoriesToReveal,
  groupsToReveal,
  highlightSet,
  linkedDeliverableCounts,
  linkedDeliverables,
} from './initiativeLinks';

// One initiative driving two deliverables under two different assets, in two
// categories — the shape the feature exists for and the demo never contains.
const assets: Asset[] = [
  { id: 'a-pay', name: 'Payments', categoryId: 'cat-core', maturity: 1 } as Asset,
  { id: 'a-mob', name: 'Mobile', categoryId: 'cat-channel', maturity: 1 } as Asset,
  { id: 'a-loose', name: 'Loose', maturity: 1 } as Asset,
];
const deliverables: Deliverable[] = [
  { id: 'd-gw', assetId: 'a-pay', name: 'Gateway' } as Deliverable,
  { id: 'd-app', assetId: 'a-mob', name: 'Mobile App' } as Deliverable,
  { id: 'd-loose', assetId: 'a-loose', name: 'Loose Tool' } as Deliverable,
];
const initiatives: Initiative[] = [
  { id: 'i-api', name: 'Open API', assetId: 'a-pay' } as Initiative,
  { id: 'i-idle', name: 'Idle', assetId: 'a-pay' } as Initiative,
];
const seg = (id: string, deliverableId: string, startDate: string, initiativeId?: string): DeliverableSegment =>
  ({ id, deliverableId, startDate, endDate: '2031-12-31', status: 'live', initiativeId }) as DeliverableSegment;
const segments: DeliverableSegment[] = [
  seg('s-app-late', 'd-app', '2027-10-01', 'i-api'),
  seg('s-gw', 'd-gw', '2027-04-01', 'i-api'),
  seg('s-app-early', 'd-app', '2027-01-01', 'i-api'),
  seg('s-orphan', 'd-loose', '2027-01-01'),
];

describe('linkedDeliverables (AC1, AC2)', () => {
  it('counts distinct deliverables, not segments', () => {
    // Three implementations over two applications: the badge says 2, not 3.
    expect(linkedDeliverables('i-api', segments, deliverables, assets)).toHaveLength(2);
  });

  it('orders by earliest linked segment and points each at its earliest segment', () => {
    const linked = linkedDeliverables('i-api', segments, deliverables, assets);
    expect(linked.map(l => [l.deliverable.name, l.asset?.name, l.earliestSegmentId])).toEqual([
      ['Mobile App', 'Mobile', 's-app-early'],
      ['Gateway', 'Payments', 's-gw'],
    ]);
  });

  it('is empty for an initiative with no segments', () => {
    expect(linkedDeliverables('i-idle', segments, deliverables, assets)).toEqual([]);
  });

  it('skips a segment whose deliverable no longer exists rather than listing a blank', () => {
    const withDangling = [...segments, seg('s-ghost', 'd-deleted', '2026-01-01', 'i-api')];
    expect(linkedDeliverables('i-api', withDangling, deliverables, assets).map(l => l.deliverable.id))
      .toEqual(['d-app', 'd-gw']);
  });
});

describe('linkedDeliverableCounts (AC1)', () => {
  it('agrees with linkedDeliverables for every initiative, including one with a dangling segment', () => {
    // The badge and the list it opens must never disagree about what is linked.
    const withDangling = [...segments, seg('s-ghost', 'd-deleted', '2026-01-01', 'i-api')];
    const counts = linkedDeliverableCounts(withDangling, deliverables);
    for (const i of initiatives) {
      expect(counts.get(i.id) ?? 0, i.id).toBe(linkedDeliverables(i.id, withDangling, deliverables, assets).length);
    }
    expect(counts.get('i-api')).toBe(2);
    expect(counts.has('i-idle')).toBe(false);
  });
});

describe('highlightSet (AC3, AC4)', () => {
  it('from an initiative: the initiative plus every one of its segments', () => {
    const set = highlightSet({ kind: 'initiative', id: 'i-api' }, segments, initiatives);
    expect(set?.initiativeId).toBe('i-api');
    expect([...(set?.segmentIds ?? [])].sort()).toEqual(['s-app-early', 's-app-late', 's-gw']);
  });

  it('from a segment: exactly the same set as from its initiative', () => {
    // "Whose work is this?" and "what does this deliver?" end in the same picture.
    const fromSegment = highlightSet({ kind: 'segment', id: 's-gw' }, segments, initiatives);
    const fromInitiative = highlightSet({ kind: 'initiative', id: 'i-api' }, segments, initiatives);
    expect(fromSegment?.initiativeId).toBe(fromInitiative?.initiativeId);
    expect([...(fromSegment?.segmentIds ?? [])].sort()).toEqual([...(fromInitiative?.segmentIds ?? [])].sort());
  });

  it('is null for an initiative with no segments, so nothing dims', () => {
    expect(highlightSet({ kind: 'initiative', id: 'i-idle' }, segments, initiatives)).toBeNull();
  });

  it('is null for a segment with no initiative, so nothing dims', () => {
    expect(highlightSet({ kind: 'segment', id: 's-orphan' }, segments, initiatives)).toBeNull();
  });

  it('is null for a segment whose initiative no longer exists', () => {
    const dangling = [...segments, seg('s-dangling', 'd-gw', '2027-01-01', 'i-deleted')];
    expect(highlightSet({ kind: 'segment', id: 's-dangling' }, dangling, initiatives)).toBeNull();
  });

  it('is null with no focus, or a focus on something that no longer exists', () => {
    expect(highlightSet(null, segments, initiatives)).toBeNull();
    expect(highlightSet({ kind: 'segment', id: 's-gone' }, segments, initiatives)).toBeNull();
    expect(highlightSet({ kind: 'initiative', id: 'i-gone' }, segments, initiatives)).toBeNull();
  });
});

describe('categoriesToReveal (AC5)', () => {
  const set = highlightSet({ kind: 'initiative', id: 'i-api' }, segments, initiatives);

  it('reveals a collapsed category hiding one of the segments', () => {
    expect([...categoriesToReveal(set, initiatives, deliverables, assets, new Set(['cat-channel']))])
      .toEqual(['cat-channel']);
  });

  it("reveals a collapsed category hiding the initiative itself, not only its segments", () => {
    // Categories count at both ends: the initiative sits on a-pay in cat-core.
    const onlyInitiativeEnd = highlightSet({ kind: 'initiative', id: 'i-api' },
      [seg('s-x', 'd-app', '2027-01-01', 'i-api')], initiatives);
    expect([...categoriesToReveal(onlyInitiativeEnd, initiatives, deliverables, assets, new Set(['cat-core']))])
      .toEqual(['cat-core']);
  });

  it('leaves expanded categories and unrelated collapsed ones alone', () => {
    expect([...categoriesToReveal(set, initiatives, deliverables, assets, new Set(['cat-unrelated']))]).toEqual([]);
    expect([...categoriesToReveal(set, initiatives, deliverables, assets, new Set())]).toEqual([]);
  });

  it('keys an asset with no category the way the timeline does', () => {
    const loose = highlightSet({ kind: 'initiative', id: 'i-api' },
      [seg('s-l', 'd-loose', '2027-01-01', 'i-api')], initiatives);
    expect([...categoriesToReveal(loose, initiatives, deliverables, assets, new Set(['uncategorized']))])
      .toContain('uncategorized');
  });

  it('reveals nothing without a highlight', () => {
    expect([...categoriesToReveal(null, initiatives, deliverables, assets, new Set(['cat-core']))]).toEqual([]);
  });
});

describe('groupsToReveal (AC5)', () => {
  const set = highlightSet({ kind: 'initiative', id: 'i-api' }, segments, initiatives);
  const groups = [['i-idle', 'i-api'], ['i-x', 'i-y']];

  it('reveals the collapsed group holding the focused initiative, keyed as the timeline keys it', () => {
    expect([...groupsToReveal(set, groups, ['i-api|i-idle', 'i-x|i-y'])]).toEqual(['i-api|i-idle']);
  });

  it('leaves a group that is already expanded alone', () => {
    expect([...groupsToReveal(set, groups, ['i-x|i-y'])]).toEqual([]);
  });

  it('does not reorder the caller’s group arrays while keying them', () => {
    // Timeline keys a group with g.sort(), which mutates; this must not.
    const g = [['i-idle', 'i-api']];
    groupsToReveal(set, g, ['i-api|i-idle']);
    expect(g[0]).toEqual(['i-idle', 'i-api']);
  });

  it('reveals nothing without a highlight', () => {
    expect([...groupsToReveal(null, groups, ['i-api|i-idle'])]).toEqual([]);
  });
});
