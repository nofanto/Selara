import { describe, expect, it } from 'vitest';
import { generateRptiDetails, GenerateRptiDetailsInput } from './rpti';
import type { AssetCategory, Asset, Deliverable, DeliverableSegment, DeliverableStatus, Initiative } from '../types';

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

function makeSegment(overrides: Partial<DeliverableSegment> = {}): DeliverableSegment {
  return {
    id: 'seg-1', deliverableId: 'deliv-1', startDate: '2026-02-01', endDate: '2026-03-01',
    status: 'appstatus-planned', initiativeId: 'init-1',
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

function makeContext(overrides: Partial<GenerateRptiDetailsInput> = {}): GenerateRptiDetailsInput {
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

describe('generateRptiDetails', () => {
  it('generates a "new" row for a planned segment in the report year', () => {
    const segments = [makeSegment({ id: 'seg-planned', status: 'appstatus-planned', startDate: '2026-02-01' })];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments }), 2026);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      initiativeId: 'init-1',
      targetType: 'deliverable',
      targetId: 'deliv-1',
      developmentType: 'new',
      plannedImplementationQuarter: 'Q1',
      deliverableSegmentId: 'seg-planned',
    });
  });

  it('generates an "upgrade" row for an in-production segment with no planning segment that year', () => {
    const segments = [makeSegment({ id: 'seg-prod', status: 'appstatus-in-production', startDate: '2026-08-01' })];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments }), 2026);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      developmentType: 'upgrade',
      plannedImplementationQuarter: 'Q3',
      deliverableSegmentId: 'seg-prod',
    });
  });

  it('collapses planned+funded into one "new" row, anchored on the latest (funded)', () => {
    const segments = [
      makeSegment({ id: 'seg-planned', status: 'appstatus-planned', startDate: '2026-01-15' }),
      makeSegment({ id: 'seg-funded', status: 'appstatus-funded', startDate: '2026-04-15' }),
    ];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments }), 2026);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      developmentType: 'new',
      plannedImplementationQuarter: 'Q2', // from funded (April), not planned (January)
      deliverableSegmentId: 'seg-funded',
    });
  });

  it('collapses planned + in-production in the same year into one "new" row, quarter from in-production', () => {
    const segments = [
      makeSegment({ id: 'seg-planned', status: 'appstatus-planned', startDate: '2026-01-15' }),
      makeSegment({ id: 'seg-prod', status: 'appstatus-in-production', startDate: '2026-09-01' }),
    ];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments }), 2026);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      developmentType: 'new',
      plannedImplementationQuarter: 'Q3',
      deliverableSegmentId: 'seg-prod',
    });
  });

  it('does not look back across years — in-production alone this year is "upgrade" even if planning was last year', () => {
    const segments = [
      makeSegment({ id: 'seg-planned', status: 'appstatus-planned', startDate: '2025-01-15', endDate: '2025-02-15' }),
      makeSegment({ id: 'seg-prod', status: 'appstatus-in-production', startDate: '2026-09-01' }),
    ];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments }), 2026);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ developmentType: 'upgrade', deliverableSegmentId: 'seg-prod' });
  });

  it('classifies as "upgrade" when the deliverable already went live in a prior year, even with only a planned segment this year', () => {
    const segments = [
      makeSegment({ id: 'seg-went-live-2025', status: 'appstatus-in-production', startDate: '2025-01-01', endDate: '2025-06-01' }),
      makeSegment({ id: 'seg-planned-2026', status: 'appstatus-planned', startDate: '2026-02-01', endDate: '2026-03-01' }),
    ];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments }), 2026);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ developmentType: 'upgrade', deliverableSegmentId: 'seg-planned-2026' });
  });

  it('checks prior-live history deliverable-wide, regardless of which initiative drove the earlier go-live', () => {
    const segments = [
      makeSegment({ id: 'seg-went-live-2025', initiativeId: 'init-2', status: 'appstatus-in-production', startDate: '2025-01-01', endDate: '2025-06-01' }),
      makeSegment({ id: 'seg-planned-2026', initiativeId: 'init-1', status: 'appstatus-planned', startDate: '2026-02-01', endDate: '2026-03-01' }),
    ];
    const initiatives = [makeInitiative({ id: 'init-1' }), makeInitiative({ id: 'init-2' })];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments, initiatives }), 2026);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ initiativeId: 'init-1', developmentType: 'upgrade' });
  });

  it('excludes sunset, out-of-support, and retired segments entirely', () => {
    const segments = [
      makeSegment({ id: 'seg-sunset', status: 'appstatus-sunset', startDate: '2026-02-01' }),
      makeSegment({ id: 'seg-oos', status: 'appstatus-out-of-support', startDate: '2026-05-01' }),
      makeSegment({ id: 'seg-retired', status: 'appstatus-retired', startDate: '2026-08-01' }),
    ];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments }), 2026);

    expect(rows).toHaveLength(0);
  });

  it('excludes segments with no linked initiative', () => {
    const segments = [makeSegment({ id: 'seg-unlinked', initiativeId: undefined })];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments }), 2026);

    expect(rows).toHaveLength(0);
  });

  it('excludes a segment with an unrecognized custom status — generation is an allow-list, not a deny-list', () => {
    const customStatuses = [...statuses, { id: 'appstatus-cancelled', name: 'Cancelled', color: 'red' }];
    const segments = [makeSegment({ status: 'appstatus-cancelled' })];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments, deliverableStatuses: customStatuses }), 2026);

    expect(rows).toHaveLength(0);
  });

  it('trusts an explicit isPreLaunchStatus flag over the default id/name fallback', () => {
    const customStatuses = [
      { id: 'appstatus-in-production', name: 'In Production', color: 'green', isLiveStatus: true },
      { id: 'status-custom-approved', name: 'Budget Approved', color: 'blue', isPreLaunchStatus: true },
    ];
    const segments = [makeSegment({ status: 'status-custom-approved' })];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments, deliverableStatuses: customStatuses }), 2026);

    expect(rows).toHaveLength(1);
  });

  it('stops guessing from id/name once any status has isPreLaunchStatus explicitly set', () => {
    const customStatuses = [
      { id: 'appstatus-planned', name: 'Planned', color: 'slate' }, // no explicit flag
      { id: 'status-custom-approved', name: 'Budget Approved', color: 'blue', isPreLaunchStatus: true },
    ];
    const segments = [makeSegment({ status: 'appstatus-planned' })];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments, deliverableStatuses: customStatuses }), 2026);

    // Once the workspace has opted in explicitly anywhere, the unflagged "Planned" id no
    // longer qualifies via fallback guessing.
    expect(rows).toHaveLength(0);
  });

  it('excludes a segment linked to a placeholder Initiative', () => {
    const initiatives = [makeInitiative({ isPlaceholder: true })];
    const segments = [makeSegment()];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments, initiatives }), 2026);

    expect(rows).toHaveLength(0);
  });

  it('excludes segments entirely outside the report year (no overlap)', () => {
    const segments = [makeSegment({ id: 'seg-2025', startDate: '2025-06-01', endDate: '2025-07-01' })];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments }), 2026);

    expect(rows).toHaveLength(0);
  });

  it('includes a segment that started before the report year but overlaps into it', () => {
    const segments = [makeSegment({ id: 'seg-straddle', startDate: '2025-11-01', endDate: '2026-02-01' })];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments }), 2026);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ deliverableSegmentId: 'seg-straddle' });
  });

  it('includes a segment that starts in the report year and ends after it', () => {
    const segments = [makeSegment({ id: 'seg-tail', startDate: '2026-11-01', endDate: '2027-02-01' })];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments }), 2026);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ deliverableSegmentId: 'seg-tail' });
  });

  it('keeps distinct (initiative, deliverable) pairs as separate rows', () => {
    const segments = [
      makeSegment({ id: 'seg-a', deliverableId: 'deliv-a', initiativeId: 'init-1', status: 'appstatus-planned' }),
      makeSegment({ id: 'seg-b', deliverableId: 'deliv-b', initiativeId: 'init-1', status: 'appstatus-planned' }),
      makeSegment({ id: 'seg-c', deliverableId: 'deliv-a', initiativeId: 'init-2', status: 'appstatus-planned' }),
    ];
    const initiatives = [makeInitiative({ id: 'init-1' }), makeInitiative({ id: 'init-2' })];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments, initiatives }), 2026);

    expect(rows).toHaveLength(3);
  });

  it('produces no rows when there is no qualifying segment data', () => {
    expect(generateRptiDetails(makeContext(), 2026)).toEqual([]);
  });
});

