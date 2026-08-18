/**
 * @license
 * Apache License 2.0
 */

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

/**
 * Represents a high-level strategic goal.
 * Used for categorising and colouring initiatives.
 */
export interface Strategy {
  id: string;
  name: string;
  color: string; // Tailwind color class or hex string
}

/**
 * Represents a delivery programme that groups multiple initiatives.
 */
export interface Programme {
  id: string;
  name: string;
  color: string; // Tailwind color class or hex string
}

/**
 * High-level grouping for IT Assets (e.g., "Infrastructure", "Deliverables").
 */
export interface AssetCategory {
  id: string;
  name: string;
  order?: number; // Optional sort order for the categories
  categoryCode?: RptiCategoryCode; // Default RPTI category for deliverables in this category; a Deliverable's own categoryCode overrides it
  dcCity?: string;   // Default RPTI data center location; a Deliverable's own dcCity/dcCountry overrides it, per field
  dcCountry?: string;
  drCity?: string;   // Default RPTI disaster recovery center location; a Deliverable's own drCity/drCountry overrides it, per field
  drCountry?: string;
}

/**
 * A person or generic role that can be assigned to initiatives.
 */
export interface Resource {
  id: string;
  name: string;  // Person name or generic role, e.g. "Jane Smith" or "Business Analyst"
  role?: string; // Optional job title / role label
}

/**
 * A named, coloured status that can be applied to an DeliverableSegment.
 */
export interface DeliverableStatus {
  id: string;
  name: string;
  color: string;
  isLiveStatus?: boolean; // Marks this status as "live/in production" — used to auto-derive RPTI planned implementation quarter
  isPreLaunchStatus?: boolean; // Marks this status as "planned/funded" pre-launch work — RPTI generation's allow-list, see requirement-specs/rpti-auto-generation.md
}

/**
 * The core entity representing a specific project or piece of work.
 */
export interface Initiative {
  id: string;
  name: string;
  programmeId: string;
  strategyId?: string;
  assetId: string;
  deliverableId?: string; // Optional: links the initiative to a specific deliverable within the asset
  startDate: string; // ISO format: YYYY-MM-DD
  endDate: string;   // ISO format: YYYY-MM-DD
  capex: number;     // Capital expenditure
  opex: number;      // Operational expenditure
  description?: string;
  isPlaceholder?: boolean;
  status?: 'planned' | 'active' | 'done' | 'cancelled';
  ragStatus?: 'green' | 'amber' | 'red';
  progress?: number; // 0–100
  owner?: string;    // Legacy free-text owner (used as fallback when ownerId is absent)
  ownerId?: string;  // ID of a Resource record
  resourceIds?: string[]; // IDs of additionally assigned resources
}

/**
 * Defines a directed relationship between two initiatives.
 */
export interface Dependency {
  id: string;
  sourceId: string; // The ID of the initiative, milestone, or deliverable segment that has the dependency
  targetId: string; // The ID of the initiative or deliverable segment being depended upon
  type: 'blocks' | 'requires' | 'related';
  midXOffset?: number; // Manual horizontal offset for the vertical segment of the arrow
  sourceType?: 'initiative' | 'milestone' | 'segment'; // Defaults to 'initiative' when absent
  targetType?: 'initiative' | 'segment'; // Defaults to 'initiative' when absent
}

/**
 * Significant point in time for a specific Asset.
 */
export interface Milestone {
  id: string;
  assetId: string;
  date: string; // ISO format: YYYY-MM-DD
  name: string;
  type: 'info' | 'warning' | 'critical';
}

export type DecisionStatus = 'proposed' | 'accepted' | 'deprecated' | 'superseded';

/**
 * A portfolio decision record (MADR-style) — captures why a decision was
 * made about an initiative, programme, or asset. Stored in the decisions
 * IndexedDB store, independent of the git-tracked docs/adr/ engineering log.
 */
export interface Decision {
  id: string;
  title: string;
  status: DecisionStatus;
  supersededBy?: string; // Decision.id, set when status === 'superseded'
  createdAt: string; // ISO datetime, same convention as Version.timestamp
  context?: string;
  consideredOptions?: string; // free text, one option per line
  decisionOutcome?: string;
  consequences?: string;
  linkedEntityType?: 'initiative' | 'programme' | 'asset';
  linkedEntityId?: string;
}

