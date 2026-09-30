import { openDB, DBSchema, IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';
import { createSerialAsyncRunner } from './serialAsync';
import { Asset, Deliverable, DeliverableSegment, DeliverableStatus, Decision, RptiDetail, LkptiDetail, Initiative, Milestone, Programme, Strategy, Dependency, AssetCategory, TimelineSettings, Version, Resource } from '../types';

interface ITMapDB extends DBSchema {
  assets: {
    key: string;
    value: Asset;
  };
  deliverables: {
    key: string;
    value: Deliverable;
  };
  deliverableSegments: {
    key: string;
    value: DeliverableSegment;
  };
  initiatives: {
    key: string;
    value: Initiative;
  };
  milestones: {
    key: string;
    value: Milestone;
  };
  programmes: {
    key: string;
    value: Programme;
  };
  strategies: {
    key: string;
    value: Strategy;
  };
  dependencies: {
    key: string;
    value: Dependency;
  };
  assetCategories: {
    key: string;
    value: AssetCategory;
  };
  settings: {
    key: string;
    value: TimelineSettings;
  };
  versions: {
    key: string;
    value: Version;
  };
  resources: {
    key: string;
    value: Resource;
  };
  deliverableStatuses: {
    key: string;
    value: DeliverableStatus;
  };
  decisions: {
    key: string;
    value: Decision;
  };
  rptiDetails: {
    key: string;
    value: RptiDetail;
  };
  lkptiDetails: {
    key: string;
    value: LkptiDetail;
  };
}

const DB_NAME = 'it-initiative-visualiser';
const DB_VERSION = 20;

let dbPromise: Promise<IDBPDatabase<ITMapDB>> | undefined;

// ─── Upgrades across tabs (ADR-0016) ─────────────────────────────────────────
//
// 'blocked': another tab holds an older version open, so this tab's upgrade waits.
// 'superseded': another tab opened a newer version, so this tab let go of the
// database and can no longer read or write it until it is reloaded.

export type StorageState = 'ready' | 'blocked' | 'superseded';
let storageState: StorageState = 'ready';
const storageListeners = new Set<() => void>();
const setStorageState = (next: StorageState) => {
  storageState = next;
  storageListeners.forEach(listener => listener());
};
export const getStorageState = () => storageState;
export const subscribeStorageState = (listener: () => void) => {
  storageListeners.add(listener);
  return () => { storageListeners.delete(listener); };
};

export class DatabaseSupersededError extends Error {
  constructor() {
    super('Selara was updated in another tab, so this tab can no longer save. Reload it to continue; changes made here since then were not saved.');
    this.name = 'DatabaseSupersededError';
  }
}

/**
 * Lets a newer version upgrade. Transactions already running finish (close waits
 * for them); anything after rejects with DatabaseSupersededError, so a queued or
 * later save fails where the planner can see it instead of hanging or reopening
 * a connection at a version the database has left behind.
 */
function supersede(connection: IDBDatabase) {
  connection.close();
  const error = new DatabaseSupersededError();
  dbPromise = Promise.reject(error);
  dbPromise.catch(() => undefined);
  setStorageState('superseded');
}

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<ITMapDB>(DB_NAME, DB_VERSION, {
      blocked() {
        setStorageState('blocked');
      },
      blocking(_currentVersion, _blockedVersion, event) {
        supersede(event.target as IDBDatabase);
      },
      async upgrade(db, oldVersion, _newVersion, tx) {
        // v20 (ADR-0016): a database can reach a version without every store its
        // version implies — the steps below only run for versions it had not passed.
        // The atomic workspace read/write needs them all, so on every upgrade create
        // whichever are missing. Existing stores and records are left as they are.
        for (const name of [...ENTITY_STORES, 'versions'] as const) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');

        if (!db.objectStoreNames.contains('assets')) {
          db.createObjectStore('assets', { keyPath: 'id' });
        }
        if (oldVersion < 2 && !db.objectStoreNames.contains('initiatives')) {
          db.createObjectStore('initiatives', { keyPath: 'id' });
        }
        if (oldVersion < 3 && !db.objectStoreNames.contains('milestones')) {
          db.createObjectStore('milestones', { keyPath: 'id' });
        }
        if (oldVersion < 4 && !db.objectStoreNames.contains('programmes')) {
          db.createObjectStore('programmes', { keyPath: 'id' });
          db.createObjectStore('strategies', { keyPath: 'id' });
          db.createObjectStore('dependencies', { keyPath: 'id' });
          db.createObjectStore('assetCategories', { keyPath: 'id' });
        }
        if (oldVersion < 5 && !db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
        if (oldVersion < 6 && !db.objectStoreNames.contains('versions')) {
          db.createObjectStore('versions', { keyPath: 'id' });
        }
        if (oldVersion < 7 && !db.objectStoreNames.contains('resources')) {
          db.createObjectStore('resources', { keyPath: 'id' });
        }
        if (oldVersion < 8 && !db.objectStoreNames.contains('deliverables')) {
          db.createObjectStore('deliverables', { keyPath: 'id' });
        }
        if (oldVersion < 9 && !db.objectStoreNames.contains('deliverableSegments')) {
          db.createObjectStore('deliverableSegments', { keyPath: 'id' });
        }
        if (oldVersion < 10 && !db.objectStoreNames.contains('deliverableStatuses')) {
          db.createObjectStore('deliverableStatuses', { keyPath: 'id' });
        }
        if (oldVersion < 11) {
          // Migrate assetId-based segments to Deliverable records + deliverableId.
          // Segments that already have deliverableId are left untouched.
          const allSegments = await tx.objectStore('deliverableSegments').getAll();
          const allAssets = await tx.objectStore('assets').getAll();
          const assetMap = new Map(allAssets.map((a: any) => [a.id, a]));

          // Build a map from "assetId|label" → generated deliverableId so that
          // segments sharing the same asset+label resolve to the same Deliverable.
          const appKeyToId = new Map<string, string>();
          let counter = 0;

          for (const seg of allSegments) {
            if ((seg as any).assetId && !(seg as any).deliverableId) {
              const assetId: string = (seg as any).assetId;
              const label: string = (seg as any).label ?? '';
              const key = `${assetId}|${label}`;
              if (!appKeyToId.has(key)) {
                const asset = assetMap.get(assetId) as any;
                const appName = label || asset?.name || assetId;
                const appId = `app-migrated-${assetId}-${counter++}`;
                appKeyToId.set(key, appId);
                await tx.objectStore('deliverables').add({ id: appId, assetId, name: appName });
              }
            }
          }

          // Rewrite each assetId-based segment to use deliverableId.
          for (const seg of allSegments) {
            if ((seg as any).assetId && !(seg as any).deliverableId) {
              const key = `${(seg as any).assetId}|${(seg as any).label ?? ''}`;
              const deliverableId = appKeyToId.get(key);
              if (deliverableId) {
                const { assetId: _a, label: _l, ...rest } = seg as any;
                await tx.objectStore('deliverableSegments').put({ ...rest, deliverableId });
              }
            }
          }
        }
        if (oldVersion < 12) {
          // Migrate single budget field to capex/opex split.
          // Existing budget value moves to capex; opex defaults to 0.
          const allInitiatives = await tx.objectStore('initiatives').getAll();
          for (const init of allInitiatives) {
            if ((init as any).budget !== undefined && (init as any).capex === undefined) {
              const { budget, ...rest } = init as any;
              await tx.objectStore('initiatives').put({ ...rest, capex: Number(budget) || 0, opex: 0 });
            }
          }
        }
        if (oldVersion < 14) {
          if (!db.objectStoreNames.contains('decisions')) {
            db.createObjectStore('decisions', { keyPath: 'id' });
          }
        }
        if (oldVersion < 15) {
          if (!db.objectStoreNames.contains('rptiDetails')) {
            db.createObjectStore('rptiDetails', { keyPath: 'id' });
          }
        }
        if (oldVersion < 16) {
          // Flatten RptiDetail.location into top-level dcCity/dcCountry/drCity/drCountry.
          const allRptiDetails = await tx.objectStore('rptiDetails').getAll();
          for (const detail of allRptiDetails) {
            const loc = (detail as any).location;
            if (loc) {
              const { location: _location, ...rest } = detail as any;
              await tx.objectStore('rptiDetails').put({
                ...rest,
                dcCity: loc.dataCenter?.city,
                dcCountry: loc.dataCenter?.country,
                drCity: loc.disasterRecoveryCenter?.city,
                drCountry: loc.disasterRecoveryCenter?.country,
              });
            }
          }
        }
        if (oldVersion < 17) {
          // The Application/ApplicationSegment/ApplicationStatus entities were renamed to
          // Deliverable/DeliverableSegment/DeliverableStatus. Databases that already passed
          // v8-v10 under the old names won't hit those blocks again (oldVersion isn't < 8-10
          // here), so create the new-named stores directly. Old 'applications' /
          // 'applicationSegments' / 'applicationStatuses' stores (if present) are left in
          // place, orphaned and unmigrated — same treatment as 'dtsPhases' in v13.
          if (!db.objectStoreNames.contains('deliverables')) {
            db.createObjectStore('deliverables', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('deliverableSegments')) {
            db.createObjectStore('deliverableSegments', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('deliverableStatuses')) {
            db.createObjectStore('deliverableStatuses', { keyPath: 'id' });
          }
        }
        if (oldVersion < 18) {
          // Currency is now a single workspace-wide fact (TimelineSettings.defaultCurrency),
          // not tracked per row — drop the now-redundant per-row currency/IDR-equivalent
          // fields from RptiDetail. See requirement-specs/rpti-auto-fill-improvements.md.
          const allRptiDetails = await tx.objectStore('rptiDetails').getAll();
          for (const detail of allRptiDetails) {
            const d = detail as any;
            if (d.capexCurrency !== undefined || d.opexCurrency !== undefined || d.capexIdrEquivalent !== undefined || d.opexIdrEquivalent !== undefined) {
              const { capexCurrency: _cc, opexCurrency: _oc, capexIdrEquivalent: _cie, opexIdrEquivalent: _oie, ...rest } = d;
              await tx.objectStore('rptiDetails').put(rest);
            }
          }
        }
        if (oldVersion < 19) {
          if (!db.objectStoreNames.contains('lkptiDetails')) {
            db.createObjectStore('lkptiDetails', { keyPath: 'id' });
          }
        }
      },
    }).then(db => {
      if (storageState === 'blocked') setStorageState('ready');
      return db;
    });
  }
  return dbPromise;
};

export const getAppData = async () => {
  const db = await initDB();
  const assets = await db.getAll('assets');
  const deliverables = db.objectStoreNames.contains('deliverables') ? await db.getAll('deliverables') : [];
  const deliverableSegments = db.objectStoreNames.contains('deliverableSegments') ? await db.getAll('deliverableSegments') : [];
  const initiatives = await db.getAll('initiatives');
  const milestones = await db.getAll('milestones');
  const programmes = await db.getAll('programmes');
  const strategies = await db.getAll('strategies');
  const dependencies = await db.getAll('dependencies');
  const assetCategories = await db.getAll('assetCategories');
  const resources = db.objectStoreNames.contains('resources') ? await db.getAll('resources') : [];
  const deliverableStatuses = db.objectStoreNames.contains('deliverableStatuses') ? await db.getAll('deliverableStatuses') : [];
  const decisions = db.objectStoreNames.contains('decisions') ? await db.getAll('decisions') : [];
  const rptiDetails = db.objectStoreNames.contains('rptiDetails') ? await db.getAll('rptiDetails') : [];
  const lkptiDetails = db.objectStoreNames.contains('lkptiDetails') ? await db.getAll('lkptiDetails') : [];

  // Settings is not a standard list of entities, it's just one config object
  let settingsFromDb = null;
  if (db.objectStoreNames.contains('settings')) {
    settingsFromDb = await db.get('settings', 'timelineSettings');
  }
  const timelineSettings = settingsFromDb || { startYear: 2026, monthsToShow: 36, sidebarWidth: 256 };

  return {
    assets,
    deliverables,
    deliverableSegments,
    initiatives,
    milestones,
    programmes,
    strategies,
    dependencies,
    assetCategories,
    timelineSettings,
    resources,
    deliverableStatuses,
    decisions,
    rptiDetails,
    lkptiDetails,
  };
};

type WorkspaceStore =
  | 'assets' | 'deliverables' | 'deliverableSegments' | 'deliverableStatuses' | 'decisions' | 'rptiDetails' | 'lkptiDetails'
  | 'initiatives' | 'milestones' | 'programmes' | 'strategies' | 'dependencies' | 'assetCategories' | 'resources';

/** Every entity store a workspace occupies (settings and versions are handled beside them). */
const ENTITY_STORES: readonly WorkspaceStore[] = [
  'assets', 'deliverables', 'deliverableSegments', 'deliverableStatuses', 'decisions', 'rptiDetails', 'lkptiDetails',
  'initiatives', 'milestones', 'programmes', 'strategies', 'dependencies', 'assetCategories', 'resources',
];

export interface WorkspaceData {
  assets: Asset[];
  deliverables: Deliverable[];
  deliverableSegments: DeliverableSegment[];
  initiatives: Initiative[];
  milestones: Milestone[];
  programmes: Programme[];
  strategies: Strategy[];
  dependencies: Dependency[];
  assetCategories: AssetCategory[];
  timelineSettings: TimelineSettings;
  resources: Resource[];
  deliverableStatuses: DeliverableStatus[];
  versions?: Version[];
  decisions?: Decision[];
  rptiDetails?: RptiDetail[];
  lkptiDetails?: LkptiDetail[];
}

/**
 * The workspace exactly as stored, History included, read in one transaction.
 * `timelineSettings` is whatever the store holds — possibly nothing, or an older
 * shape — because this is the base a replacement is compared against, not what
 * the screen shows.
 */
export interface PersistedWorkspace extends Omit<WorkspaceData, 'timelineSettings' | 'versions' | 'decisions' | 'rptiDetails' | 'lkptiDetails'> {
  decisions: Decision[];
  rptiDetails: RptiDetail[];
  lkptiDetails: LkptiDetail[];
  timelineSettings: TimelineSettings | undefined;
  versions: Version[];
}

type ReadTx = IDBPTransaction<ITMapDB, StoreNames<ITMapDB>[], 'readonly' | 'readwrite'>;
type WriteTx = IDBPTransaction<ITMapDB, StoreNames<ITMapDB>[], 'readwrite'>;

async function readInTransaction(tx: ReadTx): Promise<PersistedWorkspace> {
  const [lists, timelineSettings, versions] = await Promise.all([
    Promise.all(ENTITY_STORES.map(name => tx.objectStore(name).getAll())),
    tx.objectStore('settings').get('timelineSettings'),
    tx.objectStore('versions').getAll(),
  ]);
  const entities = Object.fromEntries(ENTITY_STORES.map((name, i) => [name, lists[i]]));
  return { ...entities, timelineSettings, versions } as PersistedWorkspace;
}

/** A coherent read of every workspace store, settings and History (FR-015/016). */
export const readPersistedWorkspace = async (): Promise<PersistedWorkspace> => {
  const db = await initDB();
  const tx = db.transaction([...ENTITY_STORES, 'settings', 'versions'], 'readonly');
  const [data] = await Promise.all([readInTransaction(tx as unknown as ReadTx), tx.done]);
  return data;
};

/** The persisted base a replacement was reviewed against no longer matches the database. */
export class StaleWorkspaceError extends Error {
  constructor() {
    super('The workspace changed after this was reviewed — possibly in another tab — so nothing was replaced.');
    this.name = 'StaleWorkspaceError';
  }
}

/** An earlier save of on-screen changes failed; nothing may build on the stale stored copy. */
export class PendingSaveError extends Error {
  constructor(cause: string) {
    super(`Your latest changes haven't been saved (${cause}). Nothing was changed; your unsaved work is still on screen.`);
    this.name = 'PendingSaveError';
  }
}

/**
 * Queues the clears and puts for a whole workspace in one transaction, with no
 * intermediate await: awaiting between them risks the transaction auto-committing
 * before everything is queued, which would leave stores half-written.
 */
function queueWorkspaceWrites(tx: WriteTx, data: WorkspaceData): Promise<unknown>[] {
  const writes: Promise<unknown>[] = [];
  for (const name of ENTITY_STORES) {
    const store = tx.objectStore(name);
    writes.push(store.clear());
    for (const item of (data[name] as unknown[] | undefined) ?? []) writes.push(store.put(item as never));
  }
  writes.push(tx.objectStore('settings').clear());
  writes.push(tx.objectStore('settings').put(data.timelineSettings, 'timelineSettings'));
  if (data.versions) {
    writes.push(tx.objectStore('versions').clear());
    for (const version of data.versions) writes.push(tx.objectStore('versions').put(version));
  }
  return writes;
}

/**
 * Runs one readwrite transaction, turning every way it can fail — a request
 * error, a quota abort, an explicit abort — into a single rejection, and never
 * leaving an unobserved `tx.done` rejection behind. IndexedDB rolls back an
 * aborted transaction as a whole, so failure means no store changed.
 */
async function runWorkspaceTransaction(withVersions: boolean, body: (tx: WriteTx) => Promise<void>) {
  const db = await initDB();
  const stores: StoreNames<ITMapDB>[] = withVersions ? [...ENTITY_STORES, 'settings', 'versions'] : [...ENTITY_STORES, 'settings'];
  const tx = db.transaction(stores, 'readwrite') as unknown as WriteTx;
  const done = tx.done;
  done.catch(() => undefined);
  try {
    await body(tx);
    await done;
  } catch (error) {
    try { tx.abort(); } catch { /* already finished or aborted */ }
    await done.catch(() => undefined);
    if (error instanceof StaleWorkspaceError) throw error;
    const reason = tx.error ?? error;
    throw reason instanceof Error ? reason : new Error(String(reason));
  }
}

// ─── Write coordination ─────────────────────────────────────────────────────
//
// Every workspace and History write goes through one queue, so an older queued
// save can never land after — and quietly undo — a replacement or a History
// change, and a replacement can wait for everything already on screen to be
// stored before it reads its base (FR-015/016).

let lastWorkspaceSaveError: Error | null = null;

const runSerially = createSerialAsyncRunner((task: () => Promise<unknown>) => task());
const enqueueWrite = <T>(task: () => Promise<T>) => runSerially(task) as Promise<T>;

/** Resolves once every write queued so far has finished, whether it succeeded or not. */
export const settleWrites = (): Promise<void> => enqueueWrite(async () => undefined);

/**
 * Waits for every queued write. Rejects with PendingSaveError when the most
 * recent save of on-screen changes failed and nothing has saved since: the
 * stored workspace is then older than the screen, and a backup or replacement
 * preview built on it would misrepresent what the planner has.
 */
export const drainWrites = async (): Promise<void> => {
  await settleWrites();
  if (lastWorkspaceSaveError) throw new PendingSaveError(lastWorkspaceSaveError.message);
};

export const hasFailedSave = () => lastWorkspaceSaveError !== null;

/** An ordinary, unconditional full-workspace save (optimistic edits). */
export const saveAppData = (data: WorkspaceData) => enqueueWrite(async () => {
  try {
    await runWorkspaceTransaction(!!data.versions, async tx => { await Promise.all(queueWorkspaceWrites(tx, data)); });
    lastWorkspaceSaveError = null;
  } catch (error) {
    lastWorkspaceSaveError = error instanceof Error ? error : new Error(String(error));
    throw error;
  }
});

/**
 * Replaces the whole workspace, but only if the stored workspace still matches
 * the fingerprint the planner reviewed. The comparison happens inside the same
 * transaction as the writes, so a change committed by another tab between the
 * preview and the confirmation is detected even if its broadcast arrives late:
 * the transaction aborts with StaleWorkspaceError and the other tab's work survives.
 */
export const replaceWorkspace = (
  data: WorkspaceData,
  expectedFingerprint: string,
  fingerprint: (stored: PersistedWorkspace) => string,
) => enqueueWrite(async () => {
  // Versions are always in scope: a History change in another tab also makes the preview stale.
  await runWorkspaceTransaction(true, async tx => {
    const stored = await readInTransaction(tx as unknown as ReadTx);
    if (fingerprint(stored) !== expectedFingerprint) throw new StaleWorkspaceError();
    await Promise.all(queueWorkspaceWrites(tx, data));
  });
  lastWorkspaceSaveError = null;
});

// Versions helper functions — queued with workspace writes (see above).
export const saveVersion = (version: Version) => enqueueWrite(async () => {
  const db = await initDB();
  await db.put('versions', version);
});

export const getAllVersions = async () => {
  const db = await initDB();
  return db.getAll('versions');
};

export const deleteVersion = (id: string) => enqueueWrite(async () => {
  const db = await initDB();
  await db.delete('versions', id);
});
