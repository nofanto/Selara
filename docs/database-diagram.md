# Database Diagram

Scenia persists all application data client-side in **IndexedDB**, accessed via the `idb` library. The database is defined in a single location: [`src/lib/db.ts`](../src/lib/db.ts).

- **Database name:** `it-initiative-visualiser`
- **Current schema version:** `16`
- **Object stores:** 15 (all key-path stores except `settings`, which uses an explicit out-of-line key)
- **Indexes:** none — all lookups are done via `getAll()` with in-memory filtering/joining on foreign-key-like fields (there is no `createIndex` usage anywhere in the codebase)

## Entity-Relationship Diagram

```mermaid
erDiagram
    STRATEGY {
        string id PK
        string name
        string color
    }

    PROGRAMME {
        string id PK
        string name
        string color
    }

    ASSET_CATEGORY {
        string id PK
        string name
        int order
    }

    ASSET {
        string id PK
        string categoryId FK
        string name
        int maturity
        string alias
        string externalId
    }

    APPLICATION {
        string id PK
        string assetId FK
        string name
        string type "deliverable kind: application/infrastructure/document/procedure/other; undefined treated as 'application'"
    }

    APPLICATION_SEGMENT {
        string id PK
        string applicationId FK
        date startDate
        date endDate
        string status
        string initiativeId FK "optional; attributes this lifecycle phase to the driving Initiative"
        int row
        int rowSpan
    }

    APPLICATION_STATUS {
        string id PK
        string name
        string color
        boolean isLiveStatus "marks this status as live/in-production"
    }

    RESOURCE {
        string id PK
        string name
        string role
    }

    INITIATIVE {
        string id PK
        string name
        string programmeId FK
        string strategyId FK
        string assetId FK
        string applicationId FK
        string ownerId FK
        string_array resourceIds FK
        date startDate
        date endDate
        number capex
        number opex
        string description
        boolean isPlaceholder
        string status
        string ragStatus
        number progress
        string owner
    }

    MILESTONE {
        string id PK
        string assetId FK
        date date
        string name
        string type
    }

    DEPENDENCY {
        string id PK
        string sourceId FK
        string targetId FK
        string sourceType
        string targetType
        string type
        number midXOffset
    }

    DECISION {
        string id PK
        string title
        string status
        string supersededBy FK
        datetime createdAt
        string context
        string consideredOptions
        string decisionOutcome
        string consequences
        string linkedEntityType
        string linkedEntityId FK
    }

    RPTI_DETAIL {
        string id PK
        string initiativeId FK
        string targetType "'application' or 'asset'"
        string targetId FK "polymorphic; Application.id or Asset.id per targetType"
        string categoryCode
        string developmentType "'new' or 'upgrade'"
        string developer "'inhouse' or 'PPJTI'"
        string ppjtiRelatedParty "'yes'/'no'/'n/a'"
        string dcCity
        string dcCountry
        string drCity
        string drCountry
        number capexAmount
        string capexCurrency
        number capexIdrEquivalent
        number opexAmount
        string opexCurrency
        number opexIdrEquivalent
        string plannedImplementationQuarter
        string applicationSegmentId FK "optional; set when quarter is auto-derived"
        string remarks
    }

    VERSION {
        string id PK
        string name
        datetime timestamp
        string description
        object data "denormalized snapshot of all stores"
    }

    SETTINGS {
        string key PK "literal 'timelineSettings'"
        date startDate
        int monthsToShow
        string budgetVisualisation
        string descriptionDisplay
        string emptyRowDisplay
        string snapToPeriod
        string conflictDetection
        string showRelationships
        object columnWidths "optional; per-table column widths"
        string_array collapsedGroups "optional"
        boolean hasSeenTutorial "optional"
        number columnZoom "optional; 0.5-3.0 multiplier"
        int sidebarWidth "optional; pixels"
        string mobileBucketMode "optional"
        string criticalPath "optional"
        string groupBy "optional"
        string colorBy "optional"
        string showResources "optional"
        string display "optional; 'both'/'initiatives'/'applications'"
        string templateId "optional; which workspace template was chosen"
        boolean showGeanzCatalogue "optional, default true"
        string clusterName "optional"
    }

    ASSET_CATEGORY ||--o{ ASSET : "categorizes"
    ASSET ||--o{ APPLICATION : "hosts"
    APPLICATION ||--o{ APPLICATION_SEGMENT : "has timeline segments"
    APPLICATION_STATUS ||--o{ APPLICATION_SEGMENT : "status of (by id, unenforced)"
    INITIATIVE |o--o{ APPLICATION_SEGMENT : "drives lifecycle phase (optional)"
    ASSET ||--o{ MILESTONE : "has"

    PROGRAMME ||--o{ INITIATIVE : "groups"
    STRATEGY |o--o{ INITIATIVE : "aligns (optional)"
    ASSET ||--o{ INITIATIVE : "targets"
    APPLICATION |o--o{ INITIATIVE : "targets (optional)"
    RESOURCE |o--o{ INITIATIVE : "owns (optional)"
    RESOURCE }o--o{ INITIATIVE : "assigned to (many-to-many)"

    INITIATIVE }o--o{ DEPENDENCY : "polymorphic source/target"
    MILESTONE }o--o{ DEPENDENCY : "polymorphic source/target"
    APPLICATION_SEGMENT }o--o{ DEPENDENCY : "polymorphic source/target"

    INITIATIVE |o..o{ DECISION : "polymorphic link (optional)"
    PROGRAMME |o..o{ DECISION : "polymorphic link (optional)"
    ASSET |o..o{ DECISION : "polymorphic link (optional)"
    DECISION |o--o| DECISION : "superseded by (optional)"

    INITIATIVE ||--o{ RPTI_DETAIL : "backs (one initiative, many report rows)"
    APPLICATION }o--o| RPTI_DETAIL : "polymorphic target"
    ASSET }o--o| RPTI_DETAIL : "polymorphic target"
    APPLICATION_SEGMENT |o..o{ RPTI_DETAIL : "auto-derives planned quarter (optional)"

    VERSION }o..o{ ASSET : "snapshot copy"
    VERSION }o..o{ INITIATIVE : "snapshot copy"
    VERSION }o..o{ APPLICATION : "snapshot copy"
    VERSION }o..o{ DECISION : "snapshot copy"
    VERSION }o..o{ RPTI_DETAIL : "snapshot copy"
```

