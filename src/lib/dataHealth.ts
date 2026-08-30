import {
  Asset, AssetCategory, Deliverable, DeliverableSegment, DeliverableStatus,
  Initiative, Milestone, Dependency, Decision, Resource, Programme, Strategy,
  RptiDetail, LkptiDetail,
} from '../types';
import { isLiveStatusId, isPreLaunchStatusId, resolveAssetCategory } from './rpti';

// Tabs of src/components/DataManager.tsx's own `Tab` union — defined here (the pure
// lib layer) as the source of truth so DataManager can import it instead of the other
// way around. Keep in sync with DataManager's `type Tab`.
export type DataManagerTab =
  | 'initiatives' | 'dependencies' | 'assets' | 'assetCategories'
  | 'programmes' | 'strategies' | 'milestones' | 'resources'
  | 'deliverables' | 'deliverableStatuses' | 'rpti' | 'lkpti';

export type HealthIssueLocation =
  | { view: 'data'; tab: DataManagerTab }
  | { view: 'decisions' };

export type HealthSeverity = 'error' | 'warning';

export interface HealthIssue {
  id: string; // stable, unique per (check, record) — used for React keys and dedup in tests
  severity: HealthSeverity;
  entityType: string;
  entityId: string;
  entityName: string; // best-effort human label; also used to pre-fill the Data Manager search box on navigate
  message: string;
  location: HealthIssueLocation;
}

export interface DataHealthInput {
  assets: Asset[];
  assetCategories: AssetCategory[];
  deliverables: Deliverable[];
  deliverableSegments: DeliverableSegment[];
  deliverableStatuses: DeliverableStatus[];
  initiatives: Initiative[];
  milestones: Milestone[];
  dependencies: Dependency[];
  decisions: Decision[];
  resources: Resource[];
  programmes: Programme[];
  strategies: Strategy[];
  rptiDetails: RptiDetail[];
  lkptiDetails: LkptiDetail[];
}

const DATA_TAB: HealthIssueLocation = { view: 'data', tab: 'deliverables' };
const tab = (t: DataManagerTab): HealthIssueLocation => ({ view: 'data', tab: t });
const DECISIONS: HealthIssueLocation = { view: 'decisions' };

/**
 * Computes the full set of workspace data-health issues — dangling references
 * (severity 'error') and report-generation gaps (severity 'warning'). Pure,
 * read-only: this never mutates or persists anything, it's a live read model
 * over the current AppState, recomputed on every render the same way the
 * Budget/Capacity reports are. See requirement-specs/data-completeness-report.md
 * for the full design record and the rationale behind each check.
 */
