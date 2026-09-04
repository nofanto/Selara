import { RptiDetail, Version } from '../types';

export type DiffResult = {
  assets: EntityDiff;
  programmes: EntityDiff;
  strategies: EntityDiff;
  initiatives: EntityDiff;
  dependencies: EntityDiff;
  milestones: EntityDiff;
  deliverables: EntityDiff;
  deliverableSegments: EntityDiff;
  deliverableStatuses: EntityDiff;
  resources: EntityDiff;
  assetCategories: EntityDiff;
  decisions: EntityDiff;
  rptiDetails: EntityDiff;
  lkptiDetails: EntityDiff;
  hasChanges: boolean;
};

export type DiffSectionKey = Exclude<keyof DiffResult, 'hasChanges'>;

/**
 * Change strings that requirement-specs/diff-summary.md §3 drops as cosmetic noise —
 * real diffs that belong in the audit trail but carry nothing for a catch-up summary.
 *
 * Matching a prefix of the formatted string is a coupling, so it lives here, beside
 * the `getChanges` callbacks that produce those strings, rather than in the consumer:
 * a reworded change and its classifier cannot then drift apart across files.
 * `diffSummary.test.ts` pins each one, so a rewording fails a test rather than
 * silently changing what the summary hides.
 */
export const COSMETIC_CHANGE_PREFIXES: Partial<Record<DiffSectionKey, string[]>> = {
  programmes: ['Color: '],
  strategies: ['Color: '],
  deliverableStatuses: ['Color: '],
  assetCategories: ['Order: '],
};

/** An owning entity, named so a consumer can head a group or a cluster with it. */
export type DiffOwner = { id: string; name: string };

/**
 * Identity for one entity in a diff, with its owners resolved.
 *
 * Both owners are resolved here rather than by the consumer because computeDiff
 * holds both snapshots — it can still name the asset and deliverable behind a
 * segment or LKPTI row whose owner has since been *deleted*, which a consumer
 * given only the current workspace could not. Those are removals, and removals
 * are what a catch-up summary must not drop on the floor.
 *
 * `asset` groups the summary (requirement-specs/diff-summary.md §2); `deliverable`
 * clusters rows within a group (§6). Both are unset for portfolio-level types
 * (programmes, strategies, resources, categories, statuses, decisions) and for
 * dependencies, which join two initiatives that may sit under different assets.
 * `deliverable` alone is unset for entities that hang off the asset directly —
 * initiatives, milestones, and RPTI rows targeting an asset.
 */
export type DiffEntry = {
  id: string;
  name: string;
  asset?: DiffOwner;
  deliverable?: DiffOwner;
};

export type EntityDiff = {
  added: DiffEntry[];
  removed: DiffEntry[];
  modified: (DiffEntry & { changes: string[] })[];
};

type DiffOwners = { asset?: DiffOwner; deliverable?: DiffOwner };

function compareEntities<T extends { id: string }>(
  base: T[],
  curr: T[],
  getDisplayName: (item: T) => string,
  getChanges: (b: T, c: T) => string[],
  getOwners?: (item: T) => DiffOwners
): EntityDiff {
  const toEntry = (item: T): DiffEntry => {
    const { asset, deliverable } = getOwners?.(item) ?? {};
    return {
      id: item.id,
      name: getDisplayName(item),
      ...(asset && { asset }),
      ...(deliverable && { deliverable }),
    };
  };

  const added = curr.filter(ci => !base.some(bi => bi.id === ci.id)).map(toEntry);
  const removed = base.filter(bi => !curr.some(ci => ci.id === bi.id)).map(toEntry);
  const modified: (DiffEntry & { changes: string[] })[] = [];

  curr.forEach(ci => {
    const bi = base.find(b => b.id === ci.id);
    if (bi) {
      const changes = getChanges(bi, ci);
      if (changes.length > 0) modified.push({ ...toEntry(ci), changes });
    }
  });

  return { added, removed, modified };
}

const getAssetCategoryName = (versionData: Version['data'], categoryId: string | undefined) =>
  versionData.assetCategories.find(category => category.id === categoryId)?.name || 'Uncategorised';

