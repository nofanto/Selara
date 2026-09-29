/**
 * Workspace backup: the portable, restorable form of a whole workspace
 * (specs/005-workspace-recovery, requirement-specs/workspace-backup-recovery.md).
 *
 * The backup is the existing Excel workbook (decision 1A), made lossless:
 *
 * - The 16 entity sheets stay authoritative; there is no hidden second copy.
 * - A `SelaraBackup` sheet marks format 1 and records expected row counts, so a
 *   missing row is detected instead of silently restored as "fewer records".
 * - Nested values, and any string SheetJS would alter on a round trip, are
 *   written as `__SELARA_JSON_V1__:` + JSON. The escaped JSON avoids `_x` and
 *   non-XML characters so the encoded text itself survives Excel.
 *
 * The contract is proven, not assumed: `createBackup` writes real XLSX bytes,
 * reads them back through the same reader Restore Backup uses, and refuses to
 * hand over a file that does not compare equal to the workspace it came from.
 */
import * as XLSX from 'xlsx';
import type {
  Asset, AssetCategory, Decision, Deliverable, DeliverableSegment, DeliverableStatus, Dependency, Initiative,
  LkptiDetail, Milestone, Programme, Resource, RptiDetail, Strategy, TimelineSettings, Version,
} from '../types';

export const BACKUP_MARKER_SHEET = 'SelaraBackup';
export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_CELL_ENCODING = 'selara-json-v1';
export const ENCODED_PREFIX = '__SELARA_JSON_V1__:';
const EXCEL_CELL_LIMIT = 32767;
/** Row envelope on versioned sheets: '' is current state, otherwise the owning Version.id. */
const ENVELOPE = 'versionId';

export interface PortableWorkspace {
  assets: Asset[];
  deliverables: Deliverable[];
  deliverableSegments: DeliverableSegment[];
  deliverableStatuses: DeliverableStatus[];
  initiatives: Initiative[];
  milestones: Milestone[];
  programmes: Programme[];
  strategies: Strategy[];
  dependencies: Dependency[];
  assetCategories: AssetCategory[];
  resources: Resource[];
  rptiDetails: RptiDetail[];
  lkptiDetails: LkptiDetail[];
  decisions: Decision[];
  timelineSettings: TimelineSettings;
  versions: Version[];
}

// ─── Field inventory (contracts/field-inventory.md) ──────────────────────────

type Kind = 'string' | 'number' | 'boolean' | 'stringArray' | 'columnWidths';
type DateFormat = 'isoDate' | 'isoDateTime' | 'dmyDate';
interface FieldSpec {
  kind: Kind;
  required: boolean;
  /** Known values. Anything else is preserved and disclosed, never rejected. */
  values?: readonly (string | number)[];
  format?: DateFormat;
}
/** Every member of T, optional or not, must be classified — a new field is a compile error here. */
type Inventory<T> = { [K in keyof T]-?: FieldSpec };

const req = (kind: Kind, extra: Partial<FieldSpec> = {}): FieldSpec => ({ kind, required: true, ...extra });
const opt = (kind: Kind, extra: Partial<FieldSpec> = {}): FieldSpec => ({ kind, required: false, ...extra });

const RPTI_CATEGORY_CODES = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '49', '51', '52', '53', '54', '99'];
const LKPTI_CATEGORY_CODES = RPTI_CATEGORY_CODES.filter(c => !['51', '52', '53', '54', '99'].includes(c));
const ON_OFF = ['on', 'off'];

