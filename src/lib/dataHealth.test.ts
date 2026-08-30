import { describe, expect, it } from 'vitest';
import { computeDataHealth, DataHealthInput } from './dataHealth';

const statuses = [
  { id: 'appstatus-planned', name: 'Planned', color: 'slate', isPreLaunchStatus: true },
  { id: 'appstatus-funded', name: 'Funded', color: 'blue', isPreLaunchStatus: true },
  { id: 'appstatus-in-production', name: 'In Production', color: 'green', isLiveStatus: true },
  { id: 'appstatus-sunset', name: 'Sunset', color: 'amber' },
];

function baseInput(overrides: Partial<DataHealthInput> = {}): DataHealthInput {
  return {
    assets: [], assetCategories: [], deliverables: [], deliverableSegments: [],
    deliverableStatuses: statuses, initiatives: [], milestones: [], dependencies: [],
    decisions: [], resources: [], programmes: [], strategies: [], rptiDetails: [], lkptiDetails: [],
    ...overrides,
  };
}

const cat = { id: 'cat-1', name: 'Category', categoryCode: '01' as const };
const asset = { id: 'asset-1', name: 'Asset One', categoryId: 'cat-1' };
const deliverable = { id: 'deliv-1', assetId: 'asset-1', name: 'App One', type: 'application' as const };
const programme = { id: 'prog-1', name: 'Programme One', color: 'blue' };
const strategy = { id: 'strat-1', name: 'Strategy One', color: 'red' };
const resource = { id: 'res-1', name: 'Resource One' };

function findIssue(issues: ReturnType<typeof computeDataHealth>, id: string) {
  return issues.find(i => i.id === id);
}

