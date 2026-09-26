import { describe, expect, it, vi } from 'vitest';
import type { RptiDetail } from '../types';
import { applyUnresolvedRowRepair, extendImportPriorPhase, priorPhaseGaps, unresolvedRowRepairDraft } from './unresolvedRowRepair';
import { projectRptiReturn, reconcileRptiReturn, openEndedDate } from './rpti';
import { computeDataHealth } from './dataHealth';
import { liftReportRowAttributes } from './attributeLift';
import { generateLkptiDetails } from './lkpti';
import { SEEDED_DELIVERABLE_STATUSES } from './deliverableStatusDefaults';

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

// ── US3: prior-phase gaps in existing workspaces (contracts 20–21, FR-018/FR-018a) ──

/**
 * A workspace as an importer left it before FR-017: the synthetic prior phase in its original
 * one-year shape, on an application (and its infrastructure twin, which the LKPTI never lists).
 * Contract 20 recognises this shape by every property at once, so each fixture below varies one.
 */
const gapState = () => ({
  assets: [
    { id: 'a-app', name: 'Core Teller System', categoryId: 'cat-1' },
    { id: 'a-infra', name: 'Primary Data Center', categoryId: 'cat-1' },
  ],
  assetCategories: [{ id: 'cat-1', name: 'Internal management', categoryCode: '12' as const }],
  deliverables: [
    { id: 'deliv-app', assetId: 'a-app', name: 'Core Teller System', type: 'application' as const, developer: 'inhouse' },
    { id: 'deliv-infra', assetId: 'a-infra', name: 'Primary Data Center', type: 'infrastructure' as const, categoryCode: '51' as const },
  ],
  deliverableSegments: [
    { id: 'rpti-import-seg-prior-1', deliverableId: 'deliv-app',
      startDate: '2026-01-01', endDate: '2026-12-31', status: 'appstatus-in-production' },
    { id: 'rpti-import-seg-prior-2', deliverableId: 'deliv-infra',
      startDate: '2026-01-01', endDate: '2026-12-31', status: 'appstatus-in-production' },
  ],
  deliverableStatuses: SEEDED_DELIVERABLE_STATUSES,
});
const oldShapePrior = { id: 'rpti-import-seg-prior-1', deliverableId: 'deliv-app',
  startDate: '2026-01-01', endDate: '2026-12-31', status: 'appstatus-in-production' };

