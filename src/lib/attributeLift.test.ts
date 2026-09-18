import { describe, expect, it } from 'vitest';
import { liftReportRowAttributes } from './attributeLift';
import type { Deliverable, Initiative } from '../types';

/**
 * Contracts 14-17 of specs/002-report-year-field-ownership/contracts/generation.md.
 *
 * Migration tooling is deliberately out of scope (design notes Q4), but deferring it
 * is only safe while the orphaned values survive. IndexedDB is schemaless within a
 * store, so they persist untouched after the type drops them — right up until the
 * first press of Generate rebuilds the rows from the deliverable and discards them
 * permanently. This lift runs before that can happen.
 */
const deliverable = (over: Partial<Deliverable> = {}): Deliverable =>
  ({ id: 'd-1', assetId: 'a-1', name: 'Core Banking GL', type: 'application', ...over } as Deliverable);

const initiative = (over: Partial<Initiative> = {}): Initiative =>
  ({ id: 'i-1', name: 'GL upgrade', programmeId: 'p-1', assetId: 'a-1',
     startDate: '2027-01-01', endDate: '2027-03-31', capex: 0, opex: 0, ...over } as Initiative);

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

  it('moves remarks onto the initiative as rptiRemarks', () => {
    const out = liftReportRowAttributes({
      deliverables: [deliverable()], initiatives: [initiative()],
      lkptiDetails: [], rptiDetails: [oldRptiRow()],
    });
    expect(out.initiatives[0].rptiRemarks).toBe('Vendor-led; related party.');
  });

  it('preserves a legacy RPTI cost override by lifting it onto its initiative', () => {
    const out = liftReportRowAttributes({
      deliverables: [deliverable()], initiatives: [initiative({ capex: 100, opex: 10 })],
      lkptiDetails: [], rptiDetails: [oldRptiRow({ capexAmount: 700, opexAmount: 70 })],
    });

    expect(out.initiatives[0]).toMatchObject({ capex: 700, opex: 70 });
  });

  it('is idempotent — running it twice changes nothing (contract 15)', () => {
    const input = {
      deliverables: [deliverable()], initiatives: [initiative()],
      lkptiDetails: [oldLkptiRow()], rptiDetails: [oldRptiRow()],
    };
    const once = liftReportRowAttributes(input);
    const twice = liftReportRowAttributes({ ...input, deliverables: once.deliverables, initiatives: once.initiatives });
    expect(twice.deliverables).toEqual(once.deliverables);
    expect(twice.initiatives).toEqual(once.initiatives);
    expect(twice.changed).toBe(false);
  });

  it('never overwrites a value already on the deliverable (contract 16)', () => {
    const out = liftReportRowAttributes({
      deliverables: [deliverable({ platform: 'Edited by hand' })],
      initiatives: [initiative({ rptiRemarks: 'Edited by hand' })],
      lkptiDetails: [oldLkptiRow()], rptiDetails: [oldRptiRow()],
    });
    expect(out.deliverables[0].platform).toBe('Edited by hand');
    expect(out.initiatives[0].rptiRemarks).toBe('Edited by hand');
    // Fields it did not already hold still come across.
    expect(out.deliverables[0].database).toBe('Oracle 19c');
  });

  it('leaves the orphaned properties on the stored rows (contract 17)', () => {
    const lk = oldLkptiRow();
    liftReportRowAttributes({
      deliverables: [deliverable()], initiatives: [initiative()],
      lkptiDetails: [lk], rptiDetails: [],
    });
    // A later migration tool must still be able to find them.
    expect((lk as unknown as Record<string, unknown>).platform).toBe('Java / Spring Boot');
  });

  it('reports having changed nothing on a workspace that never held the old shape', () => {
    const out = liftReportRowAttributes({
      deliverables: [deliverable()], initiatives: [initiative()],
      lkptiDetails: [{ id: 'lk-1', targetId: 'd-1' } as never], rptiDetails: [],
    });
    expect(out.changed).toBe(false);
  });

  it('ignores a row pointing at a deliverable that no longer exists', () => {
    const out = liftReportRowAttributes({
      deliverables: [deliverable()], initiatives: [initiative()],
      lkptiDetails: [oldLkptiRow({ targetId: 'ghost' })], rptiDetails: [],
    });
    expect(out.deliverables[0].platform).toBeUndefined();
    expect(out.changed).toBe(false);
  });
});
