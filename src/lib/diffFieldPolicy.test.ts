import { describe, expect, it } from 'vitest';
import type { Version } from '../types';
import { computeDiff } from './diff';
import { diffFieldPolicy } from './diffFieldPolicy';

// One populated record per compared entity. The tested fields come solely from
// diffFieldPolicy, so extending a policy automatically extends this test.
const records = {
  assets: [{ id: 'asset-1', name: 'Asset A', categoryId: 'cat-1', maturity: 2, externalId: 'ext-1' }],
  programmes: [{ id: 'programme-1', name: 'Programme A', color: 'blue' }],
  strategies: [{ id: 'strategy-1', name: 'Strategy A', color: 'green' }],
  initiatives: [{ id: 'initiative-1', name: 'Initiative A', programmeId: 'programme-1', strategyId: 'strategy-1',
    assetId: 'asset-1', startDate: '2026-01-01', endDate: '2026-12-31', capex: 100, opex: 50,
    description: 'Description A', isPlaceholder: true, status: 'planned', ragStatus: 'green',
    progress: 20, owner: 'Owner A', ownerId: 'resource-1', resourceIds: ['resource-1'] }],
  dependencies: [{ id: 'dependency-1', sourceId: 'initiative-1', targetId: 'initiative-2',
    type: 'blocks', midXOffset: 10, sourceType: 'initiative', targetType: 'initiative' }],
  milestones: [{ id: 'milestone-1', assetId: 'asset-1', date: '2026-06-01', name: 'Milestone A', type: 'info' }],
  deliverables: [{ id: 'deliverable-1', assetId: 'asset-1', name: 'Deliverable A', type: 'application',
    description: 'Description A', categoryCode: '01', developer: 'inhouse', dcCity: 'City A',
    dcCountry: 'Country A', drCity: 'City B', drCountry: 'Country B', platform: 'Linux',
    database: 'Postgres', dcProvider: 'Provider A', drcProvider: 'Provider B',
    backupStrategy: 'HA_ACTIVE_ACTIVE', systemOwner: 'Owner A', ownership: 'LEASE',
    ppjtiRelatedParty: 'yes' }],
  deliverableSegments: [{ id: 'segment-1', deliverableId: 'deliverable-1', title: 'Phase A',
    startDate: '2026-01-01', endDate: '2026-06-01', status: 'status-1',
    initiativeId: 'initiative-1', capexAmount: 100, opexAmount: 50,
    rptiRemarks: 'Remarks A', row: 0, rowSpan: 1 }],
  deliverableStatuses: [{ id: 'status-1', name: 'Planned', color: 'slate',
    isLiveStatus: false, isPreLaunchStatus: true }],
  resources: [{ id: 'resource-1', name: 'Person A', role: 'Analyst' }],
  assetCategories: [{ id: 'cat-1', name: 'Category A', order: 1, categoryCode: '01',
    dcCity: 'City A', dcCountry: 'Country A', drCity: 'City B', drCountry: 'Country B' }],
  rptiDetails: [{ id: 'rpti-1', initiativeId: 'initiative-1', targetType: 'deliverable',
    targetId: 'deliverable-1', categoryCode: '01', developmentType: 'new', developer: 'inhouse',
    ppjtiRelatedParty: 'yes', dcCity: 'City A', dcCountry: 'Country A',
    drCity: 'City B', drCountry: 'Country B', plannedImplementationQuarter: 'Q1',
    deliverableSegmentId: 'segment-1', remarks: 'Remarks A' }],
  lkptiDetails: [{ id: 'lkpti-1', targetId: 'deliverable-1', targetName: 'Deliverable A',
    categoryCode: '01', developer: 'inhouse', dcCity: 'City A', dcCountry: 'Country A',
    drCity: 'City B', drCountry: 'Country B', platform: 'Linux', database: 'Postgres',
    dcProvider: 'Provider A', drcProvider: 'Provider B', backupStrategy: 'HA_ACTIVE_ACTIVE',
    systemOwner: 'Owner A', goLiveDate: '01-06-2026', ownership: 'LEASE',
    functionDescription: 'Function A' }],
} satisfies Partial<Version['data']>;

const baseline: Version = {
  id: 'version-1', name: 'Baseline', timestamp: '2026-01-01T00:00:00Z',
  data: {
    ...records,
    timelineSettings: {
      startDate: '2026-01-01', monthsToShow: 12, budgetVisualisation: 'off',
      descriptionDisplay: 'off', emptyRowDisplay: 'show', snapToPeriod: 'off',
      conflictDetection: 'on', showRelationships: 'on',
    },
  },
};

function changedValue(value: unknown): unknown {
  if (typeof value === 'string') return `${value}-changed`;
  if (typeof value === 'number') return value + 1;
  if (typeof value === 'boolean') return !value;
  if (Array.isArray(value)) return [...value, 'resource-2'];
  throw new Error(`Fixture field is not populated: ${String(value)}`);
}

describe('computeDiff field policy coverage', () => {
  for (const [section, policies] of Object.entries(diffFieldPolicy)) {
    for (const [field, policy] of Object.entries(policies)) {
      if (policy !== 'diffed') continue;
      it(`${section}.${field} has a change message`, () => {
        const original = (baseline.data[section as keyof typeof records] as unknown as Record<string, unknown>[])[0];
        const changed = { ...original, [field]: changedValue(original[field]) };
        const current = { ...baseline.data, [section]: [changed] } as Version['data'];
        const modified = computeDiff(baseline, current)[section as keyof typeof diffFieldPolicy].modified;
        expect(modified, `${section}.${field}`).toHaveLength(1);
        expect(modified[0].changes.length, `${section}.${field}`).toBeGreaterThan(0);
      });
    }
  }
});
