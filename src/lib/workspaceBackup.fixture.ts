/**
 * Field-complete workspaces for the backup contract (specs/005-workspace-recovery,
 * contracts/field-inventory.md). Shared by the Vitest round trip and the E2E
 * fresh-profile recovery, so both prove preservation against the same data.
 *
 * Every inventoried field is populated somewhere in current state *and* in a
 * snapshot, and the awkward values the contract names are all present: text
 * that starts with the encoding marker, CRLF, Excel's own `_xHHHH_` escape
 * syntax, comma-bearing resource IDs, non-ASCII, zero/false/empty values, and
 * business links that deliberately resolve to nothing.
 */
import type { Decision, TimelineSettings, Version } from '../types';
import type { PortableWorkspace } from './workspaceBackup';

const MARKER_TEXT = '__SELARA_JSON_V1__:not actually encoded';

const settings = (overrides: Partial<TimelineSettings> = {}): TimelineSettings => ({
  startDate: '2026-01-01',
  monthsToShow: 24,
  budgetVisualisation: 'bar-height',
  descriptionDisplay: 'on',
  emptyRowDisplay: 'hide',
  snapToPeriod: 'month',
  conflictDetection: 'on',
  showRelationships: 'off',
  columnWidths: { initiatives: { name: '240px', 'owner, lead': '96px' }, assets: {} },
  collapsedGroups: ['cat-core', 'cat,with,commas', ''],
  hasSeenTutorial: false,
  columnZoom: 1.5,
  sidebarWidth: 0,
  mobileBucketMode: 'quarter',
  criticalPath: 'on',
  groupBy: 'programme',
  onboardingLkptiYear: 2026,
  onboardingRptiYear: 2027,
  colorBy: 'rag',
  showResources: 'on',
  display: 'both',
  templateId: 'rpti',
  showRptiCatalogue: false,
  clusterName: 'Klaster Bank — Jakarta',
  defaultCurrency: 'IDR',
  ...overrides,
});

const liveDecisions: Decision[] = [
  {
    id: 'dec-1',
    title: 'Consolidate core banking',
    status: 'superseded',
    supersededBy: 'dec-2',
    createdAt: '2026-03-01T08:00:00.000Z',
    context: 'Two ledgers.\r\nWindows line endings kept.',
    consideredOptions: 'Keep both\nConsolidate',
    decisionOutcome: MARKER_TEXT,
    consequences: 'Literal _x0041_ must not become A',
    linkedEntityType: 'initiative',
    linkedEntityId: 'init-1',
    versionId: 'ver-1',
  },
  {
    id: 'dec-2',
    title: 'Keep the replacement decision',
    status: 'accepted',
    createdAt: '2026-04-01T08:00:00.000Z',
    // Deliberately unresolved business links: they survive as stored facts.
    linkedEntityType: 'asset',
    linkedEntityId: 'asset-that-was-deleted',
    versionId: 'ver-that-was-deleted',
  },
];

/** The current workspace, every field populated at least once. */
const current = (): Omit<PortableWorkspace, 'versions'> => ({
  strategies: [{ id: 'str-1', name: 'Digital', color: '#123456' }],
  programmes: [{ id: 'prog-1', name: 'Core', color: 'bg-blue-500' }],
  assetCategories: [
    { id: 'cat-core', name: 'Core', order: 0, categoryCode: '01', dcCity: 'Jakarta', dcCountry: 'Indonesia', drCity: 'Surabaya', drCountry: 'Indonesia' },
    { id: 'cat,with,commas', name: 'Unordered' },
  ],
  resources: [
    { id: 'res-1', name: 'Siti', role: 'Architect' },
    { id: 'res,2', name: 'Comma, in id' },
    { id: 'res-3', name: 'Budi' },
  ],
  deliverableStatuses: [
    { id: 'st-live', name: 'Live', color: '#00ff00', isLiveStatus: true, isPreLaunchStatus: false },
    { id: 'st-plan', name: 'Planned', color: '#cccccc' },
  ],
  assets: [
    { id: 'asset-1', name: 'Core Ledger', categoryId: 'cat-core', maturity: 3, externalId: 'EXT-001' },
    { id: 'asset-2', name: 'Unrated', categoryId: 'cat,with,commas' },
  ],
  initiatives: [
    {
      id: 'init-1', name: 'Ledger upgrade', programmeId: 'prog-1', strategyId: 'str-1', assetId: 'asset-1',
      startDate: '2026-02-01', endDate: '2026-11-30', capex: 1250000.75, opex: 0,
      description: 'Multi-line\nwith unicode — 日本語 🎉', isPlaceholder: false, status: 'active', ragStatus: 'amber',
      progress: 0, owner: 'Legacy owner text', ownerId: 'res-1', resourceIds: ['res,2', 'res-3', 'res-1'],
    },
    {
      id: 'init-2', name: 'Placeholder', programmeId: 'prog-missing', assetId: 'asset-2',
      startDate: '2027-01-01', endDate: '2027-03-31', capex: 0, opex: -12.5,
      description: '', isPlaceholder: true, resourceIds: [],
    },
  ],
  dependencies: [
    { id: 'dep-1', sourceId: 'init-1', targetId: 'seg-1', type: 'blocks', midXOffset: -40, sourceType: 'initiative', targetType: 'segment' },
    { id: 'dep-2', sourceId: 'ms-1', targetId: 'init-2', type: 'related' },
  ],
  milestones: [{ id: 'ms-1', assetId: 'asset-1', date: '2026-06-30', name: 'Go-live', type: 'critical' }],
  deliverables: [
    {
      id: 'del-1', assetId: 'asset-1', name: 'Ledger app', type: 'application', description: 'Posts journals',
      categoryCode: '02', developer: 'PT Vendor, Tbk', dcCity: 'Jakarta', dcCountry: 'Indonesia', drCity: 'Batam', drCountry: 'Indonesia',
      platform: 'Java', database: 'Oracle', dcProvider: 'self', drcProvider: 'PT DRC', backupStrategy: 'HA_ACTIVE_PASSIVE',
      systemOwner: 'Head of Ops', ownership: 'LEASE', ppjtiRelatedParty: 'no',
    },
    { id: 'del-2', assetId: 'asset-2', name: 'Bare deliverable' },
  ],
  deliverableSegments: [
    {
      id: 'seg-1', deliverableId: 'del-1', title: 'Upgrade to v2', startDate: '2026-02-01', endDate: '2026-12-31', status: 'st-live',
      initiativeId: 'init-1', capexAmount: 500, opexAmount: 0, rptiRemarks: 'Keterangan', row: 0, rowSpan: 2,
    },
    { id: 'seg-2', deliverableId: 'del-2', startDate: '2027-01-01', endDate: '2027-12-31', status: 'st-plan' },
  ],
  rptiDetails: [
    {
      id: 'rpti-1', initiativeId: 'init-1', targetType: 'deliverable', targetId: 'del-1', categoryCode: '02', developmentType: 'upgrade',
      developer: 'PPJTI', ppjtiRelatedParty: 'no', dcCity: 'Jakarta', dcCountry: 'Indonesia', drCity: 'Batam', drCountry: 'Indonesia',
      plannedImplementationQuarter: 'Q4', deliverableSegmentId: 'seg-1', remarks: 'Filed 2026',
    },
    { id: 'rpti-2', initiativeId: 'init-2', targetType: 'asset', targetId: 'asset-2', developmentType: 'new' },
  ],
  lkptiDetails: [
    {
      id: 'lk-1', targetId: 'del-1', targetName: 'Ledger app', categoryCode: '02', developer: 'PT Vendor, Tbk',
      dcCity: 'Jakarta', dcCountry: 'Indonesia', drCity: 'Batam', drCountry: 'Indonesia', platform: 'Java', database: 'Oracle',
      dcProvider: 'self', drcProvider: 'PT DRC', backupStrategy: 'BACKUP_REALTIME', systemOwner: 'Head of Ops',
      goLiveDate: '31-12-2020', ownership: 'OUTRIGHT_PURCHASE', functionDescription: 'General ledger',
    },
    { id: 'lk-2', targetId: 'del-missing' },
  ],
  decisions: structuredClone(liveDecisions),
  timelineSettings: settings(),
});

