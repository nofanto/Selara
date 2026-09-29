import { describe, expect, it } from 'vitest';
import { buildRestoredWorkspace, describeReplacementEffects, isWorkspaceEmpty, summariseReplacement } from './workspaceState';
import type { Decision, Version } from '../types';
import * as XLSX from 'xlsx';
import { createBackup, readBackupWorkbook } from './workspaceBackup';
import { fieldCompleteWorkspace } from './workspaceBackup.fixture';

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

  // Backup now carries each snapshot's archival decision copy (FR-002); History
  // restore must go on ignoring it in favour of the live log (FR-010).
  it('ignores the archival copy that a backup round trip preserved', () => {
    const restored = readBackupWorkbook(XLSX.read(createBackup(fieldCompleteWorkspace()).bytes, { type: 'array' }));
    if (restored.status !== 'complete') throw new Error(restored.status);
    const snapshot = restored.workspace.versions.find(v => v.id === 'ver-1')!;
    expect(snapshot.data.decisions?.[0].title).toBe('Archived wording');

    const live = [decision('dec-now', 'Decided after the backup was restored')];
    expect(buildRestoredWorkspace(snapshot, live).decisions).toEqual(live);
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

describe('describeReplacementEffects (contracts/replacement-routes.md)', () => {
  const v = (id: string) => ({ id });
  const d = (id: string) => ({ id, title: id });
  const settings = { startDate: '2026-01-01', monthsToShow: 12 };
  const current = { versions: [v('ver-1'), v('ver-2')], decisions: [d('dec-1')], timelineSettings: settings };

  it('says History is kept when the route leaves it alone', () => {
    expect(describeReplacementEffects(current, { decisions: current.decisions, timelineSettings: settings }))
      .toContain('History: your 2 saved version(s) are kept.');
  });

  it('says how many saved versions a new workspace removes', () => {
    expect(describeReplacementEffects(current, { versions: [], decisions: [], timelineSettings: settings }))
      .toContain('History: all 2 saved version(s) are removed.');
  });

  it('says History is replaced, with both counts', () => {
    expect(describeReplacementEffects(current, { versions: [v('ver-9')], decisions: [], timelineSettings: settings }))
      .toContain('History: your 2 saved version(s) are replaced by 1 from the incoming workspace.');
  });

  it('distinguishes a kept, cleared and replaced decision log', () => {
    expect(describeReplacementEffects(current, { decisions: [d('dec-1')], timelineSettings: settings })).toContain('Decision log: kept (1 decision(s)).');
    expect(describeReplacementEffects(current, { decisions: [], timelineSettings: settings })).toContain('Decision log: cleared — 1 decision(s) removed.');
    expect(describeReplacementEffects(current, { decisions: [d('dec-2'), d('dec-3')], timelineSettings: settings }))
      .toContain('Decision log: replaced — 1 decision(s) now, 2 after.');
  });

  it('reports a settings change even when no record counts change', () => {
    expect(describeReplacementEffects(current, { decisions: current.decisions, timelineSettings: settings })).toContain('Timeline settings: unchanged.');
    expect(describeReplacementEffects(current, { decisions: current.decisions, timelineSettings: { ...settings, monthsToShow: 24 } }))
      .toContain("Timeline settings: replaced by the incoming workspace's settings.");
  });
});
