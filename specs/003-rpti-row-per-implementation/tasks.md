# Tasks: An RPTI row is one planned implementation, not one initiative

**Feature**: `003-rpti-row-per-implementation` · **Date**: 2026-09-22

**Input**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) ·
[data-model.md](./data-model.md) · [contracts/generation.md](./contracts/generation.md) ·
[quickstart.md](./quickstart.md)

## Format: `[ID] [P?] [Story] Description`

- **[P]** — parallelisable: different file, no dependency on an incomplete task
- **[US1]–[US4]** — the user story a task serves; setup, foundational and polish carry none

## Path Conventions

Single-project SPA. Pure logic in `src/lib/` with Vitest adjacent; UI-facing behaviour in `e2e/`
with Playwright. **Tests are mandatory, not optional** — the constitution requires them at the
altitude of the risk, and requires them to be *seen to fail* before the code that satisfies them.

---

## Phase 1: Setup

- [x] T001 Existing branch `052-multi-implementation-detection` at `41a07ca` already contains `7a75726` above merged `main` (`5100509`); no branch change needed.
- [x] T002 [P] Re-measured on `41a07ca` before implementation, via the red tests in `src/lib/rpti.test.ts` (`/tmp/selara-003-phase3-red3.log`): Q2 + Q4 2027 go-lives produced **1 row, Q4**; a Q2 2027 live segment ending 2031 produced **1 row in each of 2027, 2028, 2029, 2030, 2031**; a 2020 live segment attached to a 2027 retirement produced **1 2027 upgrade row stating Q1**. These match R1's earlier measurements on `7a75726`.

---

## Phase 2: Foundational (blocking — no user story may start before these)

**Two product decisions block implementation.** They are in `plan.md` Complexity Tracking because
every available answer is an invention, and choosing silently is what the constitution forbids.

- [x] T003 **DECISION — CLOSED 2026-09-22: no migration, and none needed.** The initiative's budget and the implementation's filed figure are *different values*, not two copies of one — the initiative's drives the timeline and budget report, the implementation's is what the return states. Import seeds both; they may diverge. Nothing is distributed, nothing is lost, and existing workspaces keep their budgets. Superseded question was: Options recorded in `plan.md`: whole figure to the earliest implementation with the rest at zero; equal split; leave all at zero and require entry before export. Record the answer and its rejected alternatives as a decided question in `requirement-specs/report-rows-as-projections.md`. Blocks T020 and T045 (the migration). T031 does **not** depend on it: an imported return states its own costs per row, so nothing is distributed. Whichever is chosen, the preparer MUST be told rather than discovering it.
- [x] T004 **DECISION — CLOSED 2026-09-22: remove `Initiative.deliverableId` with its UI.** The field was invented for Q10's single-target rule, which this feature withdraws, and the grouping model works entirely through segments' `initiativeId` — the field plays no part in it. Keeping it deprecated was rejected outright: nobody reads type comments, and a visible control that silently does nothing is worse than either removing it or giving it a real job. Repurposing it as a "default application for new segments" was set aside as a new feature wearing an old field's name, which users would reasonably expect to behave as it does today. Record with rejected alternatives in `requirement-specs/report-rows-as-projections.md`.
- [x] T005 **CLOSED 2026-09-22 — the risk does not arise.** `Initiative.capex` is no longer derived, so an initiative with no implementations keeps its budget and the timeline is unaffected. Superseded task was: measure the zero-total risk before building the derivation. Count initiatives in the shipped demo catalogue and the sample import that have a budget but no qualifying implementation; those would derive to zero under FR-009a. Record the number. If it is non-trivial, raise it before T020 rather than after — a pre-implementation initiative carrying a budget is a real thing on a timeline.
- [x] T006 Add `capexAmount`, `opexAmount` and `rptiRemarks` to `DeliverableSegment` in `src/types.ts`, each optional, each with a comment naming the filed column it supplies and pointing at Q17.

**Checkpoint**: the entity can hold what a plan line states, and nothing has changed behaviour yet.

---

## Phase 3: User Story 1 — Both go-lives reach the filing (P1) 🎯 MVP

**Goal**: an initiative with two implementations in one year files two rows, each stating its own
implementation time.

**Independent test**: build a workspace with live segments starting Q2 and Q4 of 2027, generate for
2027, count rows and read their quarters.

### Tests (write first, observe failing)

- [x] T007 [P] [US1] Failing test in `src/lib/rpti.test.ts`: two live segments on one application starting Q2 and Q4 of the filed year produce **two** rows with quarters Q2 and Q4 (contract 4). Today: one row, Q4. *(Satisfies FR-002, SC-001.)*
- [x] T008 [P] [US1] Failing test in `src/lib/rpti.test.ts`: a segment starting in 2027 and running to 2031 produces a row in **2027 only** (contract 3). Today: a row in every year until the segment ends.
- [x] T008a [P] [US1] Failing test in `src/lib/rpti.test.ts`: an implementation falling outside the filed year produces no row **and no reconciliation finding** (contract 7). Absence from a year is correct, not unreproducibility — the companion rule from Q11.
- [x] T009 [P] [US1] Failing test in `src/lib/rpti.test.ts`: a pre-launch phase followed by a live phase in the same year is **one** implementation, so one row, typed `new` (contract 5).
- [x] T010 [P] [US1] Failing test in `src/lib/rpti.test.ts`: an initiative with implementations on two different applications produces **two** rows, one per application (contract 6).
- [x] T010a [P] [US1] Failing test in `src/lib/rpti.test.ts`: two implementations of the **same** application produce rows carrying identical application-level values — category, developer, related party, DC/DR locations, platform (FR-007). Newly at risk: one application can now produce several rows, so a cascade bug would surface as two rows disagreeing about the same application. *Checked all RPTI application columns. Platform remains on the Deliverable; RPTI Format 3.1 has no platform column to compare between rows.*
- [x] T011 [P] [US1] **Regression guard** in `src/lib/rpti.test.ts`: a workspace where every initiative has exactly one implementation produces the same **filed values** in the same **order** and the same **count** as today (SC-003, contract 8). *(Clarified 2026-09-22: compares filed values only, explicitly **excluding** internal ids. `RptiDetail.id` appears in no exported column, is never persisted on the projection path, and reconciliation matches by canonical identity rather than id string — so requiring id stability would constrain T014's design for nothing a preparer can observe. Preserving legacy ids for single-implementation rows only was considered and rejected: it makes the scheme depend on how many rows exist, so adding a second implementation would retroactively change the first row's id — the instability T014 exists to prevent.)* This is the test most likely to catch an over-broad change, and almost every real workspace is this shape. *Passed on baseline; temporarily changing category in the projection made it fail (`/tmp/selara-003-t011-mutation-red.log`); restored and green.* *(Satisfies FR-003.)*
- [x] T012 [P] [US1] Failing e2e in `e2e/report-year.spec.ts`: generate 2027 from a workspace with two implementations and see two rows in the Reports view, then both in the exported workbook. *(Satisfies SC-001.)*

