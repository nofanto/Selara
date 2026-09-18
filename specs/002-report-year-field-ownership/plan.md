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
`new Date()`. Both Data Manager tabs are untouched.

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

**Constraints**: No change to what either return exports, except the one intended correction in
R2. No migration tooling (Q4), but no silent loss either (FR-019). Offline throughout.

**Scale/Scope**: Hundreds of applications. Two entities gain fields; two generation functions gain
a year; one Reports view gains a prompt; `diff.ts` gains nine lines.

## Constitution Check

*GATE: passed before Phase 0; re-checked after Phase 1 design.*

**I. Rules Before Pixels** — PASS, and the feature is an instance of it. The risk is a wrong
regulatory filing: a return that silently omits fields the bank supplied, or covers a year nobody
chose. R2 found a live instance — a decommissioned application still appearing in the LKPTI — and
the plan fixes it rather than working around it. No interface polish is on the critical path.

**II. Nothing Ambiguous Gets Built Silently** — PASS. Six design questions were settled with the
product owner in `requirement-specs/report-rows-as-projections.md` before this spec existed, and
three more during specification (where the year lives, what the LKPTI year governs, how the round
trip is verified). Nothing in the plan rests on an implementer's guess. The one judgement the plan
does make — lifting attributes on load rather than warning — is recorded in R5 with its rejected
alternative.

**III. Test at the Altitude of the Risk** — PASS. The risk is in pure functions: what generation
emits, which applications qualify at an as-at date, and whether the lift is idempotent. Those get
Vitest. Only the year prompt is a genuine interaction, and that gets Playwright. SC-001 is a unit
test that exists and fails today, so Red is already demonstrated for the feature's central claim.

**IV. Rejected Alternatives Are Recorded** — PASS. `research.md` records a rejected alternative
for each of its seven decisions; the design notes record the rejected options for Q1–Q6; ADR
required for the data-model change (see Records below).

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
├── spec.md              # 4 user stories, 30 FRs, 10 SCs
├── plan.md              # this file
├── research.md          # R1-R7, each with rejected alternatives
├── data-model.md        # the nine fields, and the behaviour changes
├── quickstart.md        # 7 validation levels
├── contracts/
│   └── generation.md    # 21 numbered properties a test can hold
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```
src/
├── types.ts                        # +8 on Deliverable, +1 on Initiative, -8/-2 on the details
├── lib/
│   ├── lkpti.ts                    # generateLkptiDetails gains asAtDate; span test replaces "has gone live"
│   ├── rpti.ts                     # remarks from Initiative, ppjtiRelatedParty from Deliverable
│   ├── diff.ts                     # nine explicit field lines (#42)
│   ├── dataHealth.ts               # checks repoint at the entity now holding the value
│   ├── attributeLift.ts            # NEW — pure, idempotent lift off stored rows
│   ├── lkptiImport.ts              # writes attributes onto the Deliverable
│   └── rptiImport.ts               # writes remarks onto the Initiative
├── components/
│   ├── ReportsView.tsx             # year prompt; generate-and-export per return
│   ├── RptiReportView.tsx          # generates rather than only displaying; copy corrected
│   ├── LkptiReportView.tsx         # same, with an as-at year
│   └── DataManager.tsx             # +8 columns on Deliverables, +1 on Initiatives; report tabs untouched
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
| **Two generation paths** — Data Manager writes stored rows, Reports menu produces a transient return | Q5/Q6 keep the tabs this round; the Reports menu is where the year is asked | Removing the tabs now is the destination but a much larger change, explicitly deferred. The paths can disagree; that is accepted and temporary |
| **`attributeLift.ts`** for a migration that is officially deferred | Without it, the first press of Generate destroys the imported return permanently (R5) | Warning the preparer instead is allowed by FR-019, but a warning that must be read correctly once, before a regulatory filing, is a weaker guarantee than a lift that cannot be got wrong |
| **Nine hand-written lines in `diff.ts`** | `compareEntities` is generic over entities, not fields — an unlisted field changes silently (#42) | Making the diff field-generic is the right fix and is #42's job; doing it here would expand this feature into a second one |
| **Behaviour change to LKPTI membership** | FR-009a cannot be satisfied without it, and it fixes a measured defect | Keeping "has ever gone live" would leave the tool asking for a year and ignoring the answer |
