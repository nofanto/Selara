import { describe, expect, it } from 'vitest';
import { buildRestoredWorkspace, isWorkspaceEmpty, summariseReplacement } from './workspaceState';
import type { Decision, Version } from '../types';

describe('isWorkspaceEmpty', () => {
  it('treats a brand new workspace as empty', () => {
    expect(
      isWorkspaceEmpty({
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
      }),
    ).toBe(true);
  });

  it('treats any persisted user data as non-empty', () => {
    expect(
      isWorkspaceEmpty({
        assets: [],
        deliverables: [],
        deliverableSegments: [],
        initiatives: [],
        milestones: [{ id: 'm1' }],
        programmes: [],
        strategies: [],
        dependencies: [],
        assetCategories: [],
        resources: [],
        deliverableStatuses: [],
      }),
    ).toBe(false);
  });

  it('does not rely only on assets and initiatives when other tables contain data', () => {
    expect(
      isWorkspaceEmpty({
        assets: [],
        deliverables: [{ id: 'app-1' }],
        deliverableSegments: [],
        initiatives: [],
        milestones: [],
        programmes: [],
        strategies: [],
        dependencies: [],
        assetCategories: [],
        resources: [],
        deliverableStatuses: [],
      }),
    ).toBe(false);
  });
});

describe('buildRestoredWorkspace', () => {
  const decision = (id: string, title: string): Decision => ({
    id,
    title,
    status: 'accepted',
    createdAt: '2026-06-01T00:00:00.000Z',
  });

  const version = (data: Partial<Version['data']> = {}): Version => ({
    id: 'ver-1',
    name: 'March baseline',
    timestamp: '2026-03-01T00:00:00.000Z',
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
      timelineSettings: {} as Version['data']['timelineSettings'],
      resources: [],
      ...data,
    },
  });

  it('keeps the live decision log, not the snapshot copy (ADR-0011)', () => {
    const live = [decision('dec-1', 'Defer the mobile programme'), decision('dec-2', 'Restore March baseline')];
    const restored = buildRestoredWorkspace(version({ decisions: [decision('dec-1', 'Defer the mobile programme')] }), live);

    expect(restored.decisions).toEqual(live);
  });

  it('preserves decisions recorded after the snapshot was taken', () => {
    // The regression this rule exists for: restoring a March snapshot must not
    // delete the June decision explaining why the restore happened.
    const live = [decision('dec-june', 'Roll back to March after the vendor pulled out')];
    const restored = buildRestoredWorkspace(version({ decisions: [] }), live);

    expect(restored.decisions).toHaveLength(1);
    expect(restored.decisions[0].id).toBe('dec-june');
  });

  it('leaves the log empty when the workspace has none', () => {
    expect(buildRestoredWorkspace(version(), []).decisions).toEqual([]);
  });

  it('still restores plan data from the snapshot', () => {
    const snapshot = version({ assets: [{ id: 'a-1', name: 'Core Banking', categoryId: 'cat-1' }] });
    const restored = buildRestoredWorkspace(snapshot, []);

    expect(restored.assets).toEqual([{ id: 'a-1', name: 'Core Banking', categoryId: 'cat-1' }]);
  });

  it('defaults the optional entity arrays a pre-v14 snapshot lacks', () => {
    const restored = buildRestoredWorkspace(version(), []);

    expect(restored.deliverableStatuses).toEqual([]);
    expect(restored.rptiDetails).toEqual([]);
    expect(restored.lkptiDetails).toEqual([]);
  });
});

describe('summariseReplacement', () => {
  const empty = {
    assets: [], deliverables: [], deliverableSegments: [], initiatives: [], milestones: [], programmes: [],
    strategies: [], dependencies: [], assetCategories: [], resources: [], deliverableStatuses: [],
    decisions: [], rptiDetails: [], lkptiDetails: [], versions: [],
  };
  const n = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `x-${i}` }));

  it('pairs current and incoming counts for each kind of record', () => {
    const summary = summariseReplacement(
      { ...empty, deliverables: n(42), initiatives: n(31) },
      { ...empty, deliverables: n(17), initiatives: n(12) },
    );

    expect(summary.rows).toEqual([
      { key: 'deliverables', label: 'Deliverables', current: 42, incoming: 17 },
      { key: 'initiatives', label: 'Initiatives', current: 31, incoming: 12 },
    ]);
  });

  it('omits kinds that are empty on both sides', () => {
    const summary = summariseReplacement({ ...empty, assets: n(1) }, empty);

    expect(summary.rows.map(r => r.key)).toEqual(['assets']);
  });

  // The whole point of #62: these are what a replacement destroys, even though
  // isWorkspaceEmpty() rightly ignores History when deciding whether to onboard.
  it.each(['versions', 'decisions', 'rptiDetails', 'lkptiDetails'] as const)(
    'counts %s as something the replacement would lose',
    (key) => {
      const summary = summariseReplacement({ ...empty, [key]: n(2) }, empty);

      expect(summary.losesData).toBe(true);
      expect(summary.rows).toEqual([expect.objectContaining({ key, current: 2, incoming: 0 })]);
    },
  );

  it('loses nothing when the current workspace is empty, whatever arrives', () => {
    const summary = summariseReplacement(empty, { ...empty, assets: n(3), versions: n(1) });

    expect(summary.losesData).toBe(false);
  });

  it('treats a missing optional list as empty', () => {
    const { versions: _v, deliverables: _d, ...legacy } = empty;

    expect(summariseReplacement(legacy, legacy)).toEqual({ rows: [], losesData: false });
  });
});
