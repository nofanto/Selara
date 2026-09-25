import { demoInitiatives, demoDeliverables, demoDeliverableSegments, demoDeliverableStatuses, demoAssets, demoAssetCategories } from '../demoData';
import { describe, expect, it } from 'vitest';
import { projectRptiReturn, reconcileRptiReturn, ProjectRptiInput, periodForQuarter, deriveQuarterFromDate, resolveCost, hasLiveHistoryBefore, continuousPriorLivePhase, openEndedDate, filedAttributesFor } from './rpti';
import type { AssetCategory, Asset, Deliverable, DeliverableSegment, DeliverableStatus, Initiative, RptiDetail } from '../types';

const statuses: DeliverableStatus[] = [
  { id: 'appstatus-planned', name: 'Planned', color: 'slate' },
  { id: 'appstatus-funded', name: 'Funded', color: 'blue' },
  { id: 'appstatus-in-production', name: 'In Production', color: 'green', isLiveStatus: true },
  { id: 'appstatus-sunset', name: 'Sunset', color: 'amber' },
  { id: 'appstatus-out-of-support', name: 'Out of Support', color: 'orange' },
  { id: 'appstatus-retired', name: 'Retired', color: 'red' },
];

function makeInitiative(overrides: Partial<Initiative> = {}): Initiative {
  return {
    id: 'init-1', name: 'Test Initiative', programmeId: 'prog-1', assetId: 'asset-1',
    startDate: '2026-01-01', endDate: '2026-12-31', capex: 1000, opex: 100,
    ...overrides,
  };
}

function withLegacyDeclaredTarget(initiative: Initiative, deliverableId: string): Initiative {
  return { ...initiative, deliverableId } as unknown as Initiative;
}

function makeSegment(overrides: Partial<DeliverableSegment> = {}): DeliverableSegment {
  return {
    id: 'seg-1', deliverableId: 'deliv-1', startDate: '2026-02-01', endDate: '2026-03-01',
    status: 'appstatus-in-production', initiativeId: 'init-1',
    ...overrides,
  };
}

function makeDeliverable(overrides: Partial<Deliverable> = {}): Deliverable {
  return { id: 'deliv-1', assetId: 'asset-1', name: 'Test Deliverable', ...overrides };
}

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return { id: 'asset-1', name: 'Test Asset', categoryId: 'cat-1', ...overrides };
}

function makeAssetCategory(overrides: Partial<AssetCategory> = {}): AssetCategory {
  return { id: 'cat-1', name: 'Test Category', ...overrides };
}

function makeContext(overrides: Partial<ProjectRptiInput> = {}): ProjectRptiInput {
  return {
    deliverableSegments: [],
    deliverableStatuses: statuses,
    initiatives: [makeInitiative()],
    deliverables: [],
    assets: [],
    assetCategories: [],
    ...overrides,
  };
}

describe('hasLiveHistoryBefore', () => {
  it('requires an earlier live start on the same Deliverable', () => {
    const segments = [
      makeSegment({ id: 'planned', startDate: '2025-01-01', status: 'appstatus-planned' }),
      makeSegment({ id: 'other', deliverableId: 'deliv-2', startDate: '2025-01-01' }),
      makeSegment({ id: 'same-day', startDate: '2026-04-01' }),
    ];
    expect(hasLiveHistoryBefore('deliv-1', '2026-04-01', segments, statuses)).toBe(false);
    expect(hasLiveHistoryBefore('deliv-1', '2026-04-01', [...segments, makeSegment({ id: 'earlier-live', startDate: '2026-03-31' })], statuses)).toBe(true);
  });
});

describe('continuousPriorLivePhase', () => {
  it('is unlinked and lasts through the shared planning horizon', () => {
    const phase = continuousPriorLivePhase('d', 2027, 'live', 'id');
    expect(phase).toEqual({ id: 'id', deliverableId: 'd', startDate: '2026-01-01', endDate: openEndedDate(2027), status: 'live' });
    expect(phase).not.toHaveProperty('initiativeId');
  });
});

describe('filedAttributesFor', () => {
  const category = makeAssetCategory({ categoryCode: '07', dcCity: 'Singapore', dcCountry: 'Singapore', drCity: 'Batam', drCountry: 'Indonesia' });
  const assets = [makeAsset()];
  const categories = [category];
  it('derives named provider, inhouse, inherited defaults and overrides', () => {
    expect(filedAttributesFor(makeDeliverable({ developer: 'Vendor X', ppjtiRelatedParty: 'yes' }), assets, categories)).toMatchObject({
      categoryCode: '07', developer: 'PPJTI', ppjtiRelatedParty: 'yes', dcCity: 'Singapore', drCity: 'Batam',
    });
    expect(filedAttributesFor(makeDeliverable({ developer: 'inhouse', ppjtiRelatedParty: 'yes' }), assets, categories)).toMatchObject({
      categoryCode: '07', developer: 'inhouse', ppjtiRelatedParty: 'n/a', dcCity: 'Singapore', drCity: 'Batam',
    });
    expect(filedAttributesFor(makeDeliverable(), assets, categories)).toMatchObject({
      categoryCode: '07', ppjtiRelatedParty: 'n/a', dcCity: 'Singapore', dcCountry: 'Singapore', drCity: 'Batam', drCountry: 'Indonesia',
    });
    expect(filedAttributesFor(makeDeliverable({ categoryCode: '04', dcCity: 'Jakarta', drCountry: 'Malaysia' }), assets, categories)).toMatchObject({
      categoryCode: '04', dcCity: 'Jakarta', dcCountry: 'Singapore', drCity: 'Batam', drCountry: 'Malaysia',
    });
  });

  it('matches every projected Deliverable in the existing demo fixture', () => {
    const input = { initiatives: demoInitiatives, deliverables: demoDeliverables,
      deliverableSegments: demoDeliverableSegments, deliverableStatuses: demoDeliverableStatuses,
      assets: demoAssets, assetCategories: demoAssetCategories };
    const year = new Date().getFullYear();
    const keys = ['categoryCode', 'developer', 'ppjtiRelatedParty', 'dcCity', 'dcCountry', 'drCity', 'drCountry'] as const;
    const rows = [year - 1, year, year + 1, year + 2].flatMap(y => projectRptiReturn(input, y));
    expect(rows.length).toBeGreaterThan(0); // guard: an empty projection would make the loop vacuous
    for (const row of rows) {
      const deliverable = demoDeliverables.find(d => d.id === row.targetId)!;
      const attributes = filedAttributesFor(deliverable, demoAssets, demoAssetCategories);
      expect(Object.fromEntries(keys.map(key => [key, row[key]]))).toEqual(Object.fromEntries(keys.map(key => [key, attributes[key]])));
    }
  });
});