export const FIELD_INVENTORY: {
  Strategy: Inventory<Strategy>;
  Programme: Inventory<Programme>;
  AssetCategory: Inventory<AssetCategory>;
  Resource: Inventory<Resource>;
  DeliverableStatus: Inventory<DeliverableStatus>;
  Initiative: Inventory<Initiative>;
  Dependency: Inventory<Dependency>;
  Milestone: Inventory<Milestone>;
  Decision: Inventory<Decision>;
  Asset: Inventory<Asset>;
  Deliverable: Inventory<Deliverable>;
  DeliverableSegment: Inventory<DeliverableSegment>;
  RptiDetail: Inventory<RptiDetail>;
  LkptiDetail: Inventory<LkptiDetail>;
  TimelineSettings: Inventory<TimelineSettings>;
} = {
  Strategy: { id: req('string'), name: req('string'), color: req('string') },
  Programme: { id: req('string'), name: req('string'), color: req('string') },
  AssetCategory: {
    id: req('string'), name: req('string'), order: opt('number'), categoryCode: opt('string', { values: RPTI_CATEGORY_CODES }),
    dcCity: opt('string'), dcCountry: opt('string'), drCity: opt('string'), drCountry: opt('string'),
  },
  Resource: { id: req('string'), name: req('string'), role: opt('string') },
  DeliverableStatus: {
    id: req('string'), name: req('string'), color: req('string'), isLiveStatus: opt('boolean'), isPreLaunchStatus: opt('boolean'),
  },
  Initiative: {
    id: req('string'), name: req('string'), programmeId: req('string'), strategyId: opt('string'), assetId: req('string'),
    startDate: req('string', { format: 'isoDate' }), endDate: req('string', { format: 'isoDate' }),
    capex: req('number'), opex: req('number'), description: opt('string'), isPlaceholder: opt('boolean'),
    status: opt('string', { values: ['planned', 'active', 'done', 'cancelled'] }),
    ragStatus: opt('string', { values: ['green', 'amber', 'red'] }),
    progress: opt('number'), owner: opt('string'), ownerId: opt('string'), resourceIds: opt('stringArray'),
  },
  Dependency: {
    id: req('string'), sourceId: req('string'), targetId: req('string'),
    type: req('string', { values: ['blocks', 'requires', 'related'] }), midXOffset: opt('number'),
    sourceType: opt('string', { values: ['initiative', 'milestone', 'segment'] }),
    targetType: opt('string', { values: ['initiative', 'segment'] }),
  },
  Milestone: {
    id: req('string'), assetId: req('string'), date: req('string', { format: 'isoDate' }), name: req('string'),
    type: req('string', { values: ['info', 'warning', 'critical'] }),
  },
  Decision: {
    id: req('string'), title: req('string'), status: req('string', { values: ['proposed', 'accepted', 'deprecated', 'superseded'] }),
    supersededBy: opt('string'), createdAt: req('string', { format: 'isoDateTime' }), context: opt('string'),
    consideredOptions: opt('string'), decisionOutcome: opt('string'), consequences: opt('string'),
    linkedEntityType: opt('string', { values: ['initiative', 'programme', 'asset'] }), linkedEntityId: opt('string'),
    versionId: opt('string'),
  },
  Asset: { id: req('string'), name: req('string'), categoryId: req('string'), maturity: opt('number'), externalId: opt('string') },
  Deliverable: {
    id: req('string'), assetId: req('string'), name: req('string'),
    type: opt('string', { values: ['application', 'infrastructure', 'document', 'procedure', 'other'] }),
    description: opt('string'), categoryCode: opt('string', { values: RPTI_CATEGORY_CODES }), developer: opt('string'),
    dcCity: opt('string'), dcCountry: opt('string'), drCity: opt('string'), drCountry: opt('string'),
    platform: opt('string'), database: opt('string'), dcProvider: opt('string'), drcProvider: opt('string'),
    backupStrategy: opt('string', { values: ['HA_ACTIVE_ACTIVE', 'HA_ACTIVE_PASSIVE', 'BACKUP_REALTIME', 'BACKUP_PERIODIC'] }),
    systemOwner: opt('string'), ownership: opt('string', { values: ['LEASE', 'OUTRIGHT_PURCHASE'] }),
    ppjtiRelatedParty: opt('string', { values: ['yes', 'no', 'n/a'] }),
  },
  DeliverableSegment: {
    id: req('string'), deliverableId: req('string'), title: opt('string'),
    startDate: req('string', { format: 'isoDate' }), endDate: req('string', { format: 'isoDate' }), status: req('string'),
    initiativeId: opt('string'), capexAmount: opt('number'), opexAmount: opt('number'), rptiRemarks: opt('string'),
    row: opt('number'), rowSpan: opt('number'),
  },
  RptiDetail: {
    id: req('string'), initiativeId: req('string'), targetType: req('string', { values: ['deliverable', 'asset'] }),
    targetId: req('string'), categoryCode: opt('string', { values: RPTI_CATEGORY_CODES }),
    developmentType: req('string', { values: ['new', 'upgrade'] }), developer: opt('string', { values: ['inhouse', 'PPJTI'] }),
    ppjtiRelatedParty: opt('string', { values: ['yes', 'no', 'n/a'] }),
    dcCity: opt('string'), dcCountry: opt('string'), drCity: opt('string'), drCountry: opt('string'),
    plannedImplementationQuarter: opt('string', { values: ['Q1', 'Q2', 'Q3', 'Q4'] }),
    deliverableSegmentId: opt('string'), remarks: opt('string'),
  },
  LkptiDetail: {
    id: req('string'), targetId: req('string'), targetName: opt('string'), categoryCode: opt('string', { values: LKPTI_CATEGORY_CODES }),
    developer: opt('string'), dcCity: opt('string'), dcCountry: opt('string'), drCity: opt('string'), drCountry: opt('string'),
    platform: opt('string'), database: opt('string'), dcProvider: opt('string'), drcProvider: opt('string'),
    backupStrategy: opt('string', { values: ['HA_ACTIVE_ACTIVE', 'HA_ACTIVE_PASSIVE', 'BACKUP_REALTIME', 'BACKUP_PERIODIC'] }),
    systemOwner: opt('string'), goLiveDate: opt('string', { format: 'dmyDate' }),
    ownership: opt('string', { values: ['LEASE', 'OUTRIGHT_PURCHASE'] }), functionDescription: opt('string'),
  },
  TimelineSettings: {
    startDate: req('string', { format: 'isoDate' }), monthsToShow: req('number', { values: [3, 6, 12, 24, 36] }),
    budgetVisualisation: req('string', { values: ['label', 'bar-height', 'off'] }),
    descriptionDisplay: req('string', { values: ON_OFF }), emptyRowDisplay: req('string', { values: ['show', 'hide'] }),
    snapToPeriod: req('string', { values: ['off', 'month'] }), conflictDetection: req('string', { values: ON_OFF }),
    showRelationships: req('string', { values: ON_OFF }), columnWidths: opt('columnWidths'), collapsedGroups: opt('stringArray'),
    hasSeenTutorial: opt('boolean'), columnZoom: opt('number'), sidebarWidth: opt('number'),
    mobileBucketMode: opt('string', { values: ['timeline', 'quarter', 'year', 'programme', 'strategy'] }),
    criticalPath: opt('string', { values: ON_OFF }), groupBy: opt('string', { values: ['asset', 'programme', 'strategy'] }),
    onboardingLkptiYear: opt('number'), onboardingRptiYear: opt('number'),
    colorBy: opt('string', { values: ['programme', 'strategy', 'status', 'rag'] }), showResources: opt('string', { values: ON_OFF }),
    display: opt('string', { values: ['both', 'initiatives', 'deliverables'] }), templateId: opt('string'),
    showRptiCatalogue: opt('boolean'), clusterName: opt('string'), defaultCurrency: opt('string'),
  },
};

type EntityName = keyof typeof FIELD_INVENTORY;

type CollectionKey =
  | 'initiatives' | 'assets' | 'assetCategories' | 'programmes' | 'strategies' | 'milestones' | 'dependencies'
  | 'deliverables' | 'deliverableSegments' | 'deliverableStatuses' | 'resources' | 'rptiDetails' | 'lkptiDetails';

/** The versioned entity sheets, in the order the ordinary export has always written them. */
const COLLECTIONS: readonly { key: CollectionKey; sheet: string; entity: EntityName }[] = [
  { key: 'initiatives', sheet: 'Initiatives', entity: 'Initiative' },
  { key: 'assets', sheet: 'Assets', entity: 'Asset' },
  { key: 'assetCategories', sheet: 'AssetCategories', entity: 'AssetCategory' },
  { key: 'programmes', sheet: 'Programmes', entity: 'Programme' },
  { key: 'strategies', sheet: 'Strategies', entity: 'Strategy' },
  { key: 'milestones', sheet: 'Milestones', entity: 'Milestone' },
  { key: 'dependencies', sheet: 'Dependencies', entity: 'Dependency' },
  { key: 'deliverables', sheet: 'Deliverables', entity: 'Deliverable' },
  { key: 'deliverableSegments', sheet: 'DeliverableSegments', entity: 'DeliverableSegment' },
  { key: 'deliverableStatuses', sheet: 'DeliverableStatuses', entity: 'DeliverableStatus' },
  { key: 'resources', sheet: 'Resources', entity: 'Resource' },
  { key: 'rptiDetails', sheet: 'RptiDetails', entity: 'RptiDetail' },
  { key: 'lkptiDetails', sheet: 'LkptiDetails', entity: 'LkptiDetail' },
];