### Implementation

- [x] T013 [US1] Replace the overlap membership test at `src/lib/rpti.ts:151` with **start-within-year** on the implementation (contract 2). This single change resolves all three symptoms in research.md R1.
- [x] T013a [US1] **CORRECTION.** Restrict membership to segments flagged `isLiveStatus` — a transition **into production** (contract 2, corrected; FR-001a). The first pass admitted pre-launch starts too, because contract 2 said "live or pre-launch", contradicting the spec's Q2 answer. Measured defect: a build with its run-up in 2026 and go-live in April 2027 filed twice; it now files only in 2027.
- [x] T013b [US1] **Failing test first**, in `src/lib/rpti.test.ts`: a build whose run-up starts in 2026 and whose go-live is in 2027 files nothing in 2026 and one `new` / Q2 row in 2027 (contract 2a). Red observed in `/tmp/selara-003-t013-red.log`: expected `[]` for 2026, received a run-up row; green in `/tmp/selara-003-t013-green.log`.
- [x] T013c [US1] Re-derive `new` vs `upgrade` from the deliverable's history — `new` when it has no live phase beginning before the filed year, `upgrade` otherwise (contract 2b, FR-001b). Both branches tested with 2026 first go-live and 2027 later go-live. Red observed in `/tmp/selara-003-t013-red.log`: first go-live was `upgrade` instead of `new`; green in `/tmp/selara-003-t013-green.log`.
- [x] T013e [US1] **Authorised scope addition, 2026-09-22.** The corrected membership broke the importer: `rptiImport.ts` synthesised a **pre-launch** segment for a filed `new` row, so round-trip regeneration omitted 11 rows and mistyped an infrastructure upgrade. Each imported filed row now has a **live** anchor at its filed quarter, for `new` and `upgrade` alike. An upgrade without inventory history gets an unlinked prior-live phase, which distinguishes its type without filing an extra prior-year row. Red observed in `/tmp/selara-003-t013-import-red.log` (sample `new` row missing) and `/tmp/selara-003-t013-prior-red.log` (synthetic history filed an extra 2026 row); affected unit files green in `/tmp/selara-003-t013-import-final.log`.
  - **The risk it creates**: `developmentType` now rests *entirely* on prior-live history, since the qualifying set holds no pre-launch segments. If an upgrade's prior-live segment is wrong, absent, or positioned after the filed year, every imported upgrade types as `new`. Test both directions on the real sample, not a synthetic pair.
  - **Test-adjustment line**: tests encoding *how* a row is modelled (segment status, count, ids) may change — the modelling genuinely moved. Tests asserting *what survives* a round trip — filed values, row count, development type, quarter — may not. A failure there is a defect to fix, never an expectation to update.
  - **Consequence for Phase 5**: T034's import work now starts from a moved importer. Note it there rather than rediscovering it.
- [x] T013d [US1] Re-checked T009 and T011 against contract 2b. T009's second go-live in the same year is `new`, since no live phase began before that year; T011's first live start without run-up is also `new`, while its same-year run-up plus go-live remains `new` / Q2. Demo counts by filing year changed from `2025=1, 2026=6, 2027=1, 2028=0` to `2025=1, 2026=0, 2027=1, 2028=0`; React Native Shell appears only in 2027 as `new` / Q2. The demo count and target are asserted in `src/lib/rpti.test.ts`.
- [x] T013f [US1] **Decision applied 2026-09-23.** Decide `new` vs `upgrade` against everything live before *this implementation*, not before the filed year (contract 2b, corrected; FR-001b). Two go-lives on a brand-new application previously both typed `new`, stating in one return that the same application was built from nothing twice. Red first: `types the second go-live of a brand-new application as an upgrade` and T009's own assertion both failed against the year-boundary rule. A same-day guard asserts two implementations sharing a start date stay `new`. Falsified after: restoring `seg.startDate < yearStart` fails 2.
- [x] T013g [US1] **Decision applied 2026-09-23.** Anchor an imported filed row on an **open-ended** live phase rather than one bounded by the filed quarter (contract 2c, FR-001c). Measured defect on the published sample: LKPTI as at 2027-12-31 held **14** applications — the 13 from the 2026 inventory plus the one new build that happened to be filed for Q4, while the Q1–Q3 builds were absent and each drew a three-month bar on the timeline. Now **16** in 2027 and 2028: the 13 plus all three new applications, whichever quarter they state. `openEndedDate` moved from `lkptiImport.ts` into `rpti.ts` so both importers share one horizon. Round trip unchanged at 12 of 13 with identical types and quarters. Red first: `keeps every filed new build live from its go-live, whichever quarter it states`; falsified after by restoring `endDate: qEnd`, which fails 4.
- [x] T014 [US1] Project one row per implementation in `src/lib/rpti.ts`, replacing the group-by-initiative pass (contract 1, FR-001). Row id must be stable and derived from the implementation, not from `(initiative, deliverable, year)`.
- [x] T015 [US1] Give the projection a deterministic order for implementations sharing a start date (contract 8), so a regenerated return does not reshuffle. *A temporary removal of the segment-id tie break made the new test fail (`/tmp/selara-003-t015-mutation-red.log`); restored and green.*
- [x] T016 [US1] Remove the `initiative-rpti-multi-implementation` warning from `src/lib/dataHealth.ts` and its tests, **in the same commit as T013/T014** (contract 20). It warns that a second implementation will be dropped; once filed, it is false, and a stale warning teaches preparers to ignore findings. *(Satisfies FR-016.)*

