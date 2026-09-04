import { describe, expect, it } from 'vitest';
import { computeDiff } from './diff';
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
      resources: [],
      deliverableStatuses: [],
      ...overrides,
    },
  };
}

describe('computeDiff', () => {
  it('reports asset changes as workspace changes', () => {
    const base = makeVersion({
      assets: [{ id: 'asset-1', name: 'Core Platform', categoryId: 'cat-1' }],
    });
    const current = {
      ...base.data,
      assets: [{ id: 'asset-1', name: 'Core Platform v2', categoryId: 'cat-1' }],
    };

    const diff = computeDiff(base, current);

    expect(diff.hasChanges).toBe(true);
    expect((diff as any).assets.added).toEqual([]);
    expect((diff as any).assets.removed).toEqual([]);
    expect((diff as any).assets.modified).toEqual([
      {
        id: 'asset-1',
        name: 'Core Platform v2',
        asset: { id: 'asset-1', name: 'Core Platform v2' },
        changes: ['Renamed from "Core Platform" to "Core Platform v2"'],
      },
    ]);
  });

  it('reports programme changes as workspace changes', () => {
    const base = makeVersion({
      programmes: [{ id: 'prog-1', name: 'Delivery', color: 'blue' }],
    });
    const current = {
      ...base.data,
      programmes: [{ id: 'prog-1', name: 'Delivery Plus', color: 'blue' }],
    };

    const diff = computeDiff(base, current);

    expect(diff.hasChanges).toBe(true);
    expect((diff as any).programmes.modified).toEqual([
      {
        id: 'prog-1',
        name: 'Delivery Plus',
        changes: ['Renamed from "Delivery" to "Delivery Plus"'],
      },
    ]);
  });

  it('reports strategy changes as workspace changes', () => {
    const base = makeVersion({
      strategies: [{ id: 'strat-1', name: 'Modernise', color: 'green' }],
    });
    const current = {
      ...base.data,
      strategies: [{ id: 'strat-1', name: 'Modernise Fast', color: 'green' }],
    };

    const diff = computeDiff(base, current);

    expect(diff.hasChanges).toBe(true);
    expect((diff as any).strategies.modified).toEqual([
      {
        id: 'strat-1',
        name: 'Modernise Fast',
        changes: ['Renamed from "Modernise" to "Modernise Fast"'],
      },
    ]);
  });

  it('reports deliverable changes, including type and asset moves', () => {
    const base = makeVersion({
      assets: [
        { id: 'asset-1', name: 'Core Platform', categoryId: 'cat-1' },
        { id: 'asset-2', name: 'Edge Gateway', categoryId: 'cat-1' },
      ],
      deliverables: [{ id: 'app-1', assetId: 'asset-1', name: 'Ledger Service', type: 'application' }],
    });
    const current: Version['data'] = {
      ...base.data,
      deliverables: [{ id: 'app-1', assetId: 'asset-2', name: 'Ledger Service', type: 'infrastructure' }],
    };

    const diff = computeDiff(base, current);

    expect(diff.hasChanges).toBe(true);
    expect(diff.deliverables.modified).toEqual([
      {
        id: 'app-1',
        name: 'Ledger Service',
        asset: { id: 'asset-2', name: 'Edge Gateway' },
        deliverable: { id: 'app-1', name: 'Ledger Service' },
        changes: [
          'Type: application → infrastructure',
          'Moved from Asset "Core Platform" to "Edge Gateway"',
        ],
      },
    ]);
  });

  it('reports deliverable segment status and date changes by resolved status name', () => {
    const base = makeVersion({
      deliverables: [{ id: 'app-1', assetId: 'asset-1', name: 'Ledger Service', type: 'application' }],
      deliverableStatuses: [
        { id: 'status-planned', name: 'Planned', color: 'slate' },
        { id: 'status-live', name: 'Live', color: 'green', isLiveStatus: true },
      ],
      deliverableSegments: [
        { id: 'seg-1', deliverableId: 'app-1', startDate: '2026-01-01', endDate: '2026-03-01', status: 'status-planned' },
      ],
    });
    const current = {
      ...base.data,
      deliverableSegments: [
        { id: 'seg-1', deliverableId: 'app-1', startDate: '2026-01-01', endDate: '2026-04-01', status: 'status-live' },
      ],
    };

    const diff = computeDiff(base, current);

    expect(diff.hasChanges).toBe(true);
    expect(diff.deliverableSegments.modified).toEqual([
      {
        id: 'seg-1',
        name: 'Ledger Service (2026-01-01 → 2026-04-01)',
        asset: { id: 'asset-1', name: 'Unknown asset' },
        deliverable: { id: 'app-1', name: 'Ledger Service' },
        changes: [
          'End date: 2026-03-01 → 2026-04-01',
          'Status: Planned → Live',
        ],
      },
    ]);
  });

  it('reports deliverable status flag changes', () => {
    const base = makeVersion({
      deliverableStatuses: [{ id: 'status-planned', name: 'Planned', color: 'slate' }],
    });
    const current = {
      ...base.data,
      deliverableStatuses: [{ id: 'status-planned', name: 'Planned', color: 'slate', isPreLaunchStatus: true }],
    };

    const diff = computeDiff(base, current);

    expect(diff.deliverableStatuses.modified).toEqual([
      { id: 'status-planned', name: 'Planned', changes: ['Pre-launch status flag: off → on'] },
    ]);
  });

  it('reports resource role changes', () => {
    const base = makeVersion({
      resources: [{ id: 'res-1', name: 'Jane Smith', role: 'Business Analyst' }],
    });
    const current = {
      ...base.data,
      resources: [{ id: 'res-1', name: 'Jane Smith', role: 'Product Manager' }],
    };

    const diff = computeDiff(base, current);

    expect(diff.hasChanges).toBe(true);
    expect(diff.resources.modified).toEqual([
      {
        id: 'res-1',
        name: 'Jane Smith',
        changes: ['Role: Business Analyst → Product Manager'],
      },
    ]);
  });

  it('reports asset category renames and order changes', () => {
    const base = makeVersion({
      assetCategories: [{ id: 'cat-1', name: 'Infrastructure', order: 1 }],
    });
    const current = {
      ...base.data,
      assetCategories: [{ id: 'cat-1', name: 'Core Infrastructure', order: 2 }],
    };

    const diff = computeDiff(base, current);

    expect(diff.hasChanges).toBe(true);
    expect(diff.assetCategories.modified).toEqual([
      {
        id: 'cat-1',
        name: 'Core Infrastructure',
        changes: [
          'Renamed from "Infrastructure" to "Core Infrastructure"',
          'Order: 1 → 2',
        ],
      },
    ]);
  });

  it('reports decision status and outcome changes', () => {
    const base = makeVersion({
      decisions: [{ id: 'dec-1', title: 'Adopt microservices', status: 'proposed', createdAt: '2026-01-01T00:00:00.000Z' }],
    });
    const current: Version['data'] = {
      ...base.data,
      decisions: [{ id: 'dec-1', title: 'Adopt microservices', status: 'accepted', createdAt: '2026-01-01T00:00:00.000Z', decisionOutcome: 'Proceed with phased rollout' }],
    };

    const diff = computeDiff(base, current);

    expect(diff.hasChanges).toBe(true);
    expect(diff.decisions.modified).toEqual([
      {
        id: 'dec-1',
        name: 'Adopt microservices',
        changes: ['Status: proposed → accepted', 'Decision outcome updated'],
      },
    ]);
  });

  it('reports RPTI detail changes, naming the row by initiative and target', () => {
    const base = makeVersion({
      initiatives: [{ id: 'init-1', name: 'Core Banking Upgrade', programmeId: 'prog-1', assetId: 'asset-1', startDate: '2026-01-01', endDate: '2026-06-01', capex: 0, opex: 0 }],
      deliverables: [{ id: 'app-1', assetId: 'asset-1', name: 'Ledger Service' }],
      rptiDetails: [{
        id: 'rpti-1', initiativeId: 'init-1', targetType: 'deliverable', targetId: 'app-1',
        categoryCode: '01', developmentType: 'new', developer: 'inhouse', ppjtiRelatedParty: 'no',
      }],
    });
    const current: Version['data'] = {
      ...base.data,
      rptiDetails: [{
        id: 'rpti-1', initiativeId: 'init-1', targetType: 'deliverable', targetId: 'app-1',
        categoryCode: '01', developmentType: 'upgrade', developer: 'PPJTI', ppjtiRelatedParty: 'yes',
      }],
    };

    const diff = computeDiff(base, current);

    expect(diff.hasChanges).toBe(true);
    expect(diff.rptiDetails.modified).toEqual([
      {
        id: 'rpti-1',
        name: 'Core Banking Upgrade → Ledger Service',
        asset: { id: 'asset-1', name: 'Unknown asset' },
        deliverable: { id: 'app-1', name: 'Ledger Service' },
        changes: [
          'Development type: new → upgrade',
          'Developer: inhouse → PPJTI',
          'PPJTI related party: no → yes',
        ],
      },
    ]);
  });

  it('does not report changes for entity types that are identical across versions', () => {
    const base = makeVersion({
      resources: [{ id: 'res-1', name: 'Jane Smith', role: 'Business Analyst' }],
      rptiDetails: [],
      decisions: [],
    });
    const current = { ...base.data };

    const diff = computeDiff(base, current);

    expect(diff.hasChanges).toBe(false);
    expect(diff.resources.modified).toEqual([]);
    expect(diff.rptiDetails.modified).toEqual([]);
    expect(diff.decisions.modified).toEqual([]);
  });
});