export const BACKUP_DATA_SHEETS: readonly string[] = [...COLLECTIONS.map(c => c.sheet), 'TimelineSettings', 'Versions', 'Decisions'];

/** Keys a Version.data may carry. `decisions` is the archival copy (ADR-0011). */
const SNAPSHOT_KEYS: readonly string[] = [...COLLECTIONS.map(c => c.key), 'timelineSettings', 'decisions'];
const VERSION_FIELDS = new Set(['id', 'name', 'timestamp', 'description', 'data']);
const VERSION_SHEET_COLUMNS = new Set(['id', 'name', 'timestamp', 'description', 'collections', 'rowCounts', 'archivedDecisions']);

// ─── Findings ────────────────────────────────────────────────────────────────

/** Loss or corruption: blocks a backup, rejects (or redirects) a restore. */
type Problems = string[];

/** Preserved as stored, but worth saying: off-list values, odd dates, unknown fields. */
class Notices {
  private byKey = new Map<string, { text: (count: number, example: string) => string; count: number; example: string }>();

  add(key: string, example: unknown, text: (count: number, example: string) => string) {
    const entry = this.byKey.get(key);
    if (entry) entry.count++;
    else this.byKey.set(key, { text, count: 1, example: typeof example === 'string' ? example : JSON.stringify(example) });
  }

  lines(): string[] {
    return [...this.byKey.values()].map(n => n.text(n.count, n.example));
  }
}

export class BackupGenerationError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Backup could not be created without losing data: ${problems.slice(0, 3).join(' ')}${problems.length > 3 ? ` (and ${problems.length - 3} more)` : ''}`);
    this.name = 'BackupGenerationError';
  }
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

const describeValue = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'a list' : typeof v === 'object' ? 'an object' : `${typeof v} ${JSON.stringify(v)}`);

const isRealDate = (y: number, m: number, d: number) => {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

const matchesFormat = (value: string, format: DateFormat) => {
  if (format === 'isoDateTime') return !Number.isNaN(Date.parse(value));
  const match = format === 'isoDate' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) return false;
  const [y, m, d] = format === 'isoDate' ? [match[1], match[2], match[3]] : [match[3], match[2], match[1]];
  return isRealDate(Number(y), Number(m), Number(d));
};

const kindMatches = (kind: Kind, v: unknown) => {
  switch (kind) {
    case 'string': return typeof v === 'string';
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'boolean': return typeof v === 'boolean';
    case 'stringArray': return Array.isArray(v) && v.every(s => typeof s === 'string');
    case 'columnWidths':
      return isPlainObject(v) && Object.values(v).every(inner => isPlainObject(inner) && Object.values(inner).every(w => typeof w === 'string'));
  }
};

const KIND_LABEL: Record<Kind, string> = {
  string: 'text', number: 'a finite number', boolean: 'true/false', stringArray: 'a list of text values', columnWidths: 'a table → column → width map',
};

/** A value an unknown field may hold and still round-trip exactly. */
const representableProblem = (v: unknown): string | null => {
  if (v === null) return 'is null';
  if (typeof v === 'number') return Number.isFinite(v) ? null : `is ${v}, which a spreadsheet can't hold`;
  if (typeof v === 'string' || typeof v === 'boolean') return null;
  if (Array.isArray(v)) {
    for (const item of v) {
      if (item === undefined) return 'is a list with an empty slot';
      const inner = representableProblem(item);
      if (inner) return inner;
    }
    return null;
  }
  if (isPlainObject(v)) {
    for (const item of Object.values(v)) {
      if (item === undefined) continue;
      const inner = representableProblem(item);
      if (inner) return inner;
    }
    return null;
  }
  return `is ${describeValue(v)}, which can't be written to a spreadsheet`;
};

const scopeLabel = (version?: { id: string; name?: unknown }) =>
  version ? `saved version ${version.id}${typeof version.name === 'string' ? ` ("${version.name}")` : ''}` : 'current state';

const recordLabel = (entity: EntityName, record: unknown, scope: string) => {
  const id = isPlainObject(record) && typeof record.id === 'string' && record.id ? record.id : '(no id)';
  return entity === 'TimelineSettings' ? `Timeline settings of ${scope}` : `${entity} ${id} in ${scope}`;
};

/**
 * Checks one record against the inventory. Structure (presence, declared JS
 * type, finite numbers) is a problem; off-list values, odd dates and unknown
 * fields are preserved and noticed (design notes, 2026-09-29 amendment).
 */
function checkRecord(entity: EntityName, record: unknown, scope: string, problems: Problems, notices: Notices, reserved: readonly string[] = []) {
  const label = recordLabel(entity, record, scope);
  if (!isPlainObject(record)) {
    problems.push(`${label}: is ${describeValue(record)}, not a record.`);
    return;
  }
  const inventory = FIELD_INVENTORY[entity] as Record<string, FieldSpec>;
  for (const [field, spec] of Object.entries(inventory)) {
    const v = record[field];
    if (v === undefined) {
      if (spec.required) problems.push(`${label}: missing required field ${field}.`);
      continue;
    }
    if (!kindMatches(spec.kind, v)) {
      problems.push(`${label}: ${field} is ${describeValue(v)}; expected ${KIND_LABEL[spec.kind]}.`);
      continue;
    }
    if (field === 'id' && v === '') {
      problems.push(`${label}: id is empty.`);
      continue;
    }
    if (spec.values && !spec.values.includes(v as string | number)) {
      notices.add(`${entity}.${field}:values`, v, (n, e) => `${entity}.${field}: ${n} value(s) outside Selara's known list, kept as stored (e.g. ${JSON.stringify(e)}).`);
    }
    if (spec.format && !matchesFormat(v as string, spec.format)) {
      notices.add(`${entity}.${field}:format`, v, (n, e) => `${entity}.${field}: ${n} value(s) not in the expected date format, kept as stored (e.g. ${JSON.stringify(e)}).`);
    }
  }
  for (const [field, v] of Object.entries(record)) {
    if (field in inventory || v === undefined) continue;
    if (reserved.includes(field)) {
      problems.push(`${label}: has its own field "${field}", which the backup format reserves.`);
      continue;
    }
    const problem = representableProblem(v);
    if (problem) {
      problems.push(`${label}: ${field} ${problem}.`);
      continue;
    }
    notices.add(`${entity}.${field}:unknown`, field, n => `${entity}.${field}: a field Selara doesn't recognise, kept as stored (${n} record(s)).`);
  }
}

