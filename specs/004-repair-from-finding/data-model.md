# Data Model: Repair an Unresolved Imported RPTI Row from Its Finding

**No stored entity changes.** No field is added, removed or renamed, and no IndexedDB version bump or
ADR is needed (research R12). The feature writes existing fields of existing entities. This document
records **which** fields each path writes, because that is what the tests pin.

## Read, never written

| Entity | Role | Fields read |
|---|---|---|
| `RptiDetail` (the unresolved row) | Evidence (Q12). Frozen in tests. | `id`, `initiativeId`, `targetId` (`rpti-import-unresolved-*`), `deliverableSegmentId` (must be absent), `categoryCode`, `developer`, `ppjtiRelatedParty`, `dcCity`, `dcCountry`, `drCity`, `drCountry`, `plannedImplementationQuarter`, `remarks` |

## Written by option B — "The bank runs it, but the inventory doesn't list it"

| Entity | Operation | Fields |
|---|---|---|
| `AssetCategory` | Created **only if** none has the filed `categoryCode` | `id: rpti-import-cat-<code>`, `name`, `categoryCode`, the same shape the importer creates |
| `Asset` | Created | `id: rpti-repair-asset-<rowId>`, `name` (confirmed), `categoryId`, `maturity: 1` |
| `Deliverable` | Created | `id: rpti-repair-deliv-<rowId>`, `assetId`, `name`, `type: 'application'`, `developer` (`inhouse` or the provider's name), `ppjtiRelatedParty`, `dcCity`/`dcCountry`/`drCity`/`drCountry`, `categoryCode` only when it differs from the Asset Category's code |
| `DeliverableSegment` (prior) | Created | `id: rpti-repair-seg-prior-<rowId>`, `deliverableId`, `startDate: <Y-1>-01-01`, `endDate: openEndedDate(Y)`, `status: <live>`, **no** `initiativeId` |
| `DeliverableSegment` (implementation) | Created | `id: rpti-repair-seg-<rowId>`, `deliverableId`, `startDate`/`endDate` = the filed quarter of year Y, `status: <live>`, `initiativeId`, `capexAmount`, `opexAmount`, `rptiRemarks` |
| `Initiative` | Updated | `assetId` only |
| `DeliverableStatus` | Added **only if** the workspace has no live status | `IN_PRODUCTION_STATUS` (research R4) |

`Y` is the filed year and `<live>` is the workspace's first `isLiveStatus` status.

## Written by option A — "It's this existing entry"

| Entity | Operation | Fields |
|---|---|---|
| `DeliverableSegment` (implementation) | Created | as in B, on the chosen `deliverableId` |
| `DeliverableSegment` (prior) | Created **only if** `hasLiveHistoryBefore(chosen, quarterStart)` is false | as in B |
| `Deliverable` (chosen) | Updated **only** for fields the preparer marked "update" | any of `categoryCode`, `developer`, `ppjtiRelatedParty`, `dcCity`, `dcCountry`, `drCity`, `drCountry`. A `developer` update to a filed `PPJTI` writes the provider's name the preparer typed, never `PPJTI` (FR-006). |
| `Initiative` | Updated | `assetId` = the chosen Deliverable's `assetId` |
| `DeliverableStatus` | as in B | |

## Written by the prior-phase extension (FR-018a)

| Entity | Operation | Fields |
|---|---|---|
| `DeliverableSegment` matching the importer's original shape | Updated | `endDate` = `openEndedDate(Y+1)`, where `Y` is the segment's year |

## Written by the importer (FR-017)

The importer's two synthetic prior phases (research R5) change from `<Y-1>-12-31` to
`openEndedDate(Y)`. They keep their id prefix `rpti-import-seg-prior-*`, so a workspace imported after
this feature never matches FR-018a's "original shape" and never gets the warning.

## Computed, not stored

- **`RepairDraft`** — the form's initial values, each tagged with its source. The sources are
  `stored-row`, `initiative-name`, `initiative-start`, `initiative-budget` and `needs-input`.
- **`RepairCandidate`** — a Deliverable plus its tier: `same-name`, `similar` or `other`.
- **`AttributeDifference`** — `{ field, filed, current }`, computed from what projection would file,
  not from raw fields (research R7).
- **`HealthIssue.action`** — an optional
  `{ kind: 'repair-unresolved-rpti-row'; rowId } | { kind: 'extend-import-prior-phase'; segmentId }`.
  It is recomputed with the issue and never persisted.

## State transitions of the finding

```text
unresolved row ──(B or A confirmed; one handleUpdate)──▶ row reconciles by the initiative's only live implementation ──▶ no finding
      │
      └──(cancel, or a precondition fails on confirm)──▶ unchanged; the finding remains
```
