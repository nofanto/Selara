import { describe, expect, it } from 'vitest';
import { liftReportRowAttributes } from './attributeLift';
import type { Deliverable, DeliverableSegment, Initiative } from '../types';

/**
 * Contracts 14-17 of specs/002-report-year-field-ownership/contracts/generation.md.
 *
 * Broad in-place migration tooling remains out of scope (design notes Q4), but the
 * idempotent boundary lift covers every reachable path into live state. IndexedDB is
 * schemaless within a store, so old workspaces, snapshots and workbooks retain their
 * orphaned values until a boundary can lift them. Legacy cost properties are removed
 * after lifting so their absence durably marks that one-time migration done.
 */
const deliverable = (over: Partial<Deliverable> = {}): Deliverable =>
  ({ id: 'd-1', assetId: 'a-1', name: 'Core Banking GL', type: 'application', ...over } as Deliverable);

const initiative = (over: Partial<Initiative> = {}): Initiative =>
  ({ id: 'i-1', name: 'GL upgrade', programmeId: 'p-1', assetId: 'a-1',
     startDate: '2027-01-01', endDate: '2027-03-31', capex: 0, opex: 0, ...over } as Initiative);

const segment = (over: Partial<DeliverableSegment> = {}): DeliverableSegment => ({
  id: 'seg-1', deliverableId: 'd-1', initiativeId: 'i-1', status: 'appstatus-in-production',
  startDate: '2027-01-01', endDate: '2031-12-31', ...over,
});

const statuses = [
  { id: 'appstatus-planned', name: 'Planned', color: 'slate', isPreLaunchStatus: true },
  { id: 'appstatus-in-production', name: 'In Production', color: 'green', isLiveStatus: true },
];

const withLegacyInitiativeRemarks = (remarks: string): Initiative =>
  ({ ...initiative(), rptiRemarks: remarks } as unknown as Initiative);

// A stored row of the old shape: the eight attributes live on it and nowhere else.
const oldLkptiRow = (over: Record<string, unknown> = {}) => ({
  id: 'lk-1', targetId: 'd-1',
  platform: 'Java / Spring Boot', database: 'Oracle 19c',
  dcProvider: 'Self', drcProvider: 'PT Telkomsigma',
  backupStrategy: 'HA_ACTIVE_ACTIVE', systemOwner: 'Head of Finance Systems',
  ownership: 'OUTRIGHT_PURCHASE', developer: 'PT Sigma Cipta Caraka',
  ...over,
}) as never;

const oldRptiRow = (over: Record<string, unknown> = {}) => ({
  id: 'rp-1', initiativeId: 'i-1', targetType: 'deliverable', targetId: 'd-1',
  developmentType: 'upgrade', remarks: 'Vendor-led; related party.', ppjtiRelatedParty: 'yes',
  ...over,
}) as never;