function checkUniqueIds(entity: EntityName, records: readonly unknown[], scope: string, problems: Problems) {
  const seen = new Set<string>();
  for (const record of records) {
    if (!isPlainObject(record) || typeof record.id !== 'string') continue;
    if (seen.has(record.id)) problems.push(`${entity} ${record.id} appears more than once in ${scope}.`);
    seen.add(record.id);
  }
}

/** Everything a workspace must satisfy before it can be written without loss. */
function checkWorkspace(ws: PortableWorkspace): { problems: Problems; notices: Notices } {
  const problems: Problems = [];
  const notices = new Notices();
  const checkCollection = (entity: EntityName, records: unknown, scope: string, reserved: readonly string[]) => {
    if (!Array.isArray(records)) {
      problems.push(`${entity} records in ${scope} are not a list.`);
      return;
    }
    records.forEach(r => checkRecord(entity, r, scope, problems, notices, reserved));
    checkUniqueIds(entity, records, scope, problems);
  };

  for (const { key, entity } of COLLECTIONS) checkCollection(entity, ws[key], 'current state', [ENVELOPE]);
  checkCollection('Decision', ws.decisions, 'the decision log', []);
  checkRecord('TimelineSettings', ws.timelineSettings, 'current state', problems, notices, [ENVELOPE]);

  if (!Array.isArray(ws.versions)) {
    problems.push('Saved versions are not a list.');
    return { problems, notices };
  }
  const versionIds = new Set<string>();
  for (const version of ws.versions) {
    if (!isPlainObject(version) || typeof version.id !== 'string' || version.id === '') {
      problems.push(`A saved version has no usable id.`);
      continue;
    }
    const scope = scopeLabel(version);
    if (versionIds.has(version.id)) problems.push(`Saved version ${version.id} appears more than once.`);
    versionIds.add(version.id);
    if (typeof version.name !== 'string') problems.push(`${scope}: name is ${describeValue(version.name)}; expected text.`);
    if (typeof version.timestamp !== 'string') problems.push(`${scope}: timestamp is ${describeValue(version.timestamp)}; expected text.`);
    if (version.description !== undefined && typeof version.description !== 'string') problems.push(`${scope}: description is ${describeValue(version.description)}; expected text.`);
    for (const field of Object.keys(version)) {
      if (!VERSION_FIELDS.has(field) && (version as unknown as Record<string, unknown>)[field] !== undefined) {
        problems.push(`${scope} has a field "${field}", which backup has no place for.`);
      }
    }
    if (!isPlainObject(version.data)) {
      problems.push(`${scope} has no snapshot data.`);
      continue;
    }
    const data = version.data as unknown as Record<string, unknown>;
    for (const key of Object.keys(data)) {
      if (!SNAPSHOT_KEYS.includes(key) && data[key] !== undefined) problems.push(`${scope} contains ${key}, which backup has no place for.`);
    }
    for (const { key, entity } of COLLECTIONS) if (data[key] !== undefined) checkCollection(entity, data[key], scope, [ENVELOPE]);
    if (data.decisions !== undefined) checkCollection('Decision', data.decisions, `the archived decisions of ${scope}`, []);
    if (data.timelineSettings === undefined) problems.push(`Timeline settings of ${scope}: missing, so this snapshot can't be restored as it was saved.`);
    else checkRecord('TimelineSettings', data.timelineSettings, scope, problems, notices, [ENVELOPE]);
  }
  return { problems, notices };
}

// ─── Cell encoding ───────────────────────────────────────────────────────────

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** Strings that SheetJS/Excel would change on a round trip (probed against 0.20.3). */
const needsEscape = (s: string) =>
  s.startsWith(ENCODED_PREFIX) || s.includes('\r') || /_x[0-9a-f]{4}_/i.test(s) || /[￾￿]/.test(s) || LONE_SURROGATE.test(s);

/** JSON text that survives XLSX: no `_x…_` escapes, no non-XML characters (JSON already escapes lone surrogates). */
const safeJson = (v: unknown) =>
  JSON.stringify(v)
    .replace(/_(?=[xX])/g, '\\u005f')
    .replace(/[￾￿]/g, c => `\\u${c.charCodeAt(0).toString(16)}`);

const encodeCell = (v: unknown): string | number | boolean =>
  typeof v === 'string' ? (needsEscape(v) ? ENCODED_PREFIX + safeJson(v) : v)
    : typeof v === 'number' || typeof v === 'boolean' ? v
      : ENCODED_PREFIX + safeJson(v);

function encodeRow(record: Record<string, unknown>, label: string, problems: Problems, envelope?: string): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [field, v] of Object.entries(record)) {
    if (v === undefined) continue;
    const cell = encodeCell(v);
    if (typeof cell === 'string' && cell.length > EXCEL_CELL_LIMIT) {
      problems.push(`${label}: ${field} needs ${cell.length.toLocaleString('en')} characters; an Excel cell holds at most ${EXCEL_CELL_LIMIT.toLocaleString('en')}.`);
      continue;
    }
    row[field] = cell;
  }
  if (envelope !== undefined) row[ENVELOPE] = envelope;
  return row;
}

class DecodeError extends Error {}

const decodeCell = (v: unknown, where: string): unknown => {
  if (typeof v !== 'string' || !v.startsWith(ENCODED_PREFIX)) return v;
  try {
    return JSON.parse(v.slice(ENCODED_PREFIX.length));
  } catch {
    throw new DecodeError(`${where}: an encoded cell can't be read.`);
  }
};

const sheetRows = (wb: XLSX.WorkBook, sheet: string): Record<string, unknown>[] =>
  XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheet], { raw: true });

// ─── Writing ─────────────────────────────────────────────────────────────────

const metaCell = (v: unknown) => ENCODED_PREFIX + safeJson(v);

/**
 * Builds the format 1 workbook. Throws BackupGenerationError, naming the record
 * and field, when anything can't be written without loss — before any download.
 */
