import { describe, expect, it } from 'vitest';
import { computeDiff } from './diff';
import { summarizeDiff } from './diffSummary';
import type { Version } from '../types';

function makeVersion(overrides: Partial<Version['data']> = {}): Version {
  return {
    id: 'ver-base',
    name: 'Baseline',
    timestamp: '2026-05-22T00:00:00.000Z',
    data: {
      assets: [],
      deliverables: [],
      deliverableSegments: [],
      initiatives: [],
      milestones: [],
      programmes: [],
      strategies: [],
      dependencies: [],
      assetCategories: [],
      resources: [],
      deliverableStatuses: [],
      timelineSettings: {
        startDate: '2026-01-01',
        monthsToShow: 12,
        budgetVisualisation: 'off',
        descriptionDisplay: 'off',
        emptyRowDisplay: 'show',
        snapToPeriod: 'off',
        conflictDetection: 'on',
        showRelationships: 'on',
        criticalPath: 'off',
        showResources: 'off',
        display: 'both',
      },
      ...overrides,
    },
  };
}

const summarise = (base: Version, current: Version['data']) => summarizeDiff(computeDiff(base, current));

const initiative = (id: string, assetId: string, name: string, over: Record<string, unknown> = {}) => ({
  id, assetId, name, programmeId: 'prog-1', capex: 0, opex: 0,
  startDate: '2026-01-01', endDate: '2026-06-01', ...over,
});

describe('summarizeDiff — grouping', () => {
  it('groups changes under their owning asset, titled with the asset name', () => {
    const base = makeVersion({
      assets: [
        { id: 'asset-1', name: 'Core Ledger', categoryId: 'cat-1' },
        { id: 'asset-2', name: 'Mobile Banking', categoryId: 'cat-1' },
      ],
      initiatives: [initiative('init-1', 'asset-1', 'Ledger Rewrite')],
      milestones: [{ id: 'ms-1', assetId: 'asset-2', name: 'App Store Launch', date: '2026-06-01', type: 'info' }],
    });
    const current: Version['data'] = {
      ...base.data,
      initiatives: [initiative('init-1', 'asset-1', 'Ledger Rewrite', { endDate: '2026-09-01' })],
      milestones: [{ id: 'ms-1', assetId: 'asset-2', name: 'App Store Launch', date: '2026-07-01', type: 'info' }],
    };

    const summary = summarise(base, current);

    expect(summary.groups.map(g => g.title)).toEqual(['Core Ledger', 'Mobile Banking']);
    expect(summary.groups[0].asset).toEqual({ id: 'asset-1', name: 'Core Ledger' });
    expect(summary.groups[0].changes.map(c => c.id)).toEqual(['init-1']);
    expect(summary.groups[1].changes.map(c => c.id)).toEqual(['ms-1']);
  });

  it('collects asset-less changes into a portfolio group that always sorts last', () => {
    const base = makeVersion({
      assets: [{ id: 'asset-1', name: 'Core Ledger', categoryId: 'cat-1' }],
      programmes: [{ id: 'prog-1', name: 'Modernisation', color: 'blue' }],
      resources: [{ id: 'res-1', name: 'Jane Smith', role: 'BA' }],
      initiatives: [initiative('init-1', 'asset-1', 'Ledger Rewrite')],
    });
    const current: Version['data'] = {
      ...base.data,
      // A rename is not cosmetic; a colour change would be.
      programmes: [{ id: 'prog-1', name: 'Modernisation 2026', color: 'blue' }],
      resources: [{ id: 'res-1', name: 'Jane Smith', role: 'Product Owner' }],
      initiatives: [initiative('init-1', 'asset-1', 'Ledger Rewrite', { endDate: '2026-09-01' })],
    };

    const summary = summarise(base, current);

    const last = summary.groups[summary.groups.length - 1];
    expect(last.asset).toBeUndefined();
    expect(last.title).toBe('Portfolio-level');
    expect(last.changes.map(c => c.id).sort()).toEqual(['prog-1', 'res-1']);
  });
});