describe('computeDataHealth — hard checks (dangling references)', () => {
  it('flags a Deliverable pointing at a missing Asset', () => {
    const issues = computeDataHealth(baseInput({ deliverables: [deliverable] }));
    const issue = findIssue(issues, `deliverable-asset:${deliverable.id}`);
    expect(issue?.severity).toBe('error');
    expect(issue?.location).toEqual({ view: 'data', tab: 'deliverables' });
  });

  it('does not flag a Deliverable whose Asset exists', () => {
    const issues = computeDataHealth(baseInput({ assets: [asset], deliverables: [deliverable] }));
    expect(findIssue(issues, `deliverable-asset:${deliverable.id}`)).toBeUndefined();
  });

  it('flags an Asset pointing at a missing AssetCategory', () => {
    const issues = computeDataHealth(baseInput({ assets: [asset] }));
    expect(findIssue(issues, `asset-category:${asset.id}`)?.severity).toBe('error');
  });

  it('flags a segment pointing at a missing Deliverable', () => {
    const seg = { id: 'seg-1', deliverableId: 'ghost', startDate: '2026-01-01', endDate: '2026-02-01', status: 'appstatus-in-production' };
    const issues = computeDataHealth(baseInput({ deliverableSegments: [seg] }));
    expect(findIssue(issues, `segment-deliverable:${seg.id}`)?.severity).toBe('error');
  });

  it('flags a segment pointing at a missing Initiative', () => {
    const seg = { id: 'seg-1', deliverableId: 'deliv-1', startDate: '2026-01-01', endDate: '2026-02-01', status: 'appstatus-in-production', initiativeId: 'ghost' };
    const issues = computeDataHealth(baseInput({ deliverables: [deliverable], deliverableSegments: [seg] }));
    expect(findIssue(issues, `segment-initiative:${seg.id}`)?.severity).toBe('error');
  });

  it('flags a segment with an unknown status id', () => {
    const seg = { id: 'seg-1', deliverableId: 'deliv-1', startDate: '2026-01-01', endDate: '2026-02-01', status: 'ghost-status' };
    const issues = computeDataHealth(baseInput({ deliverables: [deliverable], deliverableSegments: [seg] }));
    expect(findIssue(issues, `segment-status:${seg.id}`)?.severity).toBe('error');
  });

  it('flags an Initiative with dangling programmeId/strategyId/assetId/deliverableId/ownerId/resourceIds', () => {
    const init = {
      id: 'init-1', name: 'Init One', programmeId: 'ghost', strategyId: 'ghost', assetId: 'ghost',
      deliverableId: 'ghost', ownerId: 'ghost', resourceIds: ['ghost'],
      startDate: '2026-01-01', endDate: '2026-02-01', capex: 0, opex: 0,
    };
    const issues = computeDataHealth(baseInput({ initiatives: [init] }));
    expect(findIssue(issues, `initiative-programme:${init.id}`)?.severity).toBe('error');
    expect(findIssue(issues, `initiative-strategy:${init.id}`)?.severity).toBe('error');
    expect(findIssue(issues, `initiative-asset:${init.id}`)?.severity).toBe('error');
    expect(findIssue(issues, `initiative-deliverable:${init.id}`)?.severity).toBe('error');
    expect(findIssue(issues, `initiative-owner:${init.id}`)?.severity).toBe('error');
    expect(findIssue(issues, `initiative-resource:${init.id}:ghost`)?.severity).toBe('error');
  });

  it('does not flag an Initiative whose references all resolve', () => {
    const init = {
      id: 'init-1', name: 'Init One', programmeId: 'prog-1', strategyId: 'strat-1', assetId: 'asset-1',
      ownerId: 'res-1', resourceIds: ['res-1'],
      startDate: '2026-01-01', endDate: '2026-02-01', capex: 0, opex: 0,
    };
    const issues = computeDataHealth(baseInput({
      programmes: [programme], strategies: [strategy], assets: [asset], resources: [resource], initiatives: [init],
    }));
    expect(issues.filter(i => i.entityId === init.id && i.severity === 'error')).toHaveLength(0);
  });

  it('flags a Milestone pointing at a missing Asset', () => {
    const milestone = { id: 'mile-1', assetId: 'ghost', date: '2026-01-01', name: 'Milestone One', type: 'info' as const };
    const issues = computeDataHealth(baseInput({ milestones: [milestone] }));
    expect(findIssue(issues, `milestone-asset:${milestone.id}`)?.severity).toBe('error');
  });

  it('flags a Dependency with a dangling source or target, respecting sourceType/targetType', () => {
    const dep = { id: 'dep-1', sourceId: 'ghost', targetId: 'ghost', type: 'blocks' as const, sourceType: 'milestone' as const, targetType: 'segment' as const };
    const issues = computeDataHealth(baseInput({ dependencies: [dep] }));
    expect(findIssue(issues, `dependency-source:${dep.id}`)?.severity).toBe('error');
    expect(findIssue(issues, `dependency-target:${dep.id}`)?.severity).toBe('error');
  });

  it('defaults Dependency source/targetType to initiative when absent', () => {
    const init = { id: 'init-1', name: 'Init', programmeId: 'prog-1', assetId: 'asset-1', startDate: '2026-01-01', endDate: '2026-02-01', capex: 0, opex: 0 };
    const dep = { id: 'dep-1', sourceId: init.id, targetId: init.id, type: 'blocks' as const };
    const issues = computeDataHealth(baseInput({ initiatives: [init], dependencies: [dep] }));
    expect(issues.filter(i => i.entityType === 'Dependency')).toHaveLength(0);
  });

  it('flags a Decision with a dangling linkedEntityId or supersededBy', () => {
    const dec = { id: 'dec-1', title: 'Decision One', status: 'accepted' as const, createdAt: '2026-01-01T00:00:00Z', linkedEntityType: 'initiative' as const, linkedEntityId: 'ghost', supersededBy: 'ghost' };
    const issues = computeDataHealth(baseInput({ decisions: [dec] }));
    expect(findIssue(issues, `decision-linked:${dec.id}`)).toMatchObject({ severity: 'error', location: { view: 'decisions' } });
    expect(findIssue(issues, `decision-superseded-by:${dec.id}`)?.severity).toBe('error');
  });

  it('flags an RptiDetail with dangling initiativeId, targetId, or deliverableSegmentId', () => {
    const r = { id: 'rpti-1', initiativeId: 'ghost', targetType: 'deliverable' as const, targetId: 'ghost', developmentType: 'new' as const, deliverableSegmentId: 'ghost' };
    const issues = computeDataHealth(baseInput({ rptiDetails: [r] }));
    expect(findIssue(issues, `rpti-initiative:${r.id}`)?.severity).toBe('error');
    expect(findIssue(issues, `rpti-target:${r.id}`)?.severity).toBe('error');
    expect(findIssue(issues, `rpti-segment:${r.id}`)?.severity).toBe('error');
  });

  it('flags an LkptiDetail with a dangling targetId', () => {
    const l = { id: 'lkpti-1', targetId: 'ghost' };
    const issues = computeDataHealth(baseInput({ lkptiDetails: [l] }));
    expect(findIssue(issues, `lkpti-target:${l.id}`)?.severity).toBe('error');
  });
});

