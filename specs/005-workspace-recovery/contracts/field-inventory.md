# Preservation inventory and equality contract

**Updated:** 2026-09-29. Implements U3 / FR-002–003 / SC-001. Enumerated from [src/types.ts](../../../src/types.ts); future fields require an explicit classification and a failing coverage test before this inventory can be considered current.

## Included fields

All fields below are preserved, including optional values when present. A question mark means absence is allowed and must remain distinguishable from a meaningful empty value. The field types and enums are those declared in the linked source; completeness validation must not add regulatory-readiness conditions. Every entity collection is covered in current state and each Version that contains it. Decision rows cover both the live log and archival snapshot copies, under distinct serialization fields.

| Entity | Fields |
|---|---|
| Strategy | `id`, `name`, `color` |
| Programme | `id`, `name`, `color` |
| AssetCategory | `id`, `name`, `order?`, `categoryCode?`, `dcCity?`, `dcCountry?`, `drCity?`, `drCountry?` |
| Resource | `id`, `name`, `role?` |
| DeliverableStatus | `id`, `name`, `color`, `isLiveStatus?`, `isPreLaunchStatus?` |
| Initiative | `id`, `name`, `programmeId`, `strategyId?`, `assetId`, `startDate`, `endDate`, `capex`, `opex`, `description?`, `isPlaceholder?`, `status?`, `ragStatus?`, `progress?`, `owner?`, `ownerId?`, `resourceIds?` |
| Dependency | `id`, `sourceId`, `targetId`, `type`, `midXOffset?`, `sourceType?`, `targetType?` |
| Milestone | `id`, `assetId`, `date`, `name`, `type` |
| Decision | `id`, `title`, `status`, `supersededBy?`, `createdAt`, `context?`, `consideredOptions?`, `decisionOutcome?`, `consequences?`, `linkedEntityType?`, `linkedEntityId?`, `versionId?` |
| Asset | `id`, `name`, `categoryId`, `maturity?`, `externalId?` |
| Deliverable | `id`, `assetId`, `name`, `type?`, `description?`, `categoryCode?`, `developer?`, `dcCity?`, `dcCountry?`, `drCity?`, `drCountry?`, `platform?`, `database?`, `dcProvider?`, `drcProvider?`, `backupStrategy?`, `systemOwner?`, `ownership?`, `ppjtiRelatedParty?` |
| DeliverableSegment | `id`, `deliverableId`, `title?`, `startDate`, `endDate`, `status`, `initiativeId?`, `capexAmount?`, `opexAmount?`, `rptiRemarks?`, `row?`, `rowSpan?` |
| RptiDetail | `id`, `initiativeId`, `targetType`, `targetId`, `categoryCode?`, `developmentType`, `developer?`, `ppjtiRelatedParty?`, `dcCity?`, `dcCountry?`, `drCity?`, `drCountry?`, `plannedImplementationQuarter?`, `deliverableSegmentId?`, `remarks?` |
| LkptiDetail | `id`, `targetId`, `targetName?`, `categoryCode?`, `developer?`, `dcCity?`, `dcCountry?`, `drCity?`, `drCountry?`, `platform?`, `database?`, `dcProvider?`, `drcProvider?`, `backupStrategy?`, `systemOwner?`, `goLiveDate?`, `ownership?`, `functionDescription?` |
| TimelineSettings | `startDate`, `monthsToShow`, `budgetVisualisation`, `descriptionDisplay`, `emptyRowDisplay`, `snapToPeriod`, `conflictDetection`, `showRelationships`, `columnWidths?`, `collapsedGroups?`, `hasSeenTutorial?`, `columnZoom?`, `sidebarWidth?`, `mobileBucketMode?`, `criticalPath?`, `groupBy?`, `onboardingLkptiYear?`, `onboardingRptiYear?`, `colorBy?`, `showResources?`, `display?`, `templateId?`, `showRptiCatalogue?`, `clusterName?`, `defaultCurrency?` |
| Version | `id`, `name`, `timestamp`, `description?`, `data` |
| Version.data | `assets`, `deliverables`, `deliverableSegments`, `initiatives`, `milestones`, `programmes`, `strategies`, `dependencies`, `assetCategories`, `timelineSettings`, `resources`, `deliverableStatuses?`, `decisions?`, `rptiDetails?`, `lkptiDetails?` |