export function computeDiff(baseVersion: Version, currentData: Version['data']): DiffResult {
  const currency = currentData.timelineSettings.defaultCurrency || 'USD';

  // Current snapshot first, then the baseline. The fallback is the whole reason
  // owners are resolved here: an entity deleted since the baseline is absent from
  // the current workspace, and its removal still needs a group and a cluster to
  // sit under. See requirement-specs/diff-summary.md §4 (revision 2026-09-04).
  const resolveAsset = (assetId: string | undefined): DiffOwner | undefined => {
    if (!assetId) return undefined;
    const name = currentData.assets.find(a => a.id === assetId)?.name
      || baseVersion.data.assets.find(a => a.id === assetId)?.name
      || 'Unknown asset';
    return { id: assetId, name };
  };

  const resolveDeliverable = (deliverableId: string | undefined): DiffOwner | undefined => {
    if (!deliverableId) return undefined;
    const name = currentData.deliverables.find(d => d.id === deliverableId)?.name
      || baseVersion.data.deliverables.find(d => d.id === deliverableId)?.name
      || 'Unknown deliverable';
    return { id: deliverableId, name };
  };

  const getDeliverableAssetId = (deliverableId: string) =>
    currentData.deliverables.find(d => d.id === deliverableId)?.assetId
    ?? baseVersion.data.deliverables.find(d => d.id === deliverableId)?.assetId;

  /** Owners for anything that hangs off a deliverable: segments, LKPTI rows, deliverable-targeted RPTI rows. */
  const deliverableOwners = (deliverableId: string): DiffOwners => ({
    asset: resolveAsset(getDeliverableAssetId(deliverableId)),
    deliverable: resolveDeliverable(deliverableId),
  });
  const assets = compareEntities(
    baseVersion.data.assets,
    currentData.assets,
    (asset) => asset.name,
    (b, c) => {
      const changes: string[] = [];
      if (b.name !== c.name) changes.push(`Renamed from "${b.name}" to "${c.name}"`);
      if (b.categoryId !== c.categoryId) {
        const oldCategory = getAssetCategoryName(baseVersion.data, b.categoryId);
        const newCategory = getAssetCategoryName(currentData, c.categoryId);
        changes.push(`Category: ${oldCategory} → ${newCategory}`);
      }
      if ((b.maturity ?? null) !== (c.maturity ?? null)) {
        changes.push(`Maturity: ${b.maturity ?? 'Unrated'} → ${c.maturity ?? 'Unrated'}`);
      }
      return changes;
    },
    (asset) => ({ asset: resolveAsset(asset.id) })
  );

  const programmes = compareEntities(
    baseVersion.data.programmes,
    currentData.programmes,
    (programme) => programme.name,
    (b, c) => {
      const changes: string[] = [];
      if (b.name !== c.name) changes.push(`Renamed from "${b.name}" to "${c.name}"`);
      if (b.color !== c.color) changes.push(`Color: ${b.color} → ${c.color}`);
      return changes;
    }
  );

  const strategies = compareEntities(
    baseVersion.data.strategies,
    currentData.strategies,
    (strategy) => strategy.name,
    (b, c) => {
      const changes: string[] = [];
      if (b.name !== c.name) changes.push(`Renamed from "${b.name}" to "${c.name}"`);
      if (b.color !== c.color) changes.push(`Color: ${b.color} → ${c.color}`);
      return changes;
    }
  );

  const initiatives = compareEntities(
    baseVersion.data.initiatives,
    currentData.initiatives,
    (i) => i.name,
    (b, c) => {
      const changes: string[] = [];
      if (b.name !== c.name) changes.push(`Renamed from "${b.name}" to "${c.name}"`);
      if (b.startDate !== c.startDate) changes.push(`Start date: ${b.startDate} → ${c.startDate}`);
      if (b.endDate !== c.endDate) changes.push(`End date: ${b.endDate} → ${c.endDate}`);
      if (b.capex !== c.capex) changes.push(`CapEx: ${currency} ${(b.capex || 0).toLocaleString()} → ${currency} ${(c.capex || 0).toLocaleString()}`);
      if (b.opex !== c.opex) changes.push(`OpEx: ${currency} ${(b.opex || 0).toLocaleString()} → ${currency} ${(c.opex || 0).toLocaleString()}`);
      if (b.assetId !== c.assetId) {
        const oldAsset = baseVersion.data.assets.find(a => a.id === b.assetId)?.name || 'Unknown';
        const newAsset = currentData.assets.find(a => a.id === c.assetId)?.name || 'Unknown';
        changes.push(`Moved from Asset "${oldAsset}" to "${newAsset}"`);
      }
      return changes;
    },
    (i) => ({ asset: resolveAsset(i.assetId) })
  );

  const dependencies = compareEntities(
    baseVersion.data.dependencies,
    currentData.dependencies,
    (d) => {
      const s = currentData.initiatives.find(i => i.id === d.sourceId)?.name
        || baseVersion.data.initiatives.find(i => i.id === d.sourceId)?.name
        || 'Unknown';
      const t = currentData.initiatives.find(i => i.id === d.targetId)?.name
        || baseVersion.data.initiatives.find(i => i.id === d.targetId)?.name
        || 'Unknown';
      return `${s} → ${t}`;
    },
    (b, c) => {
      const changes: string[] = [];
      if (b.type !== c.type) changes.push(`Type: ${b.type} → ${c.type}`);
      if (b.sourceId !== c.sourceId || b.targetId !== c.targetId) changes.push('Endpoints reconnected');
      return changes;
    }
  );

  const milestones = compareEntities(
    baseVersion.data.milestones,
    currentData.milestones,
    (m) => m.name,
    (b, c) => {
      const changes: string[] = [];
      if (b.name !== c.name) changes.push(`Renamed to "${c.name}"`);
      if (b.date !== c.date) changes.push(`Date: ${b.date} → ${c.date}`);
      if (b.type !== c.type) changes.push(`Type: ${b.type} → ${c.type}`);
      return changes;
    },
    (m) => ({ asset: resolveAsset(m.assetId) })
  );

  const deliverables = compareEntities(
    baseVersion.data.deliverables,
    currentData.deliverables,
    (a) => a.name,
    (b, c) => {
      const changes: string[] = [];
      if (b.name !== c.name) changes.push(`Renamed from "${b.name}" to "${c.name}"`);
      if ((b.type ?? 'application') !== (c.type ?? 'application')) {
        changes.push(`Type: ${b.type ?? 'application'} → ${c.type ?? 'application'}`);
      }
      if (b.assetId !== c.assetId) {
        const oldAsset = baseVersion.data.assets.find(a => a.id === b.assetId)?.name || 'Unknown';
        const newAsset = currentData.assets.find(a => a.id === c.assetId)?.name || 'Unknown';
        changes.push(`Moved from Asset "${oldAsset}" to "${newAsset}"`);
      }
      return changes;
    },
    (d) => ({ asset: resolveAsset(d.assetId), deliverable: resolveDeliverable(d.id) })
  );

  const getSegmentDeliverableName = (deliverableId: string) =>
    currentData.deliverables.find(a => a.id === deliverableId)?.name
    || baseVersion.data.deliverables.find(a => a.id === deliverableId)?.name
    || 'Unknown deliverable';

  const getSegmentStatusName = (statusId: string) =>
    (currentData.deliverableStatuses ?? []).find(s => s.id === statusId)?.name
    || (baseVersion.data.deliverableStatuses ?? []).find(s => s.id === statusId)?.name
    || statusId;

  const deliverableSegments = compareEntities(
    baseVersion.data.deliverableSegments,
    currentData.deliverableSegments,
    (s) => `${getSegmentDeliverableName(s.deliverableId)} (${s.startDate} → ${s.endDate})`,
    (b, c) => {
      const changes: string[] = [];
      if (b.startDate !== c.startDate) changes.push(`Start date: ${b.startDate} → ${c.startDate}`);
      if (b.endDate !== c.endDate) changes.push(`End date: ${b.endDate} → ${c.endDate}`);
      if (b.status !== c.status) changes.push(`Status: ${getSegmentStatusName(b.status)} → ${getSegmentStatusName(c.status)}`);
      if (b.deliverableId !== c.deliverableId) changes.push(`Moved to deliverable "${getSegmentDeliverableName(c.deliverableId)}"`);
      return changes;
    },
    (s) => deliverableOwners(s.deliverableId)
  );

  const deliverableStatuses = compareEntities(
    baseVersion.data.deliverableStatuses ?? [],
    currentData.deliverableStatuses ?? [],
    (s) => s.name,
    (b, c) => {
      const changes: string[] = [];
      if (b.name !== c.name) changes.push(`Renamed from "${b.name}" to "${c.name}"`);
      if (b.color !== c.color) changes.push(`Color: ${b.color} → ${c.color}`);
      if (!!b.isLiveStatus !== !!c.isLiveStatus) {
        changes.push(`Live status flag: ${b.isLiveStatus ? 'on' : 'off'} → ${c.isLiveStatus ? 'on' : 'off'}`);
      }
      if (!!b.isPreLaunchStatus !== !!c.isPreLaunchStatus) {
        changes.push(`Pre-launch status flag: ${b.isPreLaunchStatus ? 'on' : 'off'} → ${c.isPreLaunchStatus ? 'on' : 'off'}`);
      }
      return changes;
    }
  );

  const resources = compareEntities(
    baseVersion.data.resources,
    currentData.resources,
    (r) => r.name,
    (b, c) => {
      const changes: string[] = [];
      if (b.name !== c.name) changes.push(`Renamed from "${b.name}" to "${c.name}"`);
      if ((b.role ?? '') !== (c.role ?? '')) changes.push(`Role: ${b.role || 'None'} → ${c.role || 'None'}`);
      return changes;
    }
  );

  const assetCategories = compareEntities(
    baseVersion.data.assetCategories,
    currentData.assetCategories,
    (cat) => cat.name,
    (b, c) => {
      const changes: string[] = [];
      if (b.name !== c.name) changes.push(`Renamed from "${b.name}" to "${c.name}"`);
      if ((b.order ?? null) !== (c.order ?? null)) changes.push(`Order: ${b.order ?? 'Unset'} → ${c.order ?? 'Unset'}`);
      return changes;
    }
  );

  const decisions = compareEntities(
    baseVersion.data.decisions ?? [],
    currentData.decisions ?? [],
    (d) => d.title,
    (b, c) => {
      const changes: string[] = [];
      if (b.title !== c.title) changes.push(`Renamed from "${b.title}" to "${c.title}"`);
      if (b.status !== c.status) changes.push(`Status: ${b.status} → ${c.status}`);
      if ((b.decisionOutcome ?? '') !== (c.decisionOutcome ?? '')) changes.push('Decision outcome updated');
      if ((b.context ?? '') !== (c.context ?? '')) changes.push('Context updated');
      return changes;
    }
  );

  const getInitiativeName = (initiativeId: string) =>
    currentData.initiatives.find(i => i.id === initiativeId)?.name
    || baseVersion.data.initiatives.find(i => i.id === initiativeId)?.name
    || 'Unknown initiative';

  const getRptiTargetName = (targetType: RptiDetail['targetType'], targetId: string) => {
    if (targetType === 'asset') {
      return currentData.assets.find(a => a.id === targetId)?.name
        || baseVersion.data.assets.find(a => a.id === targetId)?.name
        || 'Unknown asset';
    }
    return currentData.deliverables.find(a => a.id === targetId)?.name
      || baseVersion.data.deliverables.find(a => a.id === targetId)?.name
      || 'Unknown deliverable';
  };

  const rptiDetails = compareEntities(
    baseVersion.data.rptiDetails ?? [],
    currentData.rptiDetails ?? [],
    (r) => `${getInitiativeName(r.initiativeId)} → ${getRptiTargetName(r.targetType, r.targetId)}`,
    (b, c) => {
      const changes: string[] = [];
      if (b.categoryCode !== c.categoryCode) changes.push(`Category code: ${b.categoryCode} → ${c.categoryCode}`);
      if (b.developmentType !== c.developmentType) changes.push(`Development type: ${b.developmentType} → ${c.developmentType}`);
      if (b.developer !== c.developer) changes.push(`Developer: ${b.developer} → ${c.developer}`);
      if (b.ppjtiRelatedParty !== c.ppjtiRelatedParty) changes.push(`PPJTI related party: ${b.ppjtiRelatedParty} → ${c.ppjtiRelatedParty}`);
      if ((b.plannedImplementationQuarter ?? '') !== (c.plannedImplementationQuarter ?? '')) {
        changes.push(`Planned quarter: ${b.plannedImplementationQuarter ?? 'Unset'} → ${c.plannedImplementationQuarter ?? 'Unset'}`);
      }
      if ((b.capexAmount ?? 0) !== (c.capexAmount ?? 0)) changes.push(`CapEx: ${b.capexAmount ?? 0} → ${c.capexAmount ?? 0}`);
      if ((b.opexAmount ?? 0) !== (c.opexAmount ?? 0)) changes.push(`OpEx: ${b.opexAmount ?? 0} → ${c.opexAmount ?? 0}`);
      if ((b.remarks ?? '') !== (c.remarks ?? '')) changes.push('Remarks updated');
      return changes;
    },
    (r) => (r.targetType === 'asset' ? { asset: resolveAsset(r.targetId) } : deliverableOwners(r.targetId))
  );

  const getLkptiTargetName = (targetId: string) =>
    currentData.deliverables.find(d => d.id === targetId)?.name
    || baseVersion.data.deliverables.find(d => d.id === targetId)?.name
    || 'Unknown deliverable';

  const lkptiDetails = compareEntities(
    baseVersion.data.lkptiDetails ?? [],
    currentData.lkptiDetails ?? [],
    (r) => getLkptiTargetName(r.targetId),
    (b, c) => {
      const changes: string[] = [];
      if (b.categoryCode !== c.categoryCode) changes.push(`Category code: ${b.categoryCode} → ${c.categoryCode}`);
      if (b.developer !== c.developer) changes.push(`Developer: ${b.developer} → ${c.developer}`);
      if ((b.platform ?? '') !== (c.platform ?? '')) changes.push(`Platform: ${b.platform ?? 'Unset'} → ${c.platform ?? 'Unset'}`);
      if ((b.database ?? '') !== (c.database ?? '')) changes.push(`Database: ${b.database ?? 'Unset'} → ${c.database ?? 'Unset'}`);
      if ((b.backupStrategy ?? '') !== (c.backupStrategy ?? '')) changes.push(`Backup strategy: ${b.backupStrategy ?? 'Unset'} → ${c.backupStrategy ?? 'Unset'}`);
      if ((b.systemOwner ?? '') !== (c.systemOwner ?? '')) changes.push(`System owner: ${b.systemOwner ?? 'Unset'} → ${c.systemOwner ?? 'Unset'}`);
      if ((b.goLiveDate ?? '') !== (c.goLiveDate ?? '')) changes.push(`Go-live date: ${b.goLiveDate ?? 'Unset'} → ${c.goLiveDate ?? 'Unset'}`);
      if ((b.ownership ?? '') !== (c.ownership ?? '')) changes.push(`Ownership: ${b.ownership ?? 'Unset'} → ${c.ownership ?? 'Unset'}`);
      return changes;
    },
    (l) => deliverableOwners(l.targetId)
  );

  const hasChanges =
    assets.added.length > 0 || assets.removed.length > 0 || assets.modified.length > 0 ||
    programmes.added.length > 0 || programmes.removed.length > 0 || programmes.modified.length > 0 ||
    strategies.added.length > 0 || strategies.removed.length > 0 || strategies.modified.length > 0 ||
    initiatives.added.length > 0 || initiatives.removed.length > 0 || initiatives.modified.length > 0 ||
    dependencies.added.length > 0 || dependencies.removed.length > 0 || dependencies.modified.length > 0 ||
    milestones.added.length > 0 || milestones.removed.length > 0 || milestones.modified.length > 0 ||
    deliverables.added.length > 0 || deliverables.removed.length > 0 || deliverables.modified.length > 0 ||
    deliverableSegments.added.length > 0 || deliverableSegments.removed.length > 0 || deliverableSegments.modified.length > 0 ||
    deliverableStatuses.added.length > 0 || deliverableStatuses.removed.length > 0 || deliverableStatuses.modified.length > 0 ||
    resources.added.length > 0 || resources.removed.length > 0 || resources.modified.length > 0 ||
    assetCategories.added.length > 0 || assetCategories.removed.length > 0 || assetCategories.modified.length > 0 ||
    decisions.added.length > 0 || decisions.removed.length > 0 || decisions.modified.length > 0 ||
    rptiDetails.added.length > 0 || rptiDetails.removed.length > 0 || rptiDetails.modified.length > 0 ||
    lkptiDetails.added.length > 0 || lkptiDetails.removed.length > 0 || lkptiDetails.modified.length > 0;

  return {
    assets, programmes, strategies, initiatives, dependencies, milestones,
    deliverables, deliverableSegments, deliverableStatuses, resources, assetCategories, decisions, rptiDetails,
    lkptiDetails,
    hasChanges,
  };
}
