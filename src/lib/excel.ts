import * as XLSX from 'xlsx';
import { decodeFormat1ForImport, FIELD_INVENTORY } from './workspaceBackup';
import { Decision, Asset, Deliverable, DeliverableSegment, DeliverableStatus, Initiative, Milestone, Programme, Strategy, Dependency, AssetCategory, TimelineSettings, Resource, Version, RptiDetail, LkptiDetail } from '../types';

interface AppData {
  assets: Asset[];
  deliverables?: Deliverable[];
  deliverableSegments?: DeliverableSegment[];
  deliverableStatuses?: DeliverableStatus[];
  initiatives: Initiative[];
  milestones: Milestone[];
  programmes: Programme[];
  strategies: Strategy[];
  dependencies: Dependency[];
  assetCategories: AssetCategory[];
  timelineSettings?: TimelineSettings;
  resources?: Resource[];
  versions?: Version[];
  rptiDetails?: RptiDetail[];
  lkptiDetails?: LkptiDetail[];
  decisions?: Decision[];
}


const ALLOWED_MONTHS_TO_SHOW: TimelineSettings['monthsToShow'][] = [3, 6, 12, 24, 36];

const sanitizeTimelineSettings = (raw: unknown): TimelineSettings | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;

  const candidate = raw as Partial<TimelineSettings>;
  const startDate = typeof candidate.startDate === 'string' ? candidate.startDate.trim() : '';
  const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(startDate) && !Number.isNaN(Date.parse(startDate));

  const parsedMonths = Number((candidate as any).monthsToShow);
  const monthsToShow = ALLOWED_MONTHS_TO_SHOW.includes(parsedMonths as TimelineSettings['monthsToShow'])
    ? (parsedMonths as TimelineSettings['monthsToShow'])
    : undefined;

  if (!isIsoDate || !monthsToShow) return undefined;

  return {
    ...candidate,
    startDate,
    monthsToShow,
  } as TimelineSettings;
};

/**
 * Display fallback for a saved version whose settings are missing or invalid —
 * ordinary Import only (contracts/workbook.md, "Legacy repairs"). startDate is a
 * viewport position, never an implementation or go-live date.
 */
export const SNAPSHOT_DISPLAY_FALLBACK: Pick<TimelineSettings,
  'startDate' | 'monthsToShow' | 'budgetVisualisation' | 'descriptionDisplay' | 'emptyRowDisplay' | 'snapToPeriod' | 'conflictDetection' | 'showRelationships'> = {
  startDate: '2000-01-01',
  monthsToShow: 12,
  budgetVisualisation: 'label',
  descriptionDisplay: 'off',
  emptyRowDisplay: 'show',
  snapToPeriod: 'month',
  conflictDetection: 'off',
  showRelationships: 'off',
};

/** Settings that carry business meaning: kept when valid, disclosed when not, never borrowed or derived. */
const BUSINESS_SETTINGS = ['onboardingLkptiYear', 'onboardingRptiYear', 'defaultCurrency', 'clusterName'] as const;

const settingValid = (field: string, value: unknown): boolean => {
  const spec = (FIELD_INVENTORY.TimelineSettings as Record<string, { kind: string; values?: readonly unknown[] }>)[field];
  if (!spec) return true;
  const kindOk = spec.kind === 'string' ? typeof value === 'string'
    : spec.kind === 'number' ? typeof value === 'number' && Number.isFinite(value)
      : spec.kind === 'boolean' ? typeof value === 'boolean'
        : spec.kind === 'stringArray' ? Array.isArray(value) && value.every(v => typeof v === 'string')
          : typeof value === 'object' && value !== null && !Array.isArray(value)
            && Object.values(value).every(inner => typeof inner === 'object' && inner !== null && Object.values(inner).every(w => typeof w === 'string'));
  if (!kindOk) return false;
  if (field === 'startDate') return sanitizeTimelineSettings({ startDate: value, monthsToShow: 12 }) !== undefined;
  return !spec.values || spec.values.includes(value);
};

