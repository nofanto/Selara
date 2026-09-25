import {
  Asset, AssetCategory, Deliverable, DeliverableSegment, DeliverableStatus,
  Initiative, Milestone, Dependency, Decision, Resource, Programme, Strategy,
  RptiDetail, LkptiDetail, TimelineSettings,
} from '../types';
import { isRepairableUnresolvedRow } from './unresolvedRowRepair';
import { deletedAnchorRepair, isLiveStatusId, isPreLaunchStatusId, reconcileRptiReturn, resolveAssetCategory } from './rpti';

// Tabs of src/components/DataManager.tsx's own `Tab` union — defined here (the pure
// lib layer) as the source of truth so DataManager can import it instead of the other
// way around. Keep in sync with DataManager's `type Tab`.
export type DataManagerTab =
  | 'initiatives' | 'dependencies' | 'assets' | 'assetCategories'
  | 'programmes' | 'strategies' | 'milestones' | 'resources'
  | 'deliverables' | 'deliverableStatuses' | 'rpti' | 'lkpti';

export type HealthIssueLocation =
  | { view: 'data'; tab: DataManagerTab }
  | { view: 'history' };

export type HealthSeverity = 'error' | 'warning';

/**
 * Which question the check asks. 'completeness' — is this reference resolvable /
 * is this value present? 'validity' — is the value that *is* present actually legal
 * under the OJK schema? Independent of severity, and never a gate: both phases always
 * run, so a validity error is never hidden behind the completeness warnings every real
 * workspace carries. See requirement-specs/data-completeness-report.md § Phase 2 §1.
 */
export type HealthPhase = 'completeness' | 'validity';

/** A filed OJK return that a check can bear on. */
export type HealthReport = 'rpti' | 'lkpti';

export interface HealthIssue {
  id: string; // stable, unique per (check, record) — used for React keys and dedup in tests
  severity: HealthSeverity;
  phase: HealthPhase;
  entityType: string;
  entityId: string;
  entityName: string; // best-effort human label; also used to pre-fill the Data Manager search box on navigate
  message: string;
  location: HealthIssueLocation;
  /**
   * Which filed returns this issue affects. Empty means neither — a real problem
   * with the workspace that changes nothing about what is submitted.
   *
   * A list rather than a four-value enum so that "affects both" is simply
   * `['rpti', 'lkpti']`, and filtering to one return is `reports.includes(r)`
   * with no special case for issues that hit both.
   */
  reports: HealthReport[];
  action?: { kind: 'repair-unresolved-rpti-row'; rowId: string };
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
  // Phase 2 only, and only `defaultCurrency` is read — narrowed rather than taking the
  // whole TimelineSettings so callers and fixtures need supply no more than the check uses.
  timelineSettings: Pick<TimelineSettings, 'defaultCurrency'>;
}