describe('summarizeDiff — clustering within a group', () => {
  const base = makeVersion({
    assets: [{ id: 'asset-1', name: 'Core Ledger', categoryId: 'cat-1' }],
    deliverables: [
      { id: 'app-1', assetId: 'asset-1', name: 'Ledger Service', type: 'application' },
      { id: 'app-2', assetId: 'asset-1', name: 'Batch Poster', type: 'application' },
    ],
    deliverableStatuses: [{ id: 'status-planned', name: 'Planned', color: 'slate' }],
    deliverableSegments: [
      { id: 'seg-1', deliverableId: 'app-1', startDate: '2026-01-01', endDate: '2026-03-01', status: 'status-planned' },
      { id: 'seg-2', deliverableId: 'app-1', startDate: '2026-03-01', endDate: '2026-06-01', status: 'status-planned' },
      { id: 'seg-3', deliverableId: 'app-2', startDate: '2026-01-01', endDate: '2026-03-01', status: 'status-planned' },
    ],
    initiatives: [initiative('init-1', 'asset-1', 'Ledger Rewrite')],
  });

  it('keeps rows about the same deliverable together, under that deliverable name', () => {
    const current: Version['data'] = {
      ...base.data,
      deliverables: [
        { id: 'app-1', assetId: 'asset-1', name: 'Ledger Service v2', type: 'application' },
        { id: 'app-2', assetId: 'asset-1', name: 'Batch Poster', type: 'application' },
      ],
      deliverableSegments: [
        { id: 'seg-1', deliverableId: 'app-1', startDate: '2026-01-01', endDate: '2026-04-01', status: 'status-planned' },
        { id: 'seg-2', deliverableId: 'app-1', startDate: '2026-04-01', endDate: '2026-06-01', status: 'status-planned' },
        { id: 'seg-3', deliverableId: 'app-2', startDate: '2026-01-01', endDate: '2026-05-01', status: 'status-planned' },
      ],
    };

    const [group] = summarise(base, current).groups;

    expect(group.clusters.map(c => c.title)).toEqual(['Ledger Service v2', 'Batch Poster']);
    expect(group.clusters[0].deliverable).toEqual({ id: 'app-1', name: 'Ledger Service v2' });
    expect(group.clusters[0].changes.map(c => c.id)).toEqual(['app-1', 'seg-1', 'seg-2']);
    expect(group.clusters[1].changes.map(c => c.id)).toEqual(['seg-3']);
  });

  it('holds changes with no deliverable in the group head, above the clusters', () => {
    const current: Version['data'] = {
      ...base.data,
      initiatives: [initiative('init-1', 'asset-1', 'Ledger Rewrite', { endDate: '2026-09-01' })],
      deliverableSegments: [
        { id: 'seg-1', deliverableId: 'app-1', startDate: '2026-01-01', endDate: '2026-04-01', status: 'status-planned' },
        ...base.data.deliverableSegments.slice(1),
      ],
    };

    const [group] = summarise(base, current).groups;

    expect(group.changes.map(c => c.id)).toEqual(['init-1']);
    expect(group.clusters.map(c => c.title)).toEqual(['Ledger Service']);
  });
});

