import { describe, expect, it } from 'vitest';
import {
  generateLkptiDetails,
  suggestGoLiveDate,
  lkptiCascadeOnDeliverableDelete,
  GenerateLkptiDetailsInput,
} from './lkpti';
import type { AssetCategory, Asset, Deliverable, DeliverableSegment, DeliverableStatus } from '../types';

const statuses: DeliverableStatus[] = [
  { id: 'appstatus-planned', name: 'Planned', color: 'slate' },
  { id: 'appstatus-funded', name: 'Funded', color: 'blue' },
  { id: 'appstatus-in-production', name: 'In Production', color: 'green', isLiveStatus: true },
  { id: 'appstatus-sunset', name: 'Sunset', color: 'amber' },
];

function makeSegment(overrides: Partial<DeliverableSegment> = {}): DeliverableSegment {
  return {
    id: 'seg-1', deliverableId: 'deliv-1', startDate: '2026-02-01', endDate: '2026-03-01',
    status: 'appstatus-planned',
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

function makeContext(overrides: Partial<GenerateLkptiDetailsInput> = {}): GenerateLkptiDetailsInput {
  return {
    deliverableSegments: [],
    deliverableStatuses: statuses,
    deliverables: [makeDeliverable()],
    assets: [makeAsset()],
    assetCategories: [makeAssetCategory()],
    ...overrides,
  };
}

describe('generateLkptiDetails', () => {
  it('generates a row for a deliverable with a live (in-production) segment', () => {
    const segments = [makeSegment({ status: 'appstatus-in-production' })];
    const rows = generateLkptiDetails(makeContext({ deliverableSegments: segments }));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ targetId: 'deliv-1' });
  });

  it('does not generate a row for a deliverable with only a planned segment (not yet live)', () => {
    const segments = [makeSegment({ status: 'appstatus-planned' })];
    const rows = generateLkptiDetails(makeContext({ deliverableSegments: segments }));

    expect(rows).toHaveLength(0);
  });

  it('does not generate a row for a deliverable with no segments at all', () => {
    const rows = generateLkptiDetails(makeContext({ deliverableSegments: [] }));
    expect(rows).toHaveLength(0);
  });

  it('skips non-application deliverable types even with a live segment', () => {
    const deliverables = [makeDeliverable({ type: 'infrastructure' })];
    const segments = [makeSegment({ status: 'appstatus-in-production' })];
    const rows = generateLkptiDetails(makeContext({ deliverables, deliverableSegments: segments }));

    expect(rows).toHaveLength(0);
  });

  it('treats a deliverable with an undefined type as an application (legacy default)', () => {
    const deliverables = [makeDeliverable({ type: undefined })];
    const segments = [makeSegment({ status: 'appstatus-in-production' })];
    const rows = generateLkptiDetails(makeContext({ deliverables, deliverableSegments: segments }));

    expect(rows).toHaveLength(1);
  });

  it('cascades categoryCode/developer/dc/dr from Deliverable first, falling back to AssetCategory', () => {
    const assetCategories = [makeAssetCategory({ categoryCode: '05', dcCity: 'Jakarta', dcCountry: 'Indonesia', drCity: 'Surabaya', drCountry: 'Indonesia' })];
    const deliverables = [makeDeliverable({ categoryCode: '01', dcCity: 'Bandung' })]; // overrides categoryCode + dcCity only
    const segments = [makeSegment({ status: 'appstatus-in-production' })];
    const rows = generateLkptiDetails(makeContext({ deliverables, assetCategories, deliverableSegments: segments }));

    expect(rows[0]).toMatchObject({
      categoryCode: '01',        // Deliverable override wins
      dcCity: 'Bandung',         // Deliverable override wins
      dcCountry: 'Indonesia',    // falls back to AssetCategory
      drCity: 'Surabaya',        // falls back to AssetCategory
      drCountry: 'Indonesia',    // falls back to AssetCategory
    });
  });

  it('suggests "inhouse" as developer when the Deliverable is inhouse-developed', () => {
    const deliverables = [makeDeliverable({ developer: 'inhouse' })];
    const segments = [makeSegment({ status: 'appstatus-in-production' })];
    const rows = generateLkptiDetails(makeContext({ deliverables, deliverableSegments: segments }));

    expect(rows[0].developer).toBe('inhouse');
  });

  it('leaves developer blank (for manual entry) when the Deliverable developer is PPJTI — LKPTI wants the provider name, not a generic marker', () => {
    const deliverables = [makeDeliverable({ developer: 'PPJTI' })];
    const segments = [makeSegment({ status: 'appstatus-in-production' })];
    const rows = generateLkptiDetails(makeContext({ deliverables, deliverableSegments: segments }));

    expect(rows[0].developer).toBeUndefined();
  });

  it('ignores an infrastructure-only categoryCode (51-54, 99) inherited via cascade — LKPTI 3.2.6 only accepts 01-12/49', () => {
    const assetCategories = [makeAssetCategory({ categoryCode: '52' })];
    const segments = [makeSegment({ status: 'appstatus-in-production' })];
    const rows = generateLkptiDetails(makeContext({ assetCategories, deliverableSegments: segments }));

    expect(rows[0].categoryCode).toBeUndefined();
  });

  it('auto-suggests goLiveDate (dd-mm-yyyy) from the earliest live segment', () => {
    const segments = [
      makeSegment({ id: 'seg-late', status: 'appstatus-in-production', startDate: '2026-08-15' }),
      makeSegment({ id: 'seg-early', status: 'appstatus-in-production', startDate: '2026-03-10' }),
    ];
    const rows = generateLkptiDetails(makeContext({ deliverableSegments: segments }));

    expect(rows[0].goLiveDate).toBe('10-03-2026');
  });
});

describe('suggestGoLiveDate', () => {
  it('returns undefined when no live segment exists for the target', () => {
    const segments = [makeSegment({ status: 'appstatus-planned' })];
    expect(suggestGoLiveDate('deliv-1', segments, statuses)).toBeUndefined();
  });

  it('converts the live segment start date from ISO to dd-mm-yyyy', () => {
    const segments = [makeSegment({ status: 'appstatus-in-production', startDate: '2021-03-15' })];
    expect(suggestGoLiveDate('deliv-1', segments, statuses)).toBe('15-03-2021');
  });
});

describe('lkptiCascadeOnDeliverableDelete', () => {
  it('removes rows targeting the deleted deliverable', () => {
    const details = [
      { id: 'a1', targetId: 'deliv-1' },
      { id: 'a2', targetId: 'deliv-2' },
    ] as any;
    const result = lkptiCascadeOnDeliverableDelete(details, 'deliv-1');
    expect(result).toEqual([{ id: 'a2', targetId: 'deliv-2' }]);
  });
});
