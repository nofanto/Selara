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
    id: 'seg-1', deliverableId: 'deliv-1', startDate: '2026-02-01', endDate: '2099-12-31',
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
    asAtDate: '2026-12-31',
    deliverableSegments: [],
    deliverableStatuses: statuses,
    deliverables: [makeDeliverable()],
    assets: [makeAsset()],
    assetCategories: [makeAssetCategory()],
    existingDetails: [],
    ...overrides,
  };
}

describe('generateLkptiDetails', () => {
  describe('as-at membership', () => {
    it('includes an application during its live span and excludes it after that span ends', () => {
      const segments = [makeSegment({
        status: 'appstatus-in-production', startDate: '2021-06-01', endDate: '2025-06-30',
      })];

      expect(generateLkptiDetails(makeContext({
        deliverableSegments: segments, asAtDate: '2024-12-31',
      } as never))).toHaveLength(1);
      expect(generateLkptiDetails(makeContext({
        deliverableSegments: segments, asAtDate: '2026-12-31',
      } as never))).toHaveLength(0);
    });

    it('excludes an application that has not yet gone live as at the requested date', () => {
      const segments = [makeSegment({
        status: 'appstatus-in-production', startDate: '2025-01-01', endDate: '2028-12-31',
      })];

      expect(generateLkptiDetails(makeContext({
        deliverableSegments: segments, asAtDate: '2024-12-31',
      } as never))).toHaveLength(0);
    });

    it('requires an explicit as-at date', () => {
      const segments = [makeSegment({ status: 'appstatus-in-production' })];
      expect(() => generateLkptiDetails({
        ...makeContext({ deliverableSegments: segments }), asAtDate: undefined,
      } as never)).toThrow(/as-at/i);
    });
  });

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

  it('emits a service provider name verbatim — the widened developer field is what LKPTI files', () => {
    const deliverables = [makeDeliverable({ developer: 'PT Sigma Cipta Caraka' })];
    const segments = [makeSegment({ status: 'appstatus-in-production' })];
    const rows = generateLkptiDetails(makeContext({ deliverables, deliverableSegments: segments }));

    expect(rows[0].developer).toBe('PT Sigma Cipta Caraka');
  });

  it('leaves developer blank when the Deliverable has none, rather than inventing one', () => {
    const deliverables = [makeDeliverable({ developer: undefined })];
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

  it('cascades functionDescription from Deliverable.description', () => {
    const deliverables = [makeDeliverable({ description: 'Handles customer onboarding.' })];
    const segments = [makeSegment({ status: 'appstatus-in-production' })];
    const rows = generateLkptiDetails(makeContext({ deliverables, deliverableSegments: segments }));

    expect(rows[0].functionDescription).toBe('Handles customer onboarding.');
  });

  it('leaves functionDescription undefined when the Deliverable has no description', () => {
    const segments = [makeSegment({ status: 'appstatus-in-production' })];
    const rows = generateLkptiDetails(makeContext({ deliverableSegments: segments }));

    expect(rows[0].functionDescription).toBeUndefined();
  });

  /**
   * LKPTI 3.2.6 is an inventory of applications that have ACTUALLY gone live, not a
   * plan. requirement-specs/lkpti-integration.md §3 requires a live segment precisely
   * so that every generated row satisfies OJK validation rule 5.3 ("go_live_date must
   * not be in the future") by construction — but the original check only asked whether
   * a live segment EXISTED, so a deliverable whose in-production phase begins next year
   * still generated a row, carrying a future go-live date that dataHealth.ts then
   * flagged as an error.
   */
  it('excludes a deliverable whose only live segment starts in the future', () => {
    const segments = [makeSegment({
      status: 'appstatus-in-production', startDate: '2099-04-01', endDate: '2099-12-31',
    })];
    const rows = generateLkptiDetails(makeContext({ deliverableSegments: segments }));

    expect(rows).toHaveLength(0);
  });

  it('includes a deliverable whose live segment has already started', () => {
    const segments = [makeSegment({
      status: 'appstatus-in-production', startDate: '2020-01-01', endDate: '2099-12-31',
    })];
    const rows = generateLkptiDetails(makeContext({ deliverableSegments: segments }));

    expect(rows).toHaveLength(1);
  });

  it('includes a deliverable whose live segment starts today (today is not the future)', () => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const segments = [makeSegment({
      status: 'appstatus-in-production', startDate: iso, endDate: '2099-12-31',
    })];
    const rows = generateLkptiDetails(makeContext({ deliverableSegments: segments }));

    expect(rows).toHaveLength(1);
  });

  it('excludes a deliverable whose in-production segment has ended before the as-at date', () => {
    const segments = [
      makeSegment({ id: 'seg-prod', status: 'appstatus-in-production', startDate: '2020-01-01', endDate: '2021-06-30' }),
      makeSegment({ id: 'seg-sunset', status: 'appstatus-sunset', startDate: '2021-07-01', endDate: '2099-12-31' }),
    ];
    const rows = generateLkptiDetails(makeContext({ deliverableSegments: segments }));

    expect(rows).toHaveLength(0);
  });

  it('never suggests a future goLiveDate when an earlier live segment has started', () => {
    const segments = [
      makeSegment({ id: 'seg-future', status: 'appstatus-in-production', startDate: '2099-01-01', endDate: '2099-12-31' }),
      makeSegment({ id: 'seg-past', status: 'appstatus-in-production', startDate: '2020-05-20', endDate: '2098-12-31' }),
    ];
    const rows = generateLkptiDetails(makeContext({ deliverableSegments: segments }));

    expect(rows).toHaveLength(1);
    expect(rows[0].goLiveDate).toBe('20-05-2020');
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

describe('generateLkptiDetails — merge-preserving regeneration (issue #9 / User Story 20 AC5)', () => {
  it('preserves the 7 manual-only fields and goLiveDate on a row that already exists', () => {
    const existingDetails = [{
      id: 'lk-imported-1',
      targetId: 'deliv-1',
      platform: 'Custom Platform',
      database: 'Custom DB',
      dcProvider: 'Self',
      drcProvider: 'Self',
      backupStrategy: 'HA_ACTIVE_ACTIVE',
      systemOwner: 'Jane Doe',
      ownership: 'LEASE',
      goLiveDate: '01-01-2020',
    }] as any;
    const segments = [makeSegment({ status: 'appstatus-in-production', startDate: '2026-08-15' })];
    const rows = generateLkptiDetails(makeContext({ deliverableSegments: segments, existingDetails }));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'lk-imported-1',
      platform: 'Custom Platform',
      database: 'Custom DB',
      dcProvider: 'Self',
      drcProvider: 'Self',
      backupStrategy: 'HA_ACTIVE_ACTIVE',
      systemOwner: 'Jane Doe',
      ownership: 'LEASE',
      goLiveDate: '01-01-2020', // not overwritten by the freshly-suggested date from the segment above
    });
  });

  it('still refreshes cascade-derived fields on an existing row', () => {
    const existingDetails = [{ id: 'lk-imported-1', targetId: 'deliv-1', categoryCode: '05' }] as any;
    const deliverables = [makeDeliverable({ categoryCode: '01' })];
    const segments = [makeSegment({ status: 'appstatus-in-production' })];
    const rows = generateLkptiDetails(makeContext({ deliverables, deliverableSegments: segments, existingDetails }));

    expect(rows[0].categoryCode).toBe('01'); // refreshed from the Deliverable, not left stale at '05'
  });

  it('creates a fresh, fully cascade-filled row when no existing LkptiDetail exists for the deliverable', () => {
    const segments = [makeSegment({ status: 'appstatus-in-production', startDate: '2026-05-01' })];
    const rows = generateLkptiDetails(makeContext({ deliverableSegments: segments, existingDetails: [] }));

    expect(rows[0]).toMatchObject({ id: 'lkpti-gen-deliv-1', targetId: 'deliv-1', goLiveDate: '01-05-2026' });
  });

  it('drops a deliverable that no longer qualifies, even if an existing row was present for it', () => {
    const existingDetails = [{ id: 'lk-imported-1', targetId: 'deliv-1', platform: 'Custom Platform' }] as any;
    const rows = generateLkptiDetails(makeContext({ deliverableSegments: [], existingDetails }));

    expect(rows).toHaveLength(0);
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

/**
 * F4, from the final adversarial review. Q11 established that an existing row cannot make
 * a non-live application *join* the inventory — membership is computed from segment spans
 * against the as-at date. That is true, and it is only about membership. The row's own
 * `goLiveDate` was still spread through untouched, so a filing could state a go-live
 * *after* the as-at date it claims to describe.
 *
 * That is a wrong-period filing, not a cosmetic carry-over: LKPTI 3.2.6 asks what was live
 * as at 31 December of the report year, and a date later than that answers a different
 * question. ADR-0013 called this residual; it was not.
 */
describe('a generated LKPTI never states a go-live after its own as-at date (F4)', () => {
  const deliverables = [makeDeliverable()];
  const segments = [makeSegment({
    status: 'appstatus-in-production', startDate: '2020-01-01', endDate: '2030-12-31',
  })];

  it('does not carry a stored go-live that post-dates the as-at date', () => {
    const rows = generateLkptiDetails(makeContext({
      deliverables, deliverableSegments: segments, asAtDate: '2027-12-31',
      // A stored row from an earlier filing, or hand-entered: live from 2028.
      existingDetails: [{ id: 'l1', targetId: 'deliv-1', goLiveDate: '01-01-2028' }],
    } as never));

    expect(rows).toHaveLength(1);
    expect(rows[0].goLiveDate,
      'a 2027 inventory cannot state a 2028 go-live').not.toBe('01-01-2028');
  });

  it('falls back to the live segment the membership test actually used', () => {
    const rows = generateLkptiDetails(makeContext({
      deliverables, deliverableSegments: segments, asAtDate: '2027-12-31',
      existingDetails: [{ id: 'l1', targetId: 'deliv-1', goLiveDate: '01-01-2028' }],
    } as never));

    expect(rows[0].goLiveDate).toBe('01-01-2020');
  });

  it('keeps a stored go-live that is consistent with the as-at date', () => {
    const rows = generateLkptiDetails(makeContext({
      deliverables, deliverableSegments: segments, asAtDate: '2027-12-31',
      // The filed value, more precise than the segment start — it must survive (FR-017).
      existingDetails: [{ id: 'l1', targetId: 'deliv-1', goLiveDate: '15-03-2021' }],
    } as never));

    expect(rows[0].goLiveDate,
      'a filed date the as-at supports is not ours to discard').toBe('15-03-2021');
  });
});