describe('computeDiff — entity identity', () => {
  it('carries the entity id on added, removed and modified entries alike', () => {
    const base = makeVersion({
      assets: [
        { id: 'asset-1', name: 'Core Platform', categoryId: 'cat-1' },
        { id: 'asset-2', name: 'Retired Thing', categoryId: 'cat-1' },
      ],
    });
    const current: Version['data'] = {
      ...base.data,
      assets: [
        { id: 'asset-1', name: 'Core Platform v2', categoryId: 'cat-1' },
        { id: 'asset-3', name: 'New Thing', categoryId: 'cat-1' },
      ],
    };

    const diff = computeDiff(base, current);

    expect(diff.assets.added).toEqual([
      { id: 'asset-3', name: 'New Thing', asset: { id: 'asset-3', name: 'New Thing' } },
    ]);
    expect(diff.assets.removed).toEqual([
      { id: 'asset-2', name: 'Retired Thing', asset: { id: 'asset-2', name: 'Retired Thing' } },
    ]);
    expect(diff.assets.modified).toEqual([
      {
        id: 'asset-1',
        name: 'Core Platform v2',
        asset: { id: 'asset-1', name: 'Core Platform v2' },
        changes: ['Renamed from "Core Platform" to "Core Platform v2"'],
      },
    ]);
  });

  it('resolves the owning asset, with its name, for initiatives, deliverables and milestones', () => {
    const base = makeVersion({
      assets: [{ id: 'asset-1', name: 'Core Platform', categoryId: 'cat-1' }],
      initiatives: [{ id: 'init-1', assetId: 'asset-1', name: 'Ledger Rewrite', programmeId: 'prog-1', capex: 0, opex: 0, startDate: '2026-01-01', endDate: '2026-06-01' }],
      deliverables: [{ id: 'app-1', assetId: 'asset-1', name: 'Ledger Service', type: 'application' }],
      milestones: [{ id: 'ms-1', assetId: 'asset-1', name: 'Go Live', date: '2026-06-01', type: 'info' }],
    });
    const current: Version['data'] = {
      ...base.data,
      initiatives: [{ id: 'init-1', assetId: 'asset-1', name: 'Ledger Rewrite II', programmeId: 'prog-1', capex: 0, opex: 0, startDate: '2026-01-01', endDate: '2026-06-01' }],
      deliverables: [{ id: 'app-1', assetId: 'asset-1', name: 'Ledger Service v2', type: 'application' }],
      milestones: [{ id: 'ms-1', assetId: 'asset-1', name: 'Go Live', date: '2026-07-01', type: 'info' }],
    };

    const diff = computeDiff(base, current);

    const asset = { id: 'asset-1', name: 'Core Platform' };
    expect(diff.initiatives.modified[0]).toMatchObject({ id: 'init-1', asset });
    expect(diff.deliverables.modified[0]).toMatchObject({ id: 'app-1', asset });
    expect(diff.milestones.modified[0]).toMatchObject({ id: 'ms-1', asset });
  });

  it('resolves both owners through the deliverable for segments and LKPTI rows', () => {
    const base = makeVersion({
      assets: [{ id: 'asset-1', name: 'Core Platform', categoryId: 'cat-1' }],
      deliverables: [{ id: 'app-1', assetId: 'asset-1', name: 'Ledger Service', type: 'application' }],
      deliverableStatuses: [{ id: 'status-planned', name: 'Planned', color: 'slate' }],
      deliverableSegments: [
        { id: 'seg-1', deliverableId: 'app-1', startDate: '2026-01-01', endDate: '2026-03-01', status: 'status-planned' },
      ],
      lkptiDetails: [{ id: 'lk-1', targetId: 'app-1', categoryCode: '11', developer: 'inhouse', systemOwner: 'Ops' }],
    });
    const current: Version['data'] = {
      ...base.data,
      deliverableSegments: [
        { id: 'seg-1', deliverableId: 'app-1', startDate: '2026-01-01', endDate: '2026-04-01', status: 'status-planned' },
      ],
      lkptiDetails: [{ id: 'lk-1', targetId: 'app-1', categoryCode: '11', developer: 'inhouse', systemOwner: 'Platform Ops' }],
    };

    const diff = computeDiff(base, current);

    const owners = {
      asset: { id: 'asset-1', name: 'Core Platform' },
      deliverable: { id: 'app-1', name: 'Ledger Service' },
    };
    expect(diff.deliverableSegments.modified[0]).toMatchObject({ id: 'seg-1', ...owners });
    expect(diff.lkptiDetails.modified[0]).toMatchObject({ id: 'lk-1', ...owners });
  });

  it('resolves owners for RPTI rows targeting an asset directly and via a deliverable', () => {
    const base = makeVersion({
      assets: [{ id: 'asset-1', name: 'Core Platform', categoryId: 'cat-1' }],
      deliverables: [{ id: 'app-1', assetId: 'asset-1', name: 'Ledger Service', type: 'application' }],
      initiatives: [{ id: 'init-1', assetId: 'asset-1', name: 'Ledger Rewrite', programmeId: 'prog-1', capex: 0, opex: 0, startDate: '2026-01-01', endDate: '2026-06-01' }],
      rptiDetails: [
        { id: 'rpti-1', initiativeId: 'init-1', targetType: 'deliverable', targetId: 'app-1', categoryCode: '11', developmentType: 'new', developer: 'inhouse', ppjtiRelatedParty: 'n/a', remarks: 'before' },
        { id: 'rpti-2', initiativeId: 'init-1', targetType: 'asset', targetId: 'asset-1', categoryCode: '11', developmentType: 'new', developer: 'inhouse', ppjtiRelatedParty: 'n/a', remarks: 'before' },
      ],
    });
    const current: Version['data'] = {
      ...base.data,
      rptiDetails: [
        { id: 'rpti-1', initiativeId: 'init-1', targetType: 'deliverable', targetId: 'app-1', categoryCode: '11', developmentType: 'new', developer: 'inhouse', ppjtiRelatedParty: 'n/a', remarks: 'after' },
        { id: 'rpti-2', initiativeId: 'init-1', targetType: 'asset', targetId: 'asset-1', categoryCode: '11', developmentType: 'new', developer: 'inhouse', ppjtiRelatedParty: 'n/a', remarks: 'after' },
      ],
    };

    const diff = computeDiff(base, current);

    // An asset-targeted row has no deliverable to cluster under; it belongs at the
    // top of the asset's group alongside initiatives and milestones.
    expect(diff.rptiDetails.modified[0]).toMatchObject({
      id: 'rpti-1',
      asset: { id: 'asset-1', name: 'Core Platform' },
      deliverable: { id: 'app-1', name: 'Ledger Service' },
    });
    expect(diff.rptiDetails.modified[1]).toMatchObject({
      id: 'rpti-2',
      asset: { id: 'asset-1', name: 'Core Platform' },
    });
    expect(diff.rptiDetails.modified[1].deliverable).toBeUndefined();
  });

  it('names both owners from the baseline when they have since been deleted', () => {
    const base = makeVersion({
      assets: [{ id: 'asset-1', name: 'Core Platform', categoryId: 'cat-1' }],
      deliverables: [{ id: 'app-1', assetId: 'asset-1', name: 'Ledger Service', type: 'application' }],
      deliverableStatuses: [{ id: 'status-planned', name: 'Planned', color: 'slate' }],
      deliverableSegments: [
        { id: 'seg-1', deliverableId: 'app-1', startDate: '2026-01-01', endDate: '2026-03-01', status: 'status-planned' },
      ],
      lkptiDetails: [{ id: 'lk-1', targetId: 'app-1', categoryCode: '11', developer: 'inhouse', systemOwner: 'Ops' }],
    });
    const current: Version['data'] = {
      ...base.data,
      assets: [],
      deliverables: [],
      deliverableSegments: [],
      lkptiDetails: [],
    };

    const diff = computeDiff(base, current);

    // Everything here is gone from the current workspace, so only the baseline can
    // name the group and the cluster these removals belong to — and removals are
    // exactly what a catch-up summary must not drop on the floor.
    const owners = {
      asset: { id: 'asset-1', name: 'Core Platform' },
      deliverable: { id: 'app-1', name: 'Ledger Service' },
    };
    expect(diff.deliverables.removed).toEqual([
      { id: 'app-1', name: 'Ledger Service', ...owners },
    ]);
    expect(diff.deliverableSegments.removed[0]).toMatchObject({ id: 'seg-1', ...owners });
    expect(diff.lkptiDetails.removed[0]).toMatchObject({ id: 'lk-1', ...owners });
  });

  it('falls back to a placeholder name when an asset id resolves to no asset record', () => {
    const base = makeVersion({
      // No matching Asset row for 'asset-ghost' in either snapshot.
      milestones: [{ id: 'ms-1', assetId: 'asset-ghost', name: 'Go Live', date: '2026-06-01', type: 'info' }],
    });
    const current: Version['data'] = {
      ...base.data,
      milestones: [{ id: 'ms-1', assetId: 'asset-ghost', name: 'Go Live', date: '2026-07-01', type: 'info' }],
    };

    const diff = computeDiff(base, current);

    // The id still groups correctly; only the heading degrades.
    expect(diff.milestones.modified[0]).toMatchObject({
      asset: { id: 'asset-ghost', name: 'Unknown asset' },
    });
  });

  it('leaves both owners unset for portfolio-level types and for dependencies', () => {
    const base = makeVersion({
      assets: [
        { id: 'asset-1', name: 'Core Platform', categoryId: 'cat-1' },
        { id: 'asset-2', name: 'Edge Gateway', categoryId: 'cat-1' },
      ],
      initiatives: [
        { id: 'init-1', assetId: 'asset-1', name: 'Ledger Rewrite', programmeId: 'prog-1', capex: 0, opex: 0, startDate: '2026-01-01', endDate: '2026-06-01' },
        { id: 'init-2', assetId: 'asset-2', name: 'Gateway Upgrade', programmeId: 'prog-1', capex: 0, opex: 0, startDate: '2026-01-01', endDate: '2026-06-01' },
      ],
      programmes: [{ id: 'prog-1', name: 'Modernisation', color: 'blue' }],
      resources: [{ id: 'res-1', name: 'Jane Smith', role: 'BA' }],
      dependencies: [{ id: 'dep-1', sourceId: 'init-1', targetId: 'init-2', type: 'blocks' }],
    });
    const current: Version['data'] = {
      ...base.data,
      programmes: [{ id: 'prog-1', name: 'Modernisation 2026', color: 'blue' }],
      resources: [{ id: 'res-1', name: 'Jane Smith', role: 'Product Owner' }],
      dependencies: [{ id: 'dep-1', sourceId: 'init-1', targetId: 'init-2', type: 'requires' }],
    };

    const diff = computeDiff(base, current);

    expect(diff.programmes.modified[0]).toMatchObject({ id: 'prog-1' });
    expect(diff.programmes.modified[0].asset).toBeUndefined();
    expect(diff.resources.modified[0].asset).toBeUndefined();
    // A dependency joins two initiatives that may sit under different assets,
    // so it has no single owning asset.
    expect(diff.dependencies.modified[0]).toMatchObject({ id: 'dep-1' });
    expect(diff.dependencies.modified[0].asset).toBeUndefined();
    expect(diff.dependencies.modified[0].deliverable).toBeUndefined();
  });
});