describe('generateRptiDetails — categoryCode auto-fill', () => {
  const segments = [makeSegment({ id: 'seg-planned', status: 'appstatus-planned', startDate: '2026-02-01' })];

  it('uses the Deliverable.categoryCode when set', () => {
    const deliverables = [makeDeliverable({ categoryCode: '06' })];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments, deliverables }), 2026);

    expect(rows[0].categoryCode).toBe('06');
  });

  it('falls back to the AssetCategory default (via Asset.categoryId) when the Deliverable has none', () => {
    const deliverables = [makeDeliverable()];
    const assets = [makeAsset({ categoryId: 'cat-1' })];
    const assetCategories = [makeAssetCategory({ id: 'cat-1', categoryCode: '07' })];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments, deliverables, assets, assetCategories }), 2026);

    expect(rows[0].categoryCode).toBe('07');
  });

  it('Deliverable.categoryCode overrides the AssetCategory default when both are set', () => {
    const deliverables = [makeDeliverable({ categoryCode: '04' })];
    const assets = [makeAsset({ categoryId: 'cat-1' })];
    const assetCategories = [makeAssetCategory({ id: 'cat-1', categoryCode: '07' })];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments, deliverables, assets, assetCategories }), 2026);

    expect(rows[0].categoryCode).toBe('04');
  });

  it('leaves categoryCode undefined when neither the Deliverable nor its AssetCategory has one', () => {
    const deliverables = [makeDeliverable()];
    const assets = [makeAsset({ categoryId: 'cat-1' })];
    const assetCategories = [makeAssetCategory({ id: 'cat-1' })];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments, deliverables, assets, assetCategories }), 2026);

    expect(rows[0].categoryCode).toBeUndefined();
  });
});

