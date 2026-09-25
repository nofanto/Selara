# Implementation Plan: An RPTI row is one planned implementation, not one initiative

**Branch**: `003-rpti-row-per-implementation` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-rpti-row-per-implementation/spec.md`

## Summary

An RPTI plan line is one **planned implementation**, not one initiative. Generation moves from
grouping by initiative to projecting each implementation — a lifecycle segment that starts within
the filed year — and the values a line states (application, time, type, cost, commentary) move onto
that implementation.

This reverses two recorded decisions. **Q7**: the *filed* cost moves from the initiative to the
implementation. `Initiative.capex`/`opex` stay stored and editable as a portfolio figure — a
different value, not a copy — with a data-health warning when the two diverge. **Q10**: the
one-target-per-initiative rule is withdrawn, so one initiative may file for several applications.
Both keep Q7's original principle — *one piece of work, one budget* — and change only what counts
as the piece of work.

The change also fixes two defects beyond the originating one, because all three share a cause: the
segment-overlap membership test answers *"was this in progress this year"* where the filing asks
*"when does this go live"*.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Vite

**Primary Dependencies**: React, Tailwind CSS, `idb` (IndexedDB), `xlsx`

**Storage**: IndexedDB, schemaless within a store. No version bump needed — the new fields are
optional additions to an existing entity, and `excel.ts`'s `flatten()` is generic (verified in the
previous feature, contract 21).

**Testing**: Vitest for pure logic (`src/lib/**`), Playwright for UI-facing behaviour (`e2e/**`)

**Target Platform**: Browser, local-first, no accounts

**Project Type**: Single-project SPA

**Performance Goals**: 300 applications generate and reconcile within the responsiveness of today.
Per-implementation rows increase row count, so the existing bound gets tighter, not looser.

**Constraints**: Local-first; `AppState` is enumerated at every call site, so a new store is
expensive and extending `DeliverableSegment` is cheap; no migration tooling for exported or shared
files (Q4), though the lift now runs at every boundary admitting data to live state.

**Scale/Scope**: Hundreds of applications ([#36](https://github.com/nofanto/Selara/issues/36)); an
application may have several implementations per year.

## Constitution Check

| Principle | Assessment |
|---|---|
| **I. Rules Before Pixels** | This is entirely a domain-rule change — what constitutes a filed line, and what it states. It carries full process weight: spec, research, contracts, tests before code. The UI work (cost moving to the segment panel) is consequence, not motive. **PASS** |
| **II. Nothing Ambiguous Gets Built Silently** | Three clarifications were raised and answered before planning (Q1–Q3), and two of them reversed recorded decisions. Both reversals are written up as Q17 in the design notes with their reasoning, not applied silently. Two questions remain genuinely open and are named in Complexity Tracking rather than guessed. **PASS** |
| **III. Test at the Altitude of the Risk** | Row grain, membership, cost derivation and reconciliation are pure logic → Vitest adjacent to source. Cost entry on the segment panel and the divergence warning are UI-facing → Playwright. Every test is written to fail first, and the round-trip test must be *seen* to have teeth given R10. **PASS** |
| **IV. Rejected Alternatives Are Recorded** | research.md records what was turned down for each decision — a new store, a cost split rule, per-symptom patches, the initiative-figure-as-default. Q17 records both reversals with the reasoning that survived. **PASS** |
| **V. Verification Is Enforced, Not Reported** | Both suites green with real exit codes before any commit. `npx playwright test \| tail` returns tail's status, so runs redirect to a file and check `$?`. **PASS** |

**No violations.** The feature is large but not complex in the constitutional sense: it removes a
concept (initiative-grouped rows) rather than adding one.

## Project Structure

### Documentation (this feature)

```text
specs/003-rpti-row-per-implementation/
├── spec.md              # What and why, with Q1-Q3 answered
├── plan.md              # This file
├── research.md          # R1-R10, all measured on 7a75726
├── data-model.md        # Entity changes and the derivation rule
├── contracts/
│   └── generation.md    # The projection, reconciliation and cost contracts
├── quickstart.md        # Validation levels
└── checklists/
    └── requirements.md  # 16/16
```

### Source Code (repository root)

```text
src/
├── types.ts                          # DeliverableSegment gains cost + remarks
├── lib/
│   ├── rpti.ts                       # projection grain, membership, cost resolution
│   ├── dataHealth.ts                 # remove multi-target; remove #52 detection
│   ├── diff.ts                       # name the new fields, and initiativeId
│   ├── rptiImport.ts                 # import writes cost/remarks to the implementation
│   └── scale.test.ts                 # multi-implementation at 300 applications
├── components/
│   ├── DeliverableSegmentPanel.tsx   # gains cost and remarks entry
│   └── DataManager.tsx               # Initiatives tab: label which figure is filed
e2e/
└── report-year.spec.ts               # multi-implementation filing, end to end
```

**Structure Decision**: single project, existing layout. No new directories — the feature extends
an entity that already exists and changes the rules that read it.

## Complexity Tracking

**No open questions remain.** Three were recorded here and all closed on 2026-09-22, two of them
dissolved rather than answered.

| Question | Resolution |
|---|---|
| How an initiative budget divides across its implementations | **Does not arise.** The initiative's budget and the implementation's filed figure are different values, not two copies of one. Nothing is divided, nothing migrates. |
| An initiative with no implementations deriving a total of zero | **Does not arise.** `Initiative.capex` is not derived; it keeps its stored value and its thirteen readers. |
| Whether `Initiative.deliverableId` survives | **Removed with its UI.** It was invented for Q10's single-target rule, which this feature withdraws, and the grouping model works entirely through segments' `initiativeId`. |

**The one risk that remains is an ordering constraint, not an unknown.** The F2 repair path — how a
preparer fixes a stored row whose deliverable was deleted — currently runs through
`Initiative.deliverableId` (`rpti.ts:338`). Its replacement matches on the segment's own
`deliverableId` instead. T043b must land before T043c, or the repair route is gone before its
replacement exists.

That is the same shape as a defect this project has already shipped once: a repair path removed by
a change whose author did not know the path ran through what they were removing.