**Checkpoint**: the originating defect is fixed and ordinary single-implementation work is provably
unchanged.

---

## Phase 4: User Story 2 — Each implementation carries its own filed values (P1)

**Goal**: two implementations file different costs and different commentary, and the initiative's
own budget stays a separate, editable portfolio figure that the filing never reads.

*(Corrected 2026-09-23: this goal previously read "the initiative shows a total it does not own",
and the independent test asserted the initiative's displayed figure was the sum of its
implementations. That is the derived-total model the two-figures decision replaced — see R3, Q17
and T027, which keep `Initiative.capex`/`opex` stored and editable. Implementing the stale wording
would have rebuilt the very derivation the decision rejected, and with it the empty-initiative and
migration problems that decision dissolved.)*

**Independent test**: give two implementations different CapEx and different remarks; generate;
confirm each row carries its own, the initiative's own figure is untouched by generation, and data
health raises a divergence **warning** naming both figures without blocking export.

### Tests (write first, observe failing)

- [x] T017 [P] [US2] Failing test in `src/lib/rpti.test.ts`: each row states its own implementation's `capexAmount`/`opexAmount`, never the initiative's (contracts 9, 13). *(Satisfies FR-004.)*
- [x] T017a [P] [US2] Failing test in `src/lib/rpti.test.ts`: splitting one implementation into two, with the original cost divided between them, leaves the **plan's total unchanged** (SC-005, contract 13). This is the double-counting guard — the risk that justified moving cost in the first place. Assert on the summed **filed** amounts, not on the initiative's derived figure, or it tests the derivation instead of the filing. *(Satisfies FR-005.)*
- [x] T018 [P] [US2] Failing test in `src/lib/rpti.test.ts`: each row carries its own implementation's `rptiRemarks` (FR-006, FR-011).
- [x] T019 [P] [US2] Failing test in `src/lib/rpti.test.ts`: an implementation with no stated cost files zero and does not throw (contract 10).
- [x] T020 [P] [US2] Failing test in `src/lib/rpti.test.ts`: `Initiative.capex`/`opex` are **never read as a filing source** — a row states its implementation's figure even when the two disagree (contract 11). Assert the divergent case specifically; equal figures would pass whichever source was read.
- [x] T021 [P] [US2] Failing e2e in `e2e/rpti-data-manager.spec.ts`: setting an initiative budget that differs from its implementations' total raises the divergence **warning**, and the generated filing is unchanged by it (contract 13a, FR-009c). Assert both halves — a warning that fired while the filing had also shifted would hide the thing it is meant to report.
- [x] T022 [P] [US2] Failing e2e: cost and remarks are entered on the segment panel and reach the generated filing after reload.

### Implementation