export function buildBackupWorkbook(ws: PortableWorkspace, exportedAt = new Date().toISOString()): { workbook: XLSX.WorkBook; notices: string[] } {
  const { problems, notices } = checkWorkspace(ws);
  if (problems.length > 0) throw new BackupGenerationError(problems);

  const encodeProblems: Problems = [];
  const sheets = new Map<string, Record<string, unknown>[]>();
  const currentCounts: Record<string, number> = {};

  for (const { key, sheet, entity } of COLLECTIONS) {
    const rows = ws[key].map(r => encodeRow(r as unknown as Record<string, unknown>, recordLabel(entity, r, 'current state'), encodeProblems, ''));
    currentCounts[sheet] = rows.length;
    for (const version of ws.versions) {
      const records = (version.data as unknown as Record<string, unknown[] | undefined>)[key];
      if (records) rows.push(...records.map(r => encodeRow(r as Record<string, unknown>, recordLabel(entity, r, scopeLabel(version)), encodeProblems, version.id)));
    }
    sheets.set(sheet, rows);
  }

  const settingsRows = [encodeRow(ws.timelineSettings as unknown as Record<string, unknown>, 'Timeline settings of current state', encodeProblems, '')];
  for (const version of ws.versions) {
    settingsRows.push(encodeRow(version.data.timelineSettings as unknown as Record<string, unknown>, `Timeline settings of ${scopeLabel(version)}`, encodeProblems, version.id));
  }
  sheets.set('TimelineSettings', settingsRows);
  currentCounts.TimelineSettings = 1;

  sheets.set('Versions', ws.versions.map(version => {
    const data = version.data as unknown as Record<string, unknown>;
    const collections = SNAPSHOT_KEYS.filter(k => data[k] !== undefined);
    const rowCounts: Record<string, number> = { TimelineSettings: 1 };
    for (const { key, sheet } of COLLECTIONS) if (Array.isArray(data[key])) rowCounts[sheet] = (data[key] as unknown[]).length;
    return encodeRow({
      id: version.id,
      name: version.name,
      timestamp: version.timestamp,
      description: version.description,
      collections,
      rowCounts,
      archivedDecisions: version.data.decisions,
    }, scopeLabel(version), encodeProblems);
  }));
  currentCounts.Versions = ws.versions.length;

  sheets.set('Decisions', ws.decisions.map(d => encodeRow(d as unknown as Record<string, unknown>, recordLabel('Decision', d, 'the decision log'), encodeProblems)));
  currentCounts.Decisions = ws.decisions.length;

  if (encodeProblems.length > 0) throw new BackupGenerationError(encodeProblems);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
    { key: 'about', value: 'Selara workspace backup. Restore it with Restore Backup. Editing this file by hand can make it unrestorable.' },
    { key: 'formatVersion', value: BACKUP_FORMAT_VERSION },
    { key: 'cellEncoding', value: BACKUP_CELL_ENCODING },
    { key: 'exportedAt', value: exportedAt },
    { key: 'currentCounts', value: metaCell(currentCounts) },
  ]), BACKUP_MARKER_SHEET);
  for (const sheet of BACKUP_DATA_SHEETS) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheets.get(sheet) ?? []), sheet);
  return { workbook, notices: notices.lines() };
}

/**
 * The whole backup: real XLSX bytes that have been read back through Restore
 * Backup's own reader and compared with the source. Nothing is returned — so
 * nothing can be downloaded — unless that comparison holds.
 */
export function createBackup(ws: PortableWorkspace, exportedAt = new Date().toISOString()): { bytes: Uint8Array; notices: string[] } {
  const { workbook, notices } = buildBackupWorkbook(ws, exportedAt);
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
  } catch (error) {
    throw new BackupGenerationError([`The spreadsheet library could not write the file: ${error instanceof Error ? error.message : String(error)}`]);
  }
  const check = readBackupWorkbook(XLSX.read(bytes, { type: 'array' }));
  if (check.status !== 'complete') {
    throw new BackupGenerationError([`The written file did not read back as a complete backup: ${check.problems.join(' ')}`]);
  }
  const differences = describeDifferences(ws, check.workspace);
  if (differences.length > 0) {
    throw new BackupGenerationError(differences.map(d => `The written file did not read back identically at ${d}.`));
  }
  return { bytes, notices };
}

export const backupFileName = (at: Date = new Date()) => `selara-backup-${at.toISOString().slice(0, 10)}.xlsx`;

// ─── Reading ─────────────────────────────────────────────────────────────────

export type BackupReadResult =
  | { status: 'complete'; format: 'selara-1' | 'legacy'; workspace: PortableWorkspace; notices: string[]; exportedAt?: string }
  /** Recoverable through ordinary Import, which may repair; never through Restore Backup. */
  | { status: 'incomplete'; problems: string[]; notices: string[] }
  | { status: 'rejected'; problems: string[] };

const rejected = (problems: string[]): BackupReadResult => ({ status: 'rejected', problems });

const NOT_A_WORKSPACE =
  "This file isn't a Selara workspace backup. If it's a filed RPTI or LKPTI return, start a workspace from filed returns instead (Data Manager → Clear data and start again).";

/**
 * Classifies a workbook for Restore Backup (contracts/workbook.md): complete
 * format 1 or recognised legacy → restorable as-is; incomplete → ordinary Import
 * with its limitations; corrupt, inconsistent or future → rejected. Validation is
 * structural only: it never judges business data, and unresolved links survive.
 */
export function readBackupWorkbook(wb: XLSX.WorkBook): BackupReadResult {
  const present = new Set(wb.SheetNames.filter(name => wb.Sheets[name]));
  if (present.has(BACKUP_MARKER_SHEET)) return readFormat1(wb, present);
  if (!BACKUP_DATA_SHEETS.some(sheet => present.has(sheet))) return rejected([NOT_A_WORKSPACE]);
  return readLegacy(wb, present);
}

interface Marker { exportedAt?: string; currentCounts: Record<string, number> }

function readMarker(wb: XLSX.WorkBook): Marker | BackupReadResult {
  const entries = new Map<unknown, unknown>(sheetRows(wb, BACKUP_MARKER_SHEET).map(r => [r.key, r.value]));
  const formatVersion = entries.get('formatVersion');
  if (typeof formatVersion !== 'number' || !Number.isInteger(formatVersion)) {
    return rejected([`The ${BACKUP_MARKER_SHEET} sheet is damaged (its formatVersion is ${describeValue(formatVersion)}), so this file can't be trusted as a backup.`]);
  }
  if (formatVersion > BACKUP_FORMAT_VERSION) {
    return rejected([`This backup was made by a newer version of Selara (backup format ${formatVersion}). Restore it with a Selara version that supports that format.`]);
  }
  if (formatVersion !== BACKUP_FORMAT_VERSION) return rejected([`The ${BACKUP_MARKER_SHEET} sheet names backup format ${formatVersion}, which doesn't exist.`]);
  const encoding = entries.get('cellEncoding');
  if (encoding !== BACKUP_CELL_ENCODING) {
    return rejected([`This backup uses cell encoding ${describeValue(encoding)}, which this version of Selara can't read. It may have been made by a newer version.`]);
  }
  let counts: unknown;
  try {
    counts = decodeCell(entries.get('currentCounts'), `${BACKUP_MARKER_SHEET} currentCounts`);
  } catch (error) {
    return rejected([(error as Error).message]);
  }
  if (!isPlainObject(counts) || !Object.values(counts).every(n => typeof n === 'number' && Number.isInteger(n) && n >= 0)) {
    return rejected([`The ${BACKUP_MARKER_SHEET} sheet's row counts are damaged.`]);
  }
  const exportedAt = entries.get('exportedAt');
  return { exportedAt: typeof exportedAt === 'string' ? exportedAt : undefined, currentCounts: counts as Record<string, number> };
}