/**
 * Represents a specific system, team, or resource area.
 */
export interface Asset {
  id: string;
  name: string;
  categoryId: string;
  maturity?: number; // 1–5: Emergent → Optimised. Omitted means unrated.
  externalId?: string; // Stable external identifier — used for idempotent re-import and catalogue dedup
}

export type DeliverableType = 'application' | 'infrastructure' | 'document' | 'procedure' | 'other';

/**
 * An application, infrastructure item, document, or other deliverable that makes up an IT asset.
 */
export interface Deliverable {
  id: string;
  assetId: string;
  name: string;
  type?: DeliverableType; // Undefined is treated as 'application' (legacy records predate this field)
  description?: string; // What this deliverable does — no category-level default; cascades into LkptiDetail.functionDescription
  categoryCode?: RptiCategoryCode; // Overrides the parent AssetCategory's default RPTI category when set
  developer?: RptiDeveloper; // No category-level default — varies too much within one architectural category to make one trustworthy
  dcCity?: string;   // Overrides the parent AssetCategory's default RPTI data center location when set, per field
  dcCountry?: string;
  drCity?: string;   // Overrides the parent AssetCategory's default RPTI disaster recovery center location when set, per field
  drCountry?: string;
}

/**
 * A time-bounded lifecycle phase for a Deliverable.
 * A deliverable may have many segments representing its progression
 * through planned → in-production → sunset → retired etc.
 */
export interface DeliverableSegment {
  id: string;
  deliverableId: string; // Links segment to a Deliverable record within the asset
  startDate: string; // ISO format: YYYY-MM-DD
  endDate: string;   // ISO format: YYYY-MM-DD
  status: string;
  initiativeId?: string; // Optionally attributes this lifecycle phase to the Initiative driving it
  row?: number;      // Which row within the swimlane (0-indexed). Auto-assigned if absent.
  rowSpan?: number;  // How many rows tall this segment is (default 1). Controlled by bottom-edge drag.
}

export type RptiTargetType = 'deliverable' | 'asset';
export type RptiDevelopmentType = 'new' | 'upgrade';
export type RptiDeveloper = 'inhouse' | 'PPJTI';
export type RptiRelatedParty = 'yes' | 'no' | 'n/a';
export type RptiQuarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';
export type RptiCategoryCode =
  | '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12'
  | '49' | '51' | '52' | '53' | '54' | '99';

/**
 * One row of the RPTI (IT Development Plan Report) regulatory report — an
 * Initiative's planned development activity on a specific Deliverable or
 * Asset. One Initiative may back multiple RptiDetail rows, one per affected
 * target, without changing Initiative's own single-asset targeting.
 */
export interface RptiDetail {
  id: string;
  initiativeId: string;
  targetType: RptiTargetType;
  targetId: string; // Deliverable.id or Asset.id, per targetType
  categoryCode?: RptiCategoryCode; // Regulatory classification — no auto-fill source, always set manually
  developmentType: RptiDevelopmentType;
  developer?: RptiDeveloper; // No auto-fill source, always set manually
  ppjtiRelatedParty?: RptiRelatedParty; // No auto-fill source, always set manually
  dcCity?: string;
  dcCountry?: string;
  drCity?: string;
  drCountry?: string;
  capexAmount?: number; // Defaults to the linked Initiative's capex when unset. Always in TimelineSettings.defaultCurrency — this app reports in a single workspace-wide currency, no per-row conversion.
  opexAmount?: number; // Defaults to the linked Initiative's opex when unset. Always in TimelineSettings.defaultCurrency, same as capexAmount.
  plannedImplementationQuarter?: RptiQuarter;
  deliverableSegmentId?: string; // Set when the quarter is auto-derived (targetType 'deliverable' only)
  remarks?: string;
}

// LKPTI 3.2.6's own category_code enum excludes RPTI's infrastructure-only codes
// (51-54, 99) — Daftar Aplikasi is application-only. See requirement-specs/lkpti-schema.md §2.
export type LkptiCategoryCode = Exclude<RptiCategoryCode, '51' | '52' | '53' | '54' | '99'>;
export type LkptiBackupStrategy = 'HA_ACTIVE_ACTIVE' | 'HA_ACTIVE_PASSIVE' | 'BACKUP_REALTIME' | 'BACKUP_PERIODIC';
export type LkptiOwnership = 'LEASE' | 'OUTRIGHT_PURCHASE';

