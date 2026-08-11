import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Asset, Deliverable, DeliverableSegment, DeliverableStatus, Decision, RptiDetail, Initiative, Milestone, Programme, Strategy, Dependency, AssetCategory, TimelineSettings, Version, Resource } from '../types';
import { createSerialAsyncRunner } from './serialAsync';

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
}

const DB_NAME = 'it-initiative-visualiser';
const DB_VERSION = 18;

let dbPromise: Promise<IDBPDatabase<ITMapDB>>;

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<ITMapDB>(DB_NAME, DB_VERSION, {
      async upgrade(db, oldVersion, _newVersion, tx) {
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
      },
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
  };
};

const saveAppDataImpl = async (data: {
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
}) => {
  const db = await initDB();
  const stores: ("assets" | "deliverables" | "deliverableSegments" | "deliverableStatuses" | "decisions" | "rptiDetails" | "initiatives" | "milestones" | "programmes" | "strategies" | "dependencies" | "assetCategories" | "settings" | "resources" | "versions")[] = [
    'assets', 'initiatives', 'milestones', 'programmes', 'strategies', 'dependencies', 'assetCategories'
  ];
  if (db.objectStoreNames.contains('settings')) {
    stores.push('settings');
  }
  if (db.objectStoreNames.contains('resources')) {
    stores.push('resources');
  }
  if (db.objectStoreNames.contains('deliverables')) {
    stores.push('deliverables');
  }
  if (db.objectStoreNames.contains('deliverableSegments')) {
    stores.push('deliverableSegments');
  }
  if (db.objectStoreNames.contains('deliverableStatuses')) {
    stores.push('deliverableStatuses');
  }
  if (db.objectStoreNames.contains('decisions')) {
    stores.push('decisions');
  }
  if (db.objectStoreNames.contains('rptiDetails')) {
    stores.push('rptiDetails');
  }
  if (data.versions && db.objectStoreNames.contains('versions')) {
    stores.push('versions');
  }
  const tx = db.transaction(stores, 'readwrite');

  let transactionError: Error | null = null;
  tx.onerror = () => {
    transactionError = new Error(tx.error?.message || 'Transaction failed');
  };

  try {
    // Queue all clears and adds in a single batch without intermediate awaits.
    // Awaiting between operations risks the transaction auto-committing before
    // all adds are queued, which would leave the stores empty.
    const allPromises: Promise<unknown>[] = [
      tx.objectStore('assets').clear(),
      tx.objectStore('initiatives').clear(),
      tx.objectStore('milestones').clear(),
      tx.objectStore('programmes').clear(),
      tx.objectStore('strategies').clear(),
      tx.objectStore('dependencies').clear(),
      tx.objectStore('assetCategories').clear(),
      ...data.assets.map(item => tx.objectStore('assets').put(item)),
      ...data.initiatives.map(item => tx.objectStore('initiatives').put(item)),
      ...data.milestones.map(item => tx.objectStore('milestones').put(item)),
      ...data.programmes.map(item => tx.objectStore('programmes').put(item)),
      ...data.strategies.map(item => tx.objectStore('strategies').put(item)),
      ...data.dependencies.map(item => tx.objectStore('dependencies').put(item)),
      ...data.assetCategories.map(item => tx.objectStore('assetCategories').put(item)),
    ];
    if (db.objectStoreNames.contains('settings')) {
      allPromises.push(tx.objectStore('settings').clear());
      allPromises.push(tx.objectStore('settings').put(data.timelineSettings, 'timelineSettings'));
    }
    if (db.objectStoreNames.contains('resources')) {
      allPromises.push(tx.objectStore('resources').clear());
      (data.resources || []).forEach(item => allPromises.push(tx.objectStore('resources').put(item)));
    }
    if (db.objectStoreNames.contains('deliverables')) {
      allPromises.push(tx.objectStore('deliverables').clear());
      (data.deliverables || []).forEach(item => allPromises.push(tx.objectStore('deliverables').put(item)));
    }
    if (db.objectStoreNames.contains('deliverableSegments')) {
      allPromises.push(tx.objectStore('deliverableSegments').clear());
      (data.deliverableSegments || []).forEach(item => allPromises.push(tx.objectStore('deliverableSegments').put(item)));
    }
    if (db.objectStoreNames.contains('deliverableStatuses')) {
      allPromises.push(tx.objectStore('deliverableStatuses').clear());
      (data.deliverableStatuses || []).forEach(item => allPromises.push(tx.objectStore('deliverableStatuses').put(item)));
    }
    if (db.objectStoreNames.contains('decisions')) {
      allPromises.push(tx.objectStore('decisions').clear());
      (data.decisions || []).forEach(item => allPromises.push(tx.objectStore('decisions').put(item)));
    }
    if (db.objectStoreNames.contains('rptiDetails')) {
      allPromises.push(tx.objectStore('rptiDetails').clear());
      (data.rptiDetails || []).forEach(item => allPromises.push(tx.objectStore('rptiDetails').put(item)));
    }
    if (data.versions && db.objectStoreNames.contains('versions')) {
      allPromises.push(tx.objectStore('versions').clear());
      data.versions.forEach(v => allPromises.push(tx.objectStore('versions').put(v)));
    }

    await Promise.all(allPromises);

    await tx.done;

    // Check for transaction errors that may not have thrown
    if (transactionError) {
      throw transactionError;
    }
  } catch (error) {
    // Abort the transaction on any error to prevent partial writes
    tx.abort();
    throw error;
  }
};

export const saveAppData = createSerialAsyncRunner(saveAppDataImpl);

// Versions helper functions
export const saveVersion = async (version: Version) => {
  const db = await initDB();
  await db.put('versions', version);
};

export const getAllVersions = async () => {
  const db = await initDB();
  return db.getAll('versions');
};

export const deleteVersion = async (id: string) => {
  const db = await initDB();
  await db.delete('versions', id);
};
