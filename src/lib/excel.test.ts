import { describe, expect, it } from 'vitest';
import { buildWorkbook, parseWorkbook } from './excel';
import type { Decision } from '../types';

const emptyWorkspace = {
  assets: [],
  initiatives: [],
  milestones: [],
  programmes: [],
  strategies: [],
  dependencies: [],
  assetCategories: [],
};

const roundTrip = (decisions: Decision[]) =>
  parseWorkbook(buildWorkbook({ ...emptyWorkspace, decisions })).decisions ?? [];

const decision = (id: string, extra: Partial<Decision> = {}): Decision => ({
  id,
  title: `Decision ${id}`,
  status: 'accepted',
  createdAt: '2026-05-01T00:00:00.000Z',
  ...extra,
});

describe('Excel export/import — decisions (#22)', () => {
  it('writes a Decisions sheet', () => {
    const wb = buildWorkbook({ ...emptyWorkspace, decisions: [decision('dec-1')] });

    expect(wb.SheetNames).toContain('Decisions');
  });

  it('round-trips a decision without losing its MADR fields', () => {
    const original = decision('dec-1', {
      title: 'Consolidate identity onto one platform',
      status: 'accepted',
      context: 'Two IAM stacks with overlapping scope.',
      consideredOptions: 'Keep both\nConsolidate on CIAM',
      decisionOutcome: 'Consolidate on CIAM.',
      consequences: 'Employee IAM retires in FY27.',
    });

    expect(roundTrip([original])[0]).toEqual(original);
  });

  it('round-trips a supersededBy chain', () => {
    const older = decision('dec-1', { status: 'superseded', supersededBy: 'dec-2' });
    const newer = decision('dec-2');

    const out = roundTrip([older, newer]);

    expect(out.find(d => d.id === 'dec-1')?.supersededBy).toBe('dec-2');
    expect(out.find(d => d.id === 'dec-1')?.status).toBe('superseded');
  });

  it('round-trips a polymorphic entity link', () => {
    const linked = decision('dec-1', { linkedEntityType: 'initiative', linkedEntityId: 'i-1' });

    const out = roundTrip([linked])[0];

    expect(out.linkedEntityType).toBe('initiative');
    expect(out.linkedEntityId).toBe('i-1');
  });

  it('round-trips versionId, which the sheet envelope would otherwise eat', () => {
    // `Decision.versionId` (ADR-0011: the snapshot that enacted this decision)
    // collides by name with the `versionId` column every other sheet uses to mark
    // which snapshot a row belongs to. Exporting decisions through the usual
    // flatten()/withVersion() path would overwrite the link with '' and then strip
    // it on import — a second data loss hidden inside the fix for the first.
    const linked = decision('dec-1', { versionId: 'ver-123' });

    expect(roundTrip([linked])[0].versionId).toBe('ver-123');
  });

  it('treats an absent Decisions sheet as no decisions, not as undefined', () => {
    // Files exported before this fix have no Decisions sheet. Import must not
    // silently write [] over a populated log — the caller needs to tell "the file
    // says there are none" from "the file does not carry decisions at all".
    const wb = buildWorkbook({ ...emptyWorkspace });
    delete wb.Sheets['Decisions'];
    wb.SheetNames = wb.SheetNames.filter(n => n !== 'Decisions');

    expect(parseWorkbook(wb).decisions).toBeUndefined();
  });

  it('still round-trips other entities and their version envelope', () => {
    const wb = buildWorkbook({
      ...emptyWorkspace,
      assets: [{ id: 'a-1', name: 'Core Ledger', categoryId: 'cat-1' }],
      decisions: [decision('dec-1')],
    });

    expect(parseWorkbook(wb).assets).toEqual([{ id: 'a-1', name: 'Core Ledger', categoryId: 'cat-1' }]);
  });
});

/**
 * T030 / contract 21. The claim `excel.ts` needed no change for ADR-0013's nine moved
 * fields is a claim about `flatten()` being generic — plausible, and exactly the kind of
 * thing that is asserted in a plan and never checked. A field that exports but does not
 * come back is silent data loss on every share and every backup, so this verifies the
 * round trip field by field rather than trusting the reasoning.
 */
describe('the fields ADR-0013 moved survive the workspace round trip (contract 21)', () => {
  const deliverable = {
    id: 'deliv-1', assetId: 'asset-1', name: 'Payment Gateway', type: 'application' as const,
    platform: 'Linux RHEL 9', database: 'PostgreSQL 16',
    dcProvider: 'PT Telkom Sigma', drcProvider: 'PT Lintasarta',
    backupStrategy: 'HA_ACTIVE_PASSIVE' as const, systemOwner: 'Digital Channels',
    ownership: 'LEASE' as const, developer: 'PT Anabatic Technologies',
    ppjtiRelatedParty: 'no' as const,
  };
  const initiative = {
    id: 'init-1', name: 'Gateway Upgrade', programmeId: 'prog-1', assetId: 'asset-1',
    startDate: '2027-01-01', endDate: '2027-12-31', capex: 100, opex: 10,
    description: 'Deskripsi text', rptiRemarks: 'Keterangan text',
  };

  it('carries all eight Deliverable attributes plus the widened developer', () => {
    const wb = buildWorkbook({ ...emptyWorkspace, deliverables: [deliverable] } as never);
    const [back] = parseWorkbook(wb).deliverables as unknown as Record<string, unknown>[];

    for (const [field, value] of Object.entries(deliverable)) {
      expect(back?.[field], `Deliverable.${field} did not survive the round trip`).toBe(value);
    }
  });

  it('carries rptiRemarks distinctly from description on the Initiative', () => {
    const wb = buildWorkbook({ ...emptyWorkspace, initiatives: [initiative] } as never);
    const [back] = parseWorkbook(wb).initiatives as unknown as Record<string, unknown>[];

    expect(back?.description).toBe('Deskripsi text');
    expect(back?.rptiRemarks, 'rptiRemarks did not survive the round trip').toBe('Keterangan text');
  });
});
