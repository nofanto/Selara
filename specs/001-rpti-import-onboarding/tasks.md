# Tasks: OJK-First Onboarding and RPTI Return Import

**Feature**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Branch**: `001-rpti-import-onboarding`

**Input**: spec.md, plan.md, research.md, data-model.md, contracts/rpti-import.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]** — parallelizable (different files, no dependency on incomplete work)
- **[US1/US2/US3]** — the user story the task serves

**Tests are mandatory here**, not optional: Constitution Principle III requires tests at the
altitude of the risk, written Red-first, and CLAUDE.md step 2 requires the failure to be observed
before implementation.

## Path Conventions

Single-project SPA. Domain logic in `src/lib/` with adjacent Vitest; components in
`src/components/`; workflows in `e2e/`.

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Export a Format 3.1 and a Format 3.2.6 fixture pair from a demo workspace and commit them to `e2e/fixtures/` per quickstart.md — the importer inverts Selara's own exports, so the app generates its own fixtures
- [X] T002 [P] Produce ~300-row fixture returns for scale validation in `e2e/fixtures/`, seeded the way issue #36 was measured

---

## Phase 2: Foundational (Blocking Prerequisites)

**Blocks all user stories. T003 in particular must land before the picker is touched.**

- [X] T003 Audit the nine e2e specs that reference onboarding (research.md §6) and record, in `specs/001-rpti-import-onboarding/e2e-audit.md`, what each one protects and whether the picker is incidental setup or the thing under test
- [X] T004 [P] Write failing Vitest for `periodForQuarter(quarter, year)` in `src/lib/rpti.test.ts`, including the round-trip property `deriveQuarterFromDate(periodForQuarter(q, y).startDate) === q`
- [X] T005 Implement `periodForQuarter` in `src/lib/rpti.ts` alongside the existing `deriveQuarterFromDate`

---

## Phase 3: User Story 1 - Get started from the returns you already filed (Priority: P1) 🎯 MVP

**Goal**: A bank with its filed returns reaches a populated workspace without typing any of it.

**Independent test**: Complete onboarding with a real LKPTI/RPTI pair; confirm the workspace holds
both inventory and plan, and that the data-health review is what appears at the end.

### Tests for User Story 1 (Red first)

- [X] T006 [P] [US1] Failing Vitest in `src/lib/rptiImport.test.ts` for `parseRptiImportWorkbook`: a non-Format-3.1 workbook is rejected by name; every input row appears in exactly one of `rows` or `skipped`; a bad value inside a well-formed sheet skips the row rather than throwing
- [X] T007 [P] [US1] Failing Vitest in `src/lib/rptiImport.test.ts` for category→type mapping, asserted **per code** rather than per range — `01`-`12`/`49` → `application`, `51`-`54`/`99` → `infrastructure`, anything else skipped
- [X] T008 [P] [US1] Failing Vitest in `src/lib/rptiImport.test.ts` for segment placement: `new` yields pre-launch-then-live around the close of its quarter; `upgrade` yields the same **plus** a preceding live segment; every derived segment carries an `initiativeId`
- [X] T009 [P] [US1] Failing Vitest in `src/lib/rptiImport.test.ts` for upgrade matching: attaches on exact name **and** category; yields an unresolved reference and creates nothing on zero or multiple matches
- [X] T010 [P] [US1] Failing Vitest in `src/lib/rptiImport.test.ts` asserting derivation is pure — same inputs produce identical output, ids derive from row position rather than `Date.now()`
- [X] T011 [US1] Failing Playwright in `e2e/rpti-import-onboarding.spec.ts` for the journey: two slots with LKPTI required and RPTI optional; a year asked per return with 2026/2027 differing; LKPTI processed first; infrastructure present; matched upgrade attached not duplicated; unmatched upgrade appearing in data health; **skipped rows listed with position and reason**; ends on data health; LKPTI-alone also completes

### Implementation for User Story 1

