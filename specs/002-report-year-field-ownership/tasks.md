---

description: "Task list for Report Year and Report-Row Field Ownership"
---

# Tasks: Report Year and Report-Row Field Ownership

**Input**: Design documents from `/specs/002-report-year-field-ownership/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/generation.md

**Tests**: Included and mandatory. Constitution principle III requires tests where the risk lives,
seen to fail before the code that satisfies them. Almost all the risk here is in pure functions.

**Organization**: By user story. Note that **US1's goal is delivered by moving the fields and US3
makes them editable** — the field move serves both, so it sits in US1 where the round trip proves
it, and US3 adds the surface for maintaining them.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US4 per spec.md

---

## Phase 1: Setup

**Purpose**: Establish the Red baseline before anything changes.

- [x] T001 Extend `src/lib/sampleReturns.test.ts` with a round-trip assertion that imports both sample returns, discards the imported report rows, regenerates, and compares **exported values** field by field. It must FAIL, reporting the 8 LKPTI fields and 2 RPTI fields currently lost. Compare exported values rather than raw detail fields — `resolveCost` falls back to the initiative's figures, so `capexAmount`/`opexAmount` appear lost while the filed number is intact (research.md R7).

**Checkpoint**: SC-001 is red and the exact gap is recorded in test output.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Field homes and the safety net. **No user story work can begin until this is done.**

- [x] T002 [P] Add `platform`, `database`, `dcProvider`, `drcProvider`, `backupStrategy`, `systemOwner`, `ownership`, `ppjtiRelatedParty` to `Deliverable` in `src/types.ts` (11 → 19 fields), all optional, each with a comment naming the return column it serves.
- [x] T003 [P] Add `rptiRemarks` to `Initiative` in `src/types.ts` (18 → 19). Its comment MUST distinguish it from `description`, which already supplies the RPTI `Deskripsi` column (FR-013, data-model.md).
- [x] T004 Widen `Deliverable.developer` to carry a provider name as well as the two-value classification, in `src/types.ts`. Record how each return reads it: RPTI derives `'PPJTI'` from "a name that is not `inhouse`", LKPTI emits the name.
- [x] T005 Write failing tests for the attribute lift in `src/lib/attributeLift.test.ts`, covering contracts 14–17: values move onto the deliverable, running twice changes nothing, an existing value on the deliverable is never overwritten, and the orphaned properties are left in place on the stored row.
- [x] T006 Implement `src/lib/attributeLift.ts` as a pure function taking deliverables plus stored LKPTI/RPTI rows and returning updated deliverables and initiatives.
- [x] T007 Run the lift on workspace load in `src/App.tsx`, before any generation can replace the rows holding the values (FR-019, research.md R5).

**Checkpoint**: Fields exist in their new homes; a pre-change workspace is safe from the first press of Generate.

---

## Phase 3: User Story 1 - Import, fix, generate the same return back (Priority: P1) 🎯 MVP

**Goal**: A generated return reproduces the imported one.

**Independent Test**: Run T001's test. Zero differences for reproducible rows.

### Tests for User Story 1

- [x] T008 [P] [US1] Add failing tests to `src/lib/lkptiImport.test.ts` asserting the importer writes the eight attributes onto the `Deliverable`, not only onto the LKPTI row.
- [x] T009 [P] [US1] Add failing tests to `src/lib/rptiImport.test.ts` asserting `remarks` lands on the `Initiative` as `rptiRemarks` and `ppjtiRelatedParty` on the `Deliverable`.
- [x] T010 [P] [US1] Add failing tests to `src/lib/lkpti.test.ts` asserting `generateLkptiDetails` reads the eight attributes from the deliverable and emits them identically to today (contract 9).
- [x] T011 [P] [US1] Add failing tests to `src/lib/rpti.test.ts` asserting `generateRptiDetails` reads `rptiRemarks` from the initiative and `ppjtiRelatedParty` from the deliverable (contracts 4, 5).
- [ ] T012 [US1] Add a failing test in `src/lib/sampleReturns.test.ts` asserting an unreproducible row is named before a file is produced, and that repairing it makes the next generation reproduce it (contracts 12, 13 / FR-024, FR-025).

### Implementation for User Story 1

- [x] T013 [US1] Write the eight attributes onto the `Deliverable` in `src/lib/lkptiImport.ts`, keeping the existing LKPTI row output unchanged for now.
- [x] T014 [US1] Write `rptiRemarks` onto the `Initiative` and `ppjtiRelatedParty` onto the `Deliverable` in `src/lib/rptiImport.ts`.
- [x] T015 [US1] Read the eight attributes from the deliverable in `generateLkptiDetails` (`src/lib/lkpti.ts`) instead of carrying them from the existing row.
- [x] T016 [US1] Read `rptiRemarks` and `ppjtiRelatedParty` from their new homes in `generateRptiDetails` (`src/lib/rpti.ts`).
- [x] T017 [US1] ~~Remove the moved fields from `LkptiDetail` and `RptiDetail`~~ — **revised during implementation: the fields stay, marked as derived output.** Both exporters read their columns straight off the detail row (`lkpti.ts:209-219`, `rpti.ts:382,388`), so the detail types *are* the exported row shape. Removing the fields would break both returns. What changed is the source of truth, not the projection's shape: `src/types.ts` now documents them as filled by generation from the `Deliverable`/`Initiative`, and warns that a value written directly onto a row is overwritten by the next generation.
**Checkpoint**: T001 passes. US1's round-trip field-fidelity claim holds; its Reports pre-export
gate is deliberately implemented with the Reports workflow in Phase 4 (T018).

---

## Phase 4: User Story 2 - Generate for a stated year (Priority: P1)

**Goal**: A return covers one year, and that year is always asked.

**Independent Test**: Generate for two different years from one workspace; each return covers only its year and says so. No path uses the system clock.

### Tests for User Story 2

- [x] T019 [P] [US2] Add failing tests to `src/lib/lkpti.test.ts` for the as-at rule (contracts 6–8, 10): an application live 2021-06→2025-06 is present as at 31 Dec 2024 and **absent** as at 31 Dec 2026; one not yet live is absent; omitting the date is not permitted.
- [x] T020 [P] [US2] Add a failing test asserting no code path supplies `new Date().getFullYear()` as a report year (FR-005, contract 1).
- [x] T021 [P] [US2] Add `e2e/report-year.spec.ts`, failing: the Reports menu asks for a year before producing either return, and the produced return states the year it covers.

### Implementation for User Story 2

- [x] T022 [US2] Give `generateLkptiDetails` a required `asAtDate` parameter in `src/lib/lkpti.ts`, replacing `startDate <= today` with a span test `startDate <= asAt && endDate >= asAt` (research.md R2). **This also fixes a measured defect**: a decommissioned application currently still appears. The one production caller without a year prompt (`DataManager.tsx:251`) is removed by T026a, so no call site has to invent a date. When the parameter lands, pass `'2026-12-31'` in `src/lib/roundTrip.test.ts` — the sample LKPTI is the 2026 inventory while the file's `REPORT_YEAR` is 2027, and reaching for the nearby constant asserts the wrong period without failing.
- [x] T023 [US2] Add the year prompt and generate action to `src/components/ReportsView.tsx`, defaulting to the year given at onboarding where one exists, otherwise unset. *(The prompt/action is implemented; onboarding defaults remain with T031.)*
- [x] T024 [P] [US2] Update `src/components/RptiReportView.tsx` to generate for the stated year and state it. Its copy currently reads "RPTI rows are managed in Data Manager → RPTI. This screen is a read-only summary and export" — now wrong.
- [x] T025 [P] [US2] Update `src/components/LkptiReportView.tsx` the same way, with an as-at year.
- [x] T026c [US2] Lift any `RptiDetail.capexAmount`/`opexAmount` that differs from its initiative's figure onto the initiative, in `src/lib/attributeLift.ts` (FR-031). Must run before T026d, which deletes the fields. Imported overrides equal the initiative already; a hand-edited one does not, and dropping it is the silent loss this feature exists to prevent.
- [x] T026d [US2] Remove `capexAmount`/`opexAmount` from `RptiDetail` in `src/types.ts` and collapse `resolveCost` in `src/lib/rpti.ts` to read the initiative directly (FR-028, Q7). Update `rptiImport.ts:443-444` to stop writing the override; it already writes the same figure to the initiative at `:424-425`.
- [x] T026e [US2] Make generation honour `Initiative.deliverableId` with year-independent single-deliverable inference for legacy undeclared targets (Q10), so one initiative yields at most one generated row (FR-029) in `src/lib/rpti.ts`.
- [x] T026f [US2] Add a data-health **error** for an initiative without a declared target whose segments span multiple deliverables, naming target selection or a split as the fix (Q10 supersedes the broader check) (FR-030) in `src/lib/dataHealth.ts`, with a unit test. Measured: no shipped template or sample return contains this arrangement, so nothing today trips it — which is exactly why it needs a test rather than a fixture.
- [x] T026g [US2] **Failing first.** Add a **constructed** scenario proving an asset-target row cannot vanish silently from a Reports-generated filing (Q8). The sample fixture holds only deliverable targets and would pass either way, so the test must build the row itself. Precedes T026h and T018's gate, per the Red–Green rule in `CLAUDE.md` §1.2.
- [x] T026h [US2] Add a data-health **error** for any `RptiDetail` with `targetType: 'asset'`, naming the repair — record the item as a Deliverable under its Asset and point the initiative at it (FR-032, FR-033) — in `src/lib/dataHealth.ts`. Turns T026g green.
- [x] T018 [US1/US2] **Relocated from Phase 3 because it depends on this workflow.** Surface **every** RPTI row generation cannot reproduce, before export, naming what to repair (FR-024, FR-033). Not just the unresolved `rpti-target` import: the asset-target row (FR-032) and any later unreproducible kind must come through the same path. `dataHealth.ts` already raises `rpti-target` — reuse that finding rather than inventing a second one.
  - The gate belongs where the export actually happens: `src/components/RptiReportView.tsx:30-37` calls `exportRptiReportToExcel` **unconditionally today**, so `ReportsView.tsx` alone is the wrong place to put it.
  - Its test must construct an asset-target row, generate the RPTI from Reports, and assert the named repair is visible *before* an export is available. A `dataHealth.ts` unit test proves the diagnosis exists, not that the preparer sees it in time — and FR-025 is about the preparer, not the checker.
- [x] T026a [US2] Make both report tabs read-only in `src/components/DataManager.tsx` and remove their two Generate buttons (FR-021). Drops the asset entries from the RPTI Target dropdown (`:208-210`) as a consequence. *(Unblocked by Q7 and Q8; depends on T026d, T026h and T018's export gate — the tab must not become read-only while an unreproducible row can still reach a filing unannounced.)* The tabs stay present and populated; nothing in them accepts an edit. *(Revised 2026-09-18 — the earlier task asserted the opposite, that the tabs were untouched.)*
- [ ] T026 [US2] Assert in `e2e/report-year.spec.ts` that the Reports-menu path does not mutate stored rows (contract 3), and that neither report tab accepts an edit or offers a generate action (FR-021).
- [x] T026b [US2] Revisit the seven e2e specs that drive those tabs — `import-merge`, `lkpti-import-onboarding`, `rpti-import-onboarding`, `rpti-data-manager` (7 replacement scenarios), `lkpti-report`, `rpti-report`, `report-history-diff`. Those asserting an edit must move to the owning entity or to Reports; those asserting the rows are *populated* by import stay as they are.

**Checkpoint**: US1 and US2 both work. Returns are faithful and year-scoped.

---

## Phase 5: User Story 3 - Attributes are maintained on the application (Priority: P2)

**Goal**: One place to record and edit each attribute, and data health points there.

**Independent Test**: Edit each attribute on the Deliverables tab; regenerate; the value survives and data health sends you to the same place.

- [ ] T027 [P] [US3] Add the eight columns to `deliverableColumns` and `rptiRemarks` to `initiativeColumns` in `src/components/DataManager.tsx`, sized by content per #44 — the Deliverables tab goes 10 → 18 columns.
- [ ] T028 [US3] Repoint **every** data-health finding whose `location` is `tab('lkpti')` or `tab('rpti')` at the entity that now holds the value, updating both message and `location` (FR-018, FR-021a). Seven locations across eleven check kinds: `lkpti-duplicate-name`, `lkpti-golive-future`, `lkpti-golive-invalid`, `lkpti-incomplete`, `lkpti-target`, `lkpti-too-long`, `lkpti-untidy-text`, `rpti-incomplete`, `rpti-initiative`, `rpti-segment`, `rpti-target`. Once T026a lands, each of these sends the preparer to a screen where nothing can be fixed — this is the task most easily missed, because none of them fail a test today.
- [ ] T028a [US3] Rewrite the `rpti-target` finding for source-side repair (FR-021b). Today it reads "An RPTI row for X points at a deliverable that no longer exists" and is fixed by editing the Target dropdown in the read-only-to-be RPTI tab. It must instead name the application the filed plan refers to and direct the preparer to create or correct it on the Deliverables tab, which is what makes the next generation reproduce the row. Without this, FR-025 — repairing what data health flags is sufficient — has no remaining repair path.
- [ ] T029 [P] [US3] Add nine explicit field comparisons to `diff.ts` — eight on `Deliverable`, one on `Initiative` — with a test that each appears in the difference report. `compareEntities` is generic over entities, not fields, so an unlisted field changes silently ([#42](https://github.com/nofanto/Selara/issues/42)).
- [ ] T030 [P] [US3] Assert the workspace export/import round trip carries the new fields with no change to `excel.ts` (contract 21) — verify rather than assume.

**Checkpoint**: Attributes are editable, diffed, and exported in one place.

---

## Phase 6: User Story 4 - Onboarding years are not wasted (Priority: P3)

**Goal**: The years stated at onboarding become the offered defaults.

**Independent Test**: Import with 2026/2027, then generate; those years are what is offered.

- [ ] T031 [US4] Retain both onboarding years in `src/App.tsx` so generation can offer them, replacing their current use as banner text only.
- [ ] T032 [US4] Pass the LKPTI year through to `deriveWorkspaceFromLkptiImport`, which takes only rows today, so the imported inventory records when it was true.

**Checkpoint**: All four stories functional.

---

## Phase 7: Polish & Records

**Purpose**: What the lifecycle requires for a data-model change.

- [ ] T033 [P] Write an ADR in `docs/adr/` recording the field moves, the rejected child-store option, why no IndexedDB version bump is needed, and the LKPTI membership change. Add it to the ADR index.
- [ ] T034 [P] Update `docs/database-diagram.md` with the nine fields across two entities.
- [ ] T035 [P] Update `requirement-specs/lkpti-integration.md` — the as-at rule replaces "has ever gone live".
- [ ] T036 [P] Mark Q1–Q3 as implemented in `requirement-specs/report-rows-as-projections.md`, and Q5/Q6 as superseded by the read-only decision recorded there on 2026-09-18.
- [ ] T037 [P] Update `docs/user-guide/` — the Reports menu now asks for a year, and the eight attributes are recorded on the application rather than on the LKPTI row. Three lines become actively wrong and must change, not merely be extended: `14-rpti-report/recording-an-rpti-row.md:5` and `:44` ("Edit any cell inline, the same as any other Data Manager table" — the sharpest, since it instructs an edit that no longer reaches the filing) and `15-lkpti-report/recording-lkpti-rows.md:5`. Also revise `15-lkpti-report/importing-an-lkpti-report.md:27`, which describes a Generate button that no longer exists.
- [ ] T038 **Release note** in the PR description and `docs/adr/` entry from T033: a decommissioned application will drop out of the generated LKPTI. Correct, previously intended, but a behaviour change that must be stated rather than shipped quietly (research.md R2). The note must also state the second behaviour change: both Data Manager report tabs become read-only and generation moves to Reports.
- [ ] T039 Run `quickstart.md` levels 1–7, including the 300-application scale check and the #44 column-clipping harness.
- [ ] T040 Full verification: `npm run test:unit`, `npx playwright test`, `npx eslint .` at 0 errors, `npx tsc --noEmit` at no more than the 1 known baseline error.

---

## Dependencies & Execution Order

- **Phase 1** → **Phase 2** → user stories. Phase 2 blocks everything: nothing can read a field that has no home.
- **US1 (Phase 3)** must precede **US3 (Phase 5)**: US1 moves the data, US3 adds the surface for maintaining it.
- **US2 (Phase 4)** is independent of US1 and could run in parallel with it, but shares `lkpti.ts` and `rpti.ts` with T015/T016 — sequence them to avoid conflicts in the same file.
- **US4 (Phase 6)** depends on US2, since there is nowhere to offer a default until the prompt exists.
- **T017 is ordered deliberately**: removing fields from the detail types before their readers are rewired breaks the build.

### Parallel Opportunities

- T002, T003 — different sections of `types.ts`, safe together
- T008–T011 — four different test files
- T024, T025 — two different report views
- T027, T029, T030 — different files
- T033–T037 — five documents

---

## Implementation Strategy

**MVP is Phase 1 + 2 + 3.** At that point a generated return reproduces the imported one, which is
the feature's reason to exist. It is independently valuable even if the year work never lands.

Then **Phase 4** for year-scoping, which is the other P1 and the half that fixes #40.

Phases 5–7 are maintenance surface and records; the lifecycle requires 7 before this is done.

**Stop and validate at each checkpoint.** T001's test is the single best signal — it is red now and
must be green at the end of Phase 3.