describe('computeDataHealth — soft checks (report-generation gaps)', () => {
  it('flags a Deliverable with zero lifecycle segments', () => {
    const issues = computeDataHealth(baseInput({ assets: [asset], deliverables: [deliverable] }));
    expect(findIssue(issues, `deliverable-no-segments:${deliverable.id}`)?.severity).toBe('warning');
  });

  it('flags a Deliverable whose segments never carry an initiativeId', () => {
    const seg = { id: 'seg-1', deliverableId: 'deliv-1', startDate: '2026-01-01', endDate: '2026-02-01', status: 'appstatus-in-production' };
    const issues = computeDataHealth(baseInput({ assets: [asset], deliverables: [deliverable], deliverableSegments: [seg] }));
    expect(findIssue(issues, `deliverable-no-initiative-segment:${deliverable.id}`)?.severity).toBe('warning');
  });

  it('does not flag deliverable-no-initiative-segment once one segment carries an initiativeId', () => {
    const init = { id: 'init-1', name: 'Init', programmeId: 'prog-1', assetId: 'asset-1', startDate: '2026-01-01', endDate: '2026-02-01', capex: 0, opex: 0 };
    const seg = { id: 'seg-1', deliverableId: 'deliv-1', startDate: '2026-01-01', endDate: '2026-02-01', status: 'appstatus-in-production', initiativeId: 'init-1' };
    const issues = computeDataHealth(baseInput({ assets: [asset], deliverables: [deliverable], deliverableSegments: [seg], initiatives: [init] }));
    expect(findIssue(issues, `deliverable-no-initiative-segment:${deliverable.id}`)).toBeUndefined();
  });

  it('flags an application Deliverable with no live-status segment as excluded from LKPTI', () => {
    const seg = { id: 'seg-1', deliverableId: 'deliv-1', startDate: '2026-01-01', endDate: '2026-02-01', status: 'appstatus-planned' };
    const issues = computeDataHealth(baseInput({ assets: [asset], deliverables: [deliverable], deliverableSegments: [seg] }));
    expect(findIssue(issues, `deliverable-no-live-segment:${deliverable.id}`)?.severity).toBe('warning');
  });

  it('does not flag deliverable-no-live-segment for a non-application Deliverable', () => {
    const infra = { ...deliverable, id: 'deliv-2', type: 'infrastructure' as const };
    const issues = computeDataHealth(baseInput({ assets: [asset], deliverables: [infra] }));
    expect(findIssue(issues, `deliverable-no-live-segment:${infra.id}`)).toBeUndefined();
  });

  it('flags category/developer/location gaps only when the Deliverable is report-eligible', () => {
    // Not eligible for either report yet (no segments at all) — no category/developer/location noise.
    const issues = computeDataHealth(baseInput({ assets: [asset], deliverables: [deliverable] }));
    expect(findIssue(issues, `deliverable-no-category:${deliverable.id}`)).toBeUndefined();
    expect(findIssue(issues, `deliverable-no-developer:${deliverable.id}`)).toBeUndefined();
    expect(findIssue(issues, `deliverable-no-location:${deliverable.id}`)).toBeUndefined();
  });

  it('flags category/developer/location gaps once the Deliverable is LKPTI-eligible', () => {
    const seg = { id: 'seg-1', deliverableId: 'deliv-1', startDate: '2026-01-01', endDate: '2026-02-01', status: 'appstatus-in-production' };
    const issues = computeDataHealth(baseInput({ assets: [asset], deliverables: [deliverable], deliverableSegments: [seg] }));
    expect(findIssue(issues, `deliverable-no-category:${deliverable.id}`)?.severity).toBe('warning');
    expect(findIssue(issues, `deliverable-no-developer:${deliverable.id}`)?.severity).toBe('warning');
    expect(findIssue(issues, `deliverable-no-location:${deliverable.id}`)?.severity).toBe('warning');
  });

  it('resolves category/location through the AssetCategory cascade, same as generation', () => {
    const seg = { id: 'seg-1', deliverableId: 'deliv-1', startDate: '2026-01-01', endDate: '2026-02-01', status: 'appstatus-in-production' };
    const fullCat = { ...cat, dcCity: 'Jakarta', dcCountry: 'ID', drCity: 'Surabaya', drCountry: 'ID' };
    const filledDeliverable = { ...deliverable, developer: 'inhouse' as const };
    const issues = computeDataHealth(baseInput({
      assets: [asset], assetCategories: [fullCat], deliverables: [filledDeliverable], deliverableSegments: [seg],
    }));
    expect(findIssue(issues, `deliverable-no-category:${deliverable.id}`)).toBeUndefined();
    expect(findIssue(issues, `deliverable-no-developer:${deliverable.id}`)).toBeUndefined();
    expect(findIssue(issues, `deliverable-no-location:${deliverable.id}`)).toBeUndefined();
  });

  it('flags a missing description only for an LKPTI-eligible Deliverable', () => {
    const seg = { id: 'seg-1', deliverableId: 'deliv-1', startDate: '2026-01-01', endDate: '2026-02-01', status: 'appstatus-in-production' };
    const issues = computeDataHealth(baseInput({ assets: [asset], deliverables: [deliverable], deliverableSegments: [seg] }));
    expect(findIssue(issues, `deliverable-no-description:${deliverable.id}`)?.severity).toBe('warning');
  });

  it('flags an LkptiDetail row missing manual-only fields, listing which ones', () => {
    const l = { id: 'lkpti-1', targetId: 'deliv-1' };
    const issues = computeDataHealth(baseInput({ deliverables: [deliverable], lkptiDetails: [l] }));
    const issue = findIssue(issues, `lkpti-incomplete:${l.id}`);
    expect(issue?.severity).toBe('warning');
    expect(issue?.message).toContain('Platform');
    expect(issue?.message).toContain('Go-Live Date');
  });

  it('does not flag an LkptiDetail row with all manual-only fields set', () => {
    const l = {
      id: 'lkpti-1', targetId: 'deliv-1', platform: 'Linux', database: 'Postgres', dcProvider: 'self',
      drcProvider: 'self', backupStrategy: 'HA_ACTIVE_ACTIVE' as const, systemOwner: 'IT Ops',
      ownership: 'OUTRIGHT_PURCHASE' as const, goLiveDate: '01-01-2026', developer: 'inhouse',
    };
    const issues = computeDataHealth(baseInput({ deliverables: [deliverable], lkptiDetails: [l] }));
    expect(findIssue(issues, `lkpti-incomplete:${l.id}`)).toBeUndefined();
  });

  it('flags an RptiDetail row missing categoryCode/developer/ppjtiRelatedParty', () => {
    const r = { id: 'rpti-1', initiativeId: 'init-1', targetType: 'deliverable' as const, targetId: 'deliv-1', developmentType: 'new' as const };
    const issues = computeDataHealth(baseInput({ rptiDetails: [r] }));
    const issue = findIssue(issues, `rpti-incomplete:${r.id}`);
    expect(issue?.severity).toBe('warning');
    expect(issue?.message).toContain('Category');
    expect(issue?.message).toContain('PPJTI Related Party');
  });

  it('flags an Initiative with no owner and no legacy owner string', () => {
    const init = { id: 'init-1', name: 'Init', programmeId: 'prog-1', assetId: 'asset-1', startDate: '2026-01-01', endDate: '2026-02-01', capex: 0, opex: 0 };
    const issues = computeDataHealth(baseInput({ initiatives: [init] }));
    expect(findIssue(issues, `initiative-no-owner:${init.id}`)?.severity).toBe('warning');
  });

  it('does not flag an Initiative with a legacy owner string but no ownerId', () => {
    const init = { id: 'init-1', name: 'Init', programmeId: 'prog-1', assetId: 'asset-1', owner: 'Jane', startDate: '2026-01-01', endDate: '2026-02-01', capex: 0, opex: 0 };
    const issues = computeDataHealth(baseInput({ initiatives: [init] }));
    expect(findIssue(issues, `initiative-no-owner:${init.id}`)).toBeUndefined();
  });
});

describe('computeDataHealth — empty workspace', () => {
  it('returns no issues for a fully empty workspace', () => {
    expect(computeDataHealth(baseInput())).toEqual([]);
  });
});