- [x] T023 [US2] Read cost from the implementation in `resolveCost` (`src/lib/rpti.ts`), removing the initiative fallback (contract 9). *(Satisfies FR-004.)*
- [x] T024 [US2] Read `rptiRemarks` from the implementation in generation, replacing the initiative lookup (FR-011).
- [x] T024a [US2] Remove `rptiRemarks` from `Initiative` in `src/types.ts:83` once T024 reads it from the implementation, and correct the dangling reference in `LkptiDetail.remarks`'s comment at `:256`. Removing the read without removing the field leaves an orphan the type no longer explains — the ADR-0013 failure repeated.
- [x] T024b [US2] Remove the `RPTI Remarks (Keterangan)` column from the Initiatives tab in `src/components/DataManager.tsx:299`. It would edit a value nothing reads, which is the split-brain the read-only report tabs were made read-only to end.
- [x] T024c [US2] Move the `rptiRemarks` comparison in `src/lib/diff.ts:206` from the Initiative comparator to the `DeliverableSegment` comparator, merging with T044. Left on Initiative it reports a field that no longer exists; omitted from the segment the new one is invisible ([#42](https://github.com/nofanto/Selara/issues/42)).
- [x] T025 [US2] Add the budget reconciliation finding to `src/lib/dataHealth.ts` (contract 13a, FR-009c): a **warning** when an initiative's budget differs from the total of its implementations, naming both figures and both places a preparer could act. Never an error and never blocking — it compares two legal states, and a finding that calls a legitimate arrangement a defect is how preparers learn to ignore the gate.
- [x] T026 [US2] Add cost and remarks entry to `src/components/DeliverableSegmentPanel.tsx`, which today edits deliverable, title, status, initiative and dates.
- [x] T027 [US2] **Leave** `Initiative.capex`/`opex` editable in `src/components/InitiativePanel.tsx` and the Initiatives tab — they remain a portfolio figure (FR-009a, revised). Verify no task elsewhere made them read-only. Label both so a preparer can tell which figure is filed and which is the initiative's own.
- [x] T028 [US2] **Extend** the negative-cost rule in `src/lib/validation.ts:36` to the implementation's figures. The initiative's rule stays — that field is still editable (FR-009a, revised).
- [x] T028a [US2] **Move the importer's cost and remarks onto the implementation, in this phase.** Split out of T034 on 2026-09-23 because of an ordering hazard nobody had named: T023 removes the initiative fallback from `resolveCost`, but `rptiImport.ts` writes the filed CapEx/OpEx and Keterangan only to the `Initiative`. Land T023 without this and every imported row files zero — `src/lib/roundTrip.test.ts` goes from zero losses to **24** — measured by stubbing `resolveCost` to zero — breaking SC-002. Write cost and remarks to the created or matched implementation **and keep seeding the initiative's own budget from the same row** (FR-009b, contract 12); both start equal, and divergence is the preparer's to create. `Initiative.deliverableId` is *not* part of this task — that half of T034 stays in its own phase.
- [x] T029 [US2] Find and correct any data-health message naming the Initiatives tab as the place to fix a cost (contract 21). Cost entry has moved; a message naming the wrong screen is the 002 FR-025 failure in miniature.

**Phase 4 TDD evidence (2026-09-23)**

- T017, T017a, T018, T019, T020, T023 and T024: `/tmp/selara-phase4-unit-red.log` (implementation figures were `0`, remarks were absent); falsification: `/tmp/selara-phase4-falsify-generation.log` and `/tmp/selara-phase4-falsify-missing-cost.log`.
- T021, T025 and T029: `/tmp/selara-phase4-e2e-red.log` and `/tmp/selara-phase4-unit-red.log` (warning absent); falsification: `/tmp/selara-phase4-falsify-unit-others.log` and `/tmp/selara-phase4-falsify-e2e.log`.
- T022, T026 and T027: `/tmp/selara-phase4-e2e-red.log` (filed segment inputs absent); falsification: `/tmp/selara-phase4-falsify-e2e.log` (discarding panel values made the reloaded filing state zero/blank while initiative editing remained live).
- T024a and T024b: `/tmp/selara-phase4-attribute-lift-red.log` and `/tmp/selara-phase4-e2e-red.log` (legacy remarks still targeted Initiative and the segment entry surface did not exist); unplaceable-value falsification: `/tmp/selara-phase4-falsify-unplaceable-remarks.log`.
- T024c: `/tmp/selara-phase4-unit-red.log`; falsification: `/tmp/selara-phase4-falsify-unit-others.log` (segment remark change disappeared from history).
- T028: `/tmp/selara-phase4-unit-red.log`; falsification: `/tmp/selara-phase4-falsify-unit-others.log` (negative implementation costs produced no validation errors).
- T028a: `/tmp/selara-phase4-unit-red.log` (imported implementation values were `undefined`); falsification: `/tmp/selara-phase4-falsify-unit-others.log`.
- Coordinator-authorised Q20 migration addition: `/tmp/selara-phase4-q20-red.log`; falsification of existing-value precedence, missing-status safe failure, zero-implementation preservation, multi-implementation no-copy behavior, and persistence at the normal-load boundary: `/tmp/selara-phase4-q20-falsify-precedence-status.log`, `/tmp/selara-phase4-q20-falsify-zero.log`, `/tmp/selara-phase4-q20-falsify-several.log`, and `/tmp/selara-phase4-q20-falsify-boundary.log`.

**Checkpoint**: a filed line's values belong to the line, and there is exactly one place to enter
each.

---

## Phase 5: User Story 3 — A filed return still reproduces after import (P2)

**Goal**: importing a return with two rows for one application and regenerating loses nothing.

**Independent test**: import such a return, regenerate for that year, compare field by field.

### Tests (write first, observe failing)

- [x] T030 [US3] **Build the fixture first.** Add a multi-implementation case to the round-trip fixture — a return with two rows for one application in one year. Decide whether to extend the published `docs/sample-data/sample-rpti-2027.xlsx` (which users are handed) or add a separate test workbook, and say why. Without this, SC-002 reports zero losses while verifying nothing (research.md R10). **Done 2026-09-23:** extended the published sample rather than hiding the feature in a test-only workbook, because the published file is the fixture `roundTrip.test.ts` reads and leaving it single-grain would preserve the blind spot. The reproducible script now generates 14 rows; parsing reports 14 rows and zero skipped. *(Satisfies FR-018.)*
- [x] T030a [US3] **Same-import exact matching (added 2026-09-23 after code inspection).** An upgrade row may match an application created by an earlier row in the same return, using the existing exact name-and-category rule. This extends where matching looks, never how loosely it matches: 002's FR-019 still holds back an application absent from both the inventory and earlier rows in this file, and Legacy Teller Application remains the one unresolved row. Red: `/tmp/selara-phase5-t030a-red.log` measured the second Open API row unresolved. Green: `/tmp/selara-phase5-t030a-green.log`. *(Satisfies FR-018a.)*
- [x] T030b [US3] **Same-import live history (added 2026-09-23 after the T030a red).** The synthetic-history check sees segments created so far in this import as well as pre-existing segments, and compares against this implementation's date (contract 2b). Red: `/tmp/selara-phase5-t030b-red.log` measured three Open API segments, including an invented `2026-01-01` phase; `/tmp/selara-phase5-synthetic-before-lkpti-red.log` measured the resulting LKPTI row as at 2026-12-31. Green: `/tmp/selara-phase5-synthetic-after-lkpti-green.log` measures no 2026 LKPTI row, exactly the Q1 and Q3 2027 starts, and regenerated types `new`, `upgrade`. *(Satisfies FR-018b.)*
- [x] T031 [P] [US3] Failing test in `src/lib/roundTrip.test.ts`: both rows of a multi-implementation return survive import and regeneration with their own times, costs and remarks (contract 23). Red: `/tmp/selara-phase5-t031-red.log` measured only the Q1 row surviving; after T030a, `/tmp/selara-phase5-t031-after-same-import-red.log` measured both rows but the first misclassified as `upgrade`. Green: `/tmp/selara-phase5-t031-green.log`; Q1 is `new`, CapEx 8,800,000,000, OpEx 1,500,000,000, remark “SNAP-compliant open banking initiative.”; Q3 is `upgrade`, CapEx 3,600,000,000, OpEx 720,000,000, remark “Partner API phase 2 capacity upgrade.”, identically in the file and regeneration.
- [x] T032 [P] [US3] Failing test in `src/lib/rptiImport.test.ts`: an imported row's cost and remarks land on the **implementation** it created or matched, not on the initiative (contract 22). **Satisfied by Phase 4 T028a:** `seeds both the initiative budget and filed implementation with each row cost (T028a)` and `writes Keterangan onto the filed implementation as rptiRemarks` remain green on the extended fixture; no duplicate test added.
- [x] T033 [US3] Verify the round-trip test has teeth: stub the implementation-cost read and confirm the expected number of losses appears. A test never observed failing has not been shown to test anything. Red: `/tmp/selara-phase5-t033-red.log` measured 26 losses on the 14-row fixture (13 reproducible rows × CapEx and OpEx), up from the previously measured 24 on the 13-row fixture. The permanent assertion requires exactly 13 CapEx and 13 OpEx losses.

### Implementation

- [x] T034 [US3] Stop setting `Initiative.deliverableId` at `src/lib/rptiImport.ts:421` (T004). Depends on T004. *(The cost-and-remarks half moved to T028a on 2026-09-23 — it has to land with T023, not after it. T013e's live anchors and unlinked prior-live evidence are T028a's to preserve.)* **Done 2026-09-23:** before and after removal, the extended sample measures 1 reconciliation finding, 0 `initiative-rpti-multi-target` errors, 0 `initiative-rpti-no-target` errors and 13 generated rows. Evidence: `/tmp/selara-phase5-t034-before.log`, `/tmp/selara-phase5-t034-after.log`, and the permanent invariant test in `sampleReturns.test.ts`.
- [x] T035 [US3] Confirm zero losses on the extended fixture, and that the existing 13-row sample is unaffected (contract 24, SC-002). **Done 2026-09-23:** `roundTrip.test.ts` reports zero losses over the 14-row file, and an exact workbook-cell comparison against `HEAD` measured `{beforeRows:13,currentRows:14,existingRows:13,existingCellsUnchanged:true}` after excluding only the added Q3 row. Full verification: 430 unit tests and 675 Playwright tests passed; ESLint has 0 errors; TypeScript remains at the one known baseline error in `src/lib/excel.ts:289`.
- [x] T035a [US3] Assert FR-015 as part of T035's verification: after migration, no filed value must be re-entered by hand for the round trip to reproduce. **Done 2026-09-23:** the fixture is imported and regenerated directly without any intervening edit; both Open API rows reproduce their own quarter, type, cost and remarks from canonical entities alone.

**Checkpoint**: the property the previous feature established still holds at the new grain, measured
on a fixture that could actually fail.

---

## Phase 6: User Story 4 — Stored rows still reconcile (P2)

**Goal**: rows filed under the previous model are matched or named; none silently vanishes.

**Independent test**: take a workspace whose stored rows predate the change, generate, confirm each
row is matched or named.

### Tests (write first, observe failing)

- [x] T036 [P] [US4] Failing test in `src/lib/rpti.test.ts`: a stored row matching exactly one current implementation raises **no** finding (contract 17). The grain change must not turn correctly-filed history into noise. **Red:** `/tmp/selara-phase6-unit-red.log` reported the anchored row as `unanchored` because the legacy declared target won. **Green:** `/tmp/selara-phase6-unit-green.log`. **Falsified:** `/tmp/selara-phase6-t036-falsification.log` failed when the anchor was made conditional on that legacy field again. *(Satisfies SC-004.)*
- [x] T037 [P] [US4] Failing test: two stored rows matching one implementation, and one stored row matching several, both raise `identity-conflict` (contract 16). **Red:** `/tmp/selara-phase6-unit-red.log` let the one-to-many legacy row through without a finding. **Green:** `/tmp/selara-phase6-unit-green.log`. **Falsified:** `/tmp/selara-phase6-t037-falsification.log` failed when several exact implementation candidates were made to pick the first. *(Satisfies FR-014, SC-004.)*
- [x] T038 [P] [US4] Failing test: a stored row matching no current implementation is named before export, with a repair (contract 17, FR-013). **Red:** `/tmp/selara-phase6-unit-red.log` silently accepted a deleted implementation anchor. **Green:** `/tmp/selara-phase6-unit-green.log`. **Falsified:** `/tmp/selara-phase6-t038-falsification.log` failed when a missing anchor was allowed to fall back to the old pair identity. *(Satisfies SC-004.)*
- [x] T039 [P] [US4] Failing test asserting reconciliation still matches by **identity, never contents** — a stored row whose quarter or remarks differ from the projection raises nothing (contract 15). Restated because a grain change is exactly where content comparison would creep in. **Red:** `/tmp/selara-phase6-unit-red.log` raised a finding despite the exact segment anchor when the legacy declared target disagreed. **Green:** `/tmp/selara-phase6-unit-green.log`; the test deliberately changes both quarter and remarks. **Falsified:** `/tmp/selara-phase6-t039-falsification.log` failed when anchored matching was made to consult the legacy field.
- [x] T039a [P] [US4] Failing test asserting `reconcileRptiReturn` returns **findings, never rows**, and does not mutate its inputs — pass frozen arrays and assert no throw (contract 18). Marked unchanged by this feature, which is precisely why it needs an assertion: a grain change is where a mutation would be introduced without anyone noticing. **Red:** `/tmp/selara-phase6-unit-red.log` failed the expected finding shape at the new grain. **Green:** `/tmp/selara-phase6-unit-green.log` passes frozen arrays and frozen elements. **Falsified twice:** `/tmp/selara-phase6-t039a-falsification.log` failed when ambiguity accounting was weakened, and `/tmp/selara-phase6-t039a-frozen-falsification.log` failed when reconciliation attempted to mutate the frozen stored array.

### Implementation

- [x] T040 [US4] Move canonical identity to the implementation in `reconcileRptiReturn` (`src/lib/rpti.ts`), using `RptiDetail.deliverableSegmentId` as the anchor where present (contract 14). **Red:** T036, T037, T038 and T039 all failed at the old grain in `/tmp/selara-phase6-unit-red.log`. Canonical candidates are now live segments keyed by segment id; anchored stored rows do not fall back to a different implementation. *(Satisfies FR-010.)*
- [x] T041 [US4] Preserve one-to-one accounting and `identity-conflict` at the new grain (contract 16). **Red:** T037/T039a in `/tmp/selara-phase6-unit-red.log`. **Green/falsification:** `/tmp/selara-phase6-unit-green.log`, `/tmp/selara-phase6-t037-falsification.log`, and `/tmp/selara-phase6-t039a-falsification.log`. Two stored claims share the segment key and one unanchored legacy row matching several segment candidates is ambiguous.
- [x] T042 [US4] Remove the `initiative-rpti-multi-target` error from `src/lib/dataHealth.ts` and its tests (contract 19, FR-008a). It forbids an arrangement that is now legal. **Red:** both application and infrastructure multi-target tests failed in `/tmp/selara-phase6-unit-red.log`. **Green:** `/tmp/selara-phase6-unit-green.log`. **Falsified:** `/tmp/selara-phase6-t042-falsification.log` and `/tmp/selara-phase6-t042-infra-falsification.log` failed when the retired check was temporarily restored. The old export-blocking “ambiguous initiative” error needs no like-for-like replacement because several segment-owned targets are now legal; actual one-to-many stored-row correspondence is still blocked by reconciliation's `identity-conflict`. Asset-target and otherwise unresolved stored rows remain blocked and are exercised in `e2e/report-year.spec.ts`.
- [x] T043 [US4] Delete `resolveRptiTarget` from `src/lib/rpti.ts` and every filing-path caller (`:97`, `:338`, `:391`, `:420`). A segment names its own application, so nothing infers a target any more (FR-008b). **Red:** the reconciliation grain tests and the no-target retirement test failed in `/tmp/selara-phase6-unit-red.log`. **Green:** `/tmp/selara-phase6-unit-green.log`; `rg` finds zero `resolveRptiTarget` references. **Falsified:** `/tmp/selara-phase6-t043-no-target-falsification.log` failed when the inference-era no-target check was temporarily restored.
- [x] T043a [US4] Remove the `initiative-rpti-unanchored-target` check from `src/lib/dataHealth.ts` (`:249-261`) and its tests. It exists precisely because a *declared* target might carry no work; with no declared target the situation cannot arise (FR-008d). A whole finding goes, not just a field. **Red:** `/tmp/selara-phase6-unit-red.log`. **Green:** `/tmp/selara-phase6-unit-green.log`. **Falsified:** `/tmp/selara-phase6-t043a-falsification.log` failed when the retired finding was temporarily restored.
- [x] T043b [US4] **Rebuild the F2 repair path around the segment before removing the field.** Today a stored row whose deliverable was deleted is repaired by selecting the replacement on the initiative, which `rpti.ts:338` then matches on. Under the new model the repair is to correct the **segment's** `deliverableId`. `candidateFor` must match on that, and every repair message must name the segment panel rather than the Initiatives tab — an instruction naming a control that no longer exists is the 002 FR-025 defect repeated (FR-008c). **Ordering proof:** the segment-grain path went green first with all 79 `rpti.test.ts` tests in `/tmp/selara-phase6-t043b-green.log` and again after falsification in `/tmp/selara-phase6-t043b-restored-green.log`; only then was `Initiative.deliverableId` removed. **Red:** 11 relevant reconciliation/message failures appear in `/tmp/selara-phase6-unit-red.log`, and the browser repair failed on old wording in `/tmp/selara-phase6-e2e-red.log`. **Falsified:** `/tmp/selara-phase6-t043b-asset-falsification.log` and `/tmp/selara-phase6-t043b-target-falsification.log` failed when `candidateFor` was made to require the initiative field; `/tmp/selara-phase6-t043b-message-falsification.log` reports 5/5 selected wording tests failed when “segment panel” was removed; `/tmp/selara-phase6-e2e-falsification.log` reports the complete segment-only browser repair failed when the asset candidate was disabled.
- [x] T043c [US4] Remove `deliverableId` from `Initiative` in `src/types.ts:70`, the select at `src/components/InitiativePanel.tsx:112,132-133`, the `Deliverable` column at `src/components/DataManager.tsx:273`, the dangling check at `src/lib/dataHealth.ts:177` and its tests, and the assignment at `src/lib/rptiImport.ts:421`. Do this **after** T043b, so the repair path is never absent (FR-008b, FR-008c). **Red:** `/tmp/selara-phase6-unit-red.log` caught the orphan-field dangling check, and `/tmp/selara-phase6-e2e-red.log` reports 3/3 failures for the panel control, Data Manager column and new repair wording. **Green:** `/tmp/selara-phase6-unit-green.log` and `/tmp/selara-phase6-e2e-green.log`. **Falsified:** `/tmp/selara-phase6-t043c-dangling-falsification.log` and the 3/3 failures in `/tmp/selara-phase6-e2e-falsification.log`. Phase 5 already removed the importer assignment; `src/lib/rptiImport.test.ts` retains the assertion that imported initiatives have no `deliverableId`. IndexedDB orphan properties are deliberately left untouched: there is no lift and no warning.

  **Release note — declared target versus segment:** Removing the Initiative-level target makes the lifecycle segment authoritative. A legacy workspace in which `Initiative.deliverableId` disagrees with its segments may therefore file a different application after this update: the segment wins, as Q18 and FR-008b require. The shipped demo workspace contains **0** such disagreements and the published sample contains **0**, measured in `/tmp/selara-phase6-target-disagreement-measurement.log`; stored orphan properties remain in IndexedDB but are ignored rather than deleted.

  **Phase 6 verification:** `/tmp/selara-phase6-unit-full.log` reports **435/435 unit tests passed**. `/tmp/selara-phase6-e2e-full-final.log` reports **673 passed, 4 skipped** with exit code 0; the first full run found and removed one obsolete test whose subject was the retired Initiative control. `/tmp/selara-phase6-eslint-final.log` completed with **0 errors** (8 pre-existing warnings), and `/tmp/selara-phase6-tsc.log` contains only the one known baseline error at `src/lib/excel.ts:295`. Across the falsification logs, all **19 distinct new or changed Phase 6 assertions** were observed failing under a targeted regression (21 executions because T039a was falsified for both result shape and frozen-input mutation, while T038 was falsified for both identity fallback and repair wording). An exact grep for the stale phrase `this Initiative's Deliverable column` across `src`, `e2e`, and `docs/user-guide` returns **0** matches.

**Checkpoint**: all four stories complete; the filing guarantee holds across the model change.

---

## Phase 7: Polish & Cross-Cutting

- [x] T044 [P] Add `capexAmount`, `opexAmount`, `rptiRemarks` **and `initiativeId`** to the `DeliverableSegment` comparator in `src/lib/diff.ts:294-313`, with a test that each appears in the difference report (contract 25, FR-017). `initiativeId` is a pre-existing gap — re-attributing a segment changes the filing today with no history entry ([#42](https://github.com/nofanto/Selara/issues/42)). **Evidence:** one test per field. The pre-existing `rptiRemarks` test stayed green; the three genuinely absent fields failed first in `/tmp/selara-phase7-initial-tests.log` and all four pass in `/tmp/selara-phase7-t044-green.log`. Removing each new comparator branch made only its own test fail: `/tmp/selara-phase7-t044-falsify-capex.log`, `/tmp/selara-phase7-t044-falsify-opex.log`, and `/tmp/selara-phase7-t044-falsify-initiative.log`.
- [x] T045 [P] **No cost migration** (T003). Confirm by test that an existing workspace keeps its initiative budgets untouched and simply has no implementation figures until a preparer enters them — and that the new divergence warning fires for exactly that state, so it is announced rather than discovered. **Evidence:** the added regression test was green on first run because Phase 4 already implemented the warning; it asserts the initiative remains `{capex: 1250, opex: 275}`, both segment fields remain absent, and the warning names implementation totals of zero. Falsification (not misreported as red-first) temporarily disabled the warning branch and failed exactly this test in `/tmp/selara-phase7-t045-falsification.log`; `cmp` and an empty `git diff -- src/lib/dataHealth.ts` proved the implementation file was restored byte-for-byte.
- [x] T046 [P] Extend `src/lib/scale.test.ts` to several implementations per application at 300 applications (contract 26). The current fixture builds one segment per deliverable and will not exercise the increased row count; reconciliation is the part to watch, since both sides grow. **Evidence:** the fixture now projects and reconciles 900 rows (three implementations for each of 300 applications). Before: 300 rows in **16 ms** (`/tmp/selara-phase7-t046-before.log`). After: 900 rows in **31 ms** (`/tmp/selara-phase7-targeted-green.log`). The existing 2,000 ms bound still holds by a wide margin and needs no restatement. This is a guard for already-built projection/reconciliation, so it was green on addition; reverting the fixture to one implementation failed 300-vs-900 in `/tmp/selara-phase7-t046-falsification.log`. *(Satisfies SC-006.)*
- [x] T047 [P] Write an ADR in `docs/adr/` recording the grain change, the reversal of Q7 and Q10 with the principle that survived both, the rejected alternatives, and why no IndexedDB version bump is needed. Add it to the ADR index. **Evidence:** ADR-0014, `docs/adr/0014-rpti-rows-belong-to-implementations.md`, is Accepted and indexed in `docs/adr/README.md`.
- [x] T048 [P] Update `docs/database-diagram.md`: three fields on `DELIVERABLE_SEGMENT`, `Initiative.capex`/`opex` marked **stored and editable — a portfolio figure, not derived and not filed**, `rptiRemarks` removed from `INITIATIVE`. *(Corrected 2026-09-23: this task said "marked derived", the model FR-009a and T027 reject. Largely done in Phase 4 — verify rather than redo.)* **Verified:** Phase 4 had already added all three segment fields, correctly described initiative CapEx/OpEx, and removed initiative remarks. Phase 7 removed the stale Deliverable→Initiative target edge, corrected the currency and segment-anchor descriptions, added the segment→initiative relationship, and recorded the no-version-bump migration note.
- [x] T049 [P] Update `requirement-specs/rpti-auto-generation.md` with a v4 section — v3 describes projection at initiative grain, which this supersedes. **Evidence:** the existing superseded-rule banner now routes to v4 rather than being duplicated; v4 records implementation membership, filed-value ownership, separate portfolio budgets, and implementation-identity reconciliation.
- [x] T050 [P] Mark Q7, Q10 and Q14 as revised in `requirement-specs/report-rows-as-projections.md`, pointing at Q17, so a reader sees the model moved rather than finding a requirement quietly rewritten (FR-012). **Evidence:** all three headings now say `REVISED by Q17 (2026-09-22)` and their original decision text remains intact. The audit found a sixth stale live claim in Q17 itself (`derived totals`) and, after correcting it with a dated trail, a seventh in `checklists/requirements.md`; both now state stored/editable portfolio figures. Repository grep leaves zero live derived-total claims (the remaining matches are explicitly labelled correction or superseded history).
- [x] T051 [P] Update `docs/user-guide/` — cost and remarks are entered on the segment, **the initiative's figures are its own portfolio budget rather than a total of its implementations**, and one initiative may now file for several applications. *(Corrected 2026-09-23: this task said "initiative figures are totals". Largely done in Phase 4 — verify rather than redo.)* **Verified:** Phase 4 had already stated all three current rules in the lifecycle-segment, Data Manager, and RPTI guides. Phase 7 removed the one stale `Deliverable` row from the Initiative Fields reference because that control and `Initiative.deliverableId` no longer exist.
- [x] T052 **Release note** for the PR and the ADR: (a) an application with two go-lives now files two lines; (b) work going live next year no longer files this year — a **behaviour change**, per spec Q3; (c) cost and commentary move to the implementation, while the initiative keeps its own stored, editable budget as a portfolio figure that the filing never reads, with a data-health **warning** when the two diverge; (d) one initiative may now file for several applications, and `Initiative.deliverableId` is removed with its UI. Stated, not shipped quietly. *(Corrected 2026-09-24: this said "initiative figures become totals" — the derived model FR-009a and T027 reject, and the fifth instance of that same stale wording.)* **Evidence:** plain-language notes appear in ADR-0014 and `release-note.md`.
- [x] T055 **Post-completion revision, 2026-09-24 (Q21).** Imported initiatives span exactly their filed quarter instead of starting on 1 January, and carry the quarter in their name (`<application> — Q3 2027`); an imported implementation's live phase is three years from its filed quarter for `new` and the filed quarter only for `upgrade`, revising FR-001c and contract 2c. Found by the product owner importing both samples and seeing two overlapping Open API initiatives. **Red:** 7 tests in `src/lib/rptiImport.test.ts` failing on the old values (`2032-12-31`, a 1 January start, no quarter in the name); the Q1 initiative-span case passed on the old code, because 1 January is the start of Q1, which is why the test covers all four quarters. **Falsified** each change separately: a 1 January start, a name without the quarter, an open-ended upgrade, a five-year horizon, and a one-day slip in the three-year arithmetic each fail only their own tests; the file was restored byte-for-byte. The RPTI regenerates identically; two consequences it does not resolve are recorded in Q21. *(Satisfies FR-001c as revised.)*
- [x] T056 **Q21 horizon correction, 2026-09-24.** The product owner revised `new` to the LKPTI importer's shared five-year horizon, through 31 December of the filed go-live year plus five; `upgrade` remains its filed quarter. **Red:** the three new-build cases failed before implementation (exit 1). **Coupling:** temporarily changing the one horizon constant from 5 to 4 failed both `lkptiImport.test.ts` and `rptiImport.test.ts` (exit 1); the constant was restored to 5 and `git diff -U0` showed no change to its line. **Deletion falsified:** temporarily restoring the prior RPTI three-year implementation failed all three new-build cases (exit 1), then was restored. Published samples measured inventory counts for 2026–2032 as `13, 16, 16, 16, 13, 13, 0` before and `13, 16, 16, 16, 16, 16, 3` after; 2027 RPTI remained 13 rows with identical ordered development types, and round-trip losses remained zero. **Verification:** 445 unit tests passed (exit 0), Playwright 673 passed, 4 skipped, one flaky retry passed (exit 0), ESLint 0 errors (exit 0), TypeScript only its known `src/lib/excel.ts:295` error (exit 2). See Q21 for the historical first rule and the still-open upgrade edge case. **Reproduced independently in review:** changing the constant from 5 to 6 failed one test in each of `lkptiImport.test.ts` and `rptiImport.test.ts`; reintroducing a three-year horizon failed all three new-build cases; inventory and RPTI measurements matched exactly.
- [x] T053 Run `quickstart.md` levels 1–12, including the scale check and the read-only-control assertions. **Evidence:** 224 focused unit checks passed in `/tmp/selara-phase7-quickstart-unit.log`; 30 focused browser checks passed with exit 0 in `/tmp/selara-phase7-quickstart-e2e.log`. No product expectation was stale, but Level 8 had omitted the promised read-only control assertions and Level 11 saved the comparison baseline after making changes; both instructions were corrected. The scale test's stale `quickstart level 7` label was corrected to Level 12.
- [x] T054 Full verification: `npm run test:unit`, `npx playwright test` redirected to a file with the real exit code checked, `npx eslint .` at 0 errors, `npx tsc --noEmit` at no more than the 1 known `excel.ts` baseline error. Piping to `tail` returns tail's status, not the suite's. **Evidence:** `/tmp/selara-phase7-unit-full-final.log` **441/441**, exit 0; `/tmp/selara-phase7-e2e-full.log` **674 passed, 4 skipped**, exit 0; `/tmp/selara-phase7-eslint.log` **0 errors, 8 existing warnings**, exit 0; `/tmp/selara-phase7-tsc.log` contains exactly the one known `src/lib/excel.ts:295` error, exit 2. Playwright was redirected and its status captured before displaying the log tail.

---

## Dependencies

```
Phase 1 (T001-T002)
      ↓
Phase 2 (T003-T006)          ← T003 and T004 are DECISIONS; nothing downstream is safe without them
      ↓
Phase 3 US1 (T007-T016)  🎯 MVP — the defect is fixed here
      ↓
Phase 4 US2 (T017-T029)      ← needs US1's grain to exist before values can belong to it
      ↓
Phase 5 US3 (T030-T035)      ← T030 (fixture) gates everything else in this phase
      ↓
Phase 6 US4 (T036-T043)
      ↓
Phase 7 Polish (T044-T054)
```

**Story independence**: US1 is genuinely standalone and shippable — it fixes the defect while every
row keeps the initiative's cost. US2 depends on US1 (values need rows to belong to). US3 and US4
verify and preserve, and both need US1 and US2 in place.

**Blocking decisions**: all closed (2026-09-22). T003 and T005 were dissolved by the two-figures
decision; T004 resolved to removing `Initiative.deliverableId` with its UI.

**One ordering constraint carries real risk**: T043b must land before T043c. The F2 repair path —
how a preparer fixes a stored row whose deliverable was deleted — currently runs through
`Initiative.deliverableId`. Remove the field first and the repair route is gone before its
replacement exists, which is exactly the failure this project has already shipped once.

## Parallel Opportunities

- **Phase 3**: T007–T012 are six independent failing tests across two files.
- **Phase 4**: T017–T022 likewise; implementation T023–T025 touch one file and are sequential.
- **Phase 6**: T036–T039 are independent.
- **Phase 7**: T044–T051 are eight independent tasks across different files.

## Implementation Strategy

**MVP is Phase 3 alone.** It fixes the filed defect, resolves all three symptoms from research.md
R1, and is independently demonstrable. Every row still carries its initiative's cost at that point —
wrong at the new grain, but no worse than today, and no filed value is lost.

**Stop points**: after Phase 3 the product is better than today and internally consistent. After
Phase 4 the model is correct. Phases 5 and 6 are verification and preservation — valuable, but a
release could reasonably ship after Phase 4 with them following.

**The risk to watch throughout** is T011, the regression guard. Almost every real workspace has one
implementation per initiative, so an over-broad change would be invisible in the new tests and
obvious to every user.
