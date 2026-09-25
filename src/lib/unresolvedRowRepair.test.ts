import { describe, expect, it, vi } from 'vitest';
import type { RptiDetail } from '../types';
import { applyUnresolvedRowRepair, unresolvedRowRepairDraft } from './unresolvedRowRepair';
import { projectRptiReturn, reconcileRptiReturn, openEndedDate } from './rpti';

const row: RptiDetail = {
  id: 'row-1', initiativeId: 'init-1', targetType: 'deliverable',
  targetId: 'rpti-import-unresolved-1', developmentType: 'upgrade',
  categoryCode: '12', developer: 'inhouse', ppjtiRelatedParty: 'n/a',
  dcCity: 'Jakarta', dcCountry: 'Indonesia', drCity: 'Surabaya', drCountry: 'Indonesia',
  plannedImplementationQuarter: 'Q3', remarks: 'Filed remark',
};
const state = { initiatives: [{ id: 'init-1', name: 'Legacy Teller Application — Q3 2027', startDate: '2027-07-01', capex: 2900, opex: 640 }] };

describe('unresolvedRowRepairDraft (contracts 7–8)', () => {
  it('tags every prefilled value with its source, including current budget', () => {
    expect(unresolvedRowRepairDraft(row, state)).toMatchObject({
      name: { value: 'Legacy Teller Application', source: 'initiative-name' },
      filedYear: { value: 2027, source: 'initiative-name' },
      quarter: { value: 'Q3', source: 'stored-row' },
      categoryCode: { value: '12', source: 'stored-row' },
      developer: { value: 'inhouse', source: 'stored-row' },
      ppjtiRelatedParty: { value: 'n/a', source: 'stored-row' },
      dcCity: { value: 'Jakarta', source: 'stored-row' },
      dcCountry: { value: 'Indonesia', source: 'stored-row' },
      drCity: { value: 'Surabaya', source: 'stored-row' },
      drCountry: { value: 'Indonesia', source: 'stored-row' },
      remarks: { value: 'Filed remark', source: 'stored-row' },
      capex: { value: 2900, source: 'initiative-budget' },
      opex: { value: 640, source: 'initiative-budget' },
    });
  });

  it('flags a renamed initiative, derives its year from start, and never reads the clock', () => {
    const renamed = { ...state, initiatives: [{ ...state.initiatives[0], name: 'Renamed Teller' }] };
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2039-05-01'));
      const draft = unresolvedRowRepairDraft(row, renamed);
      vi.setSystemTime(new Date('2022-01-01'));
      expect(unresolvedRowRepairDraft(row, renamed)).toEqual(draft);
      expect(draft.name).toEqual({ value: 'Renamed Teller', source: 'initiative-name', check: true });
      expect(draft.filedYear).toEqual({ value: 2027, source: 'initiative-start' });
    } finally { vi.useRealTimers(); }
  });

  it('requires the real provider name for a PPJTI row', () => {
    expect(unresolvedRowRepairDraft({ ...row, developer: 'PPJTI' }, state).providerName)
      .toEqual({ value: '', source: 'needs-input' });
  });
});

const base = {
  assets: [{ id: 'old-asset', name: 'Other', categoryId: 'cat-01' }],
  assetCategories: [{ id: 'cat-01', name: 'Other', categoryCode: '01' as const }],
  deliverables: [], deliverableSegments: [],
  deliverableStatuses: [{ id: 'custom-live', name: 'Running', color: 'green', isLiveStatus: true }],
  initiatives: [{ ...state.initiatives[0], assetId: 'old-asset', programmeId: 'programme-1', endDate: '2027-09-30' }],
  rptiDetails: [row], lkptiDetails: [{ id: 'evidence', targetId: 'somewhere' }],
  programmes: [{ id: 'programme-1', name: 'Plan', color: 'blue' }],
  milestones: [], strategies: [], dependencies: [], decisions: [], resources: [],
  timelineSettings: { defaultCurrency: 'IDR' },
};
const confirmed = {
  name: 'Legacy Teller Application', filedYear: 2027, quarter: 'Q3' as const,
  categoryCode: '12' as const, developer: 'inhouse' as const, providerName: '',
  ppjtiRelatedParty: 'n/a' as const, dcCity: 'Jakarta', dcCountry: 'Indonesia',
  drCity: 'Surabaya', drCountry: 'Indonesia', remarks: 'Filed remark', capex: 2900, opex: 640,
};
const request = { rowId: row.id, option: 'create' as const, confirmed };
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