describe('priorPhaseGaps (contracts 20–21)', () => {
  it('finds the exact importer shape on an application and lists the years it leaves out', () => {
    // 2026-12-31 holds the entry in the 2026 inventory only; Y+1…Y+6 = 2027…2032 are the
    // 31 Decembers the continuous phase would have covered. The infrastructure prior is
    // absent: LKPTI is Daftar Aplikasi (research R10).
    expect(priorPhaseGaps(gapState())).toEqual([
      { segmentId: 'rpti-import-seg-prior-1', deliverableId: 'deliv-app', segmentYear: 2026,
        missingYears: [2027, 2028, 2029, 2030, 2031, 2032] },
    ]);
  });

  // Contract 21, once per property: change any one of them and the segment is no longer the
  // importer's shape — an edited phase is the preparer's decision, not a gap to warn about.
  it.each([
    ['id prefix', (seg: typeof oldShapePrior) => ({ ...seg, id: 'handmade-prior-1' })],
    ['start date', (seg: typeof oldShapePrior) => ({ ...seg, startDate: '2026-01-02' })],
    ['end date (the preparer shortened it)', (seg: typeof oldShapePrior) => ({ ...seg, endDate: '2026-12-30' })],
    ['end date (already extended to the horizon)', (seg: typeof oldShapePrior) => ({ ...seg, endDate: openEndedDate(2027) })],
    ['initiativeId set', (seg: typeof oldShapePrior) => ({ ...seg, initiativeId: 'init-1' })],
  ] as const)('returns nothing when the %s differs', (_label, mutate) => {
    const state = gapState();
    expect(priorPhaseGaps({ ...state, deliverableSegments: [mutate(oldShapePrior)] })).toEqual([]);
  });

  it('returns nothing when the status is not the importer live status id', () => {
    const state = gapState();
    const otherLive = { id: 'custom-live', name: 'Running', color: 'bg-emerald-500', isLiveStatus: true };
    expect(priorPhaseGaps({
      ...state,
      deliverableStatuses: [...state.deliverableStatuses, otherLive],
      deliverableSegments: [{ ...oldShapePrior, status: 'custom-live' }],
    })).toEqual([]);
  });

  it('returns nothing when another live segment already covers every year', () => {
    const state = gapState();
    const covering = { id: 'seg-inventory-history', deliverableId: 'deliv-app',
      startDate: '2021-08-17', endDate: '2035-12-31', status: 'appstatus-in-production' };
    expect(priorPhaseGaps({ ...state, deliverableSegments: [oldShapePrior, covering] })).toEqual([]);
  });

  it('lists only the Decembers no live segment of the Deliverable spans', () => {
    const state = gapState();
    const partial = { id: 'seg-two-years', deliverableId: 'deliv-app',
      startDate: '2027-01-01', endDate: '2029-12-31', status: 'appstatus-in-production' };
    const gaps = priorPhaseGaps({ ...state, deliverableSegments: [oldShapePrior, partial] });
    expect(gaps).toHaveLength(1);
    expect(gaps[0].missingYears).toEqual([2030, 2031, 2032]);
  });

  it('FR-018: nothing automatic — gap detection, Data Health and the load-time lift leave a frozen old-shape workspace byte-identical', () => {
    // The rule Q22 chose over migrating on open: detection reads, only the preparer's
    // Extend writes. Every path data takes on its way into live state runs here.
    const state = freeze(structuredClone({
      ...gapState(),
      initiatives: [], lkptiDetails: [], rptiDetails: [], milestones: [], dependencies: [],
      decisions: [], resources: [], programmes: [], strategies: [],
      timelineSettings: { defaultCurrency: 'IDR' },
    }));
    const before = JSON.stringify(state);
    expect(() => priorPhaseGaps(state)).not.toThrow();
    expect(() => computeDataHealth(state)).not.toThrow();
    expect(() => liftReportRowAttributes(state)).not.toThrow();
    expect(JSON.stringify(state)).toBe(before);
    const lifted = liftReportRowAttributes(state);
    expect(lifted.changed).toBe(false);
    expect(lifted.deliverableSegments).toEqual(state.deliverableSegments);
    // The detection itself still finds the gap — proving the frozen run was a real one.
    expect(priorPhaseGaps(state).map(gap => gap.segmentId)).toEqual(['rpti-import-seg-prior-1']);
  });
});

describe('extendImportPriorPhase (contract 23)', () => {
  it('changes only that segment end date, to the horizon of the filed year the phase belongs to', () => {
    // A prior phase covering 2026 came from a 2027 filing, so the extension runs to
    // openEndedDate(2027) — the same horizon continuousPriorLivePhase would have given it.
    const input = freeze(structuredClone(gapState()));
    const next = extendImportPriorPhase(input, 'rpti-import-seg-prior-1');
    expect(next).not.toBe(input);
    expect(next.deliverableSegments.find(s => s.id === 'rpti-import-seg-prior-1'))
      .toEqual({ ...oldShapePrior, endDate: openEndedDate(2027) });
    expect(next.deliverableSegments.map(s => s.id)).toEqual(input.deliverableSegments.map(s => s.id));
    expect(next.deliverableSegments.filter(s => s.id !== 'rpti-import-seg-prior-1'))
      .toEqual(input.deliverableSegments.filter(s => s.id !== 'rpti-import-seg-prior-1'));
    for (const key of ['assets', 'assetCategories', 'deliverables', 'deliverableStatuses'] as const) {
      expect(next[key]).toEqual(input[key]);
    }
    expect(input.deliverableSegments.find(s => s.id === 'rpti-import-seg-prior-1')?.endDate).toBe('2026-12-31');
  });

  it('closes the gap: no entry remains, and the LKPTI holds the application in every formerly missing year', () => {
    const next = extendImportPriorPhase(structuredClone(gapState()), 'rpti-import-seg-prior-1');
    expect(priorPhaseGaps(next)).toEqual([]);
    for (let year = 2027; year <= 2032; year++) {
      const rows = generateLkptiDetails({
        asAtDate: `${year}-12-31`,
        deliverableSegments: next.deliverableSegments, deliverableStatuses: next.deliverableStatuses,
        deliverables: next.deliverables, assets: next.assets, assetCategories: next.assetCategories,
      });
      expect(rows.map(row => row.targetId), String(year)).toContain('deliv-app');
    }
  });

  it('changes nothing when the named segment is gone', () => {
    const input = structuredClone(gapState());
    expect(extendImportPriorPhase(input, 'rpti-import-seg-prior-99')).toEqual(input);
  });
});