## Object Stores

| Store | Key path | Value type | Introduced |
|---|---|---|---|
| `assets` | `id` | `Asset` | v1 |
| `initiatives` | `id` | `Initiative` | v2 |
| `milestones` | `id` | `Milestone` | v3 |
| `programmes` | `id` | `Programme` | v4 |
| `strategies` | `id` | `Strategy` | v4 |
| `dependencies` | `id` | `Dependency` | v4 |
| `assetCategories` | `id` | `AssetCategory` | v4 |
| `settings` | *(out-of-line)* | `TimelineSettings` | v5 — single record, explicit key `'timelineSettings'` |
| `versions` | `id` | `Version` | v6 |
| `resources` | `id` | `Resource` | v7 |
| `applications` | `id` | `Application` | v8 |
| `applicationSegments` | `id` | `ApplicationSegment` | v9 |
| `applicationStatuses` | `id` | `ApplicationStatus` | v10 |
| `dtsPhases` | `id` | `DtsPhaseRecord` | v13 — orphaned; see Migration Notes |
| `decisions` | `id` | `Decision` | v14 |
| `rptiDetails` | `id` | `RptiDetail` | v15 |

## Relationships

Since IndexedDB has no native foreign-key enforcement, all relationships below are informal — fields that hold the `id` of a record in another store, resolved in application code:

