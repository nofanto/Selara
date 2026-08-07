# ADR-0003: Add an RPTI report, a typed Application field, and an Initiative→target join

## Status

Accepted

## Context and Problem Statement

`requirement-specs/rpti-schema.md` defines RPTI — Indonesia's OJK-regulated IT Development Plan Report (Format 3.1): an 11-column table (row #, application/infrastructure name, description, banking category code, dev type new/upgrade, developer inhouse/PPJTI, PPJTI related-party status, DC/DR location, planned implementation quarter, capex/opex with currency + IDR-equivalent, remarks). Building this as a Scenia feature surfaced two schema gaps:

1. `Application` is implicitly software-only (`{ id, assetId, name }`), but RPTI needs infrastructure items (data centers, networks, security systems) as first-class rows too. `demoData.ts` already had a concrete example of this strain: `app-gz-iaas` ("Infrastructure as a Service") was an infrastructure concept shoehorned into the software-only `Application` shape.
2. An IT initiative often produces or affects more than one asset/application, but `Initiative.assetId` is a single required field. Timeline row-placement, per-asset conflict detection, and dependency-line position tracking are all structurally keyed to exactly one asset per initiative — confirmed by reading `Timeline.tsx` in detail before deciding.

## Decision Drivers

- Must not require merging `Asset` and `Application`, or making `Initiative.assetId`/`applicationId` arrays — both would ripple through Timeline rendering, conflict detection, and dependency-line position tracking, a much larger and riskier change than RPTI itself needs.
- Must let a decision/report record reference either an Application or a bare Asset, since RPTI's own category list spans both (application categories 01–12/49, infrastructure categories 51–54/99).
- Should reuse existing lifecycle-tracking concepts (`ApplicationSegment`/`ApplicationStatus`) rather than inventing a new one, since they already generalize cleanly (a status is just `{id, name, color}`, no software-specific fields).
- Should let one initiative's budget be split across several report rows without double-counting.

## Considered Options

- Merge `Asset` and `Application` into one polymorphic-typed entity (`type: 'infra' | 'application' | ...`), with `Initiative` gaining multi-target support.
- Add `additionalAssetIds?: string[]` to `Initiative`, alongside its existing single `assetId`.
- Generalize `Application` with a `type` field, and model "initiative touches multiple targets" via a new join-style store (`RptiDetail`) rather than touching `Initiative` at all.

## Decision Outcome

Chosen option: "Generalize `Application` with a `type` field, and use a new join store." Concretely:

- `Application` gains `type?: 'application' | 'infrastructure' | 'document' | 'procedure' | 'other'` (undefined ≡ `'application'`, no migration backfill). Internal names (`Application`, `applicationId`, the `applications` store) are kept as-is — a full rename would have touched ~150 references across 23 files for purely cosmetic benefit.
- A new `rptiDetails` IndexedDB store (schema v15) holds `RptiDetail` records: `{ id, initiativeId, targetType: 'application' | 'asset', targetId, categoryCode, developmentType, developer, ppjtiRelatedParty, location?, capexAmount?, capexCurrency?, capexIdrEquivalent?, opexAmount?, opexCurrency?, opexIdrEquivalent?, plannedImplementationQuarter?, applicationSegmentId?, remarks? }`. One `Initiative` can back multiple `RptiDetail` rows — the multiplicity lives entirely in this join, so `Initiative.assetId` never needed to change.
- `capexAmount`/`opexAmount` default to the linked Initiative's `capex`/`opex` but are overridable per row, so a multi-target initiative can allocate its budget across rows instead of every row repeating the same total. A soft warning (`checkBudgetAllocation` in `src/lib/rpti.ts`) flags when the sum of a given initiative's row-level overrides exceeds its own total.
- `ApplicationSegment` gains `initiativeId?: string` and `ApplicationStatus` gains `isLiveStatus?: boolean`, so an application-target RPTI row's planned implementation quarter can be auto-suggested from the `startDate` of the initiative's lifecycle segment that transitions into a "live" status (`suggestApplicationQuarter` in `src/lib/rpti.ts`). Asset-target rows have no equivalent lifecycle concept, so their quarter is entered manually (with an optional one-time "copy date from Milestone" convenience).
- The RPTI report itself is a new card in the existing Reports section (`src/components/RptiReportView.tsx`), with its own Format 3.1 Excel export (`exportRptiReportToExcel`) distinct from the raw `RptiDetails` backup sheet added to the general workspace export/import round-trip.

### Pros and Cons of the Options

#### Merge Asset/Application, multi-target Initiative

- Good, because it's the most "natural" long-term data model if Scenia later wants infrastructure items to be first-class timeline rows.
- Bad, because it's a rewrite of one of the app's two foundational entities and Timeline's core rendering assumptions — far beyond what RPTI itself requires, and high-risk.

#### `additionalAssetIds?: string[]` on Initiative

- Good, because it's additive and doesn't touch Timeline rendering (only the primary `assetId` is used for row placement).
- Bad, because it still couples "which assets does this initiative affect" to Initiative's own schema, when a dedicated join store achieves the same thing without touching Initiative at all, and generalizes better to Applications too (not just Assets).

#### Typed `Application` + `RptiDetail` join store

- Good, because it needs zero changes to `Initiative`, `Timeline.tsx`'s rendering, conflict detection, or dependency logic — confirmed via direct code reading before deciding.
- Good, because the join naturally supports RPTI's own multiplicity (one initiative, several report rows) without new Initiative-level concepts.
- Bad, because RPTI-specific fields and the general "what does this initiative touch" relationship are combined into one entity rather than split cleanly — acceptable since RPTI is the only current consumer (YAGNI on splitting further; easy to extract later if a second consumer appears).

## Consequences

- IndexedDB schema bumped to version 15 (`rptiDetails` store, `keyPath: 'id'`, no seeding).
- `AppState`, `TemplateAppData`, and `Version.data` (optional field) all carry `rptiDetails`; every `handleUpdate`-style call site in `src/App.tsx` threads it through, following the exact pattern used when `decisions` was added at schema version 14.
- `DataManager.tsx`'s Applications tab gains a Type column; its Initiative/Application/Asset cascade-delete handlers now also cascade-delete affected `RptiDetail` rows.
- `ApplicationSegmentPanel.tsx` gains an optional Initiative picker so `ApplicationSegment.initiativeId` — needed for quarter auto-suggestion — is settable from the UI, not just via Excel import.
- Covered by `e2e/rpti-report.spec.ts` (row creation for both target types, edit/delete, cascade-delete, quarter auto-suggestion end-to-end, Excel export, and an Applications-tab Type-column regression case).
