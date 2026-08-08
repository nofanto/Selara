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
  hasChanges: boolean;
};

type EntityDiff = {
  added: string[];
  removed: string[];
  modified: { name: string; changes: string[] }[];
};

function compareEntities<T extends { id: string }>(
  base: T[],
  curr: T[],
  getDisplayName: (item: T) => string,
  getChanges: (b: T, c: T) => string[]
): EntityDiff {
  const added = curr.filter(ci => !base.some(bi => bi.id === ci.id)).map(i => getDisplayName(i));
  const removed = base.filter(bi => !curr.some(ci => ci.id === bi.id)).map(i => getDisplayName(i));
  const modified: { name: string; changes: string[] }[] = [];

  curr.forEach(ci => {
    const bi = base.find(b => b.id === ci.id);
    if (bi) {
      const changes = getChanges(bi, ci);
      if (changes.length > 0) modified.push({ name: getDisplayName(ci), changes });
    }
  });

  return { added, removed, modified };
}

const getAssetCategoryName = (versionData: Version['data'], categoryId: string | undefined) =>
  versionData.assetCategories.find(category => category.id === categoryId)?.name || 'Uncategorised';

export function computeDiff(baseVersion: Version, currentData: Version['data']): DiffResult {
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
    }
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
      if (b.capex !== c.capex) changes.push(`CapEx: $${(b.capex || 0).toLocaleString()} → $${(c.capex || 0).toLocaleString()}`);
      if (b.opex !== c.opex) changes.push(`OpEx: $${(b.opex || 0).toLocaleString()} → $${(c.opex || 0).toLocaleString()}`);
      if (b.assetId !== c.assetId) {
        const oldAsset = baseVersion.data.assets.find(a => a.id === b.assetId)?.name || 'Unknown';
        const newAsset = currentData.assets.find(a => a.id === c.assetId)?.name || 'Unknown';
        changes.push(`Moved from Asset "${oldAsset}" to "${newAsset}"`);
      }
      return changes;
    }
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
    }
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
    }
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
    }
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
    }
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
    rptiDetails.added.length > 0 || rptiDetails.removed.length > 0 || rptiDetails.modified.length > 0;

  return {
    assets, programmes, strategies, initiatives, dependencies, milestones,
    deliverables, deliverableSegments, deliverableStatuses, resources, assetCategories, decisions, rptiDetails,
    hasChanges,
  };
}