- [X] T012 [US1] Define `RptiImportRow`, `RptiImportSkippedRow`, `ParseRptiImportResult` and implement `parseRptiImportWorkbook` + `parseRptiImportFile` in `src/lib/rptiImport.ts`, mirroring `lkptiImport.ts`'s two-stage split
- [X] T013 [US1] Implement `deriveWorkspaceFromRptiImport(rows, reportYear, existing)` in `src/lib/rptiImport.ts` per data-model.md, returning `unresolved` alongside the entities
- [X] T014 [US1] Add the "start from your filed returns" path to `src/components/TemplatePickerModal.tsx`: an LKPTI slot (required) and an RPTI slot (optional), each with its own reporting-year input
- [X] T015 [US1] Add an optional `initialReport?: ReportSlug` prop to `src/components/ReportsView.tsx` so a report can be opened from outside (`selectedReport` is currently local state with no way in)
- [X] T016 [US1] Orchestrate onboarding in `src/App.tsx`: import LKPTI first, then RPTI against it, persist once, then navigate to the data-health report
- [X] T017 [US1] Present an import summary of **skipped rows** — position and reason — before the user reaches the workspace. Unresolved upgrade references are **not** listed here: they persist as unresolved `RptiDetail` targets and surface through data health's existing `rpti-target` check
- [X] T017a [P] [US1] Failing Vitest in `src/lib/dataHealth.test.ts` confirming an imported `RptiDetail` whose target does not resolve raises `rpti-target`, so the existing rule genuinely covers the import case rather than being assumed to

**Checkpoint**: US1 alone is a shippable MVP. The starting screen still shows the old cards
alongside the new path; Phase 4 removes them.

---

## Phase 4: User Story 2 - A starting screen that says what the product is for (Priority: P2)

**Goal**: Two ways to begin, framed around OJK returns.

**Independent test**: Open a fresh workspace and confirm the choices, without uploading anything.

- [X] T018 [P] [US2] Failing Playwright in `e2e/workspace-templates.spec.ts` for exactly two starting paths, OJK purpose stated in the copy, demo data reachable from the start-empty path, and the catalogue still addable from the Visualiser
- [X] T019 [US2] Remove the `rpti` catalogue template from `src/lib/workspaceTemplates.ts`
- [X] T020 [US2] Move the demo-data option onto the start-empty path in `src/components/TemplatePickerModal.tsx` — it is currently reachable **only** through the catalogue card being removed (`TemplatePickerModal.tsx:95-110`), so without this SC-006 breaks
- [X] T021 [US2] Rewrite the screen's heading and copy so preparing OJK returns is the stated purpose

---

## Phase 5: User Story 3 - Opening a colleague's shared file still works (Priority: P3)

**Goal**: Removing Viewer from onboarding must not remove the capability.

**Independent test**: With the simplified screen showing two paths, open a shared export from the
import/sharing surface.

- [X] T022 [P] [US3] Failing Playwright asserting the viewer upload is absent from onboarding and present on the import/share surface
- [X] T023 [US3] Remove the `viewer` template from `src/lib/workspaceTemplates.ts` and its card from `src/components/TemplatePickerModal.tsx`
- [X] T024 [US3] Surface "open a shared file" from the import/export controls in `src/components/DataControls.tsx`, wired to the existing `handleViewerImport` in `src/App.tsx`

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T025 Update the nine affected e2e specs using the T003 audit — read what each protects before changing selectors; do not repoint mechanically
- [X] T026 [P] Update `docs/user-guide/01-getting-started/` and any onboarding references to describe the two paths and the per-return year
- [X] T027 [P] Update `requirement-specs/it-planning-flow.md` to record that step 1 of the onboarding sequencing has shipped
- [X] T028 Verify scale per quickstart.md level 4 — **SC-003 passes; the option-count threshold as written does not, and should not have been written that way.** Measured on the dev server with the 300-row fixtures (390 deliverables / 390 assets / 300 initiatives / 300 RPTI / 240 LKPTI rows):
  - Import + persist **0.1s**, data-health render **0.5s** — against a 60s budget. SC-003 met with room to spare.
  - LKPTI tab 3,908 ms / **100,256** `<option>`; RPTI tab 5,534 ms / **337,120** — both above #36's recorded 78,566 / 141,470.
  - That is **not a rendering regression**. `DataManager.tsx` is untouched by this feature, and the per-row select structure is provably unchanged: the option-count histogram shows LKPTI with exactly one n-sized select per row (391 = 390 deliverables + blank) and RPTI with exactly two (301 initiatives, 781 deliverables + assets) — the three sites #36 named, and no fourth. `241 rows × 416 = 100,256` and `301 × 1120 = 337,120` account for every node.
  - The counts are higher because the workspace is larger, not because a row got heavier. #36's synthetic workspace had no imported initiatives; this one has 300, one per filed RPTI row, which is the feature working as specified. Comparing raw totals across differently-shaped workspaces was the wrong guard — the per-row select count is the invariant, and it held.
  - **Real consequence worth recording on #36**: onboarding now makes a workspace that opens the RPTI tab in ~5.5s reachable in one click from first run, where previously it took deliberate effort to construct. #36 moves from theoretical to routine. (Dev-server figures; #36's production-build numbers ran ~30% faster.)