describe('projectRptiReturn', () => {
  it('files the shipped demo only in each go-live year', () => {
    const context = { initiatives: demoInitiatives, deliverables: demoDeliverables,
      deliverableSegments: demoDeliverableSegments, deliverableStatuses: demoDeliverableStatuses,
      assets: demoAssets, assetCategories: demoAssetCategories };
    const demoYear = new Date().getFullYear();
    const years = [demoYear - 1, demoYear, demoYear + 1, demoYear + 2];
    expect(years.map(year => projectRptiReturn(context, year).length)).toEqual([1, 0, 1, 0]);
    const rows = projectRptiReturn(context, demoYear + 1);
    expect(rows.map(row => row.targetId)).toEqual(['app-rn']);
    expect(rows[0]).toMatchObject({ developmentType: 'new', plannedImplementationQuarter: 'Q2' });
    expect(new Set(rows.map(row => row.initiativeId)).size).toBe(rows.length);
  });

  it.each(['application', 'infrastructure'] as const)('files a segment-owned single %s target', type => {
    const rows = projectRptiReturn(makeContext({ initiatives: [makeInitiative()],
      deliverables: [makeDeliverable({ type })], deliverableSegments: [makeSegment()] }), 2026);
    expect(rows).toHaveLength(1);
    expect(rows[0].targetId).toBe('deliv-1');
  });

  it('files each segment target in its own implementation year', () => {
    const context = makeContext({ initiatives: [makeInitiative()],
      deliverables: [makeDeliverable(), makeDeliverable({ id: 'deliv-2' })],
      deliverableSegments: [makeSegment(), makeSegment({ id: 'later', deliverableId: 'deliv-2', startDate: '2027-01-01', endDate: '2027-12-31' })] });
    expect(projectRptiReturn(context, 2026).map(row => row.targetId)).toEqual(['deliv-1']);
    expect(projectRptiReturn(context, 2027).map(row => row.targetId)).toEqual(['deliv-2']);
  });

  it('files nothing for a planned segment without a go-live in the report year', () => {
    const segments = [makeSegment({ id: 'seg-planned', status: 'appstatus-planned', startDate: '2026-02-01' })];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments }), 2026);

    expect(rows).toEqual([]);
  });

  it('generates a "new" row for a first in-production segment without planning that year', () => {
    const segments = [makeSegment({ id: 'seg-prod', status: 'appstatus-in-production', startDate: '2026-08-01' })];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments }), 2026);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      developmentType: 'new',
      plannedImplementationQuarter: 'Q3',
      deliverableSegmentId: 'seg-prod',
    });
  });

  it('files nothing for planned and funded phases without a go-live', () => {
    const segments = [
      makeSegment({ id: 'seg-planned', status: 'appstatus-planned', startDate: '2026-01-15' }),
      makeSegment({ id: 'seg-funded', status: 'appstatus-funded', startDate: '2026-04-15' }),
    ];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments }), 2026);

    expect(rows).toEqual([]);
  });

  it('collapses planned + in-production in the same year into one "new" row, quarter from in-production', () => {
    const segments = [
      makeSegment({ id: 'seg-planned', status: 'appstatus-planned', startDate: '2026-01-15' }),
      makeSegment({ id: 'seg-prod', status: 'appstatus-in-production', startDate: '2026-09-01' }),
    ];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments }), 2026);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      developmentType: 'new',
      plannedImplementationQuarter: 'Q3',
      deliverableSegmentId: 'seg-prod',
    });
  });

  it('does not treat last year’s planning as a prior go-live', () => {
    const segments = [
      makeSegment({ id: 'seg-planned', status: 'appstatus-planned', startDate: '2025-01-15', endDate: '2025-02-15' }),
      makeSegment({ id: 'seg-prod', status: 'appstatus-in-production', startDate: '2026-09-01' }),
    ];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments }), 2026);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ developmentType: 'new', deliverableSegmentId: 'seg-prod' });
  });

  it('does not file planned work on a deliverable already live in a prior year', () => {
    const segments = [
      makeSegment({ id: 'seg-went-live-2025', status: 'appstatus-in-production', startDate: '2025-01-01', endDate: '2025-06-01' }),
      makeSegment({ id: 'seg-planned-2026', status: 'appstatus-planned', startDate: '2026-02-01', endDate: '2026-03-01' }),
    ];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments }), 2026);

    expect(rows).toEqual([]);
  });

  it('checks prior-live history deliverable-wide, regardless of which initiative drove the earlier go-live', () => {
    const segments = [
      makeSegment({ id: 'seg-went-live-2025', initiativeId: 'init-2', status: 'appstatus-in-production', startDate: '2025-01-01', endDate: '2025-06-01' }),
      makeSegment({ id: 'seg-live-2026', initiativeId: 'init-1', status: 'appstatus-in-production', startDate: '2026-02-01', endDate: '2026-03-01' }),
    ];
    const initiatives = [makeInitiative({ id: 'init-1' }), makeInitiative({ id: 'init-2' })];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments, initiatives }), 2026);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ initiativeId: 'init-1', developmentType: 'upgrade' });
  });

  it('excludes sunset, out-of-support, and retired segments entirely', () => {
    const segments = [
      makeSegment({ id: 'seg-sunset', status: 'appstatus-sunset', startDate: '2026-02-01' }),
      makeSegment({ id: 'seg-oos', status: 'appstatus-out-of-support', startDate: '2026-05-01' }),
      makeSegment({ id: 'seg-retired', status: 'appstatus-retired', startDate: '2026-08-01' }),
    ];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments }), 2026);

    expect(rows).toHaveLength(0);
  });

  it('excludes segments with no linked initiative', () => {
    const segments = [makeSegment({ id: 'seg-unlinked', initiativeId: undefined })];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments }), 2026);

    expect(rows).toHaveLength(0);
  });

  it('excludes a segment with an unrecognized custom status — generation is an allow-list, not a deny-list', () => {
    const customStatuses = [...statuses, { id: 'appstatus-cancelled', name: 'Cancelled', color: 'red' }];
    const segments = [makeSegment({ status: 'appstatus-cancelled' })];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments, deliverableStatuses: customStatuses }), 2026);

    expect(rows).toHaveLength(0);
  });

  it('does not file an explicitly flagged pre-launch phase', () => {
    const customStatuses = [
      { id: 'appstatus-in-production', name: 'In Production', color: 'green', isLiveStatus: true },
      { id: 'status-custom-approved', name: 'Budget Approved', color: 'blue', isPreLaunchStatus: true },
    ];
    const segments = [makeSegment({ status: 'status-custom-approved' })];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments, deliverableStatuses: customStatuses }), 2026);

    expect(rows).toEqual([]);
  });

  it('stops guessing from id/name once any status has isPreLaunchStatus explicitly set', () => {
    const customStatuses = [
      { id: 'appstatus-planned', name: 'Planned', color: 'slate' }, // no explicit flag
      { id: 'status-custom-approved', name: 'Budget Approved', color: 'blue', isPreLaunchStatus: true },
    ];
    const segments = [makeSegment({ status: 'appstatus-planned' })];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments, deliverableStatuses: customStatuses }), 2026);

    // An unflagged Planned status also cannot start an implementation.
    expect(rows).toHaveLength(0);
  });

  it('excludes a segment linked to a placeholder Initiative', () => {
    const initiatives = [makeInitiative({ isPlaceholder: true })];
    const segments = [makeSegment()];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments, initiatives }), 2026);

    expect(rows).toHaveLength(0);
  });

  it('excludes segments entirely outside the report year (no overlap)', () => {
    const segments = [makeSegment({ id: 'seg-2025', startDate: '2025-06-01', endDate: '2025-07-01' })];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments }), 2026);

    expect(rows).toHaveLength(0);
  });

  it('does not refile a segment that started before the report year', () => {
    const segments = [makeSegment({ id: 'seg-straddle', startDate: '2025-11-01', endDate: '2026-02-01' })];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments }), 2026);

    expect(rows).toEqual([]);
  });

  it('includes a segment that starts in the report year and ends after it', () => {
    const segments = [makeSegment({ id: 'seg-tail', startDate: '2026-11-01', endDate: '2027-02-01' })];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments }), 2026);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ deliverableSegmentId: 'seg-tail' });
  });

  it('files every implementation target, including one beyond the initiative’s old declared target', () => {
    const segments = [
      makeSegment({ id: 'seg-a', deliverableId: 'deliv-a', initiativeId: 'init-1' }),
      makeSegment({ id: 'seg-b', deliverableId: 'deliv-b', initiativeId: 'init-1' }),
      makeSegment({ id: 'seg-c', deliverableId: 'deliv-a', initiativeId: 'init-2' }),
    ];
    const initiatives = [
      makeInitiative({ id: 'init-1' }),
      makeInitiative({ id: 'init-2' }),
    ];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments, initiatives }), 2026);

    expect(rows).toHaveLength(3);
    expect(rows.map(row => row.targetId)).toEqual(['deliv-a', 'deliv-b', 'deliv-a']);
  });

  it('produces no rows when there is no qualifying segment data', () => {
    expect(projectRptiReturn(makeContext(), 2026)).toEqual([]);
  });
});

