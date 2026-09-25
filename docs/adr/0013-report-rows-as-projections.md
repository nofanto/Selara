# ADR-0013: Report rows describe the entities they belong to, and a return is generated for a stated year

## Status

Accepted

## Context and Problem Statement

`LkptiDetail` and `RptiDetail` were the only home for values that describe an application — what it
runs on, who operates its data centres, who owns it, who built it. They are report rows, so those
values existed only for as long as a row did: pressing "Generate LKPTI Rows" rebuilt the rows from
the workspace and every filed value that generation could not derive was gone. Measured on the
sample returns, a regenerate lost **110 filed values**.

The second half of the same problem is that an RPTI return is a plan for a **specific year**, and
nothing recorded which year. `reportYear` existed only as a call-time parameter; onboarding asked
for two reporting years and kept neither. So "Generate" used `new Date().getFullYear()` — not
laziness, the only year available — and `exportRptiReportToExcel` filtered by nothing at all, which
means a workspace holding a 2027 and a 2028 plan filed them to OJK as one return with no warning.

Raised jointly as [issue #40](https://github.com/nofanto/Selara/issues/40) and the design notes in
`requirement-specs/report-rows-as-projections.md`, whose Q1–Q12 record the decisions this ADR
summarises. Specification and task breakdown in `specs/002-report-year-field-ownership/`.

## Decision Drivers

- A wrong regulatory classification is the expensive failure in this product; a wrong pixel is not.
- Silent loss is worse than loud failure. A preparer who is told what will be lost can act; one who
  is not cannot.
- `AppState` is enumerated at every call site, so a new store is expensive here and extending an
  existing entity is cheap.
- IndexedDB is schemaless within a store, so a dropped TypeScript field persists as an orphaned
  property rather than erroring — which makes "it still works" a poor signal.

## Considered Options

- Keep the values on the report rows and make generation merge-preserving.
- Move the values onto the entities they describe, and derive the rows.
- Add a child table or a supplier/vendor entity to hold them.
- Store the report year on `RptiDetail`, as a workspace setting, or as a first-class filing entity.

## Decision Outcome

Chosen option: **move the values onto the entities they describe, and generate each return for a
year the preparer states**, because a value that describes an application belongs to the
application. Once it lives there, regeneration cannot lose it — there is nothing to lose.

Concretely:

- Nine fields move: `platform`, `database`, `dcProvider`, `drcProvider`, `backupStrategy`,
  `systemOwner`, `ownership` and `ppjtiRelatedParty` onto `Deliverable`, and the RPTI `Keterangan`
  column onto `Initiative.rptiRemarks` (distinct from `description`, which supplies `Deskripsi`).
- `Deliverable.developer` widens from the two-value `RptiDeveloper` enum to also carry a service
  provider's **name**, which is what LKPTI files. RPTI derives its own classification from it:
  anything that is not `'inhouse'` is PPJTI. One field serves both returns and the name is not lost.
- Cost stops being a per-row override. `RptiDetail.capexAmount`/`opexAmount` are removed and
  `Initiative.capex`/`opex` are the filed figures (Q7). An initiative has at most one RPTI target;
  where none is declared it is inferred when the initiative's segments unambiguously name one
  deliverable (Q10).
- `generateLkptiDetails` takes a **required** `asAtDate` and tests a live span rather than "has ever
  gone live". `deriveWorkspaceFromLkptiImport` takes a **required** `asAtYear` for the same reason.
- Generation moves to Reports, which asks for the year. Both Data Manager report tabs become
  read-only; their stored rows remain visible as reconciliation evidence but are no longer inputs
  or direct filing exports.
- `projectRptiReturn(input, reportYear)` is the projection, and its input type has no
  `existingDetails` key, so handing it stored rows is a compile error. `reconcileRptiReturn`
  matches stored evidence one-to-one to canonical row identities and returns **findings**, never
  rows (Q11/Q12). It deliberately does not claim field-by-field fidelity.
- Both filing exports receive the selected year, state it on a `Report Metadata` worksheet, and
  include it in the filename. Their regulatory data worksheets keep the standard layouts used by
  the importers.

### Pros and Cons of the Options

#### Keep the values on the rows, make generation merge-preserving

- Good, because it is the smallest change and it shipped first, as v2 of the auto-generation rules.
- Bad, because it treats the symptom. The values still have no owner, so two rows about the same
  application can disagree and nothing notices.
- Bad, because the merge is **year-agnostic carry-forward**, which is exactly wrong for a
  year-scoped output. Wired into the projection path it put a 2027 plan line inside a 2026 filing —
  the defect that produced Q11 and this ADR's projection split.

#### Move the values onto the entities they describe

- Good, because regeneration cannot lose what it does not own: 110 lost values became 0.
- Good, because each value gains exactly one editing surface, which the data-health findings can
  point at.
- Bad, because the Deliverables tab grows from 10 to 18 columns, on a table already ~1800px wide.
- Bad, because every new field must be named explicitly in `diff.ts` or version history will not
  see it — silently ([#42](https://github.com/nofanto/Selara/issues/42)).

#### A child table, or a supplier/vendor entity

- Good, because a vendor answered once could not then be answered inconsistently per application.
- Bad, because a new store is the expensive change in this codebase, and the duplication it avoids
  is an accepted, recorded simplification (Q3).

#### Store the report year on `RptiDetail`

- Bad, because it makes the row the authority on which return it belongs to, when the row is meant
  to be derived. Rejected in favour of the preparer stating the year at generation.

## Consequences

### Behaviour changes a preparer will notice

Both are intended. Both are stated here because a regulatory tool that changes what it files
without saying so is worse than one that does not change at all.

- **A decommissioned application now drops out of the generated LKPTI.** Previously intended,
  previously not true — membership tested only that a live segment had *started*, never whether it
  had ended, so an application the bank had retired still appeared on the inventory.
- **Both Data Manager report tabs are read-only, and their Generate buttons are gone.** A filing is
  produced from **Reports**, which asks for the year it covers. The stored rows remain visible as
  reconciliation evidence but are not exported directly; they are no longer somewhere to type. Anything that used to be edited on a report row
  is now edited on the application or the initiative that owns it.
- **A filing covers the year you state.** Previously "Generate RPTI Rows" used the current calendar
  year because that was the only year available, and the export filtered by nothing at all — a
  workspace holding two plan years filed both as one return.

### Other consequences

- **No IndexedDB version bump is needed.** Stores are schemaless within a store and `flatten()` is
  generic, so `db.ts` and `excel.ts` need nothing for new fields on an existing entity. Verified
  rather than assumed — the workspace export/import round trip is asserted field by field.
- **The orphaned-property hazard is handled at every reachable live-state boundary.** A workspace
  created before this change holds the values on its rows and not yet on its entities, so
  `liftReportRowAttributes` runs before ordinary IndexedDB load, shared-workspace load, generic
  workbook import, or version restore can expose the data to generation. Each path persists the
  lifted form immediately in its existing save. Legacy cost overrides are removed after the lift;
  their absence is the durable marker that stops a later load from undoing a newer Initiative edit.
  An exported workbook on someone else's disk is necessarily unreachable until it is imported,
  at which point the workbook-import boundary performs the lift (Q4).
- **Data-health findings were repointed and identity repairs are source-side.** RPTI evidence maps
  to a current canonical row through the surviving Initiative or target, one-to-one. Newly imported
  LKPTI evidence retains the filed application name; an older orphan without that name instructs
  re-import rather than guessing by elimination or comparing filed contents.
- **Exact per-year attribution of a stored row is not possible and is not faked.** `RptiDetail`
  carries no report year and none may be inferred from a quarter, an id suffix or a segment link,
  so reconciliation findings are stated per workspace. A persisted year-bearing record is the
  deferred fix, analysed as option 5 in `specs/002-report-year-field-ownership/merge-path-options.md`.
- **Still open:** emptying or removing the read-only report tabs.
- **Corrected 2026-09-19.** This entry previously called a stored LKPTI `goLiveDate` reaching
  generated output a *residual*. It was not: because membership is computed from segment spans
  against the as-at date while the stored date was spread through untouched, an inventory for
  2027 could state a go-live in 2028 — a wrong-period filing, not plumbing. `generateLkptiDetails`
  now falls back to the live segment the membership test itself used whenever the filed date
  post-dates the as-at date, and keeps a filed date the as-at supports, which is more precise than
  a segment start (FR-017). Understating it here is the mistake worth recording: the residual
  framing is why it went unfixed for a whole review cycle.

### Superseded in part by implementation-grain RPTI rows

Spec 003, Q17 supersedes this ADR's placement of RPTI `Keterangan` on
`Initiative.rptiRemarks`. Once one filed row corresponds to one implementation, commentary and
filed CapEx/OpEx belong to that implementation (`DeliverableSegment`); otherwise two
implementations could not state different values without repeating or overwriting each other. The
initiative CapEx/OpEx fields remain separate, editable portfolio figures and are not filing sources.