describe('applyUnresolvedRowRepair option B (contracts 13–18)', () => {
  it('writes only the exact B entities, leaves evidence and other collections intact, and reproduces an upgrade', () => {
    const input = freeze(structuredClone(base));
    const result = applyUnresolvedRowRepair(input, request);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(input).toEqual(base);
    expect(result.state.assetCategories).toEqual([...base.assetCategories, {
      id: 'rpti-import-cat-12', name: expect.any(String), categoryCode: '12',
    }]);
    expect(result.state.assets).toEqual([...base.assets, {
      id: 'rpti-repair-asset-row-1', name: confirmed.name, categoryId: 'rpti-import-cat-12', maturity: 1,
    }]);
    expect(result.state.deliverables).toEqual([{
      id: 'rpti-repair-deliv-row-1', assetId: 'rpti-repair-asset-row-1', name: confirmed.name,
      type: 'application', developer: 'inhouse', ppjtiRelatedParty: 'n/a',
      dcCity: 'Jakarta', dcCountry: 'Indonesia', drCity: 'Surabaya', drCountry: 'Indonesia',
    }]);
    expect(result.state.deliverableSegments).toEqual([
      { id: 'rpti-repair-seg-prior-row-1', deliverableId: 'rpti-repair-deliv-row-1',
        startDate: '2026-01-01', endDate: openEndedDate(2027), status: 'custom-live' },
      { id: 'rpti-repair-seg-row-1', deliverableId: 'rpti-repair-deliv-row-1',
        startDate: '2027-07-01', endDate: '2027-09-30', status: 'custom-live',
        initiativeId: 'init-1', capexAmount: 2900, opexAmount: 640, rptiRemarks: 'Filed remark' },
    ]);
    expect(result.state.initiatives).toEqual([{ ...base.initiatives[0], assetId: 'rpti-repair-asset-row-1' }]);
    expect(result.state.rptiDetails).toEqual(base.rptiDetails);
    for (const key of ['lkptiDetails', 'programmes', 'milestones', 'strategies', 'dependencies', 'decisions', 'resources', 'timelineSettings'] as const) {
      expect(result.state[key]).toEqual(base[key]);
    }
    expect(result.state.deliverableStatuses).toEqual(base.deliverableStatuses);
    expect(reconcileRptiReturn({ ...result.state, storedDetails: result.state.rptiDetails })).toEqual([]);
    const generated = projectRptiReturn(result.state, 2027);
    expect(generated).toHaveLength(1);
    expect(generated[0]).toMatchObject({ initiativeId: row.initiativeId, developmentType: 'upgrade',
      plannedImplementationQuarter: 'Q3', categoryCode: '12', developer: 'inhouse',
      dcCity: 'Jakarta', drCity: 'Surabaya', remarks: 'Filed remark' });
    expect(applyUnresolvedRowRepair(result.state, request).ok).toBe(false);
  });

  it('reuses a category and adds the importer live status only when needed', () => {
    const result = applyUnresolvedRowRepair({ ...base,
      assetCategories: [...base.assetCategories, { id: 'existing-12', name: 'Applications', categoryCode: '12' as const }],
      deliverableStatuses: [],
    }, request);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.assetCategories).toHaveLength(2);
    expect(result.state.assets.at(-1)?.categoryId).toBe('existing-12');
    expect(result.state.deliverableStatuses).toEqual([expect.objectContaining({ id: 'appstatus-in-production', isLiveStatus: true })]);
  });

  it('rejects missing evidence, an already implemented initiative, and unconfirmed PPJTI names', () => {
    expect(applyUnresolvedRowRepair({ ...base, rptiDetails: [] }, request).ok).toBe(false);
    expect(applyUnresolvedRowRepair({ ...base, deliverableSegments: [{ id: 'live', deliverableId: 'old',
      initiativeId: 'init-1', status: 'custom-live', startDate: '2026-01-01', endDate: '2026-12-31' }] }, request).ok).toBe(false);
    const ppjti = { ...base, rptiDetails: [{ ...row, developer: 'PPJTI' as const }] };
    expect(applyUnresolvedRowRepair(ppjti, { ...request, confirmed: { ...confirmed, developer: 'PPJTI' as const, providerName: '' } }).ok).toBe(false);
    expect(applyUnresolvedRowRepair(ppjti, { ...request, confirmed: { ...confirmed, developer: 'PPJTI' as const, providerName: 'PPJTI' } }).ok).toBe(false);
  });

  // Coordinator review of US1: the dialog's inputs were free text, so these reached apply.
  it('rejects a category code that is unknown or infrastructure, which B cannot create', () => {
    for (const categoryCode of ['123', '51', ''] as never[]) {
      expect(applyUnresolvedRowRepair(base, { ...request, confirmed: { ...confirmed, categoryCode } }).ok, String(categoryCode)).toBe(false);
    }
  });

  it('rejects a related party outside yes, no and n/a', () => {
    expect(applyUnresolvedRowRepair(base, { ...request, confirmed: { ...confirmed, ppjtiRelatedParty: 'maybe' as never } }).ok).toBe(false);
  });

  it('rejects an emptied cost rather than filing it as zero', () => {
    // An emptied number box reaches apply as NaN; filing 0 instead is the #51 corruption.
    expect(applyUnresolvedRowRepair(base, { ...request, confirmed: { ...confirmed, capex: Number.NaN } }).ok).toBe(false);
    expect(applyUnresolvedRowRepair(base, { ...request, confirmed: { ...confirmed, opex: Number.NaN } }).ok).toBe(false);
  });
});