- [X] T029 Full verification (all green: 278 unit tests, 650 e2e passed / 4 skipped / 0 failed, eslint 0 errors, tsc at the 1 known baseline error): `npm run test:unit`, `npx playwright test`, `npx eslint .` at 0 errors, `npx tsc --noEmit` at no more than the 1 known baseline error

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)** → no dependencies
- **Phase 2 (Foundational)** → blocks all stories; T003 blocks anything touching the picker
- **Phase 3 (US1)** → needs T004/T005 (`periodForQuarter`)
- **Phase 4 (US2)** → needs US1's picker restructure (T014) to exist before cards are removed
- **Phase 5 (US3)** → needs US2's screen (T021) settled
- **Phase 6 (Polish)** → after all stories

### User Story Dependencies

These stories are **not** fully independent, and pretending otherwise would mislead: all three
modify the same component. US1 adds the new path, US2 removes the old cards and rehomes demo data,
US3 removes Viewer. They are ordered so each leaves a working screen — US1 ships with the old cards
still present, which is ugly but functional and independently testable.

### Within Each User Story

Tests → pure library code → component → orchestration. The library work (T012, T013) has no UI
dependency and can proceed while the picker is being restructured.

### Parallel Opportunities

- T004 with T001/T002
- T006-T010 together — all Vitest in one new file, all independent of each other
- T012/T013 (library) in parallel with T014 (component), different files
- T026/T027 (docs) in parallel with each other

## Parallel Example: User Story 1

```
# All five unit-test tasks together — one new file, independent assertions:
T006, T007, T008, T009, T010

# Then library and UI in parallel, different files:
T012 + T013   (src/lib/rptiImport.ts)
T014          (src/components/TemplatePickerModal.tsx)
```

## Implementation Strategy

### MVP First (User Story 1 only)

Phases 1-3 deliver the whole point of the feature: a bank reaches a populated workspace from its
filed returns. The starting screen is untidy at that point — new path plus old cards — but every
capability works and the MVP is independently testable.

### Incremental Delivery

1. Phases 1-2 → foundations, no user-visible change
2. Phase 3 → **MVP**: import works end to end
3. Phase 4 → the screen says what the product is for
4. Phase 5 → Viewer rehomed
5. Phase 6 → specs, docs, scale verification

## Notes

**Resolved 2026-09-14 (was flagged CRITICAL by `/speckit-analyze`).** Imported data is persisted
into the workspace itself — there is no separate import space — so data health operates on it as
ordinary state. An unmatched upgrade row is therefore imported *with* an unresolved
`RptiDetail.targetId`, and the **existing** `rpti-target` check reports it. No new health rule, no
import-results store. T017a exists to prove that rule actually covers the import case.

The same principle answered the partial-failure question: each return commits on its own success,
so a failed RPTI leaves a valid LKPTI-only workspace, and recovery from any unwanted result is the
existing start-over mechanism rather than a rollback.

**Do not deepen issue #36.** Onboarding lands users directly in the RPTI and LKPTI tabs, which
already render n² DOM nodes. No per-row full-list controls. Fixing #36 is not in scope; making it
worse is a regression (T028).