export function computeDataHealth(input: DataHealthInput): HealthIssue[] {
  const {
    assets, assetCategories, deliverables, deliverableSegments, deliverableStatuses,
    initiatives, milestones, dependencies, decisions, resources, programmes, strategies,
    rptiDetails, lkptiDetails,
  } = input;

  const assetIds = new Set(assets.map(a => a.id));
  const assetCategoryIds = new Set(assetCategories.map(c => c.id));
  const deliverableIds = new Set(deliverables.map(d => d.id));
  const segmentIds = new Set(deliverableSegments.map(s => s.id));
  const statusIds = new Set(deliverableStatuses.map(s => s.id));
  const initiativeIds = new Set(initiatives.map(i => i.id));
  const milestoneIds = new Set(milestones.map(m => m.id));
  const resourceIds = new Set(resources.map(r => r.id));
  const programmeIds = new Set(programmes.map(p => p.id));
  const strategyIds = new Set(strategies.map(s => s.id));
  const decisionIds = new Set(decisions.map(d => d.id));

  const deliverableById = new Map(deliverables.map(d => [d.id, d]));
  const assetById = new Map(assets.map(a => [a.id, a]));
  const initiativeById = new Map(initiatives.map(i => [i.id, i]));

  const issues: HealthIssue[] = [];

  // ── Hard: dangling references (severity 'error') ──────────────────────────

  for (const d of deliverables) {
    if (!assetIds.has(d.assetId)) {
      issues.push({
        id: `deliverable-asset:${d.id}`, severity: 'error', entityType: 'Deliverable', entityId: d.id,
        entityName: d.name, message: `"${d.name}" points at an Asset that no longer exists.`, location: DATA_TAB,
      });
    }
  }

  for (const a of assets) {
    if (!assetCategoryIds.has(a.categoryId)) {
      issues.push({
        id: `asset-category:${a.id}`, severity: 'error', entityType: 'Asset', entityId: a.id,
        entityName: a.name, message: `"${a.name}" points at an Asset Category that no longer exists.`, location: tab('assets'),
      });
    }
  }

  for (const seg of deliverableSegments) {
    const deliverable = deliverableById.get(seg.deliverableId);
    const label = deliverable?.name ?? seg.id;
    if (!deliverableIds.has(seg.deliverableId)) {
      issues.push({
        id: `segment-deliverable:${seg.id}`, severity: 'error', entityType: 'DeliverableSegment', entityId: seg.id,
        entityName: label, message: `A lifecycle segment points at a Deliverable that no longer exists.`, location: DATA_TAB,
      });
    }
    if (seg.initiativeId && !initiativeIds.has(seg.initiativeId)) {
      issues.push({
        id: `segment-initiative:${seg.id}`, severity: 'error', entityType: 'DeliverableSegment', entityId: seg.id,
        entityName: label, message: `A lifecycle segment on "${label}" points at an Initiative that no longer exists.`, location: DATA_TAB,
      });
    }
    if (!statusIds.has(seg.status)) {
      issues.push({
        id: `segment-status:${seg.id}`, severity: 'error', entityType: 'DeliverableSegment', entityId: seg.id,
        entityName: label, message: `A lifecycle segment on "${label}" has a status ("${seg.status}") that no longer exists.`, location: DATA_TAB,
      });
    }
  }

  for (const i of initiatives) {
    if (!programmeIds.has(i.programmeId)) {
      issues.push({
        id: `initiative-programme:${i.id}`, severity: 'error', entityType: 'Initiative', entityId: i.id,
        entityName: i.name, message: `"${i.name}" points at a Programme that no longer exists.`, location: tab('initiatives'),
      });
    }
    if (i.strategyId && !strategyIds.has(i.strategyId)) {
      issues.push({
        id: `initiative-strategy:${i.id}`, severity: 'error', entityType: 'Initiative', entityId: i.id,
        entityName: i.name, message: `"${i.name}" points at a Strategy that no longer exists.`, location: tab('initiatives'),
      });
    }
    if (!assetIds.has(i.assetId)) {
      issues.push({
        id: `initiative-asset:${i.id}`, severity: 'error', entityType: 'Initiative', entityId: i.id,
        entityName: i.name, message: `"${i.name}" points at an Asset that no longer exists.`, location: tab('initiatives'),
      });
    }
    if (i.deliverableId && !deliverableIds.has(i.deliverableId)) {
      issues.push({
        id: `initiative-deliverable:${i.id}`, severity: 'error', entityType: 'Initiative', entityId: i.id,
        entityName: i.name, message: `"${i.name}" points at a Deliverable that no longer exists.`, location: tab('initiatives'),
      });
    }
    if (i.ownerId && !resourceIds.has(i.ownerId)) {
      issues.push({
        id: `initiative-owner:${i.id}`, severity: 'error', entityType: 'Initiative', entityId: i.id,
        entityName: i.name, message: `"${i.name}"'s owner is a Resource that no longer exists.`, location: tab('initiatives'),
      });
    }
    for (const rId of i.resourceIds ?? []) {
      if (!resourceIds.has(rId)) {
        issues.push({
          id: `initiative-resource:${i.id}:${rId}`, severity: 'error', entityType: 'Initiative', entityId: i.id,
          entityName: i.name, message: `"${i.name}" is assigned a Resource that no longer exists.`, location: tab('initiatives'),
        });
      }
    }
  }

  for (const m of milestones) {
    if (!assetIds.has(m.assetId)) {
      issues.push({
        id: `milestone-asset:${m.id}`, severity: 'error', entityType: 'Milestone', entityId: m.id,
        entityName: m.name, message: `"${m.name}" points at an Asset that no longer exists.`, location: tab('milestones'),
      });
    }
  }

  const depEndpointExists = (id: string, type: 'initiative' | 'milestone' | 'segment' | undefined): boolean => {
    const t = type ?? 'initiative';
    if (t === 'initiative') return initiativeIds.has(id);
    if (t === 'milestone') return milestoneIds.has(id);
    return segmentIds.has(id);
  };
  for (const dep of dependencies) {
    if (!depEndpointExists(dep.sourceId, dep.sourceType)) {
      issues.push({
        id: `dependency-source:${dep.id}`, severity: 'error', entityType: 'Dependency', entityId: dep.id,
        entityName: dep.id, message: `A dependency's source no longer exists.`, location: tab('dependencies'),
      });
    }
    if (!depEndpointExists(dep.targetId, dep.targetType)) {
      issues.push({
        id: `dependency-target:${dep.id}`, severity: 'error', entityType: 'Dependency', entityId: dep.id,
        entityName: dep.id, message: `A dependency's target no longer exists.`, location: tab('dependencies'),
      });
    }
  }

  for (const dec of decisions) {
    if (dec.linkedEntityId && dec.linkedEntityType) {
      const exists = dec.linkedEntityType === 'initiative' ? initiativeIds.has(dec.linkedEntityId)
        : dec.linkedEntityType === 'programme' ? programmeIds.has(dec.linkedEntityId)
        : assetIds.has(dec.linkedEntityId);
      if (!exists) {
        issues.push({
          id: `decision-linked:${dec.id}`, severity: 'error', entityType: 'Decision', entityId: dec.id,
          entityName: dec.title, message: `"${dec.title}" links to a ${dec.linkedEntityType} that no longer exists.`, location: DECISIONS,
        });
      }
    }
    if (dec.supersededBy && !decisionIds.has(dec.supersededBy)) {
      issues.push({
        id: `decision-superseded-by:${dec.id}`, severity: 'error', entityType: 'Decision', entityId: dec.id,
        entityName: dec.title, message: `"${dec.title}" is marked superseded by a Decision that no longer exists.`, location: DECISIONS,
      });
    }
  }

  for (const r of rptiDetails) {
    const initiative = initiativeById.get(r.initiativeId);
    const label = initiative?.name ?? r.id;
    if (!initiativeIds.has(r.initiativeId)) {
      issues.push({
        id: `rpti-initiative:${r.id}`, severity: 'error', entityType: 'RptiDetail', entityId: r.id,
        entityName: label, message: `An RPTI row points at an Initiative that no longer exists.`, location: tab('rpti'),
      });
    }
    const targetExists = r.targetType === 'deliverable' ? deliverableIds.has(r.targetId) : assetIds.has(r.targetId);
    if (!targetExists) {
      issues.push({
        id: `rpti-target:${r.id}`, severity: 'error', entityType: 'RptiDetail', entityId: r.id,
        entityName: label, message: `An RPTI row for "${label}" points at a ${r.targetType} that no longer exists.`, location: tab('rpti'),
      });
    }
    if (r.deliverableSegmentId && !segmentIds.has(r.deliverableSegmentId)) {
      issues.push({
        id: `rpti-segment:${r.id}`, severity: 'error', entityType: 'RptiDetail', entityId: r.id,
        entityName: label, message: `An RPTI row for "${label}" points at a lifecycle segment that no longer exists.`, location: tab('rpti'),
      });
    }
  }

  for (const l of lkptiDetails) {
    const deliverable = deliverableById.get(l.targetId);
    const label = deliverable?.name ?? l.id;
    if (!deliverableIds.has(l.targetId)) {
      issues.push({
        id: `lkpti-target:${l.id}`, severity: 'error', entityType: 'LkptiDetail', entityId: l.id,
        entityName: label, message: `An LKPTI row points at a Deliverable that no longer exists.`, location: tab('lkpti'),
      });
    }
  }

  // ── Soft: report-generation gaps (severity 'warning') ──────────────────────
  // Each check below is scoped to only the Deliverables actually eligible for the
  // report it concerns, mirroring the real generation eligibility rules in rpti.ts /
  // lkpti.ts, so this never flags a gap that could never affect a generated report.

  const isRptiEligible = (d: Deliverable): boolean =>
    deliverableSegments.some(seg =>
      seg.deliverableId === d.id && !!seg.initiativeId && initiativeIds.has(seg.initiativeId) &&
      (isLiveStatusId(seg.status, deliverableStatuses) || isPreLaunchStatusId(seg.status, deliverableStatuses))
    );

  const isLkptiEligible = (d: Deliverable): boolean =>
    (d.type ?? 'application') === 'application' &&
    deliverableSegments.some(seg => seg.deliverableId === d.id && isLiveStatusId(seg.status, deliverableStatuses));

  for (const d of deliverables) {
    const segments = deliverableSegments.filter(s => s.deliverableId === d.id);

    if (segments.length === 0) {
      issues.push({
        id: `deliverable-no-segments:${d.id}`, severity: 'warning', entityType: 'Deliverable', entityId: d.id,
        entityName: d.name, message: `"${d.name}" has no lifecycle segments — invisible to both RPTI and LKPTI generation.`, location: DATA_TAB,
      });
    } else if (!segments.some(s => !!s.initiativeId)) {
      issues.push({
        id: `deliverable-no-initiative-segment:${d.id}`, severity: 'warning', entityType: 'Deliverable', entityId: d.id,
        entityName: d.name, message: `"${d.name}" has lifecycle segments, but none linked to an Initiative — it can never generate an RPTI row.`, location: DATA_TAB,
      });
    }

    if ((d.type ?? 'application') === 'application' && !segments.some(s => isLiveStatusId(s.status, deliverableStatuses))) {
      issues.push({
        id: `deliverable-no-live-segment:${d.id}`, severity: 'warning', entityType: 'Deliverable', entityId: d.id,
        entityName: d.name, message: `"${d.name}" has no live-status segment — silently excluded from LKPTI generation.`, location: DATA_TAB,
      });
    }

    const rptiEligible = isRptiEligible(d);
    const lkptiEligible = isLkptiEligible(d);
    if (rptiEligible || lkptiEligible) {
      const category = resolveAssetCategory(d, assets, assetCategories);

      const resolvedCategoryCode = d.categoryCode ?? category?.categoryCode;
      if (!resolvedCategoryCode) {
        issues.push({
          id: `deliverable-no-category:${d.id}`, severity: 'warning', entityType: 'Deliverable', entityId: d.id,
          entityName: d.name, message: `"${d.name}" has no resolvable regulatory category — will export as a blank category cell.`, location: DATA_TAB,
        });
      }

      if (!d.developer) {
        issues.push({
          id: `deliverable-no-developer:${d.id}`, severity: 'warning', entityType: 'Deliverable', entityId: d.id,
          entityName: d.name, message: `"${d.name}" has no developer set — will export as a blank developer cell.`, location: DATA_TAB,
        });
      }

      const missingPlaces: string[] = [];
      if (!(d.dcCity ?? category?.dcCity)) missingPlaces.push('DC city');
      if (!(d.dcCountry ?? category?.dcCountry)) missingPlaces.push('DC country');
      if (!(d.drCity ?? category?.drCity)) missingPlaces.push('DR city');
      if (!(d.drCountry ?? category?.drCountry)) missingPlaces.push('DR country');
      if (missingPlaces.length > 0) {
        issues.push({
          id: `deliverable-no-location:${d.id}`, severity: 'warning', entityType: 'Deliverable', entityId: d.id,
          entityName: d.name, message: `"${d.name}" is missing ${missingPlaces.join(', ')} — will export as blank location cell(s).`, location: DATA_TAB,
        });
      }
    }

    if (lkptiEligible && !d.description) {
      issues.push({
        id: `deliverable-no-description:${d.id}`, severity: 'warning', entityType: 'Deliverable', entityId: d.id,
        entityName: d.name, message: `"${d.name}" has no description — LKPTI's Function Description will be blank.`, location: DATA_TAB,
      });
    }
  }

  const LKPTI_MANUAL_ONLY_FIELDS: { key: keyof LkptiDetail; label: string }[] = [
    { key: 'platform', label: 'Platform' },
    { key: 'database', label: 'Database' },
    { key: 'dcProvider', label: 'DC Provider' },
    { key: 'drcProvider', label: 'DRC Provider' },
    { key: 'backupStrategy', label: 'Backup Strategy' },
    { key: 'systemOwner', label: 'System Owner' },
    { key: 'ownership', label: 'Ownership' },
    { key: 'goLiveDate', label: 'Go-Live Date' },
    { key: 'developer', label: 'Developer' },
  ];
  for (const l of lkptiDetails) {
    const deliverable = deliverableById.get(l.targetId);
    const label = deliverable?.name ?? l.id;
    const missing = LKPTI_MANUAL_ONLY_FIELDS.filter(f => !l[f.key]).map(f => f.label);
    if (missing.length > 0) {
      issues.push({
        id: `lkpti-incomplete:${l.id}`, severity: 'warning', entityType: 'LkptiDetail', entityId: l.id,
        entityName: label, message: `The LKPTI row for "${label}" is missing: ${missing.join(', ')}.`, location: tab('lkpti'),
      });
    }
  }

  const RPTI_MANUAL_ONLY_FIELDS: { key: keyof RptiDetail; label: string }[] = [
    { key: 'categoryCode', label: 'Category' },
    { key: 'developer', label: 'Developer' },
    { key: 'ppjtiRelatedParty', label: 'PPJTI Related Party' },
  ];
  for (const r of rptiDetails) {
    const initiative = initiativeById.get(r.initiativeId);
    const label = initiative?.name ?? r.id;
    const missing = RPTI_MANUAL_ONLY_FIELDS.filter(f => !r[f.key]).map(f => f.label);
    if (missing.length > 0) {
      issues.push({
        id: `rpti-incomplete:${r.id}`, severity: 'warning', entityType: 'RptiDetail', entityId: r.id,
        entityName: label, message: `The RPTI row for "${label}" is missing: ${missing.join(', ')}.`, location: tab('rpti'),
      });
    }
  }

  for (const i of initiatives) {
    if (!i.ownerId && !i.owner) {
      issues.push({
        id: `initiative-no-owner:${i.id}`, severity: 'warning', entityType: 'Initiative', entityId: i.id,
        entityName: i.name, message: `"${i.name}" has no owner assigned.`, location: tab('initiatives'),
      });
    }
  }

  return issues;
}