describe('RPTI implementation-grain filing (003, Phase 3)', () => {
  const goLive = (id: string, startDate: string, deliverableId = 'deliv-1') =>
    makeSegment({ id, startDate, endDate: '2031-12-31', deliverableId, status: 'appstatus-in-production' });

  it('files a cross-year run-up only when its go-live starts (T013b)', () => {
    const context = makeContext({ deliverables: [makeDeliverable()], deliverableSegments: [
      makeSegment({ id: 'run-up', startDate: '2026-07-01', endDate: '2027-03-31', status: 'appstatus-planned' }),
      goLive('go-live', '2027-04-01'),
    ] });
    expect(projectRptiReturn(context, 2026)).toEqual([]);
    expect(projectRptiReturn(context, 2027)).toMatchObject([
      { deliverableSegmentId: 'go-live', developmentType: 'new', plannedImplementationQuarter: 'Q2' },
    ]);
  });

  it('types a first go-live new and a later-year go-live upgrade from deliverable history (T013c)', () => {
    const context = makeContext({ deliverables: [makeDeliverable()], deliverableSegments: [
      goLive('first-live', '2026-07-01'), goLive('later-live', '2027-04-01'),
    ] });
    expect(projectRptiReturn(context, 2026)).toMatchObject([
      { deliverableSegmentId: 'first-live', developmentType: 'new' },
    ]);
    expect(projectRptiReturn(context, 2027)).toMatchObject([
      { deliverableSegmentId: 'later-live', developmentType: 'upgrade' },
    ]);
  });

  it('files both Q2 and Q4 go-lives of one application (T007)', () => {
    const rows = projectRptiReturn(makeContext({
      deliverables: [makeDeliverable()],
      deliverableSegments: [goLive('q2', '2027-04-01'), goLive('q4', '2027-10-01')],
    }), 2027);
    expect(rows.map(row => [row.deliverableSegmentId, row.plannedImplementationQuarter]))
      .toEqual([['q2', 'Q2'], ['q4', 'Q4']]);
    expect(new Set(rows.map(row => row.id)).size).toBe(2);
  });

  it('files an open-ended go-live only in its start year (T008)', () => {
    const context = makeContext({ deliverables: [makeDeliverable()],
      deliverableSegments: [goLive('go-live', '2027-04-01')] });
    expect([2027, 2028, 2029, 2030, 2031].map(year => projectRptiReturn(context, year).length))
      .toEqual([1, 0, 0, 0, 0]);
  });

  it('does not file an old live phase again during its retirement year (R1)', () => {
    const rows = projectRptiReturn(makeContext({ deliverables: [makeDeliverable()],
      deliverableSegments: [makeSegment({ id: 'old-live', startDate: '2020-01-01',
        endDate: '2031-12-31', status: 'appstatus-in-production' }),
        makeSegment({ id: 'retirement', startDate: '2027-07-01', endDate: '2027-12-31',
          status: 'appstatus-retired' })] }), 2027);
    expect(rows).toEqual([]);
  });

  it('omits an other-year implementation without a reconciliation finding (T008a)', () => {
    const segment = makeSegment({ id: 'prior-year', startDate: '2026-04-01', endDate: '2028-12-31',
      status: 'appstatus-in-production' });
    const context = makeContext({ deliverables: [makeDeliverable()], deliverableSegments: [segment] });
    expect(projectRptiReturn(context, 2027)).toEqual([]);
    expect(reconcileRptiReturn({ ...context, storedDetails: [{
      id: 'filed-2026', initiativeId: 'init-1', targetType: 'deliverable',
      targetId: 'deliv-1', developmentType: 'upgrade', deliverableSegmentId: segment.id,
    }] })).toEqual([]);
  });

  it('files each go-live separately and ignores the run-up (T009)', () => {
    const rows = projectRptiReturn(makeContext({ deliverables: [makeDeliverable()],
      deliverableSegments: [
        makeSegment({ id: 'run-up', startDate: '2027-02-01', status: 'appstatus-planned' }),
        goLive('first-live', '2027-04-01'), goLive('second-live', '2027-10-01'),
      ] }), 2027);
    expect(rows.map(row => [row.deliverableSegmentId, row.developmentType, row.plannedImplementationQuarter]))
      .toEqual([['first-live', 'new', 'Q2'], ['second-live', 'upgrade', 'Q4']]);
  });

  // new/upgrade is decided against everything live before *this* implementation, not
  // before the filing year. Deciding it per year would state that the same application
  // was built from nothing twice in one return — the Q4 line is an enhancement to what
  // the Q2 line delivered, and the deliverable-wide reading of "has this ever been
  // live" is the same one hasPriorLiveSegment always applied across years.
  it('types the second go-live of a brand-new application as an upgrade', () => {
    const rows = projectRptiReturn(makeContext({ deliverables: [makeDeliverable()],
      deliverableSegments: [goLive('first', '2027-04-01'), goLive('second', '2027-10-01')] }), 2027);
    expect(rows.map(row => [row.deliverableSegmentId, row.developmentType]))
      .toEqual([['first', 'new'], ['second', 'upgrade']]);
  });

  it('types a go-live new when an earlier live phase starts on the same day', () => {
    const rows = projectRptiReturn(makeContext({ deliverables: [makeDeliverable()],
      deliverableSegments: [goLive('a-same-day', '2027-04-01'), goLive('z-same-day', '2027-04-01')] }), 2027);
    expect(rows.map(row => row.developmentType)).toEqual(['new', 'new']);
  });

  it('files both applications of a multi-application initiative (T010)', () => {
    const rows = projectRptiReturn(makeContext({
      deliverables: [makeDeliverable(), makeDeliverable({ id: 'deliv-2', name: 'Second App' })],
      deliverableSegments: [goLive('first', '2027-04-01'), goLive('second', '2027-10-01', 'deliv-2')],
    }), 2027);
    expect(rows.map(row => row.targetId)).toEqual(['deliv-1', 'deliv-2']);
  });

  it('carries the same application-level filing values on both implementations (T010a)', () => {
    const deliverable = makeDeliverable({ categoryCode: '06', developer: 'Vendor', ppjtiRelatedParty: 'yes',
      dcCity: 'Jakarta', dcCountry: 'Indonesia', drCity: 'Surabaya', drCountry: 'Indonesia', platform: 'Linux' });
    const rows = projectRptiReturn(makeContext({ deliverables: [deliverable],
      deliverableSegments: [goLive('q2', '2027-04-01'), goLive('q4', '2027-10-01')] }), 2027);
    expect(rows).toHaveLength(2);
    expect(rows.map(({ categoryCode, developer, ppjtiRelatedParty, dcCity, dcCountry, drCity, drCountry }) =>
      ({ categoryCode, developer, ppjtiRelatedParty, dcCity, dcCountry, drCity, drCountry })))
      .toEqual(Array(2).fill({ categoryCode: '06', developer: 'PPJTI', ppjtiRelatedParty: 'yes',
        dcCity: 'Jakarta', dcCountry: 'Indonesia', drCity: 'Surabaya', drCountry: 'Indonesia' }));
    expect(deliverable.platform).toBe('Linux');
  });

  it('orders same-date implementations by stable segment identity regardless of input order (T015)', () => {
    const first = goLive('a-segment', '2027-04-01');
    const last = goLive('z-segment', '2027-04-01');
    const context = makeContext({ deliverables: [makeDeliverable()], deliverableSegments: [last, first] });
    const reversed = { ...context, deliverableSegments: [first, last] };
    const rows = projectRptiReturn(context, 2027);
    expect(rows.map(row => row.deliverableSegmentId)).toEqual(['a-segment', 'z-segment']);
    expect(projectRptiReturn(reversed, 2027)).toEqual(rows);
  });

  it('preserves every filed value and row order for ordinary single-implementation initiatives (T011)', () => {
    const initiatives = [
      makeInitiative({ id: 'init-b', description: 'Build B', capex: 202, opex: 22 }),
      makeInitiative({ id: 'init-a', description: 'Build A', capex: 101, opex: 11 }),
    ];
    const deliverables = [
      makeDeliverable({ id: 'deliv-b', name: 'Application B', categoryCode: '05', developer: 'Vendor B',
        ppjtiRelatedParty: 'no', dcCity: 'Jakarta', dcCountry: 'Indonesia', drCity: 'Batam', drCountry: 'Indonesia' }),
      makeDeliverable({ id: 'deliv-a', name: 'Application A', categoryCode: '06', developer: 'inhouse',
        dcCity: 'Bandung', dcCountry: 'Indonesia' }),
    ];
    const segments = [
      makeSegment({ id: 'b-run-up', initiativeId: 'init-b', deliverableId: 'deliv-b',
        startDate: '2027-01-01', endDate: '2027-03-31', status: 'appstatus-planned' }),
      makeSegment({ id: 'b-live', initiativeId: 'init-b', deliverableId: 'deliv-b',
        startDate: '2027-05-01', endDate: '2031-12-31', status: 'appstatus-in-production',
        capexAmount: 202, opexAmount: 22 }),
      makeSegment({ id: 'a-live', initiativeId: 'init-a', deliverableId: 'deliv-a',
        startDate: '2027-11-01', endDate: '2031-12-31', status: 'appstatus-in-production',
        capexAmount: 101, opexAmount: 11, rptiRemarks: 'A remark' }),
    ];
    const rows = projectRptiReturn(makeContext({ initiatives, deliverables, deliverableSegments: segments }), 2027);
    // These are the workbook's filed values in its row order. Internal row and segment IDs
    // are excluded: neither appears in the export, and IDs now belong to implementations.
    const filed = rows.map((row, index) => {
      const initiative = initiatives.find(i => i.id === row.initiativeId);
      const deliverable = deliverables.find(d => d.id === row.targetId);
      return [index + 1, deliverable?.name, initiative?.description, row.categoryCode,
        row.developmentType, row.developer, row.ppjtiRelatedParty,
        row.dcCity, row.dcCountry, row.drCity, row.drCountry,
        row.plannedImplementationQuarter, ...Object.values(resolveCost(row, segments)), row.remarks];
    });
    expect(filed).toEqual([
      [1, 'Application B', 'Build B', '05', 'new', 'PPJTI', 'no',
        'Jakarta', 'Indonesia', 'Batam', 'Indonesia', 'Q2', 202, 22, undefined],
      [2, 'Application A', 'Build A', '06', 'new', 'inhouse', 'n/a',
        'Bandung', 'Indonesia', undefined, undefined, 'Q4', 101, 11, 'A remark'],
    ]);
  });
});

