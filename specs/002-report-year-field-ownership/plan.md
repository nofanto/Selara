# Implementation Plan: Report Year and Report-Row Field Ownership

**Branch**: `002-report-year-field-ownership` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-report-year-field-ownership/spec.md`

## Summary

Make a generated OJK return reproduce the return that was imported. Two changes serve that one
goal: the fields a filed return supplies but generation cannot derive move onto the entities they
actually describe, and the report year becomes a question asked when a return is generated rather
than a value inferred from the system clock.

Eight attributes move from `LkptiDetail` to `Deliverable`, `remarks` moves to `Initiative` as
`rptiRemarks`, and `ppjtiRelatedParty` moves to `Deliverable`. Generation gains a year: the RPTI's
plan year and the LKPTI's as-at date, both supplied from the Reports menu, neither ever taken from
`new Date()`. Both Data Manager report tabs remain visible and populated but become read-only;
their Generate actions move to the Reports menu. Tab removal is deliberately deferred.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Vite

**Primary Dependencies**: `idb` (IndexedDB), `xlsx` (SheetJS) — no new dependency

**Storage**: IndexedDB, schema version 19. **No version bump**: every added field lands on an
existing entity in an existing store, and IndexedDB is schemaless within a store.

**Testing**: Vitest for the pure generation and lift logic, where all the risk lives; Playwright
for the Reports-menu year prompt

**Target Platform**: Browser, local-first, no accounts, no backend

**Project Type**: Single-page web application

**Performance Goals**: Generating a return for a stated year at 300 applications stays within the
responsiveness of generating one today (SC-008)

**Constraints**: Report generation has one user-facing path: Reports asks for the year, derives a
transient return, and gates unreproducible rows before export. No migration tooling (Q4), but no
silent loss either (FR-019). Offline throughout.

**Scale/Scope**: Hundreds of applications. Two entities gain fields; RPTI cost overrides move to
the Initiative and legacy differing values are lifted before removal; two generation functions gain
a year; Reports gains a prompt and pre-export gate; report tabs become read-only; `diff.ts` gains
nine lines.

## Constitution Check

*GATE: passed before Phase 0; re-checked after Phase 1 design.*

**I. Rules Before Pixels** — PASS, and the feature is an instance of it. The risk is a wrong
regulatory filing: a return that silently omits fields the bank supplied, or covers a year nobody
chose. R2 found a live instance — a decommissioned application still appearing in the LKPTI — and
the plan fixes it rather than working around it. No interface polish is on the critical path.

**II. Nothing Ambiguous Gets Built Silently** — PASS. The field homes, report-year model,
read-only report-tab model, initiative-owned RPTI costs, and unsupported bare-Asset target rule
were settled with the product owner in `requirement-specs/report-rows-as-projections.md` (Q1–Q8).
Nothing in the plan rests on an implementer's guess. The one judgement the plan does make — lifting
attributes on load rather than warning — is recorded in R5 with its rejected alternative.

**III. Test at the Altitude of the Risk** — PASS. The risk is in pure functions: what generation
emits, which applications qualify at an as-at date, whether the lift is idempotent, and whether an
invalid RPTI target is diagnosed. Those get Vitest. The Reports year prompt, pre-export gate, and
read-only report tabs are interactions and get Playwright. SC-001 is an executable unit assertion;
new feature work remains Red-first.

**IV. Rejected Alternatives Are Recorded** — PASS. `research.md` records the generation-path
decision; the design notes record the rejected options for Q1–Q8, including retaining editable
report rows, per-row cost overrides, and supporting bare-Asset RPTI targets. ADR required for the
data-model change (see Records below).

**V. Verification Is Enforced, Not Reported** — PASS. SC-001 is an assertion, not a report. The
existing CI gates (unit, build, lint, ratcheted typecheck, Playwright) all block. Nothing in this
plan introduces a check that can fail while presenting as successful.

**Records and Documentation required by the lifecycle**:

- An **ADR** — this is a data-model change (`docs/adr/README.md`: "A data model / IndexedDB schema
  change"). It must record moving the fields, the rejected child-store option, and why no schema
  version bump is needed.
- **`docs/database-diagram.md`** — nine fields across two entities.
- **`requirement-specs/lkpti-integration.md`** — the as-at rule replaces "has ever gone live".
- **`requirement-specs/report-rows-as-projections.md`** — mark Q1–Q3 as implemented.
- **User guide** — the Reports menu now asks for a year.

## Project Structure

### Documentation (this feature)

```
specs/002-report-year-field-ownership/
├── spec.md              # 4 user stories, 30+ FRs, 10 SCs
├── plan.md              # this file
├── research.md          # R1-R7, each with rejected alternatives
├── data-model.md        # field ownership, costs, and report-tab behaviour
├── quickstart.md        # 7 validation levels
├── contracts/
│   └── generation.md    # generation and read-only-tab properties a test can hold
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```
src/
├── types.ts                        # +8 on Deliverable, +1 on Initiative; RPTI cost overrides removed
├── lib/
│   ├── lkpti.ts                    # generateLkptiDetails gains asAtDate; span test replaces "has gone live"
│   ├── rpti.ts                     # derives from Initiative/Deliverable; costs come only from Initiative
│   ├── diff.ts                     # nine explicit field lines (#42)
│   ├── dataHealth.ts               # checks repoint; blocks unsupported/unreproducible RPTI targets
│   ├── attributeLift.ts            # NEW — pure, idempotent lift off stored rows
│   ├── lkptiImport.ts              # writes attributes onto the Deliverable
│   └── rptiImport.ts               # writes remarks and costs onto the Initiative
├── components/
│   ├── ReportsView.tsx             # year prompt; generate-and-export per return
│   ├── RptiReportView.tsx          # transient stated-year return; blocks export until repairs are visible
│   ├── LkptiReportView.tsx         # transient as-at-year return
│   └── DataManager.tsx             # canonical fields editable; report tabs read-only, no Generate
└── App.tsx                         # runs the lift on load

e2e/report-year.spec.ts             # NEW — the prompt, and that no year is ever assumed
```