- `Asset.categoryId` → `AssetCategory.id`
- `Application.assetId` → `Asset.id`
- `ApplicationSegment.applicationId` → `Application.id`
- `ApplicationSegment.status` → conceptually maps to `ApplicationStatus.name`/`id`, but stored as a free string (not enforced)
- `Initiative.programmeId` → `Programme.id`
- `Initiative.strategyId` (optional) → `Strategy.id`
- `Initiative.assetId` → `Asset.id`
- `Initiative.applicationId` (optional) → `Application.id`
- `Initiative.ownerId` (optional) → `Resource.id`
- `Initiative.resourceIds` (optional array) → `Resource.id[]` (many-to-many)
- `Milestone.assetId` → `Asset.id`
- `Dependency.sourceId` / `Dependency.targetId` → polymorphic; resolved via `sourceType`/`targetType` (`'initiative' | 'milestone' | 'segment'`) to `Initiative.id`, `Milestone.id`, or `ApplicationSegment.id`
- `Decision.linkedEntityId` (optional) → polymorphic; resolved via `linkedEntityType` (`'initiative' | 'programme' | 'asset'`) to `Initiative.id`, `Programme.id`, or `Asset.id`. Unlike `Dependency`, a decision links to at most one item.
- `Decision.supersededBy` (optional) → `Decision.id` — set when a later decision replaces this one.
- `RptiDetail.initiativeId` → `Initiative.id`
- `RptiDetail.targetId` (with `targetType: 'application' | 'asset'`) → polymorphic; resolved to `Application.id` or `Asset.id`. In Data Manager, `targetType` is not directly editable — it's re-derived automatically from whichever list (`applications` or `assets`) the current `targetId` is found in, so the two fields can never fall out of sync via inline editing.
- `RptiDetail.applicationSegmentId` (optional) → `ApplicationSegment.id` — set when the row's quarter was auto-derived from a lifecycle segment at export time (see [ADR-0005](adr/0005-rpti-data-manager-tab.md)).
- `Version.data` embeds a denormalized, point-in-time snapshot of every other store (assets, applications, applicationSegments, initiatives, milestones, programmes, strategies, dependencies, assetCategories, timelineSettings, resources, applicationStatuses, decisions, rptiDetails) — this is how backup/restore and version history are implemented. `dtsPhases` is not included — it was dropped from `Version.data` when DTS was removed (see Migration Notes). The `versions` store itself is not part of the regular `getAppData`/`saveAppData` load-save cycle; it's managed separately via `saveVersion`/`getAllVersions`/`deleteVersion`.

## Migration Notes

Schema evolution is handled in the `upgrade()` callback of `openDB<ITMapDB>()` in `src/lib/db.ts`. Notable non-additive migrations:

- **v11:** Legacy `ApplicationSegment` records that carried `assetId` + `label` fields were rewritten into proper `Application` records with `applicationId`, and the old fields were dropped.
- **v12:** `Initiative.budget` (single field) was split into separate `capex` and `opex` fields, defaulting `opex` to `0`.
- **v13:** Added the `dtsPhases` store and seeded 5 default `DtsPhaseRecord`s (`phase-1`, `phase-2`, `phase-3`, `back-office`, `not-dts`) for workspaces that already contained assets whose `alias` starts with `"DTS."`. **This store is now orphaned:** the DTS workspace feature was removed (see [ADR-0004](adr/0004-remove-dts.md)), and all application code that read or wrote `dtsPhases` was deleted along with it. Per this app's additive-only migration history, the store's creation logic was simply not carried forward for new databases — no `deleteObjectStore` was called, so any database that already reached v13+ keeps its (now-inert) `dtsPhases` store forever. `DB_VERSION` was not bumped for this removal.
- **v14:** Added the `decisions` store (no seeding — always empty on creation) to support the in-app portfolio decision log. See [ADR-0002](adr/0002-in-app-decision-log.md).
- **v15:** Added the `rptiDetails` store (no seeding) and a `type` field on `Application`, to support the RPTI regulatory report. See [ADR-0003](adr/0003-rpti-report-and-application-type.md).
- **v16:** Flattened `RptiDetail.location` (a nested `{ dataCenter: {city, country}, disasterRecoveryCenter: {city, country} }` object) into four top-level fields — `dcCity`, `dcCountry`, `drCity`, `drCountry` — so the field could be edited inline in Data Manager, whose `EditableTable` component only supports flat columns. Existing `rptiDetails` records with a `location` value are rewritten in place: their nested fields are copied to the new top-level fields and `location` is removed. See [ADR-0005](adr/0005-rpti-data-manager-tab.md).

## Source of Truth

All database access is centralized in [`src/lib/db.ts`](../src/lib/db.ts); entity type definitions live in [`src/types.ts`](../src/types.ts). No other file in the codebase touches IndexedDB directly — consumers use the exported helpers (`initDB`, `getAppData`, `saveAppData`, `saveVersion`, `getAllVersions`, `deleteVersion`).

---

## Workspace Templates