function missingSheetsResult(present: Set<string>, legacy: boolean): BackupReadResult | null {
  const missing = BACKUP_DATA_SHEETS.filter(sheet => !present.has(sheet));
  if (missing.length === 0) return null;
  return {
    status: 'incomplete',
    problems: [`The file has no ${missing.join(', ')} sheet${missing.length > 1 ? 's' : ''}, so it isn't a complete backup.`],
    notices: legacy ? ['This looks like an older or partial Selara export.'] : [],
  };
}

interface VersionMeta { id: string; name: string; timestamp: string; description?: string; collections: Set<string>; rowCounts: Record<string, number>; archivedDecisions?: unknown[] }

function readFormat1(wb: XLSX.WorkBook, present: Set<string>): BackupReadResult {
  const marker = readMarker(wb);
  if ('status' in marker) return marker;
  const missing = missingSheetsResult(present, false);
  if (missing) return missing;

  const problems: Problems = [];
  const incomplete: string[] = [];
  const notices = new Notices();

  let decoded: Map<string, Record<string, unknown>[]>;
  try {
    decoded = new Map(BACKUP_DATA_SHEETS.map(sheet => [sheet, sheetRows(wb, sheet).map((row, i) => {
      const out: Record<string, unknown> = {};
      for (const [field, v] of Object.entries(row)) out[field] = decodeCell(v, `${sheet} row ${i + 2}, column ${field}`);
      return out;
    })]));
  } catch (error) {
    if (error instanceof DecodeError) return rejected([error.message]);
    throw error;
  }

  // Versions metadata first: every envelope below must name one of these.
  const versions = new Map<string, VersionMeta>();
  decoded.get('Versions')!.forEach((row, i) => {
    const where = `Versions row ${i + 2}`;
    for (const column of Object.keys(row)) if (!VERSION_SHEET_COLUMNS.has(column)) problems.push(`${where}: unexpected column "${column}".`);
    const { id, name, timestamp, description, collections, rowCounts, archivedDecisions } = row;
    if (typeof id !== 'string' || id === '') { problems.push(`${where}: has no usable id.`); return; }
    if (versions.has(id)) { problems.push(`Saved version ${id} appears more than once.`); return; }
    if (typeof name !== 'string' || typeof timestamp !== 'string') problems.push(`${where}: name and timestamp must be text.`);
    if (description !== undefined && typeof description !== 'string') problems.push(`${where}: description must be text.`);
    if (!Array.isArray(collections) || !collections.every(k => typeof k === 'string' && SNAPSHOT_KEYS.includes(k)) || new Set(collections).size !== collections.length) {
      problems.push(`${where}: its list of snapshot collections is damaged.`);
      return;
    }
    if (!isPlainObject(rowCounts) || !Object.values(rowCounts).every(n => typeof n === 'number' && Number.isInteger(n) && n >= 0)) {
      problems.push(`${where}: its row counts are damaged.`);
      return;
    }
    const collectionSet = new Set(collections as string[]);
    if (collectionSet.has('decisions') !== (archivedDecisions !== undefined) || (archivedDecisions !== undefined && !Array.isArray(archivedDecisions))) {
      problems.push(`${where}: its archived decisions don't match its list of snapshot collections.`);
      return;
    }
    versions.set(id, {
      id, name: name as string, timestamp: timestamp as string, description: description as string | undefined,
      collections: collectionSet, rowCounts: rowCounts as Record<string, number>, archivedDecisions: archivedDecisions as unknown[] | undefined,
    });
  });
  if (decoded.get('Versions')!.length !== marker.currentCounts.Versions) {
    problems.push(`Versions: expected ${marker.currentCounts.Versions ?? 0} row(s), found ${decoded.get('Versions')!.length}.`);
  }
  if (problems.length > 0) return rejected(problems);

  // Split each versioned sheet by envelope, and check it against the counts.
  const split = (sheet: string) => {
    const byScope = new Map<string, Record<string, unknown>[]>([['', []], ...[...versions.keys()].map(id => [id, []] as [string, Record<string, unknown>[]])]);
    decoded.get(sheet)!.forEach((row, i) => {
      const { [ENVELOPE]: envelope, ...record } = row;
      if (typeof envelope !== 'string') { problems.push(`${sheet} row ${i + 2}: has no ${ENVELOPE} envelope.`); return; }
      const bucket = byScope.get(envelope);
      if (!bucket) { problems.push(`${sheet} row ${i + 2}: belongs to saved version "${envelope}", which isn't in the Versions sheet.`); return; }
      bucket.push(record);
    });
    const current = byScope.get('')!.length;
    const expected = marker.currentCounts[sheet] ?? 0;
    if (current !== expected) problems.push(`${sheet}: expected ${expected} current row(s), found ${current}.`);
    for (const version of versions.values()) {
      const found = byScope.get(version.id)!.length;
      const expectedRows = version.rowCounts[sheet] ?? 0;
      if (found !== expectedRows) problems.push(`${sheet}: expected ${expectedRows} row(s) for saved version ${version.id}, found ${found}.`);
    }
    return byScope;
  };

  // No early return on a count mismatch: the record checks below can name the
  // duplicate or damaged row that caused it, which a count alone can't.
  const collectionRows = new Map(COLLECTIONS.map(c => [c.key, split(c.sheet)]));
  const settingsRows = split('TimelineSettings');

  for (const version of versions.values()) {
    for (const { key, sheet } of COLLECTIONS) {
      if (!version.collections.has(key) && (version.rowCounts[sheet] ?? 0) > 0) {
        problems.push(`Saved version ${version.id} has ${sheet} rows but doesn't list that collection.`);
      }
    }
    if (!version.collections.has('timelineSettings')) incomplete.push(`Saved version "${version.name}" (${version.id}) has no timeline settings.`);
  }

  // Record-level structure. Entity problems are corruption; settings problems are repairable by Import.
  for (const { key, entity } of COLLECTIONS) {
    for (const [scopeId, records] of collectionRows.get(key)!) {
      const scope = scopeId === '' ? 'current state' : scopeLabel(versions.get(scopeId));
      records.forEach(r => checkRecord(entity, r, scope, problems, notices));
      checkUniqueIds(entity, records, scope, problems);
    }
  }
  const decisions = decoded.get('Decisions')!;
  decisions.forEach(d => checkRecord('Decision', d, 'the decision log', problems, notices));
  checkUniqueIds('Decision', decisions, 'the decision log', problems);
  if (decisions.length !== (marker.currentCounts.Decisions ?? 0)) problems.push(`Decisions: expected ${marker.currentCounts.Decisions ?? 0} row(s), found ${decisions.length}.`);
  for (const version of versions.values()) {
    if (!version.archivedDecisions) continue;
    const scope = `the archived decisions of ${scopeLabel(version)}`;
    version.archivedDecisions.forEach(d => checkRecord('Decision', d, scope, problems, notices));
    checkUniqueIds('Decision', version.archivedDecisions, scope, problems);
  }

  const settingsFor = (scopeId: string, label: string) => {
    const rows = settingsRows.get(scopeId)!;
    if (rows.length === 0) return undefined;
    const settingsProblems: Problems = [];
    checkRecord('TimelineSettings', rows[0], label, settingsProblems, notices);
    if (settingsProblems.length > 0) incomplete.push(...settingsProblems);
    return rows[0] as unknown as TimelineSettings;
  };
  const currentSettings = settingsFor('', 'current state');
  if (!currentSettings) incomplete.push('The file has no current timeline settings.');

  if (problems.length > 0) return rejected(problems);

  const restoredVersions: Version[] = [...versions.values()].map(meta => {
    const data: Record<string, unknown> = {};
    for (const { key } of COLLECTIONS) if (meta.collections.has(key)) data[key] = collectionRows.get(key)!.get(meta.id);
    if (meta.collections.has('timelineSettings')) data.timelineSettings = settingsFor(meta.id, scopeLabel(meta));
    if (meta.archivedDecisions) data.decisions = meta.archivedDecisions;
    const version: Version = { id: meta.id, name: meta.name, timestamp: meta.timestamp, data: data as unknown as Version['data'] };
    if (meta.description !== undefined) version.description = meta.description;
    return version;
  });

  if (incomplete.length > 0) return { status: 'incomplete', problems: incomplete, notices: notices.lines() };

  const workspace = {
    ...Object.fromEntries(COLLECTIONS.map(({ key }) => [key, collectionRows.get(key)!.get('')])),
    decisions,
    timelineSettings: currentSettings,
    versions: restoredVersions,
  } as unknown as PortableWorkspace;
  return { status: 'complete', format: 'selara-1', workspace, notices: notices.lines(), exportedAt: marker.exportedAt };
}