/**
 * A saved version's settings as ordinary Import restores them. Valid settings pass
 * through unchanged. Otherwise each missing/invalid required display field gets
 * the documented fallback, invalid optional display fields are omitted, valid
 * business settings survive, and every repair and gap is described — business
 * settings are never filled in from the destination workspace or the fallback.
 */
export function repairSnapshotSettings(raw: unknown, versionLabel: string): { settings: TimelineSettings; notice?: string } {
  const source = raw && typeof raw === 'object' ? { ...(raw as Record<string, unknown>) } : {};
  const repairedDisplay = (Object.keys(SNAPSHOT_DISPLAY_FALLBACK) as (keyof typeof SNAPSHOT_DISPLAY_FALLBACK)[])
    .filter(field => !settingValid(field, source[field]));
  if (repairedDisplay.length === 0) return { settings: source as unknown as TimelineSettings };

  const settings: Record<string, unknown> = { ...source };
  for (const field of repairedDisplay) settings[field] = SNAPSHOT_DISPLAY_FALLBACK[field];
  const droppedDisplay: string[] = [];
  const droppedBusiness: string[] = [];
  for (const [field, value] of Object.entries(source)) {
    if (field in SNAPSHOT_DISPLAY_FALLBACK || value === undefined || settingValid(field, value)) continue;
    delete settings[field];
    ((BUSINESS_SETTINGS as readonly string[]).includes(field) ? droppedBusiness : droppedDisplay).push(`${field} (${JSON.stringify(value)})`);
  }
  const absentBusiness = BUSINESS_SETTINGS.filter(field => source[field] === undefined);

  const parts = [
    `${versionLabel}: its timeline display settings were missing or invalid (${repairedDisplay.join(', ')}), so Selara's display defaults were used. The 2000-01-01 start date only positions the timeline; it is not a business date.`,
  ];
  if (droppedDisplay.length) parts.push(`Invalid display settings left out: ${droppedDisplay.join(', ')}.`);
  if (droppedBusiness.length) parts.push(`Invalid business settings left out, not replaced: ${droppedBusiness.join(', ')}.`);
  if (absentBusiness.length) parts.push(`Business settings not in the file and left unset: ${absentBusiness.join(', ')}.`);
  return { settings: settings as unknown as TimelineSettings, notice: parts.join(' ') };
}

const normalizeResourceIds = (value: unknown): string[] | undefined => {
  if (typeof value === 'string') {
    const parsed = value.split(',').map(s => s.trim()).filter(Boolean);
    return parsed.length > 0 ? parsed : undefined;
  }
  if (Array.isArray(value)) {
    const parsed = value
      .filter((id): id is string => typeof id === 'string')
      .map(id => id.trim())
      .filter(Boolean);
    return parsed.length > 0 ? parsed : undefined;
  }
  return undefined;
};

// Absent stays absent, and a malformed value becomes absent rather than 'planned'.
// The hardening this was written for is satisfied either way — the bad value does not
// survive — but discarding it does not license inventing a different one in its place,
// and this function WRITES what it returns. Coercing here turned a display default into
// stored data: every status-less initiative acquired a claim nobody made, indistinguishable
// from one a preparer chose. See requirement-specs/initiative-status-unset.md.
const normalizeInitiativeStatus = (value: unknown): Initiative['status'] => {
  return value === 'planned' || value === 'active' || value === 'done' || value === 'cancelled'
    ? value
    : undefined;
};

const normalizeImportedInitiative = (init: any): Initiative => ({
  ...init,
  capex: Number(init.capex) || Number(init.budget) || 0,
  opex: Number(init.opex) || 0,
  status: normalizeInitiativeStatus(init.status),
  resourceIds: normalizeResourceIds(init.resourceIds) ?? init.resourceIds,
});