/**
 * One row of the LKPTI Format 3.2.6 (Daftar Aplikasi / Application List) regulatory
 * report — an inventory entry for a single live Deliverable. Unlike RptiDetail, this
 * isn't tied to an Initiative or a report year — it's a point-in-time snapshot of
 * applications currently in production. See requirement-specs/lkpti-integration.md.
 */
export interface LkptiDetail {
  id: string;
  targetId: string; // Deliverable.id — LKPTI 3.2.6 is scoped to applications only, unlike RptiDetail which also targets bare Assets
  categoryCode?: LkptiCategoryCode; // Cascades: this row's value ?? Deliverable.categoryCode ?? AssetCategory.categoryCode, narrowed to application-eligible codes
  developer?: string; // 'inhouse', or the IT service provider's name — free text per the LKPTI form (unlike RptiDetail.developer's two-value enum, which only marks *that* it's third-party, not who). Auto-suggested as 'inhouse' when Deliverable.developer === 'inhouse'; left blank for manual entry (the provider name) otherwise.
  dcCity?: string;   // Cascades: this row's value ?? Deliverable.dcCity ?? AssetCategory.dcCity
  dcCountry?: string;
  drCity?: string;   // Cascades: this row's value ?? Deliverable.drCity ?? AssetCategory.drCity
  drCountry?: string;
  // No auto-fill source — always manual entry:
  platform?: string;
  database?: string;
  dcProvider?: string;  // company name, or 'self'
  drcProvider?: string; // company name, or 'self'
  backupStrategy?: LkptiBackupStrategy;
  systemOwner?: string;
  goLiveDate?: string; // dd-mm-yyyy per the LKPTI form; auto-suggested via suggestGoLiveDate() but not written automatically
  ownership?: LkptiOwnership;
  functionDescription?: string;
}

/**
 * Internal type used for rendering the timeline grid columns.
 */
export interface TimeColumn {
  date: Date;
  label: string;
  year: number;
  quarter: number;
}

/**
 * Global UI and rendering configuration.
 */
export interface TimelineSettings {
  startDate: string; // YYYY-MM-DD
  monthsToShow: 3 | 6 | 12 | 24 | 36;
  budgetVisualisation: 'label' | 'bar-height' | 'off';
  descriptionDisplay: 'on' | 'off';
  emptyRowDisplay: 'show' | 'hide';
  snapToPeriod: 'off' | 'month';
  conflictDetection: 'on' | 'off';
  showRelationships: 'on' | 'off';
  columnWidths?: Record<string, Record<string, string>>;
  collapsedGroups?: string[];
  hasSeenTutorial?: boolean;
  columnZoom?: number; // Multiplier for minimum column width (0.5–3.0, default 1.0)
  sidebarWidth?: number; // Width of the sticky asset/programme sidebar in pixels
  mobileBucketMode?: 'timeline' | 'quarter' | 'year' | 'programme' | 'strategy';
  criticalPath?: 'on' | 'off';
  groupBy?: 'asset' | 'programme' | 'strategy';
  colorBy?: 'programme' | 'strategy' | 'status' | 'rag';
  showResources?: 'on' | 'off';
  display?: 'both' | 'initiatives' | 'deliverables';
  templateId?: string;           // Which workspace template was selected on first load
  showRptiCatalogue?: boolean;   // When false, the RPTI asset catalogue section is hidden (default: true)
  clusterName?: string;          // Agency cluster name — shown in the timeline header
  defaultCurrency?: string;      // Single workspace-wide currency for RptiDetail.capexAmount/opexAmount, e.g. 'USD', 'IDR'
}

/**
 * A persistent snapshot of the entire application state.
 */
export interface Version {
  id: string;
  name: string;
  timestamp: string; // ISO string
  description?: string;
  data: {
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
    deliverableStatuses?: DeliverableStatus[];
    decisions?: Decision[];
    rptiDetails?: RptiDetail[];
    lkptiDetails?: LkptiDetail[];
  };
}