describe('summarizeDiff — significance ranking', () => {
  it('ranks groups by their most significant change: filing, then scope, then the rest', () => {
    const base = makeVersion({
      assets: [
        { id: 'asset-rest', name: 'Aaa Rest', categoryId: 'cat-1' },
        { id: 'asset-scope', name: 'Bbb Scope', categoryId: 'cat-1' },
        { id: 'asset-filing', name: 'Ccc Filing', categoryId: 'cat-1' },
      ],
      deliverables: [{ id: 'app-f', assetId: 'asset-filing', name: 'Filing App', type: 'application' }],
      milestones: [{ id: 'ms-1', assetId: 'asset-rest', name: 'Audit', date: '2026-06-01', type: 'info' }],
      lkptiDetails: [{ id: 'lk-1', targetId: 'app-f', categoryCode: '11', developer: 'inhouse', systemOwner: 'Ops' }],
    });
    const current: Version['data'] = {
      ...base.data,
      // tier 3: a date moved
      milestones: [{ id: 'ms-1', assetId: 'asset-rest', name: 'Audit', date: '2026-07-01', type: 'info' }],
      // tier 2: something added
      initiatives: [initiative('init-new', 'asset-scope', 'New Programme of Work')],
      // tier 1: a filing field edited
      lkptiDetails: [{ id: 'lk-1', targetId: 'app-f', categoryCode: '11', developer: 'inhouse', systemOwner: 'Platform Ops' }],
    };

    const summary = summarise(base, current);

    expect(summary.groups.map(g => g.title)).toEqual(['Ccc Filing', 'Bbb Scope', 'Aaa Rest']);
    expect(summary.groups.map(g => g.tier)).toEqual([1, 2, 3]);
  });

  it('ranks clusters inside a group the same way', () => {
    const base = makeVersion({
      assets: [{ id: 'asset-1', name: 'Core Ledger', categoryId: 'cat-1' }],
      deliverables: [
        { id: 'app-rest', assetId: 'asset-1', name: 'Aaa Rest', type: 'application' },
        { id: 'app-filing', assetId: 'asset-1', name: 'Zzz Filing', type: 'application' },
      ],
      lkptiDetails: [{ id: 'lk-1', targetId: 'app-filing', categoryCode: '11', developer: 'inhouse', systemOwner: 'Ops' }],
    });
    const current: Version['data'] = {
      ...base.data,
      deliverables: [
        { id: 'app-rest', assetId: 'asset-1', name: 'Aaa Rest renamed', type: 'application' },
        { id: 'app-filing', assetId: 'asset-1', name: 'Zzz Filing', type: 'application' },
      ],
      lkptiDetails: [{ id: 'lk-1', targetId: 'app-filing', categoryCode: '11', developer: 'inhouse', systemOwner: 'Platform Ops' }],
    };

    const [group] = summarise(base, current).groups;

    expect(group.clusters.map(c => c.title)).toEqual(['Zzz Filing', 'Aaa Rest renamed']);
    expect(group.clusters.map(c => c.tier)).toEqual([1, 3]);
  });

  it('breaks ties between equal-tier groups on change count, then title', () => {
    const base = makeVersion({
      assets: [
        { id: 'asset-a', name: 'Aaa One Change', categoryId: 'cat-1' },
        { id: 'asset-b', name: 'Bbb One Change', categoryId: 'cat-1' },
        { id: 'asset-c', name: 'Ccc Two Changes', categoryId: 'cat-1' },
      ],
      milestones: [
        { id: 'ms-a', assetId: 'asset-a', name: 'A', date: '2026-06-01', type: 'info' },
        { id: 'ms-b', assetId: 'asset-b', name: 'B', date: '2026-06-01', type: 'info' },
        { id: 'ms-c1', assetId: 'asset-c', name: 'C1', date: '2026-06-01', type: 'info' },
        { id: 'ms-c2', assetId: 'asset-c', name: 'C2', date: '2026-06-01', type: 'info' },
      ],
    });
    const current: Version['data'] = {
      ...base.data,
      milestones: base.data.milestones.map(m => ({ ...m, date: '2026-07-01' })),
    };

    const summary = summarise(base, current);

    expect(summary.groups.map(g => g.title)).toEqual(['Ccc Two Changes', 'Aaa One Change', 'Bbb One Change']);
  });
});

describe('summarizeDiff — cosmetic changes', () => {
  it('drops cosmetic changes from the summary and reports how many were dropped', () => {
    const base = makeVersion({
      assets: [{ id: 'asset-1', name: 'Core Ledger', categoryId: 'cat-1' }],
      programmes: [{ id: 'prog-1', name: 'Modernisation', color: 'blue' }],
      assetCategories: [{ id: 'cat-1', name: 'Core', order: 1 }],
      milestones: [{ id: 'ms-1', assetId: 'asset-1', name: 'Audit', date: '2026-06-01', type: 'info' }],
    });
    const current: Version['data'] = {
      ...base.data,
      programmes: [{ id: 'prog-1', name: 'Modernisation', color: 'rose' }],
      assetCategories: [{ id: 'cat-1', name: 'Core', order: 9 }],
      milestones: [{ id: 'ms-1', assetId: 'asset-1', name: 'Audit', date: '2026-07-01', type: 'info' }],
    };

    const summary = summarise(base, current);

    expect(summary.cosmeticCount).toBe(2);
    expect(summary.groups).toHaveLength(1);
    expect(summary.groups[0].title).toBe('Core Ledger');
  });

  it('keeps a change that is cosmetic and substantive at once', () => {
    const base = makeVersion({ programmes: [{ id: 'prog-1', name: 'Modernisation', color: 'blue' }] });
    const current: Version['data'] = {
      ...base.data,
      programmes: [{ id: 'prog-1', name: 'Modernisation 2026', color: 'rose' }],
    };

    const summary = summarise(base, current);

    expect(summary.cosmeticCount).toBe(0);
    expect(summary.groups[0].changes[0].changes).toHaveLength(2);
  });

  it('returns no groups but a cosmetic count when every change was cosmetic', () => {
    const base = makeVersion({
      programmes: [{ id: 'prog-1', name: 'Modernisation', color: 'blue' }],
      strategies: [{ id: 'strat-1', name: 'Cloud First', color: 'sky' }],
      deliverableStatuses: [{ id: 'status-1', name: 'Planned', color: 'slate' }],
      assetCategories: [{ id: 'cat-1', name: 'Core', order: 1 }],
    });
    const current: Version['data'] = {
      ...base.data,
      programmes: [{ id: 'prog-1', name: 'Modernisation', color: 'rose' }],
      strategies: [{ id: 'strat-1', name: 'Cloud First', color: 'lime' }],
      deliverableStatuses: [{ id: 'status-1', name: 'Planned', color: 'gray' }],
      assetCategories: [{ id: 'cat-1', name: 'Core', order: 9 }],
    };

    const diff = computeDiff(base, current);
    const summary = summarizeDiff(diff);

    // computeDiff still reports changes; the summary must say where they went
    // rather than render as if nothing happened.
    expect(diff.hasChanges).toBe(true);
    expect(summary.groups).toEqual([]);
    expect(summary.cosmeticCount).toBe(4);
  });
});

