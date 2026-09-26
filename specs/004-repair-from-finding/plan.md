# Implementation Plan: Repair an Unresolved Imported RPTI Row from Its Finding

**Branch**: `051-repair-from-finding` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-repair-from-finding/spec.md`

## Summary

An imported RPTI upgrade that the import could not attach to exactly one inventory entry is held back
unresolved. Today it can only be repaired by hand, and the obvious manual repair files different values
than the return did, silently. This feature puts a **Repair** action on that row's finding, in Data
Health and in the pre-export gate. The action opens a form pre-filled from what was filed. The preparer
chooses one of two options:
- **B, "the bank runs it"** creates the application.
- **A, "it's this existing entry"** attaches the filed implementation to an entry that exists, with
  suggestions and per-field choices.

Confirming applies the repair as one undoable change, and the row then regenerates exactly as filed.

The technical approach adds no stored field, store or migration. The repair is a pure function from
workspace to workspace, applied through the existing single-transaction `handleUpdate`. It reuses three
rules extracted from generation, so the form cannot promise what the filing then contradicts:
- "was live before", which decides `new` or `upgrade`;
- the continuous prior live phase, now shared with the importer;
- "what would be filed" for a Deliverable's attributes.

Existing workspaces are never changed automatically. A non-blocking warning offers the new prior-phase
rule where the old one leaves an application out of an inventory year.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Vite

**Primary Dependencies**: React, Tailwind CSS, `idb` (IndexedDB), `xlsx`, `lucide-react`

**Storage**: IndexedDB, schemaless within stores. **No schema change and no version bump**: the
feature writes existing fields of `Asset`, `Deliverable`, `DeliverableSegment`, `Initiative` and
possibly `AssetCategory`/`DeliverableStatus` (research R12).

**Testing**: Vitest for `src/lib/**` (contracts 1-23), Playwright for the dialog workflow from both
entry points (quickstart level 3)

**Target Platform**: Browser, local-first, no accounts

**Project Type**: Single-project SPA

**Performance Goals**: Candidate ranking over 300 applications stays inside the existing
`scale.test.ts` budget, and repairing one row costs one `handleUpdate` (SC-005).

**Constraints**:
- Stored RPTI rows are immutable evidence (Q12).
- Nothing is inferred from today's date.
- `AppState` is enumerated at every call site, so no new store.
- An anchored row never falls back to another implementation (contract 14 / T038 of spec 003). Not
  touched here: unresolved rows carry no anchor.

**Scale/Scope**: Hundreds of applications (#36). A workspace normally has a handful of unresolved
rows; the sample has one.

## Constitution Check

| Principle | Assessment |
|---|---|
| **I. Rules Before Pixels** | The risk is filing different values than were filed. It lives in the pure repair function and in the three shared rules, all specified as contracts 1-23 and tested first. The dialog is a consequence of those rules. **PASS** |
| **II. Nothing Ambiguous Gets Built Silently** | Every rule is a recorded product-owner decision (Q22, and spec FR-018 option C). Three consequences of those decisions are named in Complexity Tracking for confirmation rather than assumed. **PASS** |
| **III. Test at the Altitude of the Risk** | Draft, candidates, differences, apply, the importer change and gap detection are pure → Vitest. The dialog from Data Health and from the gate, undo, and the warning's action are UI → Playwright. Every test is seen red; falsifications are logged in `tasks.md`. **PASS** |
| **IV. Rejected Alternatives Are Recorded** | research.md R1-R13 each record what was turned down, and Q22 records the product-level rejections. **PASS** |
| **V. Verification Is Enforced, Not Reported** | Both suites green with real exit codes before commit, and the tsc baseline stays at 1. **PASS** |

**No violations.** Post-design re-check: the design adds three exported helpers, extracted rather than
duplicated. That removes one existing duplicate (the importer's copy of "was live before") instead of
adding complexity. **Still PASS.**

## Project Structure

### Documentation (this feature)

```text
specs/004-repair-from-finding/
├── spec.md              # What and why; FR-018 answered (option C)
├── plan.md              # This file
├── research.md          # R1-R13, measured at 9c9a22d; unchanged at 9e38187 (rebased onto #57)
├── data-model.md        # Which existing fields each path writes; no schema change
├── contracts/
│   └── repair.md        # Contracts 1-23
├── quickstart.md        # Validation levels 1-4 and a manual check
└── checklists/
    └── requirements.md  # All items pass
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── rpti.ts                        # export hasLiveHistoryBefore, continuousPriorLivePhase,
│   │                                  #   filedAttributesFor; projection calls them (contracts 1-3)
│   ├── unresolvedRowRepair.ts         # NEW: isRepairableUnresolvedRow, repairOptions, draft,
│   │                                  #   rankRepairCandidates, attributeDifferences,
│   │                                  #   applyUnresolvedRowRepair, priorPhaseGaps,
│   │                                  #   extendImportPriorPhase (contracts 4-23)
│   ├── unresolvedRowRepair.test.ts    # NEW
│   ├── rptiImport.ts                  # both synthetic prior phases via continuousPriorLivePhase
│   ├── dataHealth.ts                  # HealthIssue.action; prior-phase-gap warning
│   ├── sampleReturns.test.ts          # SC-001 round trip and SC-004 counts
│   └── scale.test.ts                  # candidate ranking at 300 applications
├── components/
│   ├── UnresolvedRowRepairDialog.tsx  # NEW: options, pre-filled form, candidates, differences
│   ├── DataHealthReportView.tsx       # renders an issue's action as a button
│   └── ReportsView.tsx                # hosts the dialog; the gate renders findings with Repair
└── App.tsx                            # onRepairUnresolvedRow / onExtendImportPriorPhase → one handleUpdate each
e2e/
└── unresolved-row-repair.spec.ts      # NEW: quickstart level 3
docs/
├── user-stories/27-repair-unresolved-rpti-row.md   # NEW
└── user-guide/14-rpti-report/recording-an-rpti-row.md  # the manual-repair paragraph becomes the Repair flow
requirement-specs/report-rows-as-projections.md     # Q22: SC-004 measurements and the confirmations below
```

**Structure Decision**: single project, existing layout. The one new library module holds the repair's
pure rules, so `rpti.ts` stays about generation and gains only the three rules it already owned
implicitly.

## Complexity Tracking

No constitutional violations. Three **consequences of decided rules** were raised with the product
owner before implementation, because each changes an output someone might not expect. **All three
were confirmed on 2026-09-25**, including the proposed handling of the first.

| Consequence | Why it follows | Proposed handling |
|---|---|---|
| **After a B repair, a regenerated 2026 LKPTI lists the application** (14 rows against the 13 filed). | Q22 (B means "the bank runs it") and the prior-phase start of 1 January of the year before the filed year, the importer's existing rule, kept by R5. | Accept, and state it in the dialog: "this also adds it to the inventory from 2026". The filed 2026 return omitted an application the bank says it ran. The alternative, starting the prior phase on 1 January of the filed year, keeps 2026 at 13 rows, but it fails for a Q1 filing: the phase would not start *before* the implementation, so the row would file `new`. |
| **Option A "update" changes the LKPTI too.** | ADR-0013: the attributes belong to the Deliverable, and both returns read them (Q22, decided). | Already decided. The dialog says so beside each "update" choice. |
| **A PPJTI row created with B needs the provider's name typed in.** | The return states only `PPJTI` (FR-006). The name exists nowhere in the workspace. | Required field. This is the one value SC-002 allows to be typed, because the return never supplied it. |

**Ordering constraint, not an unknown.** Contract 1 changes `projectRptiReturn`'s development-type test
from a closure to the shared predicate. It must land first, with all existing projection tests green
and no expectation changes, before anything calls it. Otherwise a regression in `new`/`upgrade`
typing, the product's most expensive mistake (Constitution I), would arrive hidden inside a feature
commit.