describe('RPTI implementation-owned filed values (003, Phase 4)', () => {
  const implementation = (id: string, startDate: string, values: Partial<DeliverableSegment> = {}) =>
    makeSegment({ id, startDate, endDate: '2031-12-31', ...values });

  it('files each implementation\'s own CapEx and OpEx (T017)', () => {
    const segments = [
      implementation('phase-1', '2027-04-01', { capexAmount: 400, opexAmount: 40 }),
      implementation('phase-2', '2027-10-01', { capexAmount: 600, opexAmount: 60 }),
    ];
    const rows = projectRptiReturn(makeContext({ deliverables: [makeDeliverable()], deliverableSegments: segments }), 2027);

    expect(rows.map(row => resolveCost(row, segments))).toEqual([
      { capexAmount: 400, opexAmount: 40 },
      { capexAmount: 600, opexAmount: 60 },
    ]);
  });

  it('keeps the filed total unchanged when one implementation is split in two (T017a, SC-005)', () => {
    const total = (segments: DeliverableSegment[]) => projectRptiReturn(
      makeContext({ deliverables: [makeDeliverable()], deliverableSegments: segments }), 2027,
    ).reduce((sum, row) => sum + resolveCost(row, segments).capexAmount, 0);

    expect(total([implementation('whole', '2027-04-01', { capexAmount: 1000 })])).toBe(1000);
    expect(total([
      implementation('part-1', '2027-04-01', { capexAmount: 400 }),
      implementation('part-2', '2027-10-01', { capexAmount: 600 }),
    ])).toBe(1000);
  });

  it('files each implementation\'s own Keterangan (T018)', () => {
    const segments = [
      implementation('phase-1', '2027-04-01', { rptiRemarks: 'Phase one' }),
      implementation('phase-2', '2027-10-01', { rptiRemarks: 'Phase two' }),
    ];
    const rows = projectRptiReturn(makeContext({ deliverables: [makeDeliverable()], deliverableSegments: segments }), 2027);

    expect(rows.map(row => row.remarks)).toEqual(['Phase one', 'Phase two']);
  });

  it('files zero without throwing when an implementation states no cost (T019)', () => {
    const segments = [implementation('unstated', '2027-04-01')];
    const rows = projectRptiReturn(makeContext({ deliverables: [makeDeliverable()], deliverableSegments: segments }), 2027);

    expect(() => resolveCost(rows[0], segments)).not.toThrow();
    expect(resolveCost(rows[0], segments)).toEqual({ capexAmount: 0, opexAmount: 0 });
  });

  it('never reads a divergent initiative budget as the filing source (T020)', () => {
    const initiatives = [makeInitiative({ capex: 9999, opex: 999 })];
    const segments = [implementation('filed', '2027-04-01', { capexAmount: 321, opexAmount: 32 })];
    const [row] = projectRptiReturn(makeContext({ initiatives, deliverables: [makeDeliverable()], deliverableSegments: segments }), 2027);

    expect(resolveCost(row, segments)).toEqual({ capexAmount: 321, opexAmount: 32 });
  });
});

