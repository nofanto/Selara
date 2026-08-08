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
      applications: [],
      applicationSegments: [],
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
      applicationStatuses: [],
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
        name: 'Core Platform v2',
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
        name: 'Modernise Fast',
        changes: ['Renamed from "Modernise" to "Modernise Fast"'],
      },
    ]);
  });

  it('reports deliverable (application) changes, including type and asset moves', () => {
    const base = makeVersion({
      assets: [
        { id: 'asset-1', name: 'Core Platform', categoryId: 'cat-1' },
        { id: 'asset-2', name: 'Edge Gateway', categoryId: 'cat-1' },
      ],
      applications: [{ id: 'app-1', assetId: 'asset-1', name: 'Ledger Service', type: 'application' }],
    });
    const current = {
      ...base.data,
      applications: [{ id: 'app-1', assetId: 'asset-2', name: 'Ledger Service', type: 'infrastructure' }],
    };

    const diff = computeDiff(base, current);

    expect(diff.hasChanges).toBe(true);
    expect(diff.applications.modified).toEqual([
      {
        name: 'Ledger Service',
        changes: [
          'Type: application → infrastructure',
          'Moved from Asset "Core Platform" to "Edge Gateway"',
        ],
      },
    ]);
  });

  it('reports deliverable segment status and date changes by resolved status name', () => {
    const base = makeVersion({
      applications: [{ id: 'app-1', assetId: 'asset-1', name: 'Ledger Service', type: 'application' }],
      applicationStatuses: [
        { id: 'status-planned', name: 'Planned', color: 'slate' },
        { id: 'status-live', name: 'Live', color: 'green', isLiveStatus: true },
      ],
      applicationSegments: [
        { id: 'seg-1', applicationId: 'app-1', startDate: '2026-01-01', endDate: '2026-03-01', status: 'status-planned' },
      ],
    });
    const current = {
      ...base.data,
      applicationSegments: [
        { id: 'seg-1', applicationId: 'app-1', startDate: '2026-01-01', endDate: '2026-04-01', status: 'status-live' },
      ],
    };

    const diff = computeDiff(base, current);

    expect(diff.hasChanges).toBe(true);
    expect(diff.applicationSegments.modified).toEqual([
      {
        name: 'Ledger Service (2026-01-01 → 2026-04-01)',
        changes: [
          'End date: 2026-03-01 → 2026-04-01',
          'Status: Planned → Live',
        ],
      },
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
    const current = {
      ...base.data,
      decisions: [{ id: 'dec-1', title: 'Adopt microservices', status: 'accepted', createdAt: '2026-01-01T00:00:00.000Z', decisionOutcome: 'Proceed with phased rollout' }],
    };

    const diff = computeDiff(base, current);

    expect(diff.hasChanges).toBe(true);
    expect(diff.decisions.modified).toEqual([
      {
        name: 'Adopt microservices',
        changes: ['Status: proposed → accepted', 'Decision outcome updated'],
      },
    ]);
  });

  it('reports RPTI detail changes, naming the row by initiative and target', () => {
    const base = makeVersion({
      initiatives: [{ id: 'init-1', name: 'Core Banking Upgrade', programmeId: 'prog-1', assetId: 'asset-1', startDate: '2026-01-01', endDate: '2026-06-01', capex: 0, opex: 0 }],
      applications: [{ id: 'app-1', assetId: 'asset-1', name: 'Ledger Service' }],
      rptiDetails: [{
        id: 'rpti-1', initiativeId: 'init-1', targetType: 'application', targetId: 'app-1',
        categoryCode: '01', developmentType: 'new', developer: 'inhouse', ppjtiRelatedParty: 'no',
      }],
    });
    const current = {
      ...base.data,
      rptiDetails: [{
        id: 'rpti-1', initiativeId: 'init-1', targetType: 'application', targetId: 'app-1',
        categoryCode: '01', developmentType: 'upgrade', developer: 'PPJTI', ppjtiRelatedParty: 'yes',
      }],
    };

    const diff = computeDiff(base, current);

    expect(diff.hasChanges).toBe(true);
    expect(diff.rptiDetails.modified).toEqual([
      {
        name: 'Core Banking Upgrade → Ledger Service',
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