const LEGACY_NOTICE =
  'This is an older Selara export, not a backup made with Backup. It restores what the file carries, but older exports could not keep nested settings (column widths, collapsed groups), the archived decision copies inside saved versions, or the difference between a missing and an empty snapshot collection.';

/** Legacy nested settings count only in a recognisable JSON form; anything else needs Import's diagnostics. */
function readLegacyNested(settings: Record<string, unknown>, label: string, incomplete: string[]) {
  for (const field of ['columnWidths', 'collapsedGroups'] as const) {
    const v = settings[field];
    if (typeof v !== 'string') continue;
    try {
      const parsed = JSON.parse(v);
      if (kindMatches(FIELD_INVENTORY.TimelineSettings[field].kind, parsed)) { settings[field] = parsed; continue; }
    } catch { /* fall through */ }
    incomplete.push(`${label}: ${field} is in a form this version can't read.`);
  }
}

function readLegacy(wb: XLSX.WorkBook, present: Set<string>): BackupReadResult {
  const missing = missingSheetsResult(present, true);
  if (missing) return missing;

  const problems: Problems = [];
  const incomplete: string[] = [];
  const notices = new Notices();
  const raw = new Map(BACKUP_DATA_SHEETS.map(sheet => [sheet, sheetRows(wb, sheet)]));

  const versions = new Map<string, { id: string; name: unknown; timestamp: unknown; description: unknown }>();
  raw.get('Versions')!.forEach((row, i) => {
    const id = typeof row.id === 'number' ? String(row.id) : row.id;
    if (typeof id !== 'string' || id === '') { problems.push(`Versions row ${i + 2}: has no usable id.`); return; }
    if (versions.has(id)) { problems.push(`Saved version ${id} appears more than once.`); return; }
    versions.set(id, { id, name: row.name, timestamp: row.timestamp, description: row.description });
    if (typeof row.name !== 'string' || typeof row.timestamp !== 'string') incomplete.push(`Versions row ${i + 2}: name and timestamp must be text.`);
  });
  if (problems.length > 0) return rejected(problems);

  const split = (sheet: string) => {
    const byScope = new Map<string, Record<string, unknown>[]>([['', []], ...[...versions.keys()].map(id => [id, []] as [string, Record<string, unknown>[]])]);
    raw.get(sheet)!.forEach((row, i) => {
      const { [ENVELOPE]: envelope, ...record } = row;
      const scopeId = envelope === undefined || envelope === '' ? '' : String(envelope);
      const bucket = byScope.get(scopeId);
      if (!bucket) { problems.push(`${sheet} row ${i + 2}: belongs to saved version "${scopeId}", which isn't in the Versions sheet.`); return; }
      bucket.push(record);
    });
    return byScope;
  };
  const collectionRows = new Map(COLLECTIONS.map(c => [c.key, split(c.sheet)]));
  const settingsRows = split('TimelineSettings');
  if (problems.length > 0) return rejected(problems);

  let sawResourceIds = false;
  for (const records of collectionRows.get('initiatives')!.values()) {
    for (const record of records) {
      if (typeof record.resourceIds !== 'string') continue;
      sawResourceIds = true;
      record.resourceIds = record.resourceIds.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  if (sawResourceIds) {
    notices.add('legacy:resourceIds', '', () => 'Initiative.resourceIds: older exports list resource assignments separated by commas, so a resource ID that itself contains a comma can’t be told apart.');
  }

  // Older shapes are not corruption: they go to Import, which knows how to normalise them.
  const scopeName = (scopeId: string) => (scopeId === '' ? 'current state' : scopeLabel(versions.get(scopeId) as { id: string; name?: unknown }));
  for (const { key, entity } of COLLECTIONS) {
    for (const [scopeId, records] of collectionRows.get(key)!) {
      records.forEach(r => checkRecord(entity, r, scopeName(scopeId), incomplete, notices));
      checkUniqueIds(entity, records, scopeName(scopeId), problems);
    }
  }
  const decisions = raw.get('Decisions')!;
  decisions.forEach(d => checkRecord('Decision', d, 'the decision log', incomplete, notices));
  checkUniqueIds('Decision', decisions, 'the decision log', problems);

  const settingsFor = (scopeId: string) => {
    const rows = settingsRows.get(scopeId)!;
    const label = `Timeline settings of ${scopeName(scopeId)}`;
    if (rows.length > 1) { problems.push(`${label}: appear more than once.`); return undefined; }
    if (rows.length === 0) { incomplete.push(`${label}: missing.`); return undefined; }
    readLegacyNested(rows[0], label, incomplete);
    checkRecord('TimelineSettings', rows[0], scopeName(scopeId), incomplete, notices);
    return rows[0] as unknown as TimelineSettings;
  };
  const currentSettings = settingsFor('');
  const restoredVersions: Version[] = [...versions.values()].map(meta => {
    const data: Record<string, unknown> = { timelineSettings: settingsFor(meta.id) };
    for (const { key } of COLLECTIONS) data[key] = collectionRows.get(key)!.get(meta.id);
    const version = { id: meta.id, name: meta.name, timestamp: meta.timestamp, data } as unknown as Version;
    if (meta.description !== undefined) version.description = meta.description as string;
    return version;
  });

  if (problems.length > 0) return rejected(problems);
  if (incomplete.length > 0) return { status: 'incomplete', problems: incomplete, notices: [LEGACY_NOTICE, ...notices.lines()] };

  const workspace = {
    ...Object.fromEntries(COLLECTIONS.map(({ key }) => [key, collectionRows.get(key)!.get('')])),
    decisions,
    timelineSettings: currentSettings,
    versions: restoredVersions,
  } as unknown as PortableWorkspace;
  return { status: 'complete', format: 'legacy', workspace, notices: [LEGACY_NOTICE, ...notices.lines()] };
}

/**
 * Decodes a format 1 workbook's cells in place so ordinary Import — which keeps
 * its tolerant, repairing parser — can read a backup like any other export.
 * Returns false for workbooks without a valid format 1 marker.
 */
export function decodeFormat1ForImport(wb: XLSX.WorkBook): { sheets: Map<string, Record<string, unknown>[]> } | null {
  if (!wb.Sheets[BACKUP_MARKER_SHEET]) return null;
  const marker = readMarker(wb);
  if ('status' in marker) throw new Error(marker.status === 'rejected' ? marker.problems.join(' ') : 'Unreadable backup marker.');
  const sheets = new Map<string, Record<string, unknown>[]>();
  for (const sheet of BACKUP_DATA_SHEETS) {
    if (!wb.Sheets[sheet]) continue;
    sheets.set(sheet, sheetRows(wb, sheet).map((row, i) => {
      const out: Record<string, unknown> = {};
      for (const [field, v] of Object.entries(row)) out[field] = decodeCell(v, `${sheet} row ${i + 2}, column ${field}`);
      return out;
    }));
  }
  return { sheets };
}

// ─── Equality (contracts/field-inventory.md, "Equality rules") ───────────────

/** Unset (undefined) keys drop out; object keys sort; array order is kept. */
const canonicalValue = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(canonicalValue);
  if (v !== null && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(v).sort()) {
      const inner = (v as Record<string, unknown>)[key];
      if (inner !== undefined) out[key] = canonicalValue(inner);
    }
    return out;
  }
  return v;
};

