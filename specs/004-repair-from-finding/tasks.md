# Tasks: Repair an Unresolved Imported RPTI Row from Its Finding

**Feature**: `004-repair-from-finding` · **Branch**: `051-repair-from-finding` · **Date**: 2026-09-25

**Input**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) ·
[data-model.md](./data-model.md) · [contracts/repair.md](./contracts/repair.md) ·
[quickstart.md](./quickstart.md)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel. It is in a different file from every other `[P]` task in its phase, and has no dependency on an incomplete task. *(Same-file `[P]` markers were removed after `/speckit-analyze` F1.)*
- **[US1]–[US3]**: the user story a task serves. Setup, foundational and polish tasks carry none.

## Path Conventions

This is a single-project SPA. Pure logic lives in `src/lib/`, with Vitest tests next to it. UI-facing
behaviour is tested in `e2e/` with Playwright.

**Tests are mandatory.** The constitution (III) requires tests at the altitude of the risk, and
requires each one to be **seen failing** before the code that satisfies it is written. Every test task
records its red log. Every story ends with a falsification task: revert the implementation, confirm
the new tests fail, and log it.

Never pipe a suite to `tail`: redirect to a file and check `$?`. Playwright hard-codes port 3000 with
`reuseExistingServer`, so confirm nothing else is serving 3000 first, or use a temporary config on
another port.

---

## Phase 1: Setup