On first load (or when re-opened from Data Manager's "change template" action), an empty workspace is offered a choice of **starter templates** via `TemplatePickerModal` (`src/components/TemplatePickerModal.tsx`). The selection is handled by `getTemplateData(templateId, withDemoData)` in [`src/lib/workspaceTemplates.ts`](../src/lib/workspaceTemplates.ts), which assembles a full `TemplateAppData` payload that is written into every IndexedDB store via `saveAppData`. `TimelineSettings.templateId` records which template was chosen (informational only).

There are three templates:

| id | Name | Demo-data toggle? | Source data |
|---|---|---|---|
| `geanz` | GEANZ Technology Catalogue | Yes | [`src/demoData.ts`](../src/demoData.ts) |
| `viewer` | Viewer (upload & view a file) | No | none — empty shell, populated later from an imported Excel file |
| `blank` | Blank | No | none — empty shell |

Each template exercises a different *subset* of the schema described above. The diagrams below show, per template, exactly which stores get populated and which relationships are actually exercised — as opposed to the full schema diagram, which shows everything the app is *capable* of storing.

No template pre-seeds `decisions` or `rptiDetails` — every template (`geanz`, `viewer`, `blank`, with or without demo data) sets both to `[]`. Decisions and RPTI report rows are user-authored records added after the workspace is set up, so they're omitted from the per-template diagrams below.

### `geanz` — GEANZ Technology Catalogue (with demo data)

```mermaid
erDiagram
    ASSET_CATEGORY {
        int count "6"
    }
    ASSET {
        int count "42"
        string breakdown "16 banking + 26 GEANZ/TAP-catalogue"
    }
    PROGRAMME {
        int count "6"
    }
    STRATEGY {
        int count "6"
    }
    RESOURCE {
        int count "6"
    }
    APPLICATION_STATUS {
        int count "6"
    }
    APPLICATION {
        int count "17"
        string breakdown "8 banking + 9 GEANZ"
    }
    APPLICATION_SEGMENT {
        int count "35"
    }
    INITIATIVE {
        int count "48"
        string breakdown "incl. 1 isPlaceholder record"
        string ownerId "set on 47 of 48"
        string_array resourceIds "set on 27 of 48"
    }
    MILESTONE {
        int count "14"
        string breakdown "8 banking + 6 GEANZ"
    }
    DEPENDENCY {
        int count "9"
        string breakdown "all initiative-to-initiative (blocks/requires)"
    }

    ASSET_CATEGORY ||--o{ ASSET : categorizes
    ASSET ||--o{ APPLICATION : hosts
    APPLICATION ||--o{ APPLICATION_SEGMENT : "has segments"
    APPLICATION_STATUS ||--o{ APPLICATION_SEGMENT : "status of"
    ASSET ||--o{ MILESTONE : has
    PROGRAMME ||--o{ INITIATIVE : groups
    STRATEGY |o--o{ INITIATIVE : aligns
    ASSET ||--o{ INITIATIVE : targets
    RESOURCE |o--o{ INITIATIVE : owns
    RESOURCE }o--o{ INITIATIVE : "assigned to"
    INITIATIVE }o--o{ DEPENDENCY : "source/target"
```

`timelineSettings.showGeanzCatalogue` is `true` in this template, which lets the user browse and add from the live 17-area / 140-asset-type GEANZ taxonomy in [`src/lib/geanzCatalogue.ts`](../src/lib/geanzCatalogue.ts) — that catalogue is rendered directly by the Timeline UI and is **not** seeded into IndexedDB.

### `geanz` — without demo data

Selecting `geanz` with the demo-data toggle off still seeds the lookup/config stores (categories, assets, programmes, strategies, statuses) but leaves all relationship-bearing record stores empty for the user to fill in:

| Store | Count |
|---|---|
| `assetCategories` | 6 |
| `assets` | 42 |
| `programmes` | 6 |
| `strategies` | 6 |
| `applicationStatuses` | 6 |
| `initiatives` | 0 |
| `milestones` | 0 |
| `applications` | 0 |
| `applicationSegments` | 0 |
| `dependencies` | 0 |
| `resources` | 0 |

### `viewer` and `blank` — empty shells

```mermaid
erDiagram
    ALL_STORES {
        int count "0"
        string note "every store empty on creation"
    }
```

Both templates produce an identical, fully-empty `TemplateAppData` payload — no categories, assets, programmes, strategies, or statuses are pre-seeded. They differ only in what happens next:

- **`blank`** stays empty; the user builds the workspace manually from the UI.
- **`viewer`** is immediately followed by an Excel-file import (`handleViewerImport` in `src/App.tsx`), which parses the uploaded file into the same entity shape and populates the stores from that external source rather than from `getTemplateData`.