describe('projectRptiReturn — categoryCode auto-fill', () => {
  const segments = [makeSegment({ id: 'seg-live', startDate: '2026-02-01' })];

  it('uses the Deliverable.categoryCode when set', () => {
    const deliverables = [makeDeliverable({ categoryCode: '06' })];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments, deliverables }), 2026);

    expect(rows[0].categoryCode).toBe('06');
  });

  it('falls back to the AssetCategory default (via Asset.categoryId) when the Deliverable has none', () => {
    const deliverables = [makeDeliverable()];
    const assets = [makeAsset({ categoryId: 'cat-1' })];
    const assetCategories = [makeAssetCategory({ id: 'cat-1', categoryCode: '07' })];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments, deliverables, assets, assetCategories }), 2026);

    expect(rows[0].categoryCode).toBe('07');
  });

  it('Deliverable.categoryCode overrides the AssetCategory default when both are set', () => {
    const deliverables = [makeDeliverable({ categoryCode: '04' })];
    const assets = [makeAsset({ categoryId: 'cat-1' })];
    const assetCategories = [makeAssetCategory({ id: 'cat-1', categoryCode: '07' })];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments, deliverables, assets, assetCategories }), 2026);

    expect(rows[0].categoryCode).toBe('04');
  });

  it('leaves categoryCode undefined when neither the Deliverable nor its AssetCategory has one', () => {
    const deliverables = [makeDeliverable()];
    const assets = [makeAsset({ categoryId: 'cat-1' })];
    const assetCategories = [makeAssetCategory({ id: 'cat-1' })];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments, deliverables, assets, assetCategories }), 2026);

    expect(rows[0].categoryCode).toBeUndefined();
  });
});

describe('projectRptiReturn — developer / ppjtiRelatedParty auto-fill', () => {
  const segments = [makeSegment({ id: 'seg-live', startDate: '2026-02-01' })];

  it('uses Deliverable.developer, and auto-fills ppjtiRelatedParty to "n/a" for in-house', () => {
    const deliverables = [makeDeliverable({ developer: 'inhouse' })];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments, deliverables }), 2026);

    expect(rows[0].developer).toBe('inhouse');
    expect(rows[0].ppjtiRelatedParty).toBe('n/a');
  });

  it('leaves ppjtiRelatedParty blank for manual entry when developer is PPJTI', () => {
    const deliverables = [makeDeliverable({ developer: 'PPJTI' })];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments, deliverables }), 2026);

    expect(rows[0].developer).toBe('PPJTI');
    expect(rows[0].ppjtiRelatedParty).toBeUndefined();
  });

  it('auto-fills ppjtiRelatedParty to "n/a" when developer is not set at all (no category-level default exists)', () => {
    const deliverables = [makeDeliverable()];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments, deliverables }), 2026);

    expect(rows[0].developer).toBeUndefined();
    expect(rows[0].ppjtiRelatedParty).toBe('n/a');
  });
});

describe('projectRptiReturn — DC/DR location auto-fill', () => {
  const segments = [makeSegment({ id: 'seg-live', startDate: '2026-02-01' })];

  it('uses the Deliverable location fields when set', () => {
    const deliverables = [makeDeliverable({ dcCity: 'Jakarta', dcCountry: 'Indonesia', drCity: 'Surabaya', drCountry: 'Indonesia' })];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments, deliverables }), 2026);

    expect(rows[0]).toMatchObject({ dcCity: 'Jakarta', dcCountry: 'Indonesia', drCity: 'Surabaya', drCountry: 'Indonesia' });
  });

  it('falls back to the AssetCategory defaults when the Deliverable has none', () => {
    const deliverables = [makeDeliverable()];
    const assets = [makeAsset({ categoryId: 'cat-1' })];
    const assetCategories = [makeAssetCategory({ id: 'cat-1', dcCity: 'Singapore', dcCountry: 'Singapore', drCity: 'Batam', drCountry: 'Indonesia' })];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments, deliverables, assets, assetCategories }), 2026);

    expect(rows[0]).toMatchObject({ dcCity: 'Singapore', dcCountry: 'Singapore', drCity: 'Batam', drCountry: 'Indonesia' });
  });

  it('resolves each location field independently — a Deliverable can override just one field', () => {
    const deliverables = [makeDeliverable({ dcCity: 'Jakarta' })]; // only dcCity overridden
    const assets = [makeAsset({ categoryId: 'cat-1' })];
    const assetCategories = [makeAssetCategory({ id: 'cat-1', dcCity: 'Singapore', dcCountry: 'Singapore', drCity: 'Batam', drCountry: 'Indonesia' })];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments, deliverables, assets, assetCategories }), 2026);

    expect(rows[0]).toMatchObject({ dcCity: 'Jakarta', dcCountry: 'Singapore', drCity: 'Batam', drCountry: 'Indonesia' });
  });

  it('leaves location fields undefined when neither the Deliverable nor its AssetCategory has them', () => {
    const deliverables = [makeDeliverable()];
    const assets = [makeAsset({ categoryId: 'cat-1' })];
    const assetCategories = [makeAssetCategory({ id: 'cat-1' })];
    const rows = projectRptiReturn(makeContext({ deliverableSegments: segments, deliverables, assets, assetCategories }), 2026);

    expect(rows[0].dcCity).toBeUndefined();
    expect(rows[0].dcCountry).toBeUndefined();
    expect(rows[0].drCity).toBeUndefined();
    expect(rows[0].drCountry).toBeUndefined();
  });
});

describe('periodForQuarter', () => {
  // The inverse of deriveQuarterFromDate. Needed because a filed RPTI return
  // states a planned implementation quarter with no year and no dates, so
  // imported work has to be given a period (spec FR-016).
  it('maps each quarter to its calendar span within the given year', () => {
    expect(periodForQuarter('Q1', 2027)).toEqual({ startDate: '2027-01-01', endDate: '2027-03-31' });
    expect(periodForQuarter('Q2', 2027)).toEqual({ startDate: '2027-04-01', endDate: '2027-06-30' });
    expect(periodForQuarter('Q3', 2027)).toEqual({ startDate: '2027-07-01', endDate: '2027-09-30' });
    expect(periodForQuarter('Q4', 2027)).toEqual({ startDate: '2027-10-01', endDate: '2027-12-31' });
  });

  it('round-trips through deriveQuarterFromDate for both boundaries', () => {
    // If this ever fails, an imported row would regenerate into a different
    // quarter than the one the bank filed.
    for (const q of ['Q1', 'Q2', 'Q3', 'Q4'] as const) {
      const { startDate, endDate } = periodForQuarter(q, 2027);
      expect(deriveQuarterFromDate(startDate)).toBe(q);
      expect(deriveQuarterFromDate(endDate)).toBe(q);
    }
  });

  it('handles a leap year without shifting Q1', () => {
    expect(periodForQuarter('Q1', 2028)).toEqual({ startDate: '2028-01-01', endDate: '2028-03-31' });
  });

  it('is year-agnostic in shape', () => {
    expect(periodForQuarter('Q3', 2026).startDate).toBe('2026-07-01');
    expect(periodForQuarter('Q3', 2030).endDate).toBe('2030-09-30');
  });
});