## Container coverage

The portable current workspace contains assets, deliverables, deliverableSegments, deliverableStatuses, initiatives, milestones, programmes, strategies, dependencies, assetCategories, resources, rptiDetails, lkptiDetails, decisions, timelineSettings and versions. Current collection properties are present, including empty arrays. Historical collection optionality follows Version.data above; format 1 retains presence metadata where missing differs from an explicit empty array.

Version.id/name/timestamp/description and each snapshot's settings are included. Version.data.decisions is preserved as archival content only: restoring a History snapshot still preserves the live log under ADR-0011. Existing unresolved links, including linkedEntityId, supersededBy and Decision.versionId, are retained exactly. Do not regenerate stored report evidence or silently migrate business values in a complete backup restoration.

Nested settings require recursive coverage: columnWidths is a table→column→width map; collapsedGroups and Initiative.resourceIds are arrays of strings. Preserve map keys and values, array elements and their order. IDs containing punctuation/commas, literal encoding prefixes, multiline text, non-ASCII values and long values must exercise actual serialization.

## Equality rules

1. Compare every inventoried scalar, nested value and reference in current state and every snapshot. Do not rely on History's business diff, which intentionally excludes some display/layout fields.
2. Compare top-level entity collections, Versions, and archival decision collections by unique ID, ignoring database retrieval order. Explicit order fields (for example AssetCategory.order and segment row/rowSpan) remain values to compare. Preserve order inside nested arrays.
3. Preserve zero, false, empty string, empty array and empty object distinctly. Optional absent/undefined values both mean unset and may compare as unset; they must never become a stored default or an empty string. Required fields cannot be unset. Null is not a supported value for the declared interfaces; report it before backup instead of silently coercing it.
4. For new-format snapshot collections, absent and explicitly empty remain distinct using presence metadata. Do not materialize optional business settings from the destination. For legacy files, document where the original format already lost optional presence; compare the recognized decoded source, not unknowable historical pre-export data.
5. No unexplained difference is allowed. Loss due to encoding or Excel limits causes a generation error before download. Unsupported present fields/types are reported, never silently discarded; support must be explicitly extended before claiming their preservation.
6. A backup is a coherent committed point in time. A later edit is not part of that backup. Pending failed saves block the operation rather than giving an apparently complete backup of stale persisted data.

## Exclusions

- Undo/Redo stacks, open dialogs, search/filter focus, current navigation tab and other transient React state.
- localStorage landing-page dismissal, E2E flags, last backup download-start timestamp and other browser-only operational preferences.
- TimeColumn, an ephemeral rendering interface; generated diagrams, formatted report files and externally submitted files.
- Future M4 filing metadata until its schema and preservation tests are added; this does not permit discarding unknown fields in a future-format file.

Persisted TimelineSettings fields such as hasSeenTutorial remain included even if they influence UI. The exclusions above must not be used to drop inventoried settings.

## Required fixtures and assertions

- Every interface/member above classified and exercised by field-aware coverage; adding a member makes the coverage test fail until handled.
- One populated field-complete current workspace and at least two snapshots with distinct values, including archival decision copies and live decision/version links.
- Optional fields absent and present; zero/false/empty variants; all supported nested containers; current/snapshot ID reuse; deliberately unresolved business links.
- Empty workspace, History-only state, decisions-only state and source-profile deletion followed by restoration of the real downloaded file.
- Actual workbook→XLSX bytes→decoded workbook comparison, including text beginning with the encoding marker, comma-bearing resource IDs, and unrepresentable values causing visible failure.
- A fixture matrix for all accepted/rejected workbook cases; legacy repaired files use ordinary Import and their documented comparison rules.