describe('summarizeDiff — an added or removed asset', () => {
  const base = makeVersion({
    assets: [{ id: 'asset-1', name: 'Customer IAM', categoryId: 'cat-1' }],
    initiatives: [initiative('init-1', 'asset-1', 'Passkey Rollout'), initiative('init-2', 'asset-1', 'SSO Consolidation')],
    deliverables: [
      { id: 'app-1', assetId: 'asset-1', name: 'Okta', type: 'application' },
      { id: 'app-2', assetId: 'asset-1', name: 'Keycloak', type: 'application' },
    ],
    deliverableStatuses: [{ id: 'status-planned', name: 'Planned', color: 'slate' }],
    deliverableSegments: [
      { id: 'seg-1', deliverableId: 'app-1', startDate: '2026-01-01', endDate: '2026-03-01', status: 'status-planned' },
      { id: 'seg-2', deliverableId: 'app-2', startDate: '2026-01-01', endDate: '2026-03-01', status: 'status-planned' },
    ],
    lkptiDetails: [{ id: 'lk-1', targetId: 'app-1', categoryCode: '11', developer: 'inhouse', systemOwner: 'Ops' }],
  });

  it('collapses a removed asset to that one fact, with counts of what went with it', () => {
    const current: Version['data'] = {
      ...base.data,
      assets: [], initiatives: [], deliverables: [], deliverableSegments: [], lkptiDetails: [],
    };

    const summary = summarise(base, current);

    expect(summary.groups).toHaveLength(1);
    const [group] = summary.groups;
    expect(group.title).toBe('Customer IAM');
    expect(group.assetChange?.kind).toBe('removed');
    expect(group.assetChange?.childCounts.map(c => c.label)).toEqual([
      '2 initiatives', '2 deliverables', '2 segments', '1 LKPTI row',
    ]);
    // The children are summarised, not listed.
    expect(group.changes).toEqual([]);
    expect(group.clusters).toEqual([]);
  });

  it('collapses an added asset the same way', () => {
    const empty = makeVersion({ deliverableStatuses: base.data.deliverableStatuses });
    const summary = summarise(empty, base.data);

    expect(summary.groups).toHaveLength(1);
    expect(summary.groups[0].assetChange?.kind).toBe('added');
    expect(summary.groups[0].assetChange?.childCounts.map(c => c.label)).toEqual([
      '2 initiatives', '2 deliverables', '2 segments', '1 LKPTI row',
    ]);
  });

  it('does not collapse a group whose asset was merely modified', () => {
    const current: Version['data'] = {
      ...base.data,
      assets: [{ id: 'asset-1', name: 'Customer IAM (CIAM)', categoryId: 'cat-1' }],
    };

    const summary = summarise(base, current);

    expect(summary.groups[0].assetChange).toBeUndefined();
    expect(summary.groups[0].changes.map(c => c.id)).toEqual(['asset-1']);
  });
});

describe('summarizeDiff — deleted owners', () => {
  it('names a group and a cluster from the baseline when both owners were deleted', () => {
    const base = makeVersion({
      assets: [{ id: 'asset-1', name: 'Core Ledger', categoryId: 'cat-1' }],
      deliverables: [{ id: 'app-1', assetId: 'asset-1', name: 'Ledger Service', type: 'application' }],
      deliverableStatuses: [{ id: 'status-planned', name: 'Planned', color: 'slate' }],
      deliverableSegments: [
        { id: 'seg-1', deliverableId: 'app-1', startDate: '2026-01-01', endDate: '2026-03-01', status: 'status-planned' },
      ],
    });
    // The deliverable and its segment go; the asset stays, so the group is not collapsed.
    const current: Version['data'] = { ...base.data, deliverables: [], deliverableSegments: [] };

    const [group] = summarise(base, current).groups;

    expect(group.title).toBe('Core Ledger');
    expect(group.clusters.map(c => c.title)).toEqual(['Ledger Service']);
    expect(group.clusters[0].changes.map(c => c.kind)).toEqual(['removed', 'removed']);
  });
});