describe('an application that is continuously live counts as pre-existing', () => {
  /**
   * The case every earlier test missed. Each of them gave the deliverable a live
   * segment that had already *ended* before the report year, so "ended before" and
   * "started before" were indistinguishable. A real bank application is not like
   * that: an LKPTI entry means "live as at 31 December", so its segment straddles
   * the report year and never ends before it. Under the old rule, planning an
   * enhancement to an application the bank actually runs filed it as a brand-new
   * build.
   */
  const stillLive = () => makeSegment({
    id: 'seg-live-since-2021', status: 'appstatus-in-production',
    startDate: '2021-08-17', endDate: '2031-12-31', initiativeId: undefined,
  });

  it('does not file planned work on a continuously live application', () => {
    const rows = projectRptiReturn(makeContext({
      deliverableSegments: [
        stillLive(),
        makeSegment({ id: 'seg-plan-2027', status: 'appstatus-planned', startDate: '2027-01-01', endDate: '2027-03-31' }),
      ],
      initiatives: [makeInitiative({ startDate: '2027-01-01', endDate: '2027-03-31' })],
    }), 2027);

    expect(rows).toEqual([]);
  });

  it('still calls a first-ever build "new" — nothing of it was live before the year', () => {
    const rows = projectRptiReturn(makeContext({
      deliverableSegments: [
        makeSegment({ id: 'seg-plan-2027', status: 'appstatus-planned', startDate: '2027-01-01', endDate: '2027-06-30' }),
        makeSegment({ id: 'seg-live-2027', status: 'appstatus-in-production', startDate: '2027-06-30', endDate: '2030-12-31' }),
      ],
      initiatives: [makeInitiative({ startDate: '2027-01-01', endDate: '2027-06-30' })],
    }), 2027);

    expect(rows).toHaveLength(1);
    expect(rows[0].developmentType).toBe('new');
  });
});


describe('projectRptiReturn is the selected-year projection only (#40)', () => {
  /**
   * The defect: the Reports path supplied stored rows as `existingDetails`, so
   * `mergeWithExisting` carried every unmatched row into the return — a 2027 plan
   * line inside a 2026 filing. The projection API has no such input: membership is
   * derived from the workspace's canonical entities for the requested year, full stop.
   */
  const plan2027Only = () => makeContext({
    deliverables: [makeDeliverable()],
    deliverableSegments: [makeSegment({ id: 'seg-2027', startDate: '2027-02-01', endDate: '2027-03-31' })],
  });

  it('returns nothing for a year the plan does not touch', () => {
    expect(projectRptiReturn(plan2027Only(), 2027)).toHaveLength(1);
    expect(projectRptiReturn(plan2027Only(), 2026)).toEqual([]);
    expect(projectRptiReturn(plan2027Only(), 2028)).toEqual([]);
  });

  it('cannot be handed stored rows — the projection input has no existingDetails', () => {
    const input = plan2027Only();
    // @ts-expect-error — compile-time guard (option 3): passing stored rows to the
    // projection must be a type error, not a runtime possibility.
    projectRptiReturn({ ...input, existingDetails: [] }, 2026);
  });
});