**Structure decision**: Single project, existing layout. No new store, no new directory. The one
new file is a pure function in `src/lib/` because it is pure logic with real risk — the same
reason `rptiImport.ts` and `attributeLift.ts` belong beside each other rather than inside a
component.

## Complexity Tracking

| Item | Why it is here | Simpler alternative rejected because |
|---|---|---|
| **One filing path while report rows remain visible** — Reports generates and exports transient returns; Data Manager's report tabs are read-only projections | Q5/Q6 were revised after review: editable rows whose changes never reach a filing are misleading | Removing the tabs is still the destination, but is deferred; making them read-only now avoids two generation paths drifting apart |
| **`attributeLift.ts`** for a migration that is officially deferred | Without it, the first press of Generate destroys the imported return permanently (R5) | Warning the preparer instead is allowed by FR-019, but a warning that must be read correctly once, before a regulatory filing, is a weaker guarantee than a lift that cannot be got wrong |
| **Nine hand-written lines in `diff.ts`** | `compareEntities` is generic over entities, not fields — an unlisted field changes silently (#42) | Making the diff field-generic is the right fix and is #42's job; doing it here would expand this feature into a second one |
| **Behaviour change to LKPTI membership** | FR-009a cannot be satisfied without it, and it fixes a measured defect | Keeping "has ever gone live" would leave the tool asking for a year and ignoring the answer |
| **Initiative-owned RPTI costs and one RPTI target** | An Initiative is the plan's unit of work; per-row cost overrides are removed after a safety lift | A per-target store permits a filing shape the product has decided not to support and adds a store/migration |
| **Bare-Asset RPTI targets are errors** | Infrastructure is modelled as a Deliverable under an Asset; a bare Asset cannot be generated faithfully | Supporting it needs a second derivation model for category, development type, quarter, and cost |
