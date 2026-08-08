import { describe, expect, it } from 'vitest';
import { generateRptiDetails } from './rpti';
import type { DeliverableSegment, DeliverableStatus, Initiative } from '../types';

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

describe('generateRptiDetails', () => {
  it('generates a "new" row for a planned segment in the report year', () => {
    const segments = [makeSegment({ id: 'seg-planned', status: 'appstatus-planned', startDate: '2026-02-01' })];
    const rows = generateRptiDetails(segments, statuses, [makeInitiative()], 2026);

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
    const rows = generateRptiDetails(segments, statuses, [makeInitiative()], 2026);

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
    const rows = generateRptiDetails(segments, statuses, [makeInitiative()], 2026);

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
    const rows = generateRptiDetails(segments, statuses, [makeInitiative()], 2026);

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
    const rows = generateRptiDetails(segments, statuses, [makeInitiative()], 2026);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ developmentType: 'upgrade', deliverableSegmentId: 'seg-prod' });
  });

  it('excludes sunset, out-of-support, and retired segments entirely', () => {
    const segments = [
      makeSegment({ id: 'seg-sunset', status: 'appstatus-sunset', startDate: '2026-02-01' }),
      makeSegment({ id: 'seg-oos', status: 'appstatus-out-of-support', startDate: '2026-05-01' }),
      makeSegment({ id: 'seg-retired', status: 'appstatus-retired', startDate: '2026-08-01' }),
    ];
    const rows = generateRptiDetails(segments, statuses, [makeInitiative()], 2026);

    expect(rows).toHaveLength(0);
  });

  it('excludes segments with no linked initiative', () => {
    const segments = [makeSegment({ id: 'seg-unlinked', initiativeId: undefined })];
    const rows = generateRptiDetails(segments, statuses, [makeInitiative()], 2026);

    expect(rows).toHaveLength(0);
  });

  it('excludes segments entirely outside the report year (no overlap)', () => {
    const segments = [makeSegment({ id: 'seg-2025', startDate: '2025-06-01', endDate: '2025-07-01' })];
    const rows = generateRptiDetails(segments, statuses, [makeInitiative()], 2026);

    expect(rows).toHaveLength(0);
  });

  it('includes a segment that started before the report year but overlaps into it', () => {
    const segments = [makeSegment({ id: 'seg-straddle', startDate: '2025-11-01', endDate: '2026-02-01' })];
    const rows = generateRptiDetails(segments, statuses, [makeInitiative()], 2026);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ deliverableSegmentId: 'seg-straddle' });
  });

  it('includes a segment that starts in the report year and ends after it', () => {
    const segments = [makeSegment({ id: 'seg-tail', startDate: '2026-11-01', endDate: '2027-02-01' })];
    const rows = generateRptiDetails(segments, statuses, [makeInitiative()], 2026);

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
    const rows = generateRptiDetails(segments, statuses, initiatives, 2026);

    expect(rows).toHaveLength(3);
  });

  it('produces no rows when there is no qualifying segment data', () => {
    expect(generateRptiDetails([], statuses, [makeInitiative()], 2026)).toEqual([]);
  });
});