/**
 * Builds the workbook. Split out from `exportToExcel` so the export/import round
 * trip can be unit-tested without a browser download and a File — the risk in
 * this module is the sheet mapping, not the file I/O.
 */
export const buildWorkbook = (data: AppData): XLSX.WorkBook => {
  const wb = XLSX.utils.book_new();

  // Helper to add versionId to a list of items
  const withVersion = <T>(items: T[], versionId: string = ''): (T & { versionId: string })[] => {
    return items.map(item => ({ ...item, versionId }));
  };

  // Helper to flatten current + all versions into a single list
  const flatten = <T>(current: T[] | undefined, key: keyof Version['data']): (T & { versionId: string })[] => {
    const list = withVersion(current || []);
    (data.versions || []).forEach(v => {
      const vItems = (v.data[key] as T[]) || [];
      list.push(...withVersion(vItems, v.id));
    });

    // Special handling for Initiative.resourceIds — convert array to string
    if (key === 'initiatives') {
      return list.map(item => {
        if ((item as any).resourceIds && Array.isArray((item as any).resourceIds)) {
          return {
            ...item,
            resourceIds: (item as any).resourceIds.join(', ')
          };
        }
        return item;
      });
    }

    return list;
  };

  // 1. Initiatives
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatten(data.initiatives, 'initiatives')), 'Initiatives');

  // 2. Assets
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatten(data.assets, 'assets')), 'Assets');

  // 3. Asset Categories
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatten(data.assetCategories, 'assetCategories')), 'AssetCategories');

  // 4. Programmes
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatten(data.programmes, 'programmes')), 'Programmes');

  // 5. Strategies
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatten(data.strategies, 'strategies')), 'Strategies');

  // 6. Milestones
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatten(data.milestones, 'milestones')), 'Milestones');

  // 7. Dependencies
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatten(data.dependencies, 'dependencies')), 'Dependencies');

  // 8. Deliverables
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatten(data.deliverables, 'deliverables')), 'Deliverables');

  // 9. Deliverable Segments
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatten(data.deliverableSegments, 'deliverableSegments')), 'DeliverableSegments');

  // 10. Deliverable Statuses
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatten(data.deliverableStatuses, 'deliverableStatuses')), 'DeliverableStatuses');

  // 11. Resources
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatten(data.resources, 'resources')), 'Resources');

  // 12. RPTI Details (raw backup copy — the pretty Format 3.1 export is a separate, report-scoped export)
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatten(data.rptiDetails, 'rptiDetails')), 'RptiDetails');

  // 12b. LKPTI Report Details (raw backup copy — the pretty LKPTI 3.2.6 export is a separate, report-scoped export)
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatten(data.lkptiDetails, 'lkptiDetails')), 'LkptiDetails');

  // 13. Timeline Settings (versioned)
  const settingsList = [];
  if (data.timelineSettings) settingsList.push({ ...data.timelineSettings, versionId: '' });
  (data.versions || []).forEach(v => {
    if (v.data.timelineSettings) settingsList.push({ ...v.data.timelineSettings, versionId: v.id });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(settingsList), 'TimelineSettings');

  // 14. Versions (Metadata)
  const versionsMetadata = (data.versions || []).map(v => ({
    id: v.id,
    name: v.name,
    timestamp: v.timestamp,
    description: v.description || '',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(versionsMetadata), 'Versions');

  /*
   * 15. Decisions — deliberately NOT run through flatten().
   *
   * Every other sheet carries a `versionId` column saying which snapshot a row
   * belongs to ('' meaning current). `Decision.versionId` already means something
   * else entirely: the snapshot that *enacted* the decision (ADR-0011). Pushing
   * decisions through flatten()/withVersion() would overwrite that link with ''
   * on export and strip it on import — a second, quieter data loss hidden inside
   * the fix for the first.
   *
   * There is nothing to version here anyway: ADR-0011 made `Version.data.decisions`
   * a deprecated field that is never read, because the decision log is an audit
   * trail about the workspace rather than part of its state. So the log is exported
   * once, as current data, and `versionId` travels as an ordinary column.
   */
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.decisions || []), 'Decisions');

  return wb;
};