describe('generateRptiDetails — developer / ppjtiRelatedParty auto-fill', () => {
  const segments = [makeSegment({ id: 'seg-planned', status: 'appstatus-planned', startDate: '2026-02-01' })];

  it('uses Deliverable.developer, and auto-fills ppjtiRelatedParty to "n/a" for in-house', () => {
    const deliverables = [makeDeliverable({ developer: 'inhouse' })];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments, deliverables }), 2026);

    expect(rows[0].developer).toBe('inhouse');
    expect(rows[0].ppjtiRelatedParty).toBe('n/a');
  });

  it('leaves ppjtiRelatedParty blank for manual entry when developer is PPJTI', () => {
    const deliverables = [makeDeliverable({ developer: 'PPJTI' })];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments, deliverables }), 2026);

    expect(rows[0].developer).toBe('PPJTI');
    expect(rows[0].ppjtiRelatedParty).toBeUndefined();
  });

  it('auto-fills ppjtiRelatedParty to "n/a" when developer is not set at all (no category-level default exists)', () => {
    const deliverables = [makeDeliverable()];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments, deliverables }), 2026);

    expect(rows[0].developer).toBeUndefined();
    expect(rows[0].ppjtiRelatedParty).toBe('n/a');
  });
});

describe('generateRptiDetails — DC/DR location auto-fill', () => {
  const segments = [makeSegment({ id: 'seg-planned', status: 'appstatus-planned', startDate: '2026-02-01' })];

  it('uses the Deliverable location fields when set', () => {
    const deliverables = [makeDeliverable({ dcCity: 'Jakarta', dcCountry: 'Indonesia', drCity: 'Surabaya', drCountry: 'Indonesia' })];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments, deliverables }), 2026);

    expect(rows[0]).toMatchObject({ dcCity: 'Jakarta', dcCountry: 'Indonesia', drCity: 'Surabaya', drCountry: 'Indonesia' });
  });

  it('falls back to the AssetCategory defaults when the Deliverable has none', () => {
    const deliverables = [makeDeliverable()];
    const assets = [makeAsset({ categoryId: 'cat-1' })];
    const assetCategories = [makeAssetCategory({ id: 'cat-1', dcCity: 'Singapore', dcCountry: 'Singapore', drCity: 'Batam', drCountry: 'Indonesia' })];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments, deliverables, assets, assetCategories }), 2026);

    expect(rows[0]).toMatchObject({ dcCity: 'Singapore', dcCountry: 'Singapore', drCity: 'Batam', drCountry: 'Indonesia' });
  });

  it('resolves each location field independently — a Deliverable can override just one field', () => {
    const deliverables = [makeDeliverable({ dcCity: 'Jakarta' })]; // only dcCity overridden
    const assets = [makeAsset({ categoryId: 'cat-1' })];
    const assetCategories = [makeAssetCategory({ id: 'cat-1', dcCity: 'Singapore', dcCountry: 'Singapore', drCity: 'Batam', drCountry: 'Indonesia' })];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments, deliverables, assets, assetCategories }), 2026);

    expect(rows[0]).toMatchObject({ dcCity: 'Jakarta', dcCountry: 'Singapore', drCity: 'Batam', drCountry: 'Indonesia' });
  });

  it('leaves location fields undefined when neither the Deliverable nor its AssetCategory has them', () => {
    const deliverables = [makeDeliverable()];
    const assets = [makeAsset({ categoryId: 'cat-1' })];
    const assetCategories = [makeAssetCategory({ id: 'cat-1' })];
    const rows = generateRptiDetails(makeContext({ deliverableSegments: segments, deliverables, assets, assetCategories }), 2026);

    expect(rows[0].dcCity).toBeUndefined();
    expect(rows[0].dcCountry).toBeUndefined();
    expect(rows[0].drCity).toBeUndefined();
    expect(rows[0].drCountry).toBeUndefined();
  });
});
