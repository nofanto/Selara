# User Story 23: Data Health — Validity Checks

## Story

> **As** an IT portfolio manager,
> **I want** the workspace report to tell me when a value I have filled in is *illegal* — not just when it is missing,
> **So that** I find out about a rejection-worthy value before OJK does, instead of after filing.

---

## Background

[User Story 21](21-data-completeness-report.md) shipped the report as **phase 1**: it asks
*does this reference resolve?* and *is this value present?* — nothing more. The LKPTI field
check is a bare falsiness test, so a workspace can report *"No data-health issues found — the
workspace is clean"* while holding a `goLiveDate` of `31-02-2021`, a 900-character
`functionDescription` against a 500-char cap, and two applications with identical names.

This story adds **phase 2** — value validity — on top of those checks, in the same report.
Full decision record, including the four rules deliberately *not* checked and why:
`requirement-specs/data-completeness-report.md` § "Phase 2 — Validity checks". Tracked as
issue #16.

---

## Acceptance Criteria

### AC1 — The report is renamed, and says whether the workspace can be filed

- [ ] The Reports card and the report heading both read **Data Health**, not "Data Completeness" — phase 2 is not completeness. The `data-health` slug, `report-view-data-health` test id and `dataHealth.ts` module name are already correct and do not change.
- [ ] A verdict line sits above the issue list, summarising both phases at once — e.g. *"Not ready to file — 2 validity errors, 5 completeness gaps."*
- [ ] A workspace with no issues at all still reads as clean, and one carrying only completeness gaps is not reported as file-ready.

### AC2 — Validity checks run alongside completeness checks, never behind them

- [ ] `HealthIssue` carries `phase: 'completeness' | 'validity'` alongside its existing `severity`. Every issue the shipped report already produces is `phase: 'completeness'`.
- [ ] Both phases always run. Phase never gates: a workspace full of completeness warnings still surfaces its validity errors.
- [ ] Each validity check is guarded on the value being *present* — an absent `goLiveDate` is a completeness gap, not an invalid date, and is never reported twice.

### AC3 — LKPTI value validity

- [ ] A `goLiveDate` that is not `dd-mm-yyyy`, or is not a real calendar date (`31-02-2021`), is an `error`.
- [ ] A `goLiveDate` later than today is an `error`. (Accepted limitation, see spec §2: a filing prepared for an already-closed period will not flag a go-live date falling after that period's end.)
- [ ] Length caps are an `error`: `functionDescription` ≤ 500; `applicationName`, `platform`, `database`, `dcLocation`, `dcProvider`, `drcLocation`, `drcProvider`, `systemOwner`, `developer` ≤ 100.
- [ ] Caps are measured against the **composed export value** — `applicationName` reads `Deliverable.name` via `targetId`, and `dcLocation`/`drcLocation` are the joined `"City, Country"` strings the exporter builds — so a 60-char city plus a 60-char country is correctly flagged.
- [ ] A free-text value containing a line break, or leading/trailing whitespace, is a `warning`. Applies to `functionDescription`, `platform`, `database`, `dcProvider`, `drcProvider`, `systemOwner`, `developer`, `dcCity`, `dcCountry`, `drCity`, `drCountry` and `Deliverable.name`; the enum-backed columns and `goLiveDate` are excluded.
- [ ] Two applications sharing a name are a `warning`, compared as `name.trim().toLowerCase()` across only those deliverables that have an `LkptiDetail` row. **Every** member of a duplicate group is flagged, not all-but-the-first.

### AC4 — RPTI workspace validity

- [ ] A `TimelineSettings.defaultCurrency` that is set and is not `IDR` is a `warning`: the export cannot carry the IDR-equivalent the schema requires, because [ADR-0006](../adr/0006-rpti-auto-fill-and-single-currency.md) removed those fields by design. This is not fixable row-by-row.
- [ ] Being workspace-level rather than record-level, it uses a synthetic `entityType: 'Workspace'` entity so the list stays uniform, and clicking it navigates to the RPTI tab where `defaultCurrency` is edited.

### AC5 — Filtering and navigation

- [ ] A phase filter (All / Validity / Completeness) sits beside the existing severity filter, matching its button-group pattern (`aria-pressed`, `data-testid="data-health-filter-*"`).
- [ ] The two filters compose: all four severity×phase combinations are reachable, including "every error regardless of phase".
- [ ] Validity issues navigate the same way phase-1 issues do — Data Manager, on the tab where the offending value is *editable*: the Deliverables tab for an `applicationName` problem, the LKPTI tab for a row-field problem.
- [ ] The report stays read-only; no inline quick-fix editing.

---

## Out of scope (for now)

- **A reporting-period input.** "Not in the future" means relative to today; see spec §2 for the accepted limitation and when to revisit.
- **A separate "filing readiness" report.** Phase 2 is absorbed into this one — spec §3.
- **Inline validation on the `goLiveDate` input.** `DataManager.tsx` renders it as a plain text field labelled "(dd-mm-yyyy)" with no validation; this story reports the bad value in the health report rather than preventing its entry.
- **The four rules deliberately not checked** — `row_number` sequencing, enum membership, `self`/`inhouse` semantics, and the PPJTI cross-reference. Reasons in the spec.
- **Agent exposure.** The rule engine is a deterministic pure function with unit tests; an agent narrating its output is a separate, much smaller idea.

---

## Files Touched

| File | Change |
|---|---|
| `src/lib/dataHealth.ts` | `phase` on `HealthIssue`; `'completeness'` on all existing issues; new validity checks; `TimelineSettings` added to `DataHealthInput` |
| `src/lib/dataHealth.test.ts` | Vitest cases per validity check, including the composed-value caps and the duplicate-name grouping |
| `src/components/DataHealthReportView.tsx` | Verdict line; phase filter button group; title |
| `src/components/ReportsView.tsx` | Card + heading title/description → "Data Health"; pass `timelineSettings` down as a new `DataHealthReportView` prop (it already holds `currentData.timelineSettings`) |
| `src/App.tsx` | Handle the synthetic `Workspace` entity in `handleNavigateFromHealthIssue` (route to the RPTI tab) |
| `e2e/data-health-report.spec.ts` | Cases for the verdict line and the phase filter |
| `docs/user-guide/09-reports/data-completeness-report.md` | User-facing guide update + rename |