describe('reconcileRptiReturn — stored rows are reconciliation evidence, never projection members (#40)', () => {
  /**
   * Selected-year membership and reproducibility are independent questions. A valid
   * 2027 row absent from a 2026 projection is correct; an asset-target or dangling
   * row is unreproducible in *any* year. The reconciler reports only the latter, and
   * returns findings — messages naming a source-side repair — not rows.
   */
  const storedRow = (overrides: Partial<RptiDetail> = {}): RptiDetail => ({
    id: 'row-1', initiativeId: 'init-1', targetType: 'deliverable', targetId: 'deliv-1',
    developmentType: 'new', ...overrides,
  });
  const segment = (overrides: Partial<DeliverableSegment> = {}) => makeSegment({
    id: 'seg-live-2027', status: 'appstatus-in-production',
    startDate: '2027-02-01', endDate: '2027-03-31', ...overrides,
  });
  const ctx = (storedDetails: RptiDetail[], segments: DeliverableSegment[]) => ({
    storedDetails,
    initiatives: [makeInitiative()],
    deliverables: [makeDeliverable()],
    deliverableSegments: segments,
    deliverableStatuses: statuses,
  });

  it('matches a stored row to its one anchored implementation even when the legacy declared target disagrees (T036)', () => {
    const input = ctx([storedRow({ deliverableSegmentId: 'seg-live-2027' })], [segment()]);
    input.initiatives = [withLegacyDeclaredTarget(makeInitiative(), 'legacy-declared-other')];

    expect(reconcileRptiReturn(input)).toEqual([]);
  });

  it('reports both one implementation claimed twice and one legacy row matching several implementations (T037)', () => {
    const oneImplementation = ctx([
      storedRow({ deliverableSegmentId: 'seg-live-2027' }),
      storedRow({ id: 'row-2', deliverableSegmentId: 'seg-live-2027' }),
    ], [segment()]);
    expect(reconcileRptiReturn(oneImplementation).map(finding => finding.reason))
      .toEqual(['identity-conflict', 'identity-conflict']);

    const severalImplementations = ctx([storedRow()], [
      segment({ id: 'seg-live-2027-a' }),
      segment({ id: 'seg-live-2027-b', startDate: '2027-08-01' }),
    ]);
    expect(reconcileRptiReturn(severalImplementations)).toMatchObject([
      { rowId: 'row-1', reason: 'identity-conflict' },
    ]);
  });

  it('names an anchored stored row whose implementation no longer exists and gives a repair that can clear it (T038)', () => {
    const findings = reconcileRptiReturn(ctx([
      storedRow({ deliverableSegmentId: 'deleted-implementation' }),
    ], [segment()]));

    expect(findings).toMatchObject([{ rowId: 'row-1' }]);
    // #51 review: a recreated segment is a different implementation and, by this very
    // rule, can never clear the finding, so the repair is a restore or a re-import.
    expect(findings[0].message).toMatch(/History tab/);
    expect(findings[0].message).toMatch(/re-import the filing/i);
    expect(findings[0].message).not.toMatch(/segment panel/i);
  });

  it('matches only by implementation identity when stored contents differ from projection (T039)', () => {
    const input = ctx([storedRow({
      deliverableSegmentId: 'seg-live-2027', plannedImplementationQuarter: 'Q4', remarks: 'filed wording',
    })], [segment({ startDate: '2027-05-01', rptiRemarks: 'current wording' })]);
    input.initiatives = [withLegacyDeclaredTarget(makeInitiative(), 'legacy-declared-other')];

    expect(reconcileRptiReturn(input)).toEqual([]);
  });

  it('returns findings rather than rows and does not mutate frozen reconciliation inputs (T039a)', () => {
    const storedDetails = Object.freeze([Object.freeze(storedRow())]);
    const deliverableSegments = Object.freeze([
      Object.freeze(segment({ id: 'seg-a' })),
      Object.freeze(segment({ id: 'seg-b', startDate: '2027-08-01' })),
    ]);
    const initiatives = Object.freeze([Object.freeze(makeInitiative())]);
    const deliverables = Object.freeze([Object.freeze(makeDeliverable())]);
    const deliverableStatuses = Object.freeze(statuses.map(status => Object.freeze({ ...status })));

    const run = () => reconcileRptiReturn({
      storedDetails: storedDetails as RptiDetail[],
      initiatives: initiatives as Initiative[],
      deliverables: deliverables as Deliverable[],
      deliverableSegments: deliverableSegments as DeliverableSegment[],
      deliverableStatuses: deliverableStatuses as DeliverableStatus[],
    });
    expect(run).not.toThrow();
    const findings = run();
    expect(findings).toMatchObject([{ rowId: 'row-1', reason: 'identity-conflict' }]);
    expect(findings[0]).not.toHaveProperty('targetType');
  });
  /** The four states the merge conflated, as a table. */
  const cases: { name: string; stored: RptiDetail[]; segments: DeliverableSegment[]; expectFinding: boolean; pattern?: RegExp }[] = [
    {
      name: 'same-year reproducible', stored: [storedRow()], segments: [segment({ startDate: '2026-02-01', endDate: '2026-03-31' })], expectFinding: false,
    },
    {
      name: 'other-year reproducible — absent from 2026, but NOT a defect', stored: [storedRow()], segments: [segment()], expectFinding: false,
    },
    {
      name: 'unsupported asset target before the named repair', stored: [storedRow({ targetType: 'asset', targetId: 'asset-1' })], segments: [], expectFinding: true,
      pattern: /segment panel/i,
    },
    {
      name: 'dangling target before the named repair', stored: [storedRow({ targetId: 'deliv-gone' })], segments: [], expectFinding: true,
      pattern: /segment panel/i,
    },
  ];
  for (const c of cases) {
    it(`reports nothing for: ${c.name}`, () => {
      const findings = reconcileRptiReturn(ctx(c.stored, c.segments));
      if (!c.expectFinding) {
        expect(findings, c.name).toEqual([]);
      } else {
        expect(findings, c.name).toHaveLength(1);
        expect(findings[0].message).toMatch(c.pattern!);
        expect(findings[0].rowId).toBe(c.stored[0].id);
      }
    });
  }

  it('names every source step when the initiative is gone but its target survives', () => {
    const findings = reconcileRptiReturn(ctx([storedRow({ initiativeId: 'init-gone' })], []));
    expect(findings).toHaveLength(1);
    expect(findings[0].reason).toBe('missing-initiative');
    expect(findings[0].message).toMatch(/segment panel/i);
    expect(findings[0].message).toMatch(/timeline/i);
  });

  it('directs re-import when both identity anchors are gone', () => {
    const findings = reconcileRptiReturn(ctx([storedRow({ initiativeId: 'init-gone', targetId: 'deliv-gone' })], []));
    expect(findings).toHaveLength(1);
    expect(findings[0].reason).toBe('missing-initiative');
    expect(findings[0].message).toMatch(/both.*missing.*re-import/i);
  });

  it('keeps an asset-target finding until the named source repair also adds its segment', () => {
    const row = storedRow({ targetType: 'asset', targetId: 'asset-1' });
    const repaired = ctx([row], []);
    const partial = reconcileRptiReturn(repaired);
    expect(partial).toHaveLength(1);
    expect(partial[0].reason).toBe('asset-target');
    expect(partial[0].message).toMatch(/segment panel/i);
    expect(partial[0].message).toMatch(/timeline/i);

    repaired.deliverableSegments = [segment()];
    expect(reconcileRptiReturn(repaired)).toEqual([]);
  });

  it('keeps a missing-target finding until its replacement also has the named segment', () => {
    const repaired = ctx([storedRow({ targetId: 'deliv-gone' })], []);
    const partial = reconcileRptiReturn(repaired);
    expect(partial).toHaveLength(1);
    expect(partial[0].reason).toBe('missing-target');
    expect(partial[0].message).toMatch(/segment panel/i);
    expect(partial[0].message).toMatch(/timeline/i);

    repaired.deliverableSegments = [segment()];
    expect(reconcileRptiReturn(repaired)).toEqual([]);
  });

  // #51 interim fix (Q22). Following the old message cleared the gate while the
  // return then filed `new`, 0/0 and an empty Keterangan instead of what was filed.
  describe('the manual repair must say which filed values it does not carry over (#51)', () => {
    const unresolved = storedRow({
      id: 'rpti-import-row-1', targetId: 'rpti-import-unresolved-1', developmentType: 'upgrade',
      plannedImplementationQuarter: 'Q3', remarks: 'Not present in the 2026 LKPTI',
    });
    const importedInitiative = makeInitiative({
      name: 'Core Banking GL — Q3 2027', capex: 2_900_000_000, opex: 640_000_000,
    });
    const messageFor = (row: RptiDetail) => {
      const input = ctx([row], []);
      input.initiatives = [importedInitiative];
      const findings = reconcileRptiReturn(input);
      expect(findings).toHaveLength(1); // guard: otherwise every assertion below is vacuous
      expect(findings[0].reason).toBe('missing-target');
      return findings[0].message;
    };

    it('does not claim an unresolved import\'s application once existed', () => {
      const message = messageFor(unresolved);
      expect(message).not.toMatch(/no longer exists/i);
      // An ambiguous match is unresolved too (several entries, not none).
      expect(message).toMatch(/could not match to exactly one entry in your inventory/i);
    });

    it('does not call an infrastructure row an application (Codex review)', () => {
      // Ambiguous infrastructure matches stay unresolved (FR-019a creates only on no match).
      const message = messageFor({ ...unresolved, categoryCode: '51' });
      expect(message).not.toMatch(/application/i);
    });

    it('does not present a possibly edited budget as the filed figures (Codex review)', () => {
      // The stored row holds no cost (FR-026), so the budget is the best available
      // source, but it may have been edited since import (Q22).
      expect(messageFor(unresolved)).toMatch(/current budget.*check it against the filed return/i);
    });

    it('states each filed value the manual repair would otherwise lose', () => {
      const message = messageFor(unresolved);
      expect(message).toMatch(/earlier live segment/i);
      expect(message).toMatch(/as new instead of upgrade/i);
      expect(message).toMatch(/Q3/);
      expect(message).toContain((2_900_000_000).toLocaleString());
      expect(message).toContain((640_000_000).toLocaleString());
      expect(message).toContain('"Not present in the 2026 LKPTI"');
    });

    it('keeps "no longer exists" for a deleted application, and warns about the same values', () => {
      const message = messageFor(storedRow({ targetId: 'deliv-gone', developmentType: 'upgrade', remarks: 'kept' }));
      expect(message).toMatch(/no longer exists/i);
      expect(message).toMatch(/as new instead of upgrade/i);
      // A reassigned existing segment keeps its values, so only a new one files 0 (Codex review).
      expect(message).toMatch(/a new segment's CapEx and OpEx file as 0/);
      expect(message).toMatch(/a new segment's Keterangan files empty unless entered as "kept"/);
    });

    it('ends as one sentence whether or not the filed remark ends in a full stop', () => {
      for (const row of [unresolved, { ...unresolved, remarks: 'ends with a stop.' }, { ...unresolved, remarks: undefined }]) {
        const message = messageFor(row);
        expect(message).toMatch(/[^.;]\.$/);
        expect(message).not.toContain('.".');
      }
    });

    it('states the filed Deliverable attributes a bare new Deliverable would file differently (Codex review)', () => {
      // Measured on the sample: a bare repair filed category 01, no developer and empty
      // DC/DR where the row filed 12, inhouse, Jakarta and Surabaya, with no finding at all.
      const message = messageFor({ ...unresolved, categoryCode: '12', developer: 'inhouse',
        dcCity: 'Jakarta', dcCountry: 'Indonesia', drCity: 'Surabaya', drCountry: 'Indonesia' });
      expect(message).toContain('Category Code Override 12');
      expect(message).toContain('Developer inhouse');
      // The Deliverables tab has four separate fields, not combined ones (Codex review).
      expect(message).toContain('DC City Override Jakarta, DC Country Override Indonesia');
      expect(message).toContain('DR City Override Surabaya, DR Country Override Indonesia');
      expect(message).not.toMatch(/Provider Related Party/);
    });

    it('asks for the provider name and related party for a row filed as PPJTI', () => {
      const message = messageFor({ ...unresolved, developer: 'PPJTI', ppjtiRelatedParty: 'yes' });
      expect(message).toMatch(/Developer the provider's name \(filed as PPJTI\)/);
      expect(message).toContain('Provider Related Party yes');
    });

    it('states a filed related party of n/a for a PPJTI row, which a blank Deliverable would not file (Codex review)', () => {
      expect(messageFor({ ...unresolved, developer: 'PPJTI', ppjtiRelatedParty: 'n/a' })).toContain('Provider Related Party n/a');
    });

    it('sends every anchored row whose implementation is gone to restore or re-import, whatever else is missing (Codex review)', () => {
      const gone = { deliverableSegmentId: 'seg-gone' };
      const cases: [string, RptiDetail, string][] = [
        ['initiative gone, target kept', storedRow({ ...gone, initiativeId: 'init-gone' }), 'missing-initiative'],
        ['initiative and target gone', storedRow({ ...gone, initiativeId: 'init-gone', targetId: 'deliv-gone' }), 'missing-initiative'],
        ['legacy asset target', storedRow({ ...gone, targetType: 'asset', targetId: 'asset-1' }), 'asset-target'],
      ];
      for (const [name, row, reason] of cases) {
        const findings = reconcileRptiReturn(ctx([row], []));
        expect(findings, name).toHaveLength(1);
        expect(findings[0].reason, name).toBe(reason);
        expect(findings[0].message, name).toMatch(/History tab/);
        expect(findings[0].message, name).toMatch(/re-import the filing/i);
      }
    });

    it('clears once the anchored implementation is restored, which is what the advice promises', () => {
      const row = storedRow({ targetId: 'deliv-gone', deliverableSegmentId: 'seg-live-2027' });
      const deleted = ctx([row], []);
      deleted.deliverables = [];
      expect(reconcileRptiReturn(deleted)[0]?.message).toMatch(/History tab/); // guard: the dead-anchor case
      const restored = ctx([row], [segment({ deliverableId: 'deliv-gone' })]);
      restored.deliverables = [makeDeliverable({ id: 'deliv-gone' })];
      expect(reconcileRptiReturn(restored)).toEqual([]);
    });

    it('does not send an anchored row with a deleted implementation to a repair that cannot clear it', () => {
      // Its Deliverable was deleted, which removed the anchored segment too. T038 forbids
      // falling back to another implementation, so a recreated one never matches.
      const input = ctx([storedRow({ targetId: 'deliv-gone', deliverableSegmentId: 'seg-gone', developmentType: 'upgrade' })], []);
      const [finding] = reconcileRptiReturn(input);
      expect(finding.reason).toBe('missing-target');
      expect(finding.message).toMatch(/History tab/);
      expect(finding.message).toMatch(/re-import the filing/i);
      expect(finding.message).not.toMatch(/create or open the Deliverable's live lifecycle segment/);
    });

    it('keeps the segment-panel repair when the anchored segment still exists but is not live', () => {
      // That one can be repaired in place: give the same segment a live status again.
      const findings = reconcileRptiReturn(ctx([storedRow({ deliverableSegmentId: 'seg-live-2027' })],
        [segment({ status: 'appstatus-planned' })]));
      expect(findings).toHaveLength(1);
      expect(findings[0].reason).toBe('unanchored');
      expect(findings[0].message).toMatch(/segment panel/i);
      expect(findings[0].message).not.toMatch(/History tab/);
    });

    it('does not warn about the development type for a row filed as new', () => {
      const message = messageFor(storedRow({ targetId: 'deliv-gone', developmentType: 'new' }));
      expect(message).not.toMatch(/instead of upgrade/i);
      expect(message).not.toMatch(/Keterangan/);
    });
  });

  it('keeps a missing-initiative finding until its replacement also has the named segment', () => {
    const repaired = ctx([storedRow({ initiativeId: 'init-gone' })], []);
    repaired.initiatives = [makeInitiative()];
    const partial = reconcileRptiReturn(repaired);
    expect(partial).toHaveLength(1);
    expect(partial[0].reason).toBe('missing-initiative');
    expect(partial[0].message).toMatch(/segment panel/i);
    expect(partial[0].message).toMatch(/timeline/i);

    repaired.deliverableSegments = [segment()];
    expect(reconcileRptiReturn(repaired)).toEqual([]);
  });

  it('does not let two stored rows claim the same canonical row', () => {
    const findings = reconcileRptiReturn(ctx(
      [storedRow(), storedRow({ id: 'row-2' })],
      [segment()],
    ));
    expect(findings).toHaveLength(2);
    expect(findings.every(f => f.reason === 'identity-conflict')).toBe(true);
  });

  it('names a row whose (initiative, target) pair no segment can reproduce in any year', () => {
    // References all resolve — the merge-preserving gate saw nothing wrong with this
    // shape — but generation has no source for the row in any year, so it would
    // vanish from the filing silently. That is precisely what FR-024 forbids.
    const findings = reconcileRptiReturn(ctx([storedRow()], []));
    expect(findings).toHaveLength(1);
    expect(findings[0].reason).toBe('unanchored');
    expect(findings[0].message).toMatch(/segment panel/i);
    expect(findings[0].message).toMatch(/timeline/i);
  });

  it('does not re-report a reproducible row that merely differs from the projection', () => {
    // The stored row's filed quarter predates a segment move; the pair is still
    // derivable, so the projection will carry it and no finding is warranted.
    const findings = reconcileRptiReturn(ctx(
      [storedRow({ plannedImplementationQuarter: 'Q4', remarks: 'old wording' })],
      [segment({ startDate: '2026-05-01', endDate: '2026-06-30' })],
    ));
    expect(findings).toEqual([]);
  });

  it('yields one finding per row, asset-target taking priority over other reasons', () => {
    const findings = reconcileRptiReturn(ctx(
      [storedRow({ targetType: 'asset', targetId: 'asset-gone', initiativeId: 'init-gone' })],
      [],
    ));
    expect(findings).toHaveLength(1);
    expect(findings[0].reason).toBe('asset-target');
  });

  it('returns findings, not rows: a finding carries the stored row only as evidence', () => {
    const findings = reconcileRptiReturn(ctx([storedRow({ targetType: 'asset' })], [segment()]));
    expect(findings).toHaveLength(1);
    expect(findings[0].row).toMatchObject({ id: 'row-1', targetType: 'asset' });
    // `row` is typed RptiReconciliationFinding['row'] — the return type has no
    // RptiDetail[] slot for the gate to leak into the filing.
  });

  it('is read-only: reconciliation leaves the stored rows untouched', () => {
    const stored = [storedRow({ targetType: 'asset' }), storedRow({ id: 'row-2', initiativeId: 'init-gone' })];
    const snapshot = JSON.parse(JSON.stringify(stored));
    const segments = [segment()];
    const segmentsSnapshot = JSON.parse(JSON.stringify(segments));
    reconcileRptiReturn(ctx(stored, segments));
    expect(stored).toEqual(snapshot);
    expect(segments).toEqual(segmentsSnapshot);
  });
});