/** Top-level collections compare by id, not by storage order; nested arrays keep their order. */
const byId = (list: unknown): unknown => {
  if (!Array.isArray(list)) return canonicalValue(list);
  return list.map(canonicalValue).sort((a, b) => {
    const ia = isPlainObject(a) ? String(a.id) : '';
    const ib = isPlainObject(b) ? String(b.id) : '';
    return ia < ib ? -1 : ia > ib ? 1 : JSON.stringify(a) < JSON.stringify(b) ? -1 : 1;
  });
};

const ID_COLLECTIONS = new Set<string>([...COLLECTIONS.map(c => c.key), 'decisions']);

/**
 * Canonical form of a whole workspace, History included. Two workspaces with the
 * same canonical form hold the same data; used both to verify a backup file and
 * to detect that the persisted workspace changed under an open replacement.
 */
export function canonicalWorkspace(ws: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(ws).sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (value === undefined) continue;
    if (key === 'versions' && Array.isArray(value)) {
      out.versions = (byId(value) as Record<string, unknown>[]).map(v => (isPlainObject(v) && isPlainObject(v.data)
        ? { ...v, data: Object.fromEntries(Object.entries(v.data).map(([k, d]) => [k, ID_COLLECTIONS.has(k) ? byId(d) : d])) }
        : v));
    } else {
      out[key] = ID_COLLECTIONS.has(key) ? byId(value) : canonicalValue(value);
    }
  }
  return out;
}

export const workspaceFingerprint = (ws: object) => JSON.stringify(canonicalWorkspace(ws));

export const workspacesEqual = (a: object, b: object) => workspaceFingerprint(a) === workspaceFingerprint(b);

/** Where two workspaces differ, as readable paths (first `limit` only). */
export function describeDifferences(a: object, b: object, limit = 5): string[] {
  const out: string[] = [];
  const walk = (x: unknown, y: unknown, path: string) => {
    if (out.length >= limit) return;
    if (Array.isArray(x) && Array.isArray(y)) {
      if (x.length !== y.length) { out.push(`${path} (${x.length} vs ${y.length} items)`); return; }
      x.forEach((item, i) => walk(item, y[i], `${path}[${isPlainObject(item) && typeof item.id === 'string' ? item.id : i}]`));
      return;
    }
    if (isPlainObject(x) && isPlainObject(y)) {
      for (const key of new Set([...Object.keys(x), ...Object.keys(y)])) walk(x[key], y[key], path ? `${path}.${key}` : key);
      return;
    }
    if (JSON.stringify(x) !== JSON.stringify(y)) out.push(path || '(root)');
  };
  walk(canonicalWorkspace(a), canonicalWorkspace(b), '');
  return out;
}