export const exportToExcel = (data: AppData) => {
  XLSX.writeFile(buildWorkbook(data), `it-roadmap-${new Date().toISOString().split('T')[0]}.xlsx`);
};

/**
 * Reads a workbook into workspace data. Split out from `importFromExcel` so the
 * round trip is unit-testable against `buildWorkbook` without a File or a
 * FileReader.
 */
export const parseWorkbook = (wb: XLSX.WorkBook): Partial<AppData> => parseWorkbookWithDiagnostics(wb).data;

/**
 * Ordinary Import's reader, with what it had to repair or could not read. Reads
 * both older exports and format 1 backups (whose cells it decodes first), and is
 * the only place snapshot display settings are repaired — Restore Backup never
 * repairs (contracts/workbook.md).
 */
export const parseWorkbookWithDiagnostics = (wb: XLSX.WorkBook): { data: Partial<AppData>; notices: string[] } => {
        const result: Partial<AppData> = {
          versions: []
        };
        const notices: string[] = [];
        const format1 = decodeFormat1ForImport(wb);

        // Helper to safely get sheet data
        const getSheetData = <T>(name: string): T[] => {
          if (format1) return (format1.sheets.get(name) ?? []) as T[];
          const ws = wb.Sheets[name];
          if (!ws) return [];
          return XLSX.utils.sheet_to_json(ws);
        };

        // Read all sheets into raw arrays
        const raw = {
          initiatives: getSheetData<any>('Initiatives'),
          assets: getSheetData<any>('Assets'),
          assetCategories: getSheetData<any>('AssetCategories'),
          programmes: getSheetData<any>('Programmes'),
          strategies: getSheetData<any>('Strategies'),
          milestones: getSheetData<any>('Milestones'),
          dependencies: getSheetData<any>('Dependencies'),
          deliverables: getSheetData<any>('Deliverables'),
          deliverableSegments: getSheetData<any>('DeliverableSegments'),
          deliverableStatuses: getSheetData<any>('DeliverableStatuses'),
          resources: getSheetData<any>('Resources'),
          rptiDetails: getSheetData<any>('RptiDetails'),
          lkptiDetails: getSheetData<any>('LkptiDetails'),
          timelineSettings: getSheetData<any>('TimelineSettings'),
          versions: getSheetData<any>('Versions'),
        };

        // Separate current data from versioned data
        const split = <T>(list: (T & { versionId?: string })[]): { current: T[], byVersion: Record<string, T[]> } => {
          const current: T[] = [];
          const byVersion: Record<string, T[]> = {};
          list.forEach(item => {
            const { versionId, ...rest } = item;
            if (!versionId) {
              current.push(rest as T);
            } else {
              if (!byVersion[versionId]) byVersion[versionId] = [];
              byVersion[versionId].push(rest as T);
            }
          });
          return { current, byVersion };
        };

        const initsSplit = split<Initiative>(raw.initiatives);
        result.initiatives = initsSplit.current.map(normalizeImportedInitiative);

        const assetsSplit = split<Asset>(raw.assets);
        result.assets = assetsSplit.current;

        const catSplit = split<AssetCategory>(raw.assetCategories);
        result.assetCategories = catSplit.current;

        const progSplit = split<Programme>(raw.programmes);
        result.programmes = progSplit.current;

        const stratSplit = split<Strategy>(raw.strategies);
        result.strategies = stratSplit.current;

        const mileSplit = split<Milestone>(raw.milestones);
        result.milestones = mileSplit.current;

        const depSplit = split<Dependency>(raw.dependencies);
        result.dependencies = depSplit.current;

        const appSplit = split<Deliverable>(raw.deliverables);
        result.deliverables = appSplit.current;

        const segSplit = split<DeliverableSegment>(raw.deliverableSegments);
        result.deliverableSegments = segSplit.current;

        const statSplit = split<DeliverableStatus>(raw.deliverableStatuses);
        result.deliverableStatuses = statSplit.current;

        const resSplit = split<Resource>(raw.resources);
        result.resources = resSplit.current;

        const rptiDetailSplit = split<RptiDetail>(raw.rptiDetails);
        result.rptiDetails = rptiDetailSplit.current;

        const appInvDetailSplit = split<LkptiDetail>(raw.lkptiDetails);
        result.lkptiDetails = appInvDetailSplit.current;

        const settingsSplit = split<TimelineSettings>(raw.timelineSettings);
        result.timelineSettings = sanitizeTimelineSettings(settingsSplit.current[0]);
        if (!result.timelineSettings) {
          notices.push('The file has no usable current timeline settings, so your current timeline settings are kept.');
        }

        // Reconstruct versions
        if (raw.versions.length > 0) {
          result.versions = raw.versions.map((v: any) => {
            const vid = v.id;
            const repaired = repairSnapshotSettings(settingsSplit.byVersion[vid]?.[0], `Saved version "${v.name ?? vid}"`);
            if (repaired.notice) notices.push(repaired.notice);
            return {
              id: vid,
              name: v.name,
              timestamp: v.timestamp,
              description: v.description,
              data: {
                initiatives: (initsSplit.byVersion[vid] || []).map(normalizeImportedInitiative),
                assets: assetsSplit.byVersion[vid] || [],
                assetCategories: catSplit.byVersion[vid] || [],
                programmes: progSplit.byVersion[vid] || [],
                strategies: stratSplit.byVersion[vid] || [],
                milestones: mileSplit.byVersion[vid] || [],
                dependencies: depSplit.byVersion[vid] || [],
                deliverables: appSplit.byVersion[vid] || [],
                deliverableSegments: segSplit.byVersion[vid] || [],
                deliverableStatuses: statSplit.byVersion[vid] || [],
                resources: resSplit.byVersion[vid] || [],
                rptiDetails: rptiDetailSplit.byVersion[vid] || [],
                lkptiDetails: appInvDetailSplit.byVersion[vid] || [],
                timelineSettings: repaired.settings,
                // Format 1 carries each snapshot's archival decision copy (ADR-0011:
                // kept, never read on restore); older files don't.
                ...(Array.isArray(v.archivedDecisions) ? { decisions: v.archivedDecisions as Decision[] } : {}),
              }
            };
          });
        }

        /*
         * Decisions are read straight from their sheet — no split(), because the
         * Decisions sheet carries no version envelope (see buildWorkbook). Running
         * it through split() would strip `Decision.versionId`, which here means the
         * snapshot that enacted the decision, not the snapshot the row belongs to.
         *
         * Left `undefined` when the sheet is absent rather than defaulted to []:
         * files exported before this fix carry no Decisions sheet, and the overwrite
         * import path must be able to tell "this file says there are none" from
         * "this file cannot speak about decisions at all" — writing [] over a
         * populated log is exactly the bug this fixes (#22).
         */
        if (wb.Sheets['Decisions']) {
          result.decisions = getSheetData<Decision>('Decisions');
        }

        return { data: result, notices };
};

export const readWorkbookFile = (file: File): Promise<XLSX.WorkBook> => new Promise((resolve, reject) => {
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      resolve(XLSX.read(data, { type: 'array' }));
    } catch (error) {
      reject(error);
    }
  };

  reader.onerror = (error) => reject(error);
  reader.readAsArrayBuffer(file);
});

export const importFromExcelWithDiagnostics = async (file: File) => parseWorkbookWithDiagnostics(await readWorkbookFile(file));

export const importFromExcel = async (file: File): Promise<Partial<AppData>> => (await importFromExcelWithDiagnostics(file)).data;