- [x] T001 Confirm the branch `051-repair-from-finding` is based on `9e38187`: the interim fix rebased onto `origin/main` at `e30f718` (#57, which adds `src/lib/diffFieldPolicy.ts` that T013 and T046 need). **Done 2026-09-25, before dispatch, on `9e38187` plus docs only (`85c6c51` adds no code):**
  - `npm run test:unit`: **583/583**, exit 0 (`/tmp/selara-004-baseline-unit.log`);
  - `npx playwright test`: exit 0, **685 passed, 4 flaky, 4 skipped** (`/tmp/selara-004-baseline-e2e.log`);
  - the four flaky files (data-manager-layout, decision-link-integrity, decisions, deliverables), re-run alone: **37/37** on the first attempt (`/tmp/selara-004-baseline-e2e-flaky-rerun.log`). The flakiness was full-suite load, not a regression.
  - eslint: 0 errors. tsc: 1 error, the `excel.ts:295` baseline.
- [x] T002 [P] Record the **before** measurements in `/tmp/selara-004-baseline-measure.log`, using a throwaway Vitest probe that is not committed:
  - the sample import's synthetic prior segments (id, dates, Deliverable type);
  - LKPTI row counts as at 31 December 2026-2032 (expected to equal Q21's 13, 16, 16, 16, 16, 16, 3);
  - the 2027 RPTI development-type order.

  SC-004 and contract 19 compare against this.
  - Done: `/tmp/selara-004-baseline-measure.log`; prior `rpti-import-seg-prior-13` is infrastructure, 2026-01-01 to 2026-12-31; LKPTI counts 13/16/16/16/16/16/3; RPTI 2027 has 13 rows in the recorded type order. Throwaway probe deleted.

- [x] T003 [P] Write the user story `docs/user-stories/27-repair-unresolved-rpti-row.md` **before any test**, with acceptance criteria mirroring US1-US3 and links to spec 004 and Q22. The constitution's lifecycle puts requirements (Step 1) before test-driven development (Step 2). *(Moved from Polish after `/speckit-analyze` L1.)*
  - Done: `docs/user-stories/27-repair-unresolved-rpti-row.md` records US1–US3 before tests.
---

## Phase 2: Foundational (blocking: no user story may start before these)

**Ordering constraint (plan, Complexity Tracking).** Contract 1 changes how generation decides `new`
or `upgrade`. It lands **alone**, with every existing projection and importer test green and **no
expectation changed**, before anything new calls it.

- [x] T004 [P] Failing tests for **contract 1** in `src/lib/rpti.test.ts`. `hasLiveHistoryBefore` is exported, and:
  - Done: Red `/tmp/selara-004-t004-red.log`: missing export; 1 failed, 93 passed. Green with T005: `/tmp/selara-004-t004-green.log`.
  - it is true only for a live segment on the same Deliverable starting strictly before the date;
  - a non-live earlier segment, a segment on another Deliverable, and a same-day start are all false.

  Red: the export does not exist.
- [x] T005 Implement `hasLiveHistoryBefore` in `src/lib/rpti.ts`, and replace the `wasLiveBefore` closure in `projectRptiReturn` with it.
  - Done: Green `/tmp/selara-004-t004-green.log`: 117/117 projection, round-trip and sample tests; no existing expectations edited.
  - Run the whole of `rpti.test.ts`, `roundTrip.test.ts` and `sampleReturns.test.ts`. They must be green **with zero expectation edits**.
  - Log it to `/tmp/selara-004-t004-green.log`.
- [x] T006 Replace the importer's copy of the same test (`targetAlreadyLiveBeforeImplementation`, `src/lib/rptiImport.ts:394-401`) with `hasLiveHistoryBefore`. Keep the same-import history exactly as passed today (FR-018b of spec 003). `rptiImport.test.ts` must be green with zero expectation edits.
  - Done: Green `/tmp/selara-004-t006-green.log`: 68/68 importer tests; same-import history retained and no expectations edited.
- [x] T007 Failing tests for **contract 2** in `src/lib/rpti.test.ts`. `continuousPriorLivePhase('d', 2027, 'live', 'id')` equals `{ id, deliverableId: 'd', startDate: '2026-01-01', endDate: openEndedDate(2027), status: 'live' }` and has no `initiativeId` key.
  - Done: Red `/tmp/selara-004-t007-red.log`: missing export; 1 failed, 94 passed. Green with T008: `/tmp/selara-004-t008-green.log`.
- [x] T008 Implement `continuousPriorLivePhase` in `src/lib/rpti.ts`. It is not called yet; T040 switches the importer over.
  - Done: Green `/tmp/selara-004-t008-green.log`: 95/95; helper is not called by importer yet.
- [x] T009 Failing tests for **contract 3** in `src/lib/rpti.test.ts`. `filedAttributesFor(deliverable, assets, categories)` returns what projection files for that Deliverable, in these cases:
  - Done: Red `/tmp/selara-004-t009-red.log`: missing export; 2 failed, 95 passed. Green with T010: `/tmp/selara-004-t010-green.log`.
  - a named provider → `PPJTI` with the stored related party;
  - `inhouse` → `inhouse` with `n/a`;
  - no override → the Asset Category's code and DC/DR;
  - with an override → the override.

  Also assert, over every Deliverable in the existing projection fixtures, that the projection's row attributes equal `filedAttributesFor`.
- [x] T010 Implement `filedAttributesFor` in `src/lib/rpti.ts`, and make `projectRptiReturn` build its attribute columns from it (`rpti.ts:215-240`). The existing projection and round-trip tests must stay green with zero expectation edits.
  - Done: Green `/tmp/selara-004-t010-green.log`: 120/120 projection, round-trip and sample tests; no existing expectations edited.
- [x] T011 [P] Failing tests for **contracts 4-5** in the new file `src/lib/unresolvedRowRepair.test.ts`:
  - Done: Red `/tmp/selara-004-t011-red.log`: missing module; test file could not collect. Green with T012: `/tmp/selara-004-t012-green.log`.
  - `isRepairableUnresolvedRow` is true only for a `rpti-import-unresolved-*` target with no `deliverableSegmentId`. A deleted Deliverable's row, and an anchored row, are false.
  - `repairOptions` is `['existing', 'create']` for category `12` and `['existing']` for each of `51`-`54` and `99`.
- [x] T012 Create `src/lib/unresolvedRowRepair.ts` with `isRepairableUnresolvedRow` and `repairOptions`. Import `UNRESOLVED_IMPORT_TARGET_PREFIX` from `rpti.ts`. Take the infrastructure codes from one exported constant, moving `INFRASTRUCTURE_CODES` out of `rptiImport.ts` so there is one copy.
  - Done: Green `/tmp/selara-004-t012-green.log`: 70/70 helper and importer tests; infrastructure codes live in `rpti.ts` beside category labels and the existing importer dependency, avoiding a reverse dependency.
- [x] T013 Failing test for **contract 6** in `src/lib/dataHealth.test.ts`. Only the `rpti-target:<rowId>` issue of an unresolved row carries `action: { kind: 'repair-unresolved-rpti-row', rowId }`. A deleted-Deliverable `missing-target` issue, and every other issue, carry no `action`. Then add the optional, computed `action` field to `HealthIssue` in `src/lib/dataHealth.ts` and set it. Confirm `src/lib/diffFieldPolicy.test.ts` is unaffected, since `HealthIssue` is not stored.
  - Done: Red `/tmp/selara-004-t013-red.log`: only the missing action assertion failed. Green `/tmp/selara-004-t013-green.log`: 182/182 health and diff-field-policy tests; action is computed only.

**Checkpoint**: generation output is byte-identical to before (T005, T006 and T010 green without expectation edits). The three shared rules exist. The app can tell a repairable finding apart. Nothing user-visible has changed.

---

## Phase 3: User Story 1 — The bank runs it, but the inventory doesn't list it (P1) 🎯 MVP

**Goal**: from the Legacy Teller finding, option B creates the application, its continuous prior live history and the filed implementation, pre-filled, in one undoable change, and the row regenerates exactly as filed.

**Independent Test**: import both samples, repair Legacy Teller with B without editing anything, and generate 2027. The row equals the filed row in every column, and the gate is clear (SC-001).

### Tests for User Story 1 (write first; see each fail) ⚠️

- [x] T014 [P] [US1] Failing tests for **contracts 7-8** in `src/lib/unresolvedRowRepair.test.ts`. `unresolvedRowRepairDraft`:
  - Done: Red `/tmp/selara-004-t014-red.log`; green `/tmp/selara-004-t014-green.log`: provenance, renamed-name flag, PPJTI input, clock independence.
  - **name:** `"Legacy Teller Application — Q3 2027"` → `Legacy Teller Application`, source `initiative-name`. A renamed initiative with no suffix gives the whole name, `check: true`.
  - **year:** from the suffix; if there is none, from `startDate`.
  - **other values:** quarter, category, related party, DC/DR and Keterangan from the row; CapEx/OpEx from the initiative, source `initiative-budget`.
  - **PPJTI:** empty provider name, `needs-input`.
  - **Clock:** output is identical under `vi.setSystemTime` set to another year.
- [x] T015 [US1] Failing tests for **contracts 13-18 (option B)** in `src/lib/unresolvedRowRepair.test.ts`, with **frozen** input state:
  - Done: Red `/tmp/selara-004-t015-red.log`; green `/tmp/selara-004-t015-green.log`: frozen-state B writes, preconditions, status/category reuse, reconciliation, idempotence.
  - **Fields written:** exactly the data-model "option B" set, with the R11 ids. The Asset Category is created only when no category has the code. The live status is the workspace's own, and `IN_PRODUCTION_STATUS` is added only when none is live (R4).
  - **Nothing else:** deep equality over every other collection. The stored row is byte-identical (Q12).
  - **Post-condition:** `reconcileRptiReturn` has no finding for the row. `projectRptiReturn(result, 2027)` has one row for the initiative: `upgrade`, Q3, with the confirmed values.
  - **Preconditions:** `ok: false` for a missing row, for an initiative that has a live implementation, and for a `PPJTI` row whose provider name is empty or `PPJTI`.
  - **Idempotence:** a second apply returns `ok: false`.
- [x] T016 [P] [US1] Failing **SC-001** test in `src/lib/sampleReturns.test.ts`. After importing both samples, B on the Legacy Teller row with its unedited draft gives:
  - Done: Red `/tmp/selara-004-t016-red.log`; green `/tmp/selara-004-t016-green.log`: sample filed-column and cost fidelity with a nonzero budget.
  - `projectRptiReturn(…, 2027)`: a row equal to the stored filed row in **every** filed column (type, quarter, category, developer, related party, DC/DR, Keterangan, CapEx, OpEx);
  - `reconcileRptiReturn`: `[]`.

  Guard: the draft's CapEx is > 0, so the comparison is not vacuous.
- [x] T017 [P] [US1] Failing E2E in the new file `e2e/unresolved-row-repair.spec.ts`, via onboarding both samples:
  - Done: Red `/tmp/selara-004-t017-red.log`; green `/tmp/selara-004-t017-green.log`: Data Health and gate entry points, sourced form, confirm/cancel/undo, FR-003.
  - The Data Health review shows **Repair** on the Legacy Teller finding.
  - Choosing B shows every filed value pre-filled, CapEx/OpEx labelled as the initiative's current budget, the quarter and year read-only, and the note that this adds it to the inventory from 2026 (FR-010a).
  - Confirm: the finding is gone, and RPTI 2027 generates with the gate clear.
  - **Undo** brings the finding back in one step.
  - **Cancel** changes nothing.
  - **FR-003 guard:** adding a Deliverable from **Data Manager → Deliverables** creates no lifecycle segment. This passes today, so it cannot be seen red. Its teeth are shown in T024 instead: temporarily make Deliverable creation add a segment, and confirm this assertion fails.
  - **Gate entry point:** from the RPTI pre-export gate, **Repair** beside the Legacy Teller finding opens the same dialog, and after confirming the gate clears. *(Moved here from T022 after `/speckit-analyze` C1, so it is seen red before the gate is implemented.)*

### Implementation for User Story 1

- [x] T018 [US1] Implement `unresolvedRowRepairDraft` in `src/lib/unresolvedRowRepair.ts` (research R3). T014 green.
  - Done: Red `/tmp/selara-004-t014-red.log`; green `/tmp/selara-004-t014-green.log`: draft values use filed evidence and initiative provenance.
- [x] T019 [US1] Implement `applyUnresolvedRowRepair` for option B in `src/lib/unresolvedRowRepair.ts` (research R2, R4, R5, R9, R11), using `continuousPriorLivePhase` and the importer's category-creation shape. T015 and T016 green.
  - Done: Red `/tmp/selara-004-t015-red.log`, `/tmp/selara-004-t016-red.log`; green `/tmp/selara-004-t015-green.log`, `/tmp/selara-004-t016-green.log`: one pure B repair reproduces the sample.
- [x] T020 [US1] Create `src/components/UnresolvedRowRepairDialog.tsx`:
  - Done: Red `/tmp/selara-004-t017-red.log`; green `/tmp/selara-004-t017-green.log`: sourced dialog form and confirmation workflow.
  - the option choice, limited to what `repairOptions` allows;
  - the B form with source labels, the read-only quarter and year, the required provider name for `PPJTI`, and the 2026-inventory note;
  - on confirm, call the host with the request, and show the reason if the host reports `ok: false`.

  Follow the existing modal patterns (`ConfirmModal.tsx`, `useFocusTrap`).
- [x] T021 [US1] Wire it up:
  - Done: Red `/tmp/selara-004-t017-red.log`; green `/tmp/selara-004-t017-green.log`: Data Health action and one App update; undo restores the finding.
  - `src/components/DataHealthReportView.tsx` renders an issue's `action` as a **Repair** button.
  - `src/components/ReportsView.tsx` hosts the dialog.
  - `src/App.tsx` adds `onRepairUnresolvedRow`, which runs `applyUnresolvedRowRepair` on `getCurrentState()` and on `ok` calls **one** `handleUpdate` (research R2).
- [x] T022 [US1] In the RPTI pre-export gate (`src/components/ReportsView.tsx:181-203`), render reconciliation findings as objects, not strings, so a repairable one shows **Repair** beside its message. T017's gate scenario green.
  - Done: Red `/tmp/selara-004-t017-red.log`; green `/tmp/selara-004-t017-green.log`: gate finding retains row identity and opens Repair.
- [x] T023 [US1] Point the unresolved-row message at the new action. In `src/lib/rpti.ts`, the `missing-target` message for an unresolved import leads with "Use **Repair** on this finding", then keeps the manual steps and the filed-value list for anyone repairing by hand. Update the #51 assertions in `src/lib/rpti.test.ts` and `sampleReturns.test.ts` test-first.
  - Done: Red `/tmp/selara-004-t023-red.log`; green `/tmp/selara-004-t023-green.log`: Repair leads the unresolved message, with manual filed values preserved.
- [x] T024 [US1] **Falsification.** Revert T018, T019 and T021 in turn, and confirm T014-T017 fail for the right reason each time. Also show T017's FR-003 guard has teeth, by temporarily making Deliverable creation add a segment. Log to `/tmp/selara-004-us1-falsify.log`.
  - Done: Falsification `/tmp/selara-004-us1-falsify.log`: disabling draft, apply, Data Health wiring, and the FR-003 no-segment rule each failed its guard.

- [x] T024a [US1] **Coordinator review, 2026-09-25.** Four gaps found in the US1 implementation and fixed test-first (red `/tmp/selara-004-review-us1-red.log`, `/tmp/selara-004-review-us1-e2e-red.log`, `…-red2.log`; green `/tmp/selara-004-review-us1-green.log`, `/tmp/selara-004-review-us1-e2e-green.log`):
  - Data Health offered **Repair** on an unresolved row whose initiative is also gone, but the dialog cannot start without one, so the click did nothing. The action now needs the initiative too.
  - **Category code** was free text: `123` or infrastructure `51` passed validation and created a category with no name. It is now a dropdown of application codes, and apply rejects anything else.
  - **Related party** was free text. It is now a yes/no/n/a dropdown, and apply rejects other values.
  - **An emptied CapEx or OpEx box filed 0** (`Number('')` is 0), the exact #51 corruption. An empty box is now "no value", and the repair is refused with a reason. Seen red in the E2E before the fix: the dialog closed and no error was shown.

**Checkpoint**: the MVP. The published sample repairs from the finding and regenerates exactly as filed, with zero re-keyed values (SC-001, SC-002 for B).

---

## Phase 4: User Story 2 — It's this existing entry (P2)

**Goal**: option A attaches the filed implementation to an entry the inventory lists, whether renamed or one of several of the same name. Candidates are suggested and never picked. Prior history is added only when missing. Every attribute difference is the preparer's explicit choice.

**Independent Test**: a fixture whose inventory lists the application under another name. Repair with A, then check `upgrade` in the filed quarter, and that each update/keep choice files as chosen (SC-003).

### Tests for User Story 2 (write first; see each fail) ⚠️

- [x] T025 [P] [US2] Failing tests for **contracts 9-10** in `src/lib/unresolvedRowRepair.test.ts`. `rankRepairCandidates`:
  - Done: Red `/tmp/selara-004-t025-red.log` (2 missing-helper failures); green `/tmp/selara-004-t025-green.log` (2 passed). Measured kind filtering, normalised tiers, deterministic order, no selection, B-created match and empty pool.
  - the pool is only the row's kind;
  - `same-name` (normalised: case, punctuation and spacing), then `similar` (at least half the words shared, same category), then `other`;
  - deterministic order within a tier;
  - the result type carries no selected or best-match field;
  - **two rows, one application (spec edge case):** after a B repair of the first row creates "X", ranking for a second unresolved row whose draft name is "X" puts that Deliverable in `same-name`, first;
  - **empty pool:** an empty inventory returns `[]`, and the dialog's empty state says so (T033).
- [x] T026 [P] [US2] Failing **contract 11** case in `src/lib/scale.test.ts`: ranking over 300 applications stays within the file's existing budget (SC-005).
  - Done: Red `/tmp/selara-004-t026-red.log` (missing helper); green `/tmp/selara-004-t026-green.log` (1 passed). Measured 300-candidate ranking under 2 seconds; reversal `/tmp/selara-004-t026-falsify.log` caught an empty ranking.
- [x] T027 [US2] Failing tests for **contract 12** in `src/lib/unresolvedRowRepair.test.ts`. `attributeDifferences`:
  - Done: Red `/tmp/selara-004-t027-red.log` (missing helper); green `/tmp/selara-004-t027-green.log` (1 passed). Measured filed-value comparison, including named PPJTI and inherited category.
  - a named provider against a filed `PPJTI` → no difference;
  - an inherited category equal to the filed one → no difference;
  - differing DC city → one difference, `{ field: 'dcCity', filed, current }`;
  - all equal → `[]`.
- [x] T028 [US2] Failing tests for **option A** in `src/lib/unresolvedRowRepair.test.ts`, with frozen input:
  - Done: Red `/tmp/selara-004-t028-red.log` (3 option-A failures); green `/tmp/selara-004-t028-green.log` (29 passed). Measured frozen-state writes, prior phase, choices, regeneration and provider preconditions.
  - **Fields written:** exactly the data-model "option A" set.
  - **Prior phase:** added iff `hasLiveHistoryBefore` is false for the chosen entry (FR-011).
  - **Per-field choices:** "update" writes the override field, and "keep" writes nothing.
  - **Post-condition:** with every difference set to update, the row equals the filed row in every column; with a keep, that column files the entry's value.
  - **Preconditions:** `ok: false` for an entry of the wrong kind, an unanswered difference, or a chosen entry that no longer exists.
  - **PPJTI under A (FR-006):** a filed `PPJTI` against an `inhouse` entry is a developer difference. "Update" with an empty provider name, or with `PPJTI`, returns `ok: false`. "Update" with a name writes that name, and the row files `PPJTI`. "Keep" needs no name and files `inhouse`.
- [x] T029 [P] [US2] Failing E2E in `e2e/unresolved-row-repair.spec.ts`, using a seeded fixture with a renamed inventory entry:
  - Done: Red `/tmp/selara-004-t029-red.log` (3 missing-option failures); green `/tmp/selara-004-t029-green.log` (3 passed). Measured suggestions, search, explicit choice, filed category update/keep and infrastructure-only A.
  - the entry is listed as suggested and **not** selected;
  - search finds a non-suggested entry;
  - a differing category shows filed against current, with the LKPTI note;
  - "update" and "keep" each file as chosen.

  Also a seeded **infrastructure** unresolved row: only "It's this existing entry" is offered.

### Implementation for User Story 2

- [x] T030 [US2] Implement `rankRepairCandidates` in `src/lib/unresolvedRowRepair.ts` (research R8). T025 and T026 green.
  - Done: Implemented in `unresolvedRowRepair.ts`; red/green `/tmp/selara-004-t025-{red,green}.log` and `/tmp/selara-004-t026-{red,green}.log`. Ranking obeys larger-word-count threshold and 300-entry budget.
- [x] T031 [US2] Implement `attributeDifferences` via `filedAttributesFor` (research R7). T027 green.
  - Done: Implemented via `filedAttributesFor`; red/green `/tmp/selara-004-t027-{red,green}.log`. Differences match projected filing attributes.
- [x] T032 [US2] Extend `applyUnresolvedRowRepair` with option A. T028 green, and T015/T016 still green.
  - Done: Implemented option A; red/green `/tmp/selara-004-t028-{red,green}.log`. Exactly the chosen entry, needed segments, status and initiative asset change.
- [x] T033 [US2] Extend `src/components/UnresolvedRowRepairDialog.tsx` for A:
  - Done: Extended the dialog; red/green `/tmp/selara-004-t029-{red,green}.log`. Browser measured explicit candidate and per-field choice, category filing and infrastructure restriction.
  - the searchable candidate list, with a "Suggested" group and nothing pre-selected;
  - a prior-history notice when one will be added;
  - one filed-vs-current row per difference, with a required update/keep choice and an "also changes the LKPTI" note on update;
  - a required provider-name field when "update" is chosen for a filed `PPJTI` developer (FR-006).

  T029 green.
- [x] T034 [US2] **Falsification.** Revert T030, T031 and T032 in turn, and confirm T025-T029 fail for the right reason. Log to `/tmp/selara-004-us2-falsify.log`.
  - Done: Falsification `/tmp/selara-004-us2-falsify.log` and `/tmp/selara-004-t0{26,29,30,31,32}-falsify.log`. Disabling ranking, differences or apply caused the corresponding new tests to fail; all source was restored.

**Checkpoint**: both resolutions work, including ambiguous infrastructure.

---

## Phase 5: User Story 3 — Imports close the upgrade inventory gap (P3)

**Goal**: the importer's synthetic prior phase follows the same continuous rule as the repair. Existing workspaces are never changed automatically; a non-blocking warning offers the extension (FR-017, FR-018, FR-018a).

**Independent Test**: import an RPTI with a Q2 upgrade that gets a synthetic prior phase, then check the LKPTI from the year before the filed year through the horizon. Separately, open an old-shape fixture: warning → Extend → gap closed, and export never blocked.

### Tests for User Story 3 (write first; see each fail) ⚠️

- [x] T035 [P] [US3] Failing tests for **contract 19** in `src/lib/rptiImport.test.ts`:
  - both synthetic prior paths produce `continuousPriorLivePhase` output: the entry the importer creates itself (FR-019a infrastructure, `rptiImport.ts:370-375`), and a matched entry without history (`:402-410`);
  - FR-018b's same-import case still adds none.
  - Done: Red `/tmp/selara-004-t035-red.log`: both prior paths' `endDate` was still `2026-12-31`, not `2032-12-31`, 2 failed; the FR-018b guard passed. Green `/tmp/selara-004-t035-green.log`: 73/73 importer tests.
- [x] T036 [US3] Failing tests for US3 acceptance scenarios 1-2 in `src/lib/rptiImport.test.ts`:
  - an application upgrade filed for Q2 that receives a synthetic prior phase is in the LKPTI as at 31 December of every year from the year before the filed year to the horizon;
  - the RPTI for the filed year still types it `upgrade`, and the prior phase files no row of its own.
  - Done: Red `/tmp/selara-004-t036-red.log`: `2027: expected [] to include 'd-existing'`; green `/tmp/selara-004-t036-green.log`: 2 passed, the LKPTI holds the entry 2026-2032 and the filed year still has one `upgrade` row.
- [x] T037 [P] [US3] Failing tests for **contracts 20-21** in `src/lib/unresolvedRowRepair.test.ts`. `priorPhaseGaps`:
  - finds the exact old shape on an application and lists the missing years;
  - returns nothing for infrastructure;
  - returns nothing when any **one** of id prefix, start date, end date, status or `initiativeId` differs (one case each);
  - returns nothing when another live segment already covers every year;
  - **FR-018, no automatic change:** `priorPhaseGaps`, `computeDataHealth` and the load-time lift (`liftReportRowAttributes` in `src/lib/attributeLift.ts`, which `App.tsx` wraps at every boundary that admits data) run over a **frozen** old-shape workspace without throwing, and return the old segment byte-identical. *(Added after `/speckit-analyze` G1.)*
  - Done: Red `/tmp/selara-004-t037-red.log`: `priorPhaseGaps is not a function`, 10 failed, the existing 9 passed. Green `/tmp/selara-004-t037-green.log`: 22/22; the frozen run leaves the old segment byte-identical.
- [x] T038 [US3] Failing tests for **contracts 22-23**:
  - `src/lib/dataHealth.test.ts`: one **warning** per gap, `rpti-import-prior-phase-gap:<segmentId>`, with the `extend-import-prior-phase` action. It is not an error, and it does not enter the pre-export gate.
  - `src/lib/unresolvedRowRepair.test.ts`: `extendImportPriorPhase` changes only that segment's `endDate`, to `openEndedDate(Y+1)`. Afterwards `priorPhaseGaps` has no entry for it, and the LKPTI includes the Deliverable in each formerly missing year.
  - Done: Red `/tmp/selara-004-t038-red.log`: the warning was absent and `extendImportPriorPhase is not a function`. Green `/tmp/selara-004-t038-green.log`: 105/105 across the two files; the warning stays severity `warning` (error-only gate ignores it).
- [x] T039 [P] [US3] Failing E2E in `e2e/unresolved-row-repair.spec.ts`, using a seeded old-shape fixture:
  - **before any action**, after the workspace loads and Data Health renders, the stored segment still has its original `endDate`. Read it back from IndexedDB, not from the UI (FR-018);
  - Data Health shows the non-blocking warning, naming the missing years;
  - **Extend** clears it;
  - RPTI export is not blocked before or after;
  - Undo restores the warning.
  - Done: Red `/tmp/selara-004-t039-red.log`: no `data-health-group-rpti-import-phase-gap`, 1 failed. Green `/tmp/selara-004-t039-green.log`: 6/6; the IndexedDB `endDate` is `2026-12-31` before any action, `2032-12-31` after Extend, and back after Undo.

### Implementation for User Story 3

- [x] T040 [US3] In `src/lib/rptiImport.ts`, build both synthetic prior phases with `continuousPriorLivePhase`. T035 and T036 green. Contract 19's unchanged-output check: `sampleReturns.test.ts` and `roundTrip.test.ts` still show 13 rows in the same type order with zero losses, compared against T002.
  - Done: Green `/tmp/selara-004-t035-green.log`, `/tmp/selara-004-t036-green.log`; `rpti.ts`/`roundTrip`/`sampleReturns`/importer **194/194** with the **one** intended expectation edit (`rptiImport.test.ts:147` one-year `endDate` → `openEndedDate(2027)`); RPTI 2027 still 13 rows in the same type order.
- [x] T041 [US3] Implement `priorPhaseGaps` and `extendImportPriorPhase` in `src/lib/unresolvedRowRepair.ts` (research R10). T037 and T038's library half green.
  - Done: Green `/tmp/selara-004-t037-green.log`, `/tmp/selara-004-t038-green.log`: the exact importer shape is detected per property, and Extend writes only `endDate = openEndedDate(Y+1)`.
- [x] T042 [US3] Raise the warning with its action in `src/lib/dataHealth.ts`. Render the action as **Extend** in `DataHealthReportView.tsx`, and add `onExtendImportPriorPhase` in `src/App.tsx` (one `handleUpdate`). T038 and T039 green.
  - Done: Green `/tmp/selara-004-t038-green.log`, `/tmp/selara-004-t039-green.log`: warning `rpti-import-prior-phase-gap:<segmentId>` with `extend-import-prior-phase` action, **Extend** rendered, one undoable `handleUpdate`.
- [x] T043 [US3] **Falsification.** Revert T040, T041 and T042 in turn, and confirm T035-T039 fail for the right reason. Log to `/tmp/selara-004-us3-falsify.log`.
  - Done: Falsification `/tmp/selara-004-us3-falsify.log`: reverting T040 failed T035/T036 (4 failed); reverting T041 failed T037/T038 (7 failed); reverting T042 failed the Data Health warning (2 failed) and the US3 E2E.

**Checkpoint**: one prior-phase rule everywhere, and no silent change to existing data.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T044 **SC-004.** Add a pinned test in `src/lib/sampleReturns.test.ts` for LKPTI counts as at 31 December 2026-2032, in two states: after import, and after the Legacy Teller B repair. Copy the measured numbers into Q22 in `requirement-specs/report-rows-as-projections.md`, with an explanation of each difference from T002's baseline and from Q21's 13, 16, 16, 16, 16, 16, 3. Include the confirmed consequence of 2026 going from 13 to 14. The test is written after the code it measures, so it MUST be shown to have teeth (Constitution III, added after `/speckit-analyze` C2): revert T040, then T019, and confirm the pinned counts fail each time. Log to `/tmp/selara-004-t043-falsify.log`.
- [ ] T045 [P] Update `docs/user-guide/14-rpti-report/recording-an-rpti-row.md`:
  - The manual-repair paragraph becomes the **Repair** flow, B and A.
  - The manual steps stay as a fallback.
  - The deleted-implementation paragraph (restore or re-import) is unchanged.

  Add the prior-phase warning to `docs/user-guide/09-reports/data-health-report.md`. Grep `docs/user-guide` for any other description of repairing an unresolved row.
- [ ] T046 [P] **FR-019 check.** `git diff 9e38187 -- src/types.ts` shows no change to a stored entity, and `src/lib/diffFieldPolicy.test.ts` is green unmodified. If either fails, stop and declare the field in `src/lib/diffFieldPolicy.ts` test-first.
- [ ] T047 Mark spec 004's status as implemented. Add a line to Q22 pointing at spec 004 as the feature that shipped it.
- [ ] T048 Run quickstart levels 1-4 with real exit codes, and hand the product owner the manual check, including SC-006's timings. Unit, Playwright full suite, eslint 0 errors, and a tsc error count of exactly 1 (`excel.ts:295`). Log each to `/tmp/selara-004-final-*.log`, and record the totals here.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (T001-T003)**: none. T003, the user story, comes before any test (lifecycle Step 1).
- **Foundational (T004-T013)**: needs Setup. **Blocks every story.** Within it:
  - T004 → T005 → T006 are strictly first and alone (the ordering constraint).
  - T007 → T008, T009 → T010 and T011 → T012 are independent pairs.
  - T013 needs T012.
- **US1 (T014-T024)**: needs Foundational.
- **US2 (T025-T034)**: needs Foundational. It **extends** US1's function and dialog: T032 needs T019, and T033 needs T020. Its tests can be written in parallel with US1.
- **US3 (T035-T043)**: needs Foundational only (T008 for the helper, T013 for `HealthIssue.action`). It is independent of US1 and US2 and can run alongside them.
- **Polish (T044-T048)**: T044 needs T019 and T040. The rest need the stories they document.

### Within each story

The tests are written first and seen red, with the log recorded. Then implementation turns them
green. The falsification task comes last.

### Parallel opportunities

- **Foundational:** after T006, T011 can run alongside the T007/T009 chain. T007 and T009 both edit `src/lib/rpti.test.ts`, so they run one after the other.
- **US1 tests:** T014, T016 and T017 together. T015 follows T014, since both edit `unresolvedRowRepair.test.ts`.
- **US2 tests:** T025, T026 and T029 together. T027 and T028 follow T025 in the same file.
- **US3 tests:** T035, T037 and T039 together. T036 follows T035 (`rptiImport.test.ts`), and T038 follows T037 (`unresolvedRowRepair.test.ts`).
- **Across stories:** US3 can run alongside US1, but both add to `unresolvedRowRepair.test.ts` and `e2e/unresolved-row-repair.spec.ts`. Keep each story in its own `describe` block, so their edits don't collide.
- **Polish:** T045 and T046 together.

## Parallel Example: User Story 1

```text
T014  draft tests            src/lib/unresolvedRowRepair.test.ts
T016  SC-001 sample test     src/lib/sampleReturns.test.ts
T017  E2E from Data Health   e2e/unresolved-row-repair.spec.ts
```

## Implementation Strategy

1. **MVP = Phases 1-3.** Foundational, then US1. That is enough to repair the published sample from
   its finding and file exactly what was filed. Stop and validate with SC-001 and quickstart level 3
   steps 1-4 and 6.
2. **Then US3.** It is small, independent, and closes Q21's open consequence for new imports.
3. **Then US2**, the larger UI, needed for renamed entries and ambiguous infrastructure.
4. **Polish.** Pin SC-004 and record it in Q22, then docs, then the full suites.

Commit at each checkpoint only when asked, and only with both suites green. Never push without a
separate explicit request.