const DATA_TAB: HealthIssueLocation = { view: 'data', tab: 'deliverables' };
const tab = (t: DataManagerTab): HealthIssueLocation => ({ view: 'data', tab: t });
const DECISIONS: HealthIssueLocation = { view: 'history' };

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
    rptiDetails, lkptiDetails, timelineSettings,
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
  const initiativeById = new Map(initiatives.map(i => [i.id, i]));

  // Checks push without `phase` or `reports` — both are stamped on at the end, phase
  // from which array the issue landed in and reports from REPORTS_BY_CHECK, rather
  // than repeated at every one of the ~40 push sites.
  type PendingIssue = Omit<HealthIssue, 'phase' | 'reports'>;
  const issues: PendingIssue[] = [];
  const validityIssues: PendingIssue[] = [];

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

    const initiativeSegments = deliverableSegments.filter(segment => segment.initiativeId === i.id);

    // The initiative budget drives portfolio views; implementation amounts are filed.
    // Both states are legal, so divergence is reviewable and never export-blocking.
    const implementations = initiativeSegments.filter(segment => isLiveStatusId(segment.status, deliverableStatuses));
    const implementationCapex = implementations.reduce((sum, segment) => sum + (segment.capexAmount ?? 0), 0);
    const implementationOpex = implementations.reduce((sum, segment) => sum + (segment.opexAmount ?? 0), 0);
    if (implementations.length > 0 && (i.capex !== implementationCapex || i.opex !== implementationOpex)) {
      issues.push({
        id: `initiative-budget-divergence:${i.id}`, severity: 'warning', entityType: 'Initiative', entityId: i.id,
        entityName: i.name,
        message: `"${i.name}" has an initiative budget of CapEx ${i.capex.toLocaleString()} and OpEx ${i.opex.toLocaleString()}, while its implementations state CapEx ${implementationCapex.toLocaleString()} and OpEx ${implementationOpex.toLocaleString()}. Both are legal and the filing uses the implementation figures. Review the portfolio budget on the Initiatives tab or the filed figures in each lifecycle segment panel.`,
        location: tab('initiatives'),
      });
    }

    // An implementation whose application has been deleted still projects a row —
    // naming a Deliverable that does not exist, with its cascaded columns blank.
    // segment-deliverable reports the dangling reference, but the pre-export gate
    // reads RptiDetail rows and the initiative-rpti- prefix only, so before this
    // check the return could be exported with that row in it. Scoped to segments
    // that would actually file: an unattributed dangling segment is a timeline
    // problem, not a filing one, and must not block an unrelated return.
    if (!i.isPlaceholder) {
      for (const segment of implementations) {
        if (deliverableIds.has(segment.deliverableId)) continue;
        issues.push({
          id: `initiative-rpti-missing-target:${segment.id}`, severity: 'error',
          entityType: 'DeliverableSegment', entityId: segment.id, entityName: i.name,
          message: `"${i.name}" has a live implementation whose application no longer exists, so the filing would state a Deliverable that is not there. On the Deliverables tab, create or restore the application, then open that implementation's lifecycle segment panel on the Visualiser timeline and select it.`,
          location: tab('deliverables'),
        });
      }
    }

    const legacyRemarks = (i as unknown as Record<string, unknown>).rptiRemarks;
    const remarksImplementations = deliverableStatuses.length > 0 ? implementations : [];
    // The lift is non-destructive, so a remark it successfully placed stays on the
    // initiative as well. Adding a second go-live later would otherwise raise this
    // warning about a remark that is already on an implementation and already filed
    // — a finding with no action behind it, which is how a gate loses its credibility.
    const alreadyPlaced = remarksImplementations.some(segment => segment.rptiRemarks === legacyRemarks);
    if (typeof legacyRemarks === 'string' && legacyRemarks !== '' && !alreadyPlaced && remarksImplementations.length > 1) {
      issues.push({
        id: `initiative-orphaned-rpti-remarks:${i.id}`, severity: 'warning', entityType: 'Initiative', entityId: i.id,
        entityName: i.name,
        message: `"${i.name}" still carries the earlier initiative-level RPTI remark “${legacyRemarks}”. It is no longer filed because this initiative has more than one implementation and Selara cannot safely choose which row it describes. Open the intended implementation's lifecycle segment panel and enter the remark there.`,
        location: tab('initiatives'),
      });
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

  const rptiReconciliationByRow = new Map(reconcileRptiReturn({
    storedDetails: rptiDetails,
    initiatives,
    deliverables,
    deliverableSegments,
    deliverableStatuses,
  }).map(finding => [finding.rowId, finding]));

  for (const r of rptiDetails) {
    const reconciliation = rptiReconciliationByRow.get(r.id);
    // A stale stored id is not itself a defect once the row has one unambiguous
    // current canonical counterpart (Q12). The evidence remains immutable; the
    // source-side repair is what clears both Data Health and the export gate.
    if (!reconciliation) continue;
    const initiative = initiativeById.get(r.initiativeId);
    const label = initiative?.name ?? r.id;
    if (reconciliation.reason === 'identity-conflict') {
      issues.push({
        id: `rpti-identity-conflict:${r.id}`, severity: 'error', entityType: 'RptiDetail', entityId: r.id,
        entityName: label, message: reconciliation.message, location: tab('initiatives'),
      });
      continue;
    }
    if (!initiativeIds.has(r.initiativeId)) {
      issues.push({
        id: `rpti-initiative:${r.id}`, severity: 'error', entityType: 'RptiDetail', entityId: r.id,
        entityName: label, message: reconciliation.message, location: tab('initiatives'),
      });
    }
    if (r.targetType === 'asset') {
      issues.push({
        id: `rpti-asset-target:${r.id}`, severity: 'error', entityType: 'RptiDetail', entityId: r.id,
        entityName: label,
        message: reconciliation.message,
        location: tab('deliverables'),
      });
    }
    const targetExists = r.targetType === 'deliverable' ? deliverableIds.has(r.targetId) : assetIds.has(r.targetId);
    if (!targetExists) {
      issues.push({
        id: `rpti-target:${r.id}`, severity: 'error', entityType: 'RptiDetail', entityId: r.id,
        entityName: label, message: reconciliation.message, location: tab('deliverables'),
        ...(isRepairableUnresolvedRow(r) ? { action: { kind: 'repair-unresolved-rpti-row' as const, rowId: r.id } } : {}),
      });
    }
    if (r.deliverableSegmentId && !segmentIds.has(r.deliverableSegmentId)) {
      issues.push({
        id: `rpti-segment:${r.id}`, severity: 'error', entityType: 'RptiDetail', entityId: r.id,
        entityName: label, message: deletedAnchorRepair(label, [...(r.targetType === 'deliverable' && !targetExists ? ['Deliverable'] : []), ...(!initiativeIds.has(r.initiativeId) ? ['Initiative'] : [])]), location: tab('deliverables'),
      });
    }
  }

  for (const l of lkptiDetails) {
    const deliverable = deliverableById.get(l.targetId);
    const label = deliverable?.name ?? l.targetName ?? l.id;
    if (!deliverableIds.has(l.targetId)) {
      const sameName = l.targetName
        ? deliverables.filter(d => d.name.trim().toLocaleLowerCase() === l.targetName!.trim().toLocaleLowerCase())
        : [];
      if (sameName.length === 1) continue;
      const message = l.targetName
        ? `The filed LKPTI row for "${l.targetName}" no longer resolves to its original application. ${sameName.length > 1 ? 'More than one current Deliverable has that filing name; rename or remove duplicates so exactly one identifies the application.' : 'Create or correct exactly one application with that filing name on the Deliverables tab.'}`
        : `A filed LKPTI row refers to an application that is not recorded, and its application name was not recorded on the old row. Re-import the filing to restore that identity; creating an application cannot safely attach this already-orphaned row.`;
      issues.push({
        id: `lkpti-target:${l.id}`, severity: 'error', entityType: 'LkptiDetail', entityId: l.id,
        entityName: label, message, location: tab('deliverables'),
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
        entityName: label, message: `"${label}" is missing: ${missing.join(', ')}. These are recorded on the application itself (ADR-0013), on the Deliverables tab.`, location: tab('deliverables'),
      });
    }
  }

  const RPTI_MANUAL_ONLY_FIELDS: { key: keyof RptiDetail; label: string }[] = [
    { key: 'categoryCode', label: 'Category' },
    { key: 'developer', label: 'Developer' },
    { key: 'ppjtiRelatedParty', label: 'Provider Related Party' },
  ];
  for (const r of rptiDetails) {
    const initiative = initiativeById.get(r.initiativeId);
    const label = initiative?.name ?? r.id;
    const missing = RPTI_MANUAL_ONLY_FIELDS.filter(f => !r[f.key]).map(f => f.label);
    if (missing.length > 0) {
      issues.push({
        id: `rpti-incomplete:${r.id}`, severity: 'warning', entityType: 'RptiDetail', entityId: r.id,
        entityName: label, message: `The plan line for "${label}" is missing: ${missing.join(', ')}. These are recorded on the application it targets (ADR-0013), on the Deliverables tab.`, location: tab('deliverables'),
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

  // ── Phase 2: value validity ───────────────────────────────────────────────
  // Every check below is guarded on the value being *present* — an absent value is a
  // completeness gap, already reported above, and must not be reported twice.
  // See requirement-specs/data-completeness-report.md § Phase 2 §6/§6a.

  const LKPTI_NAME_CAP = 100;
  const LKPTI_DESCRIPTION_CAP = 500;

  // The go-live column is dd-mm-yyyy per the LKPTI form. Both machine paths (import via
  // toDdMmYyyy, and suggestGoLiveDate) already emit that shape; the unvalidated entry
  // path is manual typing into DataManager's plain text input.
  const DD_MM_YYYY = /^(\d{2})-(\d{2})-(\d{4})$/;
  const parseDdMmYyyy = (value: string): Date | null => {
    const match = DD_MM_YYYY.exec(value);
    if (!match) return null;
    const [, dd, mm, yyyy] = match;
    const day = Number(dd), month = Number(mm), year = Number(yyyy);
    const date = new Date(year, month - 1, day);
    // Rejects 31-02-2021 and friends: the Date constructor rolls them over silently.
    const isReal = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    return isReal ? date : null;
  };

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const isUntidy = (value: string) => /[\r\n]/.test(value) || value !== value.trim();
  const compose = (city?: string, country?: string) => [city, country].filter(Boolean).join(', ');

  for (const l of lkptiDetails) {
    const deliverable = deliverableById.get(l.targetId);
    const applicationName = deliverable?.name;
    const label = deliverable?.name ?? l.id;
    const entityName = label;
    // Both now land on the Deliverables tab: since ADR-0013 the application owns these
    // values, and since Q5/Q6's read-only revision the LKPTI tab cannot be edited at all,
    // so sending anyone there would name the problem without naming a repair (FR-021a).
    const NAME_TAB = tab('deliverables');
    const ROW_TAB = tab('deliverables');

    if (l.goLiveDate) {
      const parsed = parseDdMmYyyy(l.goLiveDate);
      if (!parsed) {
        validityIssues.push({
          id: `lkpti-golive-invalid:${l.id}`, severity: 'error', entityType: 'LkptiDetail', entityId: l.id,
          entityName, message: `The LKPTI row for "${label}" has a Go-Live Date of "${l.goLiveDate}", which is not a real dd-mm-yyyy date.`,
          location: ROW_TAB,
        });
      } else if (parsed > todayEnd) {
        validityIssues.push({
          id: `lkpti-golive-future:${l.id}`, severity: 'error', entityType: 'LkptiDetail', entityId: l.id,
          entityName, message: `The LKPTI row for "${label}" has a Go-Live Date of "${l.goLiveDate}", which is in the future.`,
          location: ROW_TAB,
        });
      }
    }

    // Caps are measured against the value that actually lands in the spreadsheet cell:
    // applicationName reads Deliverable.name, and dc/drcLocation are the composed
    // "City, Country" strings exportLkptiReportToExcel builds. Capping the parts instead
    // would let a 60-char city plus a 60-char country through as a 122-char cell.
    const capped: { field: string; label: string; value?: string; cap: number; location: HealthIssueLocation }[] = [
      { field: 'applicationName', label: 'Application Name', value: applicationName, cap: LKPTI_NAME_CAP, location: NAME_TAB },
      { field: 'functionDescription', label: 'Function Description', value: l.functionDescription, cap: LKPTI_DESCRIPTION_CAP, location: ROW_TAB },
      { field: 'platform', label: 'Platform', value: l.platform, cap: LKPTI_NAME_CAP, location: ROW_TAB },
      { field: 'database', label: 'Database', value: l.database, cap: LKPTI_NAME_CAP, location: ROW_TAB },
      { field: 'dcLocation', label: 'DC Location', value: compose(l.dcCity, l.dcCountry), cap: LKPTI_NAME_CAP, location: ROW_TAB },
      { field: 'dcProvider', label: 'DC Provider', value: l.dcProvider, cap: LKPTI_NAME_CAP, location: ROW_TAB },
      { field: 'drcLocation', label: 'DRC Location', value: compose(l.drCity, l.drCountry), cap: LKPTI_NAME_CAP, location: ROW_TAB },
      { field: 'drcProvider', label: 'DRC Provider', value: l.drcProvider, cap: LKPTI_NAME_CAP, location: ROW_TAB },
      { field: 'systemOwner', label: 'System Owner', value: l.systemOwner, cap: LKPTI_NAME_CAP, location: ROW_TAB },
      { field: 'developer', label: 'Developer', value: l.developer, cap: LKPTI_NAME_CAP, location: ROW_TAB },
    ];
    for (const c of capped) {
      if (c.value && c.value.length > c.cap) {
        validityIssues.push({
          id: `lkpti-too-long:${l.id}:${c.field}`, severity: 'error', entityType: 'LkptiDetail', entityId: l.id,
          entityName, message: `${c.label} on the LKPTI row for "${label}" is ${c.value.length} characters — the schema caps it at ${c.cap}.`,
          location: c.location,
        });
      }
    }

    // Free-text columns only: the enum-backed ones and goLiveDate have their own checks.
    const freeText: { field: string; label: string; value?: string; location: HealthIssueLocation }[] = [
      { field: 'applicationName', label: 'Application Name', value: applicationName, location: NAME_TAB },
      { field: 'functionDescription', label: 'Function Description', value: l.functionDescription, location: ROW_TAB },
      { field: 'platform', label: 'Platform', value: l.platform, location: ROW_TAB },
      { field: 'database', label: 'Database', value: l.database, location: ROW_TAB },
      { field: 'dcCity', label: 'DC City', value: l.dcCity, location: ROW_TAB },
      { field: 'dcCountry', label: 'DC Country', value: l.dcCountry, location: ROW_TAB },
      { field: 'dcProvider', label: 'DC Provider', value: l.dcProvider, location: ROW_TAB },
      { field: 'drCity', label: 'DRC City', value: l.drCity, location: ROW_TAB },
      { field: 'drCountry', label: 'DRC Country', value: l.drCountry, location: ROW_TAB },
      { field: 'drcProvider', label: 'DRC Provider', value: l.drcProvider, location: ROW_TAB },
      { field: 'systemOwner', label: 'System Owner', value: l.systemOwner, location: ROW_TAB },
      { field: 'developer', label: 'Developer', value: l.developer, location: ROW_TAB },
    ];
    for (const f of freeText) {
      if (f.value && isUntidy(f.value)) {
        validityIssues.push({
          id: `lkpti-untidy-text:${l.id}:${f.field}`, severity: 'warning', entityType: 'LkptiDetail', entityId: l.id,
          entityName, message: `${f.label} on the LKPTI row for "${label}" has a line break or untrimmed whitespace — it exports into a flat table cell.`,
          location: f.location,
        });
      }
    }
  }

  // Duplicate application names, scoped to deliverables that actually export — "unique
  // across the submission" means the rows that file, not every Deliverable in the
  // workspace. Every member of a group is flagged: both records need renaming, and
  // "all but the first" would depend on array order rather than anything the user sees.
  const submittedDeliverables = new Map<string, Deliverable>();
  for (const l of lkptiDetails) {
    const d = deliverableById.get(l.targetId);
    if (d) submittedDeliverables.set(d.id, d);
  }
  const byNameKey = new Map<string, Deliverable[]>();
  for (const d of submittedDeliverables.values()) {
    const key = d.name.trim().toLowerCase();
    if (!key) continue;
    const group = byNameKey.get(key);
    if (group) group.push(d); else byNameKey.set(key, [d]);
  }
  for (const group of byNameKey.values()) {
    if (group.length < 2) continue;
    for (const d of group) {
      const others = group.length - 1;
      validityIssues.push({
        id: `lkpti-duplicate-name:${d.id}`, severity: 'warning', entityType: 'Deliverable', entityId: d.id,
        entityName: d.name,
        message: `"${d.name}" shares its name with ${others} other application${others === 1 ? '' : 's'} in the submission — LKPTI requires it to be unique.`,
        location: tab('deliverables'),
      });
    }
  }

  // Workspace-level, not row-level: no amount of row-by-row fixing helps, because
  // ADR-0006 removed the IDR-equivalent fields the RPTI schema (§10) requires.
  // Uses the synthetic 'Workspace' entity so the list stays uniform and the click
  // still lands where defaultCurrency is edited.
  const currency = timelineSettings.defaultCurrency;
  if (currency && currency !== 'IDR') {
    validityIssues.push({
      id: 'workspace-currency-not-idr', severity: 'warning', entityType: 'Workspace', entityId: 'workspace',
      entityName: 'Workspace settings',
      message: `The workspace currency is ${currency}. RPTI requires IDR-equivalent amounts, and this app reports in a single currency with no per-row conversion, so the export cannot be schema-compliant until the workspace reports in IDR. Change it in the visualiser's display settings.`,
      location: tab('initiatives'),
    });
  }

  const withReports = <T extends { id: string }>(i: T) => ({ ...i, reports: reportsFor(i.id) });
  return [
    ...issues.map(i => ({ ...withReports(i), phase: 'completeness' as const })),
    ...validityIssues.map(i => ({ ...withReports(i), phase: 'validity' as const })),
  ];
}

/**
 * Which return each check bears on, in one table rather than spread across the
 * forty-odd places issues are pushed — the classification is a domain judgement
 * and only reviewable if it can be read in one sitting.
 *
 * Several checks already state their answer in their own message text ("invisible
 * to both RPTI and LKPTI generation", "can never generate an RPTI row", "silently
 * excluded from LKPTI generation"); this makes that queryable instead of prose.
 *
 * The default is deliberately `[]` — affects no filing — because a check that
 * forgot to declare itself should under-claim rather than pad a filing-readiness
 * count with something irrelevant. `dataHealth.test.ts` asserts every check that
 * can actually fire has an entry here, so the default never silently applies to a
 * new one.
 */
const REPORTS_BY_CHECK: Record<string, HealthReport[]> = {
  // Rows of a return, and the things that stop one being generated at all.
  'initiative-budget-divergence': ['rpti'],
  'initiative-rpti-missing-target': ['rpti'],
  'initiative-orphaned-rpti-remarks': ['rpti'],
  'rpti-asset-target': ['rpti'],
  'rpti-incomplete': ['rpti'],
  'rpti-identity-conflict': ['rpti'],
  'rpti-initiative': ['rpti'],
  'rpti-segment': ['rpti'],
  'rpti-target': ['rpti'],
  'deliverable-no-initiative-segment': ['rpti'],
  'workspace-currency-not-idr': ['rpti'],

  'lkpti-incomplete': ['lkpti'],
  'lkpti-target': ['lkpti'],
  'lkpti-golive-future': ['lkpti'],
  'lkpti-golive-invalid': ['lkpti'],
  'lkpti-too-long': ['lkpti'],
  'lkpti-untidy-text': ['lkpti'],
  'lkpti-duplicate-name': ['lkpti'],
  'deliverable-no-live-segment': ['lkpti'],
  'deliverable-no-description': ['lkpti'],

  // Fields both returns carry, so a gap shows up in whichever is filed next.
  'deliverable-no-segments': ['rpti', 'lkpti'],
  'deliverable-no-category': ['rpti', 'lkpti'],
  'deliverable-no-developer': ['rpti', 'lkpti'],
  'deliverable-no-location': ['rpti', 'lkpti'],

  // Broken references and workspace hygiene. Worth fixing, but nothing here
  // changes a cell in a filed return, so they must not inflate a readiness count.
  'asset-category': [],
  'deliverable-asset': [],
  'segment-deliverable': [],
  'segment-initiative': [],
  'segment-status': [],
  'initiative-asset': [],
  'initiative-programme': [],
  'initiative-strategy': [],
  'initiative-owner': [],
  'initiative-resource': [],
  'initiative-no-owner': [],
  'dependency-source': [],
  'dependency-target': [],
  'milestone-asset': [],
  'decision-linked': [],
  'decision-superseded-by': [],
};

/** The check an issue id belongs to: ids are `check:entityId`, or bare for workspace-wide ones. */
export const checkOf = (issueId: string): string => issueId.split(':')[0];

const reportsFor = (issueId: string): HealthReport[] => REPORTS_BY_CHECK[checkOf(issueId)] ?? [];
