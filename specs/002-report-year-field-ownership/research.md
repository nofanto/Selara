# Phase 0 Research: Report Year and Report-Row Field Ownership

Every finding below was measured against the working tree, not inferred. Line references are
as at 2026-09-18.

## R1 — Where the report year lives

**Decision**: Nowhere. It is a parameter of generating a return, asked in the Reports menu each
time, and stamped onto the produced return for display and export only.

**Rationale**: Settled with the product owner. Generation becomes the inverse of import —
`import(file, year) → workspace` and `generate(workspace, year) → return` — so the workspace
holds the portfolio and a year is a question asked of it, never a property stored on a row.

**Alternatives rejected**: a field on each `RptiDetail` (self-describing rows, but duplicates
the year and makes hand-created rows need one assigned); a workspace-level setting (one year
only, so filing 2028 would destroy the 2027 record); a first-class filing entity (the correct
destination, but it is the unbuilt filing feature and out of scope here).

## R2 — LKPTI's as-at year forces a correctness fix

**Decision**: `generateLkptiDetails` gains an as-at date and selects applications whose live
segment **spans** it, replacing the current "started before today" test.

**Rationale**: FR-009a asks for applications live *as at 31 December* of a stated year. The
current test is `seg.startDate <= today` (`lkpti.ts:90-94`) with **no upper bound at all** —
`lkpti.ts` contains no reference to a segment's `endDate`.

Measured: an application live 2021-06 to 2025-06 and **Retired** from 2025 still appears in a
LKPTI generated today. That contradicts the product owner's earlier ruling that decommissioned
applications are not in the report, and it is a live defect independent of this feature.

Changing `startDate <= asAt` to `startDate <= asAt && endDate >= asAt` satisfies FR-009a and
fixes the defect in the same expression. Doing only the first half would keep asking for a year
while still answering with "everything that ever went live", which is worse than not asking.

**Alternatives rejected**: keep `today` and treat the year as a label (FR-009a explicitly wants
the year to change which applications qualify, or it is not worth asking for); filter
retired applications by status name (brittle, and `classifySegmentKind`'s allow-list already
exists for exactly this reason — see ADR-0009).

**Flagged**: this changes output for existing workspaces. An application whose live segment has
ended will drop out of the generated LKPTI. That is the correct answer and the previously
intended one, but it is a behaviour change and must be called out in the release, not shipped
quietly.

## R3 — Cost of extending an entity versus adding a store

**Decision**: Extend `Deliverable` and `Initiative`. No new store.

**Rationale**: Measured reference counts for the comparable existing store: `App.tsx` holds
**73** references to `lkptiDetails`, because `AppState` is enumerated at every call site rather
than spread. A new store would need a schema bump, a migration, an `excel.ts` sheet, a
`compareEntities` block, dangling-reference checks, a Data Manager tab, and those 73 sites.

Extending an existing entity costs nothing in `excel.ts` (`flatten()`/`json_to_sheet` are
generic — proven by `src/lib/segmentTitle.test.ts`), nothing in `db.ts` (IndexedDB is schemaless
within a store, so no version bump), and nothing in `App.tsx` (`Deliverable` already flows
everywhere).

## R4 — New fields are invisible to version history until named

**Decision**: Every field added by this feature gets an explicit line in its entity's
`getChanges` callback in `diff.ts`.

**Rationale**: `compareEntities` is generic over *entities*, not over their *fields*. Proven
this month: renaming a `DeliverableSegment.title` produced `added: [], removed: [], modified: []`
— a completely empty diff. Tracked as [#42](https://github.com/nofanto/Selara/issues/42), where
an audit found most fields on most entities are already never diffed, including `categoryCode`
and `developer` on `Deliverable` — two of the fields this feature touches.

**Consequence**: FR-016 is not a nicety. Without it, changing an application's platform or
system owner leaves no trace in an audit trail that ADR-0011 established for regulatory purposes.

## R5 — The hazard of deferring migration

**Decision**: No migration tooling (Q4 of the design notes). Handle only the one path where
deferral destroys data.

**Rationale**: IndexedDB is schemaless within a store, so removing the eight fields from the
TypeScript type does **not** delete them — existing rows keep them as orphaned properties, and
they survive a regenerate today because `generateLkptiDetails` spreads the existing row
(`{ ...existing, ...cascadedFields }`, `lkpti.ts:112`).

That protection disappears the moment rows are rebuilt from the application rather than spread.
The first press of Generate would then discard them permanently. Until that press they are
recoverable and a later migration tool can still find them.

**Approach**: lift the values onto the `Deliverable` on load, before any generation can replace
the rows that hold them. This is a read-time lift, not a stored migration — cheap, idempotent,
and it leaves the orphaned properties in place for any future tool.

**Alternative rejected**: warn the preparer that Generate will discard the imported return.
Defensible for a pre-1.0 local-first tool and explicitly allowed by FR-019, but a warning that
must be read correctly once, under time pressure, before a regulatory filing, is a worse
guarantee than a lift that cannot be got wrong.

## R6 — Where generation is triggered from

**Decision**: Generation and export live only in the Reports menu, producing a transient return.
Both Data Manager report tabs remain visible and populated but become read-only; their Generate
buttons are removed (Q5/Q6 revised, FR-021). Removing the tabs themselves remains a later step.

**Implementation context**: `RptiReportView` states its own role today — *"RPTI rows are managed in Data
Manager → RPTI. This screen is a read-only summary and export."* That copy becomes wrong and
must change. `ReportsView` already routes both reports by slug (`ReportsView.tsx:435`, `:461`),
so the year prompt and generate action attach there.

**Rationale**: A visible, editable report row whose changes have no effect on the return filed from
Reports is misleading. Read-only projections make the source of truth unambiguous: the preparer
maintains Deliverables and Initiatives, then prepares the filing in Reports. The report tabs remain
for continuity and import visibility until their later removal.

**Alternatives rejected**: retain the two generation paths (they can silently disagree); warn that
edits to an editable report row do not affect Reports output (labels a hazardous model instead of
removing the hazard); remove the tabs now (larger navigation and migration change, deferred).

## R7 — Round-trip fidelity is already measurable

**Decision**: SC-001 is implemented as a unit test comparing imported values against regenerated
ones, field by field, using the sample returns in `docs/sample-data/`.

**Rationale**: The measurement already exists — it was run to justify this feature. At feature
discovery, regenerating after discarding imported rows lost `platform`, `database`, `dcProvider`,
`drcProvider`, `backupStrategy`, `systemOwner`, `ownership` on **13/13** LKPTI rows and
`developer` on 9/13; and `remarks` on 11/13 and `ppjtiRelatedParty` on 10/13 RPTI rows.

RPTI CapEx/OpEx are not a report-row persistence target in the resulting design. The Initiative
owns the filed figures; a legacy detail override that differs is lifted before the override fields
are removed (Q7). Round-trip tests therefore compare the figures exported from the Initiative,
not a removed detail field.

**Target**: zero differences for reproducible rows.