describe('liftReportRowAttributes', () => {
  it('moves the eight attributes onto the deliverable they describe (contract 14)', () => {
    const out = liftReportRowAttributes({
      deliverables: [deliverable()], initiatives: [initiative()],
      deliverableSegments: [segment()],
      deliverableStatuses: statuses,
      lkptiDetails: [oldLkptiRow()], rptiDetails: [oldRptiRow()],
    });
    expect(out.deliverables[0]).toMatchObject({
      platform: 'Java / Spring Boot', database: 'Oracle 19c',
      dcProvider: 'Self', drcProvider: 'PT Telkomsigma',
      backupStrategy: 'HA_ACTIVE_ACTIVE', systemOwner: 'Head of Finance Systems',
      ownership: 'OUTRIGHT_PURCHASE', developer: 'PT Sigma Cipta Caraka',
      ppjtiRelatedParty: 'yes',
    });
  });

  it('moves legacy remarks onto the explicitly named implementation', () => {
    const out = liftReportRowAttributes({
      deliverables: [deliverable()], initiatives: [initiative()],
      deliverableSegments: [segment()],
      deliverableStatuses: statuses,
      lkptiDetails: [], rptiDetails: [oldRptiRow({ deliverableSegmentId: 'seg-1' })],
    });
    expect(out.deliverableSegments[0].rptiRemarks).toBe('Vendor-led; related party.');
  });

  it('keeps unplaceable legacy remarks on the stored row and invents no destination', () => {
    const out = liftReportRowAttributes({
      deliverables: [deliverable()], initiatives: [initiative()], deliverableSegments: [segment()],
      deliverableStatuses: statuses,
      lkptiDetails: [], rptiDetails: [oldRptiRow({ deliverableSegmentId: undefined })],
    });
    expect((out.rptiDetails[0] as unknown as Record<string, unknown>).remarks).toBe('Vendor-led; related party.');
    expect(out.deliverableSegments[0].rptiRemarks).toBeUndefined();
  });

  it('preserves a legacy RPTI cost override by lifting it onto its initiative', () => {
    const out = liftReportRowAttributes({
      deliverables: [deliverable()], initiatives: [initiative({ capex: 100, opex: 10 })],
      deliverableSegments: [segment()],
      deliverableStatuses: statuses,
      lkptiDetails: [], rptiDetails: [oldRptiRow({ capexAmount: 700, opexAmount: 70 })],
    });

    expect(out.initiatives[0]).toMatchObject({ capex: 700, opex: 70 });
  });

  it('removes lifted legacy costs so a later canonical edit survives reload', () => {
    const input = {
      deliverables: [deliverable()], initiatives: [initiative({ capex: 100, opex: 10 })],
      deliverableSegments: [segment()],
      deliverableStatuses: statuses,
      lkptiDetails: [], rptiDetails: [oldRptiRow({ capexAmount: 700, opexAmount: 70 })],
    };
    const lifted = liftReportRowAttributes(input);

    expect(lifted.initiatives[0]).toMatchObject({ capex: 700, opex: 70 });
    expect(lifted.rptiDetails[0]).not.toHaveProperty('capexAmount');
    expect(lifted.rptiDetails[0]).not.toHaveProperty('opexAmount');

    const edited = [{ ...lifted.initiatives[0], capex: 900 }];
    const afterReload = liftReportRowAttributes({
      ...input, initiatives: edited, rptiDetails: lifted.rptiDetails,
    });
    expect(afterReload.initiatives[0].capex).toBe(900);
  });

  it('is idempotent — running it twice changes nothing (contract 15)', () => {
    const input = {
      deliverables: [deliverable()], initiatives: [initiative()],
      deliverableSegments: [segment()],
      deliverableStatuses: statuses,
      lkptiDetails: [oldLkptiRow()], rptiDetails: [oldRptiRow()],
    };
    const once = liftReportRowAttributes(input);
    const twice = liftReportRowAttributes({
      ...input, deliverables: once.deliverables, initiatives: once.initiatives,
      deliverableSegments: once.deliverableSegments, rptiDetails: once.rptiDetails,
    });
    expect(twice.deliverables).toEqual(once.deliverables);
    expect(twice.initiatives).toEqual(once.initiatives);
    expect(twice.changed).toBe(false);
  });

  it('never overwrites a value already on the deliverable (contract 16)', () => {
    const out = liftReportRowAttributes({
      deliverables: [deliverable({ platform: 'Edited by hand' })], initiatives: [initiative()],
      deliverableSegments: [segment({ rptiRemarks: 'Edited by hand' })],
      deliverableStatuses: statuses,
      lkptiDetails: [oldLkptiRow()], rptiDetails: [oldRptiRow({ deliverableSegmentId: 'seg-1' })],
    });
    expect(out.deliverables[0].platform).toBe('Edited by hand');
    expect(out.deliverableSegments[0].rptiRemarks).toBe('Edited by hand');
    // Fields it did not already hold still come across.
    expect(out.deliverables[0].database).toBe('Oracle 19c');
  });

  it('leaves the orphaned properties on the stored rows (contract 17)', () => {
    const lk = oldLkptiRow();
    liftReportRowAttributes({
      deliverables: [deliverable()], initiatives: [initiative()],
      deliverableSegments: [segment()],
      deliverableStatuses: statuses,
      lkptiDetails: [lk], rptiDetails: [],
    });
    // A later migration tool must still be able to find them.
    expect((lk as unknown as Record<string, unknown>).platform).toBe('Java / Spring Boot');
  });

  it('reports having changed nothing on a workspace that never held the old shape', () => {
    const out = liftReportRowAttributes({
      deliverables: [deliverable()], initiatives: [initiative()],
      deliverableSegments: [segment()],
      deliverableStatuses: statuses,
      lkptiDetails: [{ id: 'lk-1', targetId: 'd-1' } as never], rptiDetails: [],
    });
    expect(out.changed).toBe(false);
  });

  it('ignores a row pointing at a deliverable that no longer exists', () => {
    const out = liftReportRowAttributes({
      deliverables: [deliverable()], initiatives: [initiative()],
      deliverableSegments: [segment()],
      deliverableStatuses: statuses,
      lkptiDetails: [oldLkptiRow({ targetId: 'ghost' })], rptiDetails: [],
    });
    expect(out.deliverables[0].platform).toBeUndefined();
    expect(out.changed).toBe(false);
  });

  it('moves current Initiative.rptiRemarks when exactly one live implementation exists across all years (Q20)', () => {
    const planned = segment({ id: 'run-up', status: 'appstatus-planned', startDate: '2026-01-01' });
    const live = segment({ id: 'go-live', status: 'appstatus-in-production', startDate: '2027-04-01' });
    const out = liftReportRowAttributes({
      deliverables: [deliverable()], initiatives: [withLegacyInitiativeRemarks('Current workspace note')],
      deliverableSegments: [planned, live], deliverableStatuses: statuses,
      lkptiDetails: [], rptiDetails: [],
    });

    expect(out.deliverableSegments.find(s => s.id === 'run-up')?.rptiRemarks).toBeUndefined();
    expect(out.deliverableSegments.find(s => s.id === 'go-live')?.rptiRemarks).toBe('Current workspace note');
    expect((out.initiatives[0] as unknown as Record<string, unknown>).rptiRemarks).toBe('Current workspace note');
  });

  it('does not overwrite a newer remark already on the sole live implementation (Q20 precedence)', () => {
    const out = liftReportRowAttributes({
      deliverables: [deliverable()], initiatives: [withLegacyInitiativeRemarks('Older initiative note')],
      deliverableSegments: [segment({ rptiRemarks: 'Newer segment note' })], deliverableStatuses: statuses,
      lkptiDetails: [], rptiDetails: [],
    });
    expect(out.deliverableSegments[0].rptiRemarks).toBe('Newer segment note');
  });

  /**
   * The two lifts can target the same segment, and then their order decides which
   * value is filed. `Initiative.rptiRemarks` is the ADR-0013 home a preparer types
   * into; a legacy `RptiDetail.remarks` is evidence of an older filing. The newer
   * home wins, which is the rule this file's header states and which the
   * initiative-era lift already applied — old evidence must never overwrite a
   * deliberate edit.
   *
   * The nearby precedence case only pits the initiative against a remark already on
   * the segment, so it passes whichever way the two LIFTS are ordered.
   */
  it('lets a current initiative remark beat a legacy row remark on the same segment (Q19/Q20 precedence)', () => {
    const out = liftReportRowAttributes({
      deliverables: [deliverable()], initiatives: [withLegacyInitiativeRemarks('Newer, typed on the Initiatives tab')],
      deliverableSegments: [segment({ id: 'go-live' })], deliverableStatuses: statuses,
      lkptiDetails: [],
      rptiDetails: [{ id: 'r-1', initiativeId: 'init-1', targetType: 'deliverable', targetId: 'd-1',
        developmentType: 'new', deliverableSegmentId: 'go-live',
        remarks: 'Older, filed under the previous model' } as never],
    });
    expect(out.deliverableSegments[0].rptiRemarks).toBe('Newer, typed on the Initiatives tab');
  });

  it('leaves current Initiative.rptiRemarks recoverable and copies nothing when several implementations exist (Q20)', () => {
    const out = liftReportRowAttributes({
      deliverables: [deliverable()], initiatives: [withLegacyInitiativeRemarks('Ambiguous current note')],
      deliverableSegments: [segment({ id: 'first' }), segment({ id: 'second', startDate: '2028-01-01' })],
      deliverableStatuses: statuses, lkptiDetails: [], rptiDetails: [],
    });
    expect((out.initiatives[0] as unknown as Record<string, unknown>).rptiRemarks).toBe('Ambiguous current note');
    expect(out.deliverableSegments.map(s => s.rptiRemarks)).toEqual([undefined, undefined]);
  });

  it('leaves current Initiative.rptiRemarks recoverable when there are zero implementations (Q20)', () => {
    const out = liftReportRowAttributes({
      deliverables: [deliverable()], initiatives: [withLegacyInitiativeRemarks('No implementation yet')],
      deliverableSegments: [], deliverableStatuses: statuses, lkptiDetails: [], rptiDetails: [],
    });
    expect((out.initiatives[0] as unknown as Record<string, unknown>).rptiRemarks).toBe('No implementation yet');
    expect(out.deliverableSegments).toEqual([]);
  });

  it('places nothing when the status vocabulary is absent, even for a legacy live-looking id (Q20 safe failure)', () => {
    const out = liftReportRowAttributes({
      deliverables: [deliverable()], initiatives: [withLegacyInitiativeRemarks('Cannot place safely')],
      deliverableSegments: [segment()], deliverableStatuses: [], lkptiDetails: [], rptiDetails: [],
    });
    expect((out.initiatives[0] as unknown as Record<string, unknown>).rptiRemarks).toBe('Cannot place safely');
    expect(out.deliverableSegments[0].rptiRemarks).toBeUndefined();
  });
});
