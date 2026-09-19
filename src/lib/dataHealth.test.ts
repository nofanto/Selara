import { describe, expect, it } from 'vitest';
import { computeDataHealth, DataHealthInput, checkOf } from './dataHealth';

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
    timelineSettings: {},
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

  it('clears a stale LKPTI target when its retained filing name identifies exactly one replacement', () => {
    const stale = { id: 'lk-stale', targetId: 'deleted-deliverable', targetName: 'App One' };
    const issues = computeDataHealth(baseInput({
      assets: [asset], deliverables: [deliverable], lkptiDetails: [stale],
    }));
    expect(findIssue(issues, `lkpti-target:${stale.id}`)).toBeUndefined();
  });

  it('requires re-import for an already-orphaned LKPTI row with no retained filing name', () => {
    const stale = { id: 'lk-stale', targetId: 'deleted-deliverable' };
    const issue = findIssue(computeDataHealth(baseInput({
      assets: [asset], deliverables: [deliverable], lkptiDetails: [stale],
    })), `lkpti-target:${stale.id}`);
    expect(issue?.message).toMatch(/re-import/i);
    expect(issue?.message).toMatch(/name.*not.*recorded/i);
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

  it('flags an initiative whose reportable segments name more than one deliverable', () => {
    const init = { id: 'init-1', name: 'Split plan', programmeId: 'prog-1', assetId: asset.id, startDate: '2026-01-01', endDate: '2026-12-31', capex: 0, opex: 0 };
    const second = { ...deliverable, id: 'deliv-2', name: 'App Two' };
    const segments = [
      { id: 'seg-1', deliverableId: deliverable.id, initiativeId: init.id, startDate: '2026-01-01', endDate: '2026-03-31', status: 'appstatus-planned' },
      { id: 'seg-2', deliverableId: second.id, initiativeId: init.id, startDate: '2026-04-01', endDate: '2026-06-30', status: 'appstatus-planned' },
    ];
    const issue = findIssue(computeDataHealth(baseInput({ assets: [asset], deliverables: [deliverable, second], initiatives: [init], deliverableSegments: segments })), `initiative-rpti-multi-target:${init.id}`);

    expect(issue).toMatchObject({ severity: 'error', location: { view: 'data', tab: 'initiatives' } });
    expect(issue?.message).toMatch(/split/i);
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
    expect(findIssue(issues, `decision-linked:${dec.id}`)).toMatchObject({ severity: 'error', location: { view: 'history' } });
    expect(findIssue(issues, `decision-superseded-by:${dec.id}`)?.severity).toBe('error');
  });

  it('flags an RptiDetail with dangling initiativeId, targetId, or deliverableSegmentId', () => {
    const r = { id: 'rpti-1', initiativeId: 'ghost', targetType: 'deliverable' as const, targetId: 'ghost', developmentType: 'new' as const, deliverableSegmentId: 'ghost' };
    const issues = computeDataHealth(baseInput({ rptiDetails: [r] }));
    expect(findIssue(issues, `rpti-initiative:${r.id}`)?.severity).toBe('error');
    expect(findIssue(issues, `rpti-target:${r.id}`)?.severity).toBe('error');
    expect(findIssue(issues, `rpti-segment:${r.id}`)?.severity).toBe('error');
  });

  it('blocks a legacy asset-target RPTI row and names the source-side repair', () => {
    const init = { id: 'init-1', name: 'Payments renewal', programmeId: 'prog-1', assetId: asset.id, startDate: '2026-01-01', endDate: '2026-12-31', capex: 0, opex: 0 };
    const row = { id: 'rpti-asset-1', initiativeId: init.id, targetType: 'asset' as const, targetId: asset.id, developmentType: 'new' as const };
    const issue = findIssue(computeDataHealth(baseInput({ assets: [asset], initiatives: [init], rptiDetails: [row] })), `rpti-asset-target:${row.id}`);

    expect(issue).toMatchObject({ severity: 'error', location: { view: 'data', tab: 'deliverables' } });
    expect(issue?.message).toMatch(/Deliverables tab.*Initiatives tab.*timeline/i);
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
    expect(issue?.message).toContain('Provider Related Party');
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

// ── Phase 2: value validity ──────────────────────────────────────────────────
// See requirement-specs/data-completeness-report.md § "Phase 2 — Validity checks"
// and docs/user-stories/23-data-health-phase-2.md.

/** An LKPTI-eligible deliverable: application type, with a live-status segment. */
const liveSegment = {
  id: 'seg-live', deliverableId: 'deliv-1', startDate: '2020-01-01', endDate: '2027-01-01',
  status: 'appstatus-in-production',
};

/** A fully-populated LkptiDetail, so completeness warnings never mask a validity check. */
const fullLkpti = {
  id: 'lkpti-1', targetId: 'deliv-1', platform: 'Linux', database: 'Postgres',
  dcProvider: 'self', drcProvider: 'self', backupStrategy: 'HA_ACTIVE_ACTIVE' as const,
  systemOwner: 'IT Ops', ownership: 'OUTRIGHT_PURCHASE' as const, goLiveDate: '01-01-2020',
  developer: 'inhouse', functionDescription: 'Core ledger.',
  dcCity: 'Jakarta', dcCountry: 'Indonesia', drCity: 'Surabaya', drCountry: 'Indonesia',
};

function lkptiInput(overrides: Partial<typeof fullLkpti> = {}, extra: Partial<DataHealthInput> = {}) {
  return baseInput({
    assets: [asset], assetCategories: [cat], deliverables: [deliverable],
    deliverableSegments: [liveSegment], lkptiDetails: [{ ...fullLkpti, ...overrides }],
    ...extra,
  });
}

describe('computeDataHealth — phase tagging', () => {
  it('tags every pre-existing completeness check as phase "completeness"', () => {
    const issues = computeDataHealth(baseInput({ deliverables: [deliverable] }));
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every(i => i.phase === 'completeness')).toBe(true);
  });

  it('tags a validity check as phase "validity"', () => {
    const issues = computeDataHealth(lkptiInput({ goLiveDate: '31-02-2021' }));
    expect(findIssue(issues, `lkpti-golive-invalid:${fullLkpti.id}`)?.phase).toBe('validity');
  });

  it('runs validity checks even when the workspace is full of completeness gaps', () => {
    // A bare LkptiDetail row: missing nearly every manual field *and* holding a bad date.
    const l = { id: 'lkpti-1', targetId: 'deliv-1', goLiveDate: '31-02-2021' };
    const issues = computeDataHealth(baseInput({ deliverables: [deliverable], lkptiDetails: [l] }));
    expect(findIssue(issues, `lkpti-incomplete:${l.id}`)?.phase).toBe('completeness');
    expect(findIssue(issues, `lkpti-golive-invalid:${l.id}`)?.phase).toBe('validity');
  });
});

describe('computeDataHealth — validity: goLiveDate', () => {
  it('flags a goLiveDate that is not dd-mm-yyyy', () => {
    const issues = computeDataHealth(lkptiInput({ goLiveDate: '2021-02-28' }));
    expect(findIssue(issues, `lkpti-golive-invalid:${fullLkpti.id}`)?.severity).toBe('error');
  });

  it('flags a well-formed goLiveDate that is not a real calendar date', () => {
    const issues = computeDataHealth(lkptiInput({ goLiveDate: '31-02-2021' }));
    expect(findIssue(issues, `lkpti-golive-invalid:${fullLkpti.id}`)?.severity).toBe('error');
  });

  it('flags a goLiveDate in the future', () => {
    const issues = computeDataHealth(lkptiInput({ goLiveDate: '01-01-2099' }));
    expect(findIssue(issues, `lkpti-golive-future:${fullLkpti.id}`)?.severity).toBe('error');
  });

  it('accepts a real, past goLiveDate', () => {
    const issues = computeDataHealth(lkptiInput({ goLiveDate: '29-02-2020' }));
    expect(findIssue(issues, `lkpti-golive-invalid:${fullLkpti.id}`)).toBeUndefined();
    expect(findIssue(issues, `lkpti-golive-future:${fullLkpti.id}`)).toBeUndefined();
  });

  it('does not raise a validity issue for an absent goLiveDate — that is a completeness gap', () => {
    const issues = computeDataHealth(lkptiInput({ goLiveDate: undefined }));
    expect(findIssue(issues, `lkpti-golive-invalid:${fullLkpti.id}`)).toBeUndefined();
    expect(findIssue(issues, `lkpti-golive-future:${fullLkpti.id}`)).toBeUndefined();
    expect(findIssue(issues, `lkpti-incomplete:${fullLkpti.id}`)?.phase).toBe('completeness');
  });
});

describe('computeDataHealth — validity: length caps', () => {
  it('flags a functionDescription over 500 characters', () => {
    const issues = computeDataHealth(lkptiInput({ functionDescription: 'x'.repeat(501) }));
    expect(findIssue(issues, `lkpti-too-long:${fullLkpti.id}:functionDescription`)?.severity).toBe('error');
  });

  it('accepts a functionDescription of exactly 500 characters', () => {
    const issues = computeDataHealth(lkptiInput({ functionDescription: 'x'.repeat(500) }));
    expect(findIssue(issues, `lkpti-too-long:${fullLkpti.id}:functionDescription`)).toBeUndefined();
  });

  it('flags a stored row field over its 100-character cap', () => {
    const issues = computeDataHealth(lkptiInput({ platform: 'x'.repeat(101) }));
    expect(findIssue(issues, `lkpti-too-long:${fullLkpti.id}:platform`)?.severity).toBe('error');
  });

  it('caps applicationName by reading Deliverable.name, and reports it on the Deliverables tab', () => {
    const longName = { ...deliverable, name: 'x'.repeat(101) };
    const issues = computeDataHealth(lkptiInput({}, { deliverables: [longName] }));
    const issue = findIssue(issues, `lkpti-too-long:${fullLkpti.id}:applicationName`);
    expect(issue?.severity).toBe('error');
    expect(issue?.location).toEqual({ view: 'data', tab: 'deliverables' });
  });

  it('caps dcLocation on the composed "City, Country" value, not on either part', () => {
    // 60 + 60 each pass a per-part check; the composed cell is 122 and would be rejected.
    const issues = computeDataHealth(lkptiInput({ dcCity: 'x'.repeat(60), dcCountry: 'y'.repeat(60) }));
    const issue = findIssue(issues, `lkpti-too-long:${fullLkpti.id}:dcLocation`);
    expect(issue?.severity).toBe('error');
    // Repointed by T028: the LKPTI tab is read-only, and these values live on the
    // application (ADR-0013), so the repair is on the Deliverables tab (FR-021a).
    expect(issue?.location).toEqual({ view: 'data', tab: 'deliverables' });
  });

  it('accepts a composed dcLocation within the cap', () => {
    const issues = computeDataHealth(lkptiInput({ dcCity: 'x'.repeat(60), dcCountry: 'y'.repeat(30) }));
    expect(findIssue(issues, `lkpti-too-long:${fullLkpti.id}:dcLocation`)).toBeUndefined();
  });

  it('caps drcLocation on the composed value too', () => {
    const issues = computeDataHealth(lkptiInput({ drCity: 'x'.repeat(60), drCountry: 'y'.repeat(60) }));
    expect(findIssue(issues, `lkpti-too-long:${fullLkpti.id}:drcLocation`)?.severity).toBe('error');
  });
});

describe('computeDataHealth — validity: free-text hygiene', () => {
  it('flags a line break in a free-text field', () => {
    const issues = computeDataHealth(lkptiInput({ functionDescription: 'Core ledger.\nHandles postings.' }));
    expect(findIssue(issues, `lkpti-untidy-text:${fullLkpti.id}:functionDescription`)?.severity).toBe('warning');
  });

  it('flags untrimmed whitespace in a free-text field', () => {
    const issues = computeDataHealth(lkptiInput({ systemOwner: 'IT Ops ' }));
    expect(findIssue(issues, `lkpti-untidy-text:${fullLkpti.id}:systemOwner`)?.severity).toBe('warning');
  });

  it('flags untidy text in Deliverable.name, which exports as applicationName', () => {
    const untidy = { ...deliverable, name: ' App One' };
    const issues = computeDataHealth(lkptiInput({}, { deliverables: [untidy] }));
    const issue = findIssue(issues, `lkpti-untidy-text:${fullLkpti.id}:applicationName`);
    expect(issue?.severity).toBe('warning');
    expect(issue?.location).toEqual({ view: 'data', tab: 'deliverables' });
  });

  it('does not flag tidy free text', () => {
    const issues = computeDataHealth(lkptiInput());
    expect(issues.some(i => i.id.startsWith('lkpti-untidy-text:'))).toBe(false);
  });

  it('does not flag the enum-backed or date columns as untidy text', () => {
    const issues = computeDataHealth(lkptiInput({ goLiveDate: '01-01-2020' }));
    expect(findIssue(issues, `lkpti-untidy-text:${fullLkpti.id}:goLiveDate`)).toBeUndefined();
    expect(findIssue(issues, `lkpti-untidy-text:${fullLkpti.id}:ownership`)).toBeUndefined();
  });
});

describe('computeDataHealth — validity: duplicate application names', () => {
  const second = { id: 'deliv-2', assetId: 'asset-1', name: 'app one ', type: 'application' as const };
  const secondSeg = { ...liveSegment, id: 'seg-live-2', deliverableId: 'deliv-2' };
  const secondLkpti = { ...fullLkpti, id: 'lkpti-2', targetId: 'deliv-2' };

  it('flags every member of a duplicate group, comparing trimmed and case-insensitively', () => {
    const issues = computeDataHealth(baseInput({
      assets: [asset], assetCategories: [cat], deliverables: [deliverable, second],
      deliverableSegments: [liveSegment, secondSeg], lkptiDetails: [fullLkpti, secondLkpti],
    }));
    expect(findIssue(issues, `lkpti-duplicate-name:${deliverable.id}`)?.severity).toBe('warning');
    expect(findIssue(issues, `lkpti-duplicate-name:${second.id}`)?.severity).toBe('warning');
  });

  it('ignores a name collision with a deliverable that has no LkptiDetail row', () => {
    const issues = computeDataHealth(baseInput({
      assets: [asset], assetCategories: [cat], deliverables: [deliverable, second],
      deliverableSegments: [liveSegment, secondSeg], lkptiDetails: [fullLkpti],
    }));
    expect(findIssue(issues, `lkpti-duplicate-name:${deliverable.id}`)).toBeUndefined();
    expect(findIssue(issues, `lkpti-duplicate-name:${second.id}`)).toBeUndefined();
  });

  it('does not flag distinct application names', () => {
    const distinct = { ...second, name: 'App Two' };
    const issues = computeDataHealth(baseInput({
      assets: [asset], assetCategories: [cat], deliverables: [deliverable, distinct],
      deliverableSegments: [liveSegment, secondSeg], lkptiDetails: [fullLkpti, secondLkpti],
    }));
    expect(issues.some(i => i.id.startsWith('lkpti-duplicate-name:'))).toBe(false);
  });
});

describe('computeDataHealth — validity: RPTI workspace currency', () => {
  it('flags a defaultCurrency that is set and is not IDR', () => {
    const issues = computeDataHealth(baseInput({ timelineSettings: { defaultCurrency: 'USD' } }));
    const issue = findIssue(issues, 'workspace-currency-not-idr');
    expect(issue?.severity).toBe('warning');
    expect(issue?.phase).toBe('validity');
    expect(issue?.entityType).toBe('Workspace');
    // Repointed by T028: the currency control moved out of the RPTI tab into the
    // visualiser's display settings when that tab became read-only.
    expect(issue?.location).toEqual({ view: 'data', tab: 'initiatives' });
  });

  it('does not flag IDR', () => {
    const issues = computeDataHealth(baseInput({ timelineSettings: { defaultCurrency: 'IDR' } }));
    expect(findIssue(issues, 'workspace-currency-not-idr')).toBeUndefined();
  });

  it('does not flag an unset defaultCurrency — that is not a validity problem', () => {
    const issues = computeDataHealth(baseInput({ timelineSettings: {} }));
    expect(findIssue(issues, 'workspace-currency-not-idr')).toBeUndefined();
  });
});

describe('computeDataHealth — unresolved RPTI import references (#38)', () => {
  // An RPTI upgrade row that matched nothing in the inventory is imported with a
  // target that does not resolve, on the basis that the existing rpti-target
  // check reports it. That claim is only worth making if it is tested: without
  // this, the import would rely on a rule nobody had exercised for this case.
  const unresolvedRow = {
    id: 'rpti-import-row-1',
    initiativeId: 'rpti-import-init-1',
    targetType: 'deliverable' as const,
    targetId: 'rpti-import-unresolved-1',
    developmentType: 'upgrade' as const,
    categoryCode: '04' as const,
  };
  const initiative = {
    id: 'rpti-import-init-1', name: 'Core Banking GL', programmeId: '', assetId: '',
    startDate: '2027-01-01', endDate: '2027-09-30', capex: 0, opex: 0,
  };

  it('reports an imported row whose upgrade target was never resolved', () => {
    const issues = computeDataHealth(baseInput({ initiatives: [initiative], rptiDetails: [unresolvedRow] }));
    // T028a: the repair is source-side now. The RPTI tab no longer has a Target
    // dropdown to fix, so the finding must send the preparer to the application the
    // filed plan refers to — otherwise FR-025 has no remaining repair path.
    expect(findIssue(issues, `rpti-target:${unresolvedRow.id}`)).toMatchObject({
      severity: 'error',
      location: { view: 'data', tab: 'deliverables' },
    });
  });

  it('names the row so the user can find it, rather than reporting an opaque id', () => {
    const issues = computeDataHealth(baseInput({ initiatives: [initiative], rptiDetails: [unresolvedRow] }));
    expect(findIssue(issues, `rpti-target:${unresolvedRow.id}`)?.entityName).toBe('Core Banking GL');
  });

  it('does not report a row whose target resolves', () => {
    const resolved = { ...unresolvedRow, targetId: 'deliv-1' };
    const issues = computeDataHealth(baseInput({
      initiatives: [initiative],
      assetCategories: [{ id: 'c-1', name: 'Area', categoryCode: '04' }],
      assets: [{ id: 'a-1', name: 'Core Banking GL', categoryId: 'c-1' }],
      deliverables: [{ id: 'deliv-1', assetId: 'a-1', name: 'Core Banking GL', type: 'application' }],
      rptiDetails: [resolved],
    }));
    expect(findIssue(issues, `rpti-target:${resolved.id}`)).toBeUndefined();
  });
});

describe('every check declares which return it bears on', () => {
  /**
   * REPORTS_BY_CHECK defaults to [] — affects no filing — so a check added without
   * an entry disappears from the RPTI and LKPTI filters silently, with no error and
   * a green suite. This asserts the classification keeps up with the checks.
   *
   * It works by driving a workspace deliberately broken in every way the checks
   * look for, then requiring every issue that fires to carry a non-accidental
   * classification.
   */
  const brokenEverything = () => {
    const base = baseInput();
    return {
      ...base,
      // Dangling references of every shape.
      deliverables: [
        { id: 'd-1', assetId: 'missing-asset', name: 'Orphan', type: 'application' },
        { id: 'd-2', assetId: 'a-1', name: 'No segments', type: 'application' },
      ],
      assets: [{ id: 'a-1', name: 'A', categoryId: 'missing-category' }],
      assetCategories: [],
      deliverableSegments: [
        { id: 's-1', deliverableId: 'missing-deliverable', startDate: '2027-01-01', endDate: '2027-02-01', status: 'missing-status', initiativeId: 'missing-initiative' },
      ],
      deliverableStatuses: [],
      initiatives: [
        { id: 'i-1', name: 'I', programmeId: 'missing-programme', strategyId: 'missing-strategy',
          assetId: 'missing-asset', deliverableId: 'missing-deliverable', ownerId: 'missing-resource',
          resourceIds: ['missing-resource'], startDate: '2027-01-01', endDate: '2027-12-31', capex: 0, opex: 0 },
      ],
      milestones: [{ id: 'm-1', assetId: 'missing-asset', date: '2027-01-01', name: 'M', type: 'info' }],
      dependencies: [{ id: 'dep-1', sourceId: 'missing', targetId: 'missing', type: 'blocks' }],
      decisions: [
        { id: 'dec-1', title: 'D', status: 'superseded', supersededBy: 'missing', createdAt: '2027-01-01T00:00:00Z',
          linkedEntityType: 'asset', linkedEntityId: 'missing' },
      ],
      rptiDetails: [{ id: 'r-1', initiativeId: 'missing', targetType: 'deliverable', targetId: 'missing', developmentType: 'new', deliverableSegmentId: 'missing' }],
      lkptiDetails: [{ id: 'l-1', targetId: 'missing', goLiveDate: 'not-a-date' }],
      timelineSettings: { defaultCurrency: 'USD' },
    } as never;
  };

  it('classifies every check that can fire, rather than defaulting it to "affects nothing"', () => {
    const issues = computeDataHealth(brokenEverything());
    expect(issues.length).toBeGreaterThan(10); // guard: otherwise this passes vacuously

    // A check is unclassified if it fires yet reports nothing AND is not one of the
    // workspace-hygiene checks that genuinely affect no filing.
    const NON_FILING = new Set([
      'asset-category', 'deliverable-asset', 'segment-deliverable', 'segment-initiative',
      'segment-status', 'initiative-asset', 'initiative-deliverable', 'initiative-programme',
      'initiative-strategy', 'initiative-owner', 'initiative-resource', 'initiative-no-owner',
      'dependency-source', 'dependency-target', 'milestone-asset',
      'decision-linked', 'decision-superseded-by',
    ]);
    const unclassified = [...new Set(
      issues.filter(i => i.reports.length === 0).map(i => checkOf(i.id)),
    )].filter(k => !NON_FILING.has(k));

    expect(unclassified, `unclassified checks — add them to REPORTS_BY_CHECK: ${unclassified.join(', ')}`).toEqual([]);
  });

  it('gives a filing-relevant check a report, and a hygiene check none', () => {
    const issues = computeDataHealth(brokenEverything());
    const byCheck = (k: string) => issues.find(i => checkOf(i.id) === k);
    expect(byCheck('rpti-target')?.reports).toEqual(['rpti']);
    expect(byCheck('deliverable-no-segments')?.reports).toEqual(['rpti', 'lkpti']);
    expect(byCheck('initiative-programme')?.reports).toEqual([]);
  });
});


describe('RPTI target compatibility', () => {
  const init = { id: 'target-init', name: 'Target work', programmeId: programme.id, assetId: asset.id,
    startDate: '2026-01-01', endDate: '2026-12-31', capex: 1, opex: 0 };
  const segment = { id: 'target-seg', initiativeId: init.id, deliverableId: deliverable.id,
    status: 'appstatus-planned', startDate: '2026-01-01', endDate: '2026-12-31' };
  it('names the repair when qualifying segments have no existing target', () => {
    const issues = computeDataHealth(baseInput({ initiatives: [init], deliverableSegments: [segment] }));
    const issue = findIssue(issues, `initiative-rpti-no-target:${init.id}`);
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toMatch(/select.*deliverable/i);
    expect(issue?.reports).toContain('rpti');
  });
  it('does not flag a single inferred target', () => {
    const issues = computeDataHealth(baseInput({ initiatives: [init], deliverables: [deliverable], deliverableSegments: [segment] }));
    expect(findIssue(issues, `initiative-rpti-no-target:${init.id}`)).toBeUndefined();
  });
  it('accepts a declared target despite other timeline history', () => {
    const issues = computeDataHealth(baseInput({ initiatives: [{ ...init, deliverableId: deliverable.id }],
      deliverables: [deliverable, { ...deliverable, id: 'other' }],
      deliverableSegments: [segment, { ...segment, id: 'other-seg', deliverableId: 'other' }] }));
    expect(findIssue(issues, `initiative-rpti-multi-target:${init.id}`)).toBeUndefined();
  });
  it('flags ambiguous infrastructure targets as RPTI errors', () => {
    const issues = computeDataHealth(baseInput({ initiatives: [init],
      deliverables: [{ ...deliverable, type: 'infrastructure' }, { ...deliverable, id: 'other', type: 'infrastructure' }],
      deliverableSegments: [segment, { ...segment, id: 'other-seg', deliverableId: 'other' }] }));
    const issue = findIssue(issues, `initiative-rpti-multi-target:${init.id}`);
    expect(issue?.severity).toBe('error');
    expect(issue?.reports).toContain('rpti');
  });
});

/**
 * T028 / FR-021a. Both report tabs became read-only (Q5/Q6 revised), so a finding whose
 * `location` still points at one tells the preparer where the problem *is* and not where
 * to fix it — and nothing else fails when that happens, because a location naming a real
 * tab is still a valid location. That silence is why this guard is behavioural rather
 * than a code review note.
 */
describe('no data-health finding sends the preparer to a read-only report tab (FR-021a)', () => {
  const READ_ONLY = ['rpti', 'lkpti'];

  it('holds for a workspace whose every report-row check is tripped at once', () => {
    const issues = computeDataHealth(baseInput({
      assetCategories: [cat], assets: [asset], deliverables: [deliverable], programmes: [programme],
      timelineSettings: { defaultCurrency: 'USD' },
      initiatives: [{ id: 'init-1', name: 'Init One', programmeId: 'prog-1', assetId: 'asset-1',
        startDate: '2027-01-01', endDate: '2027-12-31', capex: 0, opex: 0 }],
      rptiDetails: [
        // dangling initiative, dangling target, dangling segment, bare-Asset target,
        // and a row missing every manual-only field.
        { id: 'r-ghost-init', initiativeId: 'gone', targetType: 'deliverable', targetId: 'deliv-1', developmentType: 'new' },
        { id: 'r-ghost-target', initiativeId: 'init-1', targetType: 'deliverable', targetId: 'gone', developmentType: 'new' },
        { id: 'r-ghost-seg', initiativeId: 'init-1', targetType: 'deliverable', targetId: 'deliv-1',
          developmentType: 'new', deliverableSegmentId: 'gone' },
        { id: 'r-asset', initiativeId: 'init-1', targetType: 'asset', targetId: 'asset-1', developmentType: 'new' },
      ] as never,
      lkptiDetails: [
        { id: 'l-ghost', targetId: 'gone' },
        { id: 'l-bare', targetId: 'deliv-1' },
      ] as never,
    }));

    // Guard: if the fixture stopped tripping checks this would pass vacuously.
    expect(issues.length, 'guard: the fixture must actually produce findings').toBeGreaterThan(5);

    const stranded = issues
      .filter(i => i.location.view === 'data' && READ_ONLY.includes((i.location as { tab: string }).tab))
      .map(i => `${i.id} → ${(i.location as { tab: string }).tab}`);
    expect(stranded, 'these findings point at a tab the preparer cannot edit').toEqual([]);
  });
});

/**
 * F6, from the final adversarial review. Q10 made an explicit RPTI target win over
 * timeline history, and the multi-target error is correctly suppressed when one is
 * declared. But "the target exists" was then treated as "the target is generatable":
 * an initiative declaring D1 while all its work sits on D2 produces no plan line at
 * all, and — with no stored row for reconciliation to inspect — no explanation either.
 *
 * A silently absent filing row is the failure this feature exists to remove, and this
 * is the case where preparer intent is least safely inferred: the only qualifying work
 * points somewhere other than the declared filing target.
 */
describe('an explicit RPTI target with no qualifying work on it is reported (F6)', () => {
  const second = { id: 'deliv-2', assetId: 'asset-1', name: 'App Two', type: 'application' as const };
  const declaringD1WorkingOnD2 = () => baseInput({
    assetCategories: [cat], assets: [asset], deliverables: [deliverable, second], programmes: [programme],
    initiatives: [{ id: 'init-1', name: 'Misaimed Initiative', programmeId: 'prog-1', assetId: 'asset-1',
      deliverableId: 'deliv-1', startDate: '2027-01-01', endDate: '2027-12-31', capex: 0, opex: 0 }],
    deliverableSegments: [{ id: 'seg-1', deliverableId: 'deliv-2', initiativeId: 'init-1',
      status: 'appstatus-in-production', startDate: '2027-02-01', endDate: '2027-12-31' }],
  });

  it('raises an error naming the declared target and where the work actually is', () => {
    const issue = findIssue(computeDataHealth(declaringD1WorkingOnD2()), 'initiative-rpti-unanchored-target:init-1');

    expect(issue, 'nothing explains why this initiative files no row').toBeDefined();
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('App One');
    expect(issue?.message, 'the preparer needs to know where the work actually sits').toContain('App Two');
    expect(issue?.location).toEqual({ view: 'data', tab: 'initiatives' });
  });

  it('stays silent once the declared target carries qualifying work', () => {
    const input = declaringD1WorkingOnD2();
    input.deliverableSegments = [{ id: 'seg-1', deliverableId: 'deliv-1', initiativeId: 'init-1',
      status: 'appstatus-in-production', startDate: '2027-02-01', endDate: '2027-12-31' }];

    expect(findIssue(computeDataHealth(input), 'initiative-rpti-unanchored-target:init-1')).toBeUndefined();
  });

  it('does not fire for an initiative with no qualifying segments at all', () => {
    const input = declaringD1WorkingOnD2();
    input.deliverableSegments = [];

    // Nothing is being filed, so there is no absent row to explain. Reporting here
    // would flag every initiative that has not been scheduled yet.
    expect(findIssue(computeDataHealth(input), 'initiative-rpti-unanchored-target:init-1')).toBeUndefined();
  });
});
