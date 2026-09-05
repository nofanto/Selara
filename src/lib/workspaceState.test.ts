import { describe, expect, it } from 'vitest';
import { buildRestoredWorkspace, isWorkspaceEmpty } from './workspaceState';
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
