# Implementation Plan: OJK-First Onboarding and RPTI Return Import

**Branch**: `001-rpti-import-onboarding` | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-rpti-import-onboarding/spec.md`

## Summary

Replace the four-card template picker with a two-path starting screen framed around OJK returns,
and add an RPTI Format 3.1 importer. Onboarding asks for an LKPTI inventory (required) and an RPTI
plan (optional), each with its own reporting year, imports the inventory first so the plan can be
read against it, and finishes on the data-health review.

The importer follows `lkptiImport`'s two-stage shape — a pure workbook parser and a pure
rows-to-workspace derivation — so every rule that can be wrong is unit-testable without a browser.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Vite 6
**Primary Dependencies**: `xlsx` (already present, used by both existing importers), `idb`
**Storage**: IndexedDB via `src/lib/db.ts` (schema v19; no new object store required)
**Testing**: Vitest for pure logic (`src/lib/*.test.ts`), Playwright for workflows (`e2e/`)
**Target Platform**: Browser, local-first, no accounts, no backend
**Project Type**: Single-project SPA
**Performance Goals**: Onboarding with two 300-row returns completes < 60s (SC-003); no new work proportional to n² (FR-023)
**Constraints**: Must not deepen issue #36 (RPTI/LKPTI tabs already render n² DOM nodes); a refused import must leave the workspace untouched (FR-011)
**Scale/Scope**: Hundreds of applications per return; two new library modules, one rewritten component, one prop added to `ReportsView`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|---|---|
| **I. Rules Before Pixels** | **PASS.** The risk here is domain logic — category-to-type classification, quarter-to-period conversion, upgrade-vs-new placement, match-or-report. All of it lands in pure functions under `src/lib/`, tested first. The picker rewrite is presentation and carries correspondingly less ceremony. |
| **II. Nothing Ambiguous Gets Built Silently** | **PASS.** Three clarifications were raised in the spec and settled with the product owner before planning: initiative derivation, timing placement, and the reporting year. A fourth ambiguity — what to do with an upgrade row that matches nothing — was settled as *report it* rather than guessed at (FR-019). |
| **III. Test at the Altitude of the Risk** | **PASS.** Parser and derivation are pure and get Vitest. The onboarding flow, the two-slot screen, and landing on data health get Playwright. Red-first is mandatory, and any test written after its implementation must be shown to fail by reverting that implementation. |
| **IV. Rejected Alternatives Are Recorded** | **PASS.** [research.md](./research.md) records what was rejected and why for each decision — notably single-stage import, and navigating via `onNavigate`. |
| **V. Verification Is Enforced, Not Reported** | **PASS.** CI already runs unit tests, build, lint and a ratcheted typecheck, all blocking. This feature adds no `continue-on-error` and must not raise the typecheck baseline above 1. |

**Result: PASS — no violations, Complexity Tracking not required.**

## Project Structure

### Documentation (this feature)

```
specs/001-rpti-import-onboarding/
├── spec.md
├── plan.md              # this file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── rpti-import.md   # Phase 1 — the module's public contract
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```
src/
├── lib/
│   ├── rptiImport.ts           # NEW — parse + derive, mirroring lkptiImport.ts
│   ├── rptiImport.test.ts      # NEW — Vitest
│   ├── rpti.ts                 # MODIFIED — add quarter+year → period helper
│   └── workspaceTemplates.ts   # MODIFIED — template list reduced
├── components/
│   ├── TemplatePickerModal.tsx # REWRITTEN — two paths, two slots, per-return year
│   └── ReportsView.tsx         # MODIFIED — accept an initial report slug
└── App.tsx                     # MODIFIED — onboarding orchestration, land on data health

e2e/
├── rpti-import-onboarding.spec.ts   # NEW
└── (nine existing specs touch onboarding — see research.md §6)
```

**Structure Decision**: Single project, following the existing layout exactly. Domain logic in
`src/lib/` with adjacent Vitest; components in `src/components/`; workflows in `e2e/`. No new
top-level structure, no new object store, no schema bump — imported entities use the stores that
already exist.

## Complexity Tracking

> No Constitution Check violations. Section intentionally empty.

## Phase 1 Notes

Two design consequences are worth carrying into tasks:

1. **`ReportsView` needs a seam it does not have.** `selectedReport` is local state with no way in
   (`ReportsView.tsx:97`). FR-022 requires an optional initial-report prop. This is the smallest
   change that satisfies it; lifting the state would touch every report path for no benefit.

2. **The nine affected e2e specs must be read, not repointed.** Several use the picker only as
   setup to reach a workspace, so they will fail for reasons unrelated to what they assert. The
   History-tab refactor showed how mechanical repointing silently drops guarantees — the fix there
   was found only because a marker was missing from a rebuilt list.