/** Two snapshots with distinct values, reusing current-state IDs as real snapshots do. */
const versions = (): Version[] => {
  const base = current();
  const first: Version = {
    id: 'ver-1',
    name: 'Before consolidation',
    timestamp: '2026-03-01T09:00:00.000Z',
    description: 'First snapshot\r\nwith CRLF',
    data: {
      ...structuredClone(base),
      initiatives: base.initiatives.map(i => ({ ...i, name: `${i.name} (as at March)`, capex: i.capex + 1 })),
      timelineSettings: settings({ monthsToShow: 12, columnWidths: {}, collapsedGroups: [], hasSeenTutorial: true, defaultCurrency: 'USD' }),
      // Archival copy (ADR-0011): kept by backup, ignored by History restore.
      decisions: [{ ...liveDecisions[1], title: 'Archived wording', versionId: undefined }],
    },
  };
  const { deliverableStatuses: _omitStatuses, decisions: _omitDecisions, rptiDetails: _omitRpti, lkptiDetails: _omitLkpti, ...required } = structuredClone(base);
  const second: Version = {
    id: 'ver-2',
    name: 'Optional collections absent',
    timestamp: '2026-05-01T09:00:00.000Z',
    // No description, no deliverableStatuses/decisions/rptiDetails/lkptiDetails:
    // absence must stay distinguishable from an explicitly empty collection.
    data: {
      ...required,
      assets: [],
      timelineSettings: settings({ startDate: '2025-07-01', monthsToShow: 36, columnWidths: undefined, collapsedGroups: undefined }),
    },
  };
  const third: Version = {
    id: 'ver-3',
    name: 'Optional collections present but empty',
    timestamp: '2026-06-01T09:00:00.000Z',
    description: '',
    data: { ...structuredClone(required), deliverableStatuses: [], decisions: [], rptiDetails: [], lkptiDetails: [] },
  };
  return [first, second, third];
};

export function fieldCompleteWorkspace(): PortableWorkspace {
  return { ...current(), versions: versions() };
}

const emptySettings = (): TimelineSettings => ({
  startDate: '2026-01-01',
  monthsToShow: 12,
  budgetVisualisation: 'label',
  descriptionDisplay: 'off',
  emptyRowDisplay: 'show',
  snapToPeriod: 'off',
  conflictDetection: 'off',
  showRelationships: 'off',
});

export function emptyWorkspace(): PortableWorkspace {
  return {
    assets: [], deliverables: [], deliverableSegments: [], deliverableStatuses: [], initiatives: [], milestones: [],
    programmes: [], strategies: [], dependencies: [], assetCategories: [], resources: [], rptiDetails: [], lkptiDetails: [],
    decisions: [], timelineSettings: emptySettings(), versions: [],
  };
}

/** Nothing current, but saved History — recovery must not treat it as empty. */
export function historyOnlyWorkspace(): PortableWorkspace {
  return { ...emptyWorkspace(), versions: [versions()[0]] };
}

/** Nothing current but the decision log. */
export function decisionsOnlyWorkspace(): PortableWorkspace {
  return { ...emptyWorkspace(), decisions: structuredClone(liveDecisions) };
}
