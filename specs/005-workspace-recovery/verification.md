# Verification log — workspace backup and recovery

Actual outcomes only. Each entry records what was run, and when, and what happened, including failures and retries.

## Baseline — 2026-09-29, before implementation

- `npm run test:unit`: 29 files, 650 tests passed.
- `npx tsc --noEmit`: 1 error, the accepted CI baseline: `src/lib/excel.ts(295)`, `timelineSettings: {}` not assignable to `TimelineSettings`.
- `npx eslint .`: 0 errors, 8 warnings.

## Red

- **T004/T005** — `npx vitest run src/lib/workspaceBackup.test.ts`: the suite fails to load because `./workspaceBackup` doesn't exist (`BACKUP_DATA_SHEETS`, `createBackup`, `readBackupWorkbook`) and `parseWorkbookWithDiagnostics` is not exported from `./excel`. No test can pass before the module exists.
- **T004/T005, after `workspaceBackup.ts` existed but before `excel.ts` changed**: 52 of 57 passed. The 5 failures were meaningful: four ordinary-Import tests (`parseWorkbookWithDiagnostics is not a function`), and the duplicate-ID case (the reader stopped at the count mismatch without naming `asset-1`).
- **Replacement effects** — `npx vitest run src/lib/workspaceState.test.ts`: the 5 new `describeReplacementEffects` tests failed (not exported).
- **T006–T008** — `npx playwright test e2e/workspace-recovery.spec.ts e2e/workspace-recovery-routes.spec.ts e2e/workspace-recovery-concurrency.spec.ts --retries=0`: **39 failed, 0 passed**. The Backup/Restore controls, replacement previews, busy guard and fault-tolerant routes don't exist yet.

## Green (targeted)

- **T004/T005/T010/T017 (serialization, readers, Import-only repair)** — `npx vitest run src/lib/`: 30 files, 707 tests passed. `npx tsc --noEmit`: **0 errors**; the `excel.ts` snapshot-settings baseline error is gone because `{}` was replaced by the documented display repair, not a cast.
- Full Playwright run after the `excel.ts` change, with `db.ts` changing during the run: 704 passed, 4 skipped (the disabled Share suite).
- **T006–T019 (US1–US3, routes, concurrency)**: the three new E2E suites went from 39 failed to **39 passed** (`--retries=0`). The first Green run had 5 failures, 3 of them in the tests: `populated()` built a workspace without a live decision, although the contract calls for one, and the repair fixture contained a negative `opex`, which ordinary Import correctly refuses. The other 2 were in the app: the Backup panel had no wording saying a started download doesn't prove the file was saved (FR-012), and the panel was clipped by the header's horizontal scroll. All five were fixed, not skipped.
- **Additional behavior found while verifying:**
  - A fresh profile opens on the template picker, so restore is offered there.
  - A History-only or decisions-only workspace also opens there, so the picker offers Download backup too.
  - Escape cancels a replacement preview.
  - X02 is asserted for the restore preview as well as for Backup.
  - These added 1 test, and 4 new assertions in existing recovery tests. The suites total **39 tests**, all passing.

## Existing suites affected, and why

The first full run with the routes in place gave 734 passed and 9 failed:

- **6 were intended.** Resetting a populated workspace from a template now previews and needs confirmation (R04). These tests now click confirm: `confirm-modal.spec.ts` (2), `data-manager.spec.ts` (2), `versioned-import-export.spec.ts` (2), and `open-shared-confirmation.spec.ts` AC5, whose setup step resets.
- **1 was a stricter locator.** `export-all-entities.spec.ts`: the Import Preview now also shows a "Resources" row in its effects table, so `/Resources/` became ambiguous. It now matches `/\d+ Resources/`.
- **1 was timing.** `resource-assignment-sync.spec.ts` clicked the timeline straight after Overwrite, which now completes before reporting success. It now waits for the success notification.
- **1 was layout.** `initiative-deliverable-links.spec.ts` AC5: the new Backup button made the toolbar wrap to a third row at 1280px wide, pushing a segment under the legend. Backup moved next to the search box; the toolbar is back to two rows and the test passes unmodified.

## Final gates — 2026-09-29

- `npm run test:unit`: 30 files, **713 passed**.
- `npm run lint` (`eslint .` then `tsc --noEmit`): eslint 0 errors, 6 warnings (8 at baseline; none from this work). tsc **0 errors**, so the CI typecheck baseline in `.github/workflows/ci.yml` is lowered from 1 to 0.
- `npm run build`: built. The pre-existing chunk-size warning remains.
- `CI=1 npx playwright test` (the CI settings: 2 workers, 1 retry): **743 passed, 4 skipped** (the disabled Share suites), 0 flaky, 0 failed.
- `npx playwright test` locally at 4 workers, one run earlier: 738 passed, **5 flaky** (each failed once and passed on its retry), 4 skipped:
  - `large-dataset` (a strict-mode match while the Data Manager was still opening);
  - `initiative-deliverable-links` AC6;
  - `mobile` data manager scroll;
  - `lkpti-report` export;
  - `maturity-heatmap` save (report-card click timeouts).

  Those five specs then passed 142 of 142 runs with `--repeat-each=2 --retries=0`. They are attributed to load: the new recovery suites run several browser contexts at once. Reported here rather than hidden. Nothing in those five tests touches a replacement route.
- Ordinary interchange (Export, Import, Merge) and disabled outbound Share: covered by the existing suites and by R02 and R06 above.

## Restore-validation follow-ups — 2026-09-29

A review found that `readFormat1` trusted TimelineSettings count/presence metadata (contracts/workbook.md requires exactly one settings row per scope, and rejection of inconsistent metadata). Each case below was covered by a new test in `src/lib/workspaceBackup.test.ts` that tampered with the rows and adjusted the metadata so the counts alone couldn't catch it. Each test was run Red before the fix.

- **`0ad2f6f`**:
  - Red: 3 tests failed, each `expected 'complete' to be 'rejected'`.
    - A duplicate current settings row, with the marker's `currentCounts.TimelineSettings` set to 2.
    - A duplicate `ver-1` settings row, with its `rowCounts.TimelineSettings` set to 2.
    - `ver-1` listing `timelineSettings` with no row and a count of 0.
  - A fourth test guards existing behavior and passed before and after: settings that are genuinely absent, and not listed in the metadata, stay `incomplete` and go to ordinary Import.
  - Fix: more than one settings row in any scope is rejected, whatever the counts say. A Version that lists settings but has no row is rejected.
  - After the fix: unit 717/717; Playwright 743 passed, 4 skipped.
- **`10631ea`**:
  - Red: 1 test failed (`Received "incomplete"`). A `ver-1` settings row with a matching count, but `collections` omits `timelineSettings`.
  - Fix: now rejected as inconsistent presence metadata. Genuinely absent settings still come back `incomplete`, and Restore Backup never repairs settings.

## Final gates after follow-ups — 2026-09-29

- `npm run test:unit`: 30 files, **718 passed**.
- `npx playwright test`: **743 passed, 4 skipped** (the disabled Share suites), 0 failed.
- `npm run lint`: eslint 0 errors, 6 warnings (unchanged). tsc 0 errors.
- `npm run build`: built. The pre-existing chunk-size warning remains.
- After the sign-off cleanup, one full `npx playwright test` run gave **742 passed, 1 failed, 4 skipped**.
  - The failure was `undo-redo.spec.ts` "undo stack is capped at 10": `Rename 6` instead of `Rename 5`. The test is timing-based (15 renames at 50 ms, then 10 undos at 30 ms).
  - Repeated with `--retries=0`, it failed 1 of 5, then 2 of 10. After that it passed 20 of 20 and 40 of 40 on this branch, and 20 of 20 and 40 of 40 on `main` (`8bf7e5e`).
  - It is attributed to machine load, not to this work: the cleanup changed only documentation and a trailing blank line. Reported here rather than hidden.
  - The next full run: **743 passed, 4 skipped**, 0 flaky, 0 failed.

## CI failure on PR #69 — 2026-09-29

The first PR run, [36563196084](https://github.com/nofanto/Selara/actions/runs/36563196084) on `fbd4d0c` (CI settings: 2 workers, 1 retry), failed Playwright with **741 passed, 1 failed, 1 flaky, 4 skipped**. Unit tests, build and static checks passed.

- **Failed: `undo-redo.spec.ts` "undo stack is capped at 10".** The first attempt ended on `Rename 9`, the retry on `Rename 8`; the test expected `Rename 5`. That means 4–5 of the 10 undos were lost, not a one-step timing miss.
  - **Cause:** since M1, Undo/Redo waits for queued saves and writes to IndexedDB before moving the stacks. While that is in progress, further Undo/Redo presses are ignored. This is what `contracts/replacement-routes.md` R08 requires: "Disable during saving".
  - The test pressed Ctrl+Z ten times with fixed 30 ms gaps. Before M1, Undo was synchronous and every press applied. On a slower runner the save outlasts the gap, and the later presses are correctly ignored. The earlier local off-by-one failures (`Rename 6`) had the same cause.
  - **Reproduction:** the same test with the 30 ms gap set to 0 failed 6 of 6 on this branch (`Rename 11`–`Rename 14`) and passed 6 of 6 on `main` (`8bf7e5e`). Chromium CPU throttling did not reproduce it: 4 of 4 passed on both sides at 4×, and at 6× the test ran out of time during the edits. IndexedDB work is not slowed by page CPU throttling.
  - **Fix:** the test only. After each Ctrl+Z it waits for the `undo-counter` to go down, instead of a fixed delay. It still asserts the cap: 15 edits leave 10 undo steps, 10 undos return to `Rename 5`, and Undo ends disabled. Product behavior is unchanged. The fixed test passed 20 of 20 with `--retries=0`.
- **Flaky: `dependencies.spec.ts` "clicking segment dependency arrow opens DependencyPanel…"**. It found 9 dependency arrows instead of 10 because the drag did not create the dependency, then passed on retry.
  - This predates M1: with 40 repeats and `--retries=0` it failed 1 of 40 on this branch and 1 of 40 on `main`, with the same `Received: 9`. Not changed here.

After the fix:
- `npm run test:unit`: 30 files, **718 passed**.
- `npm run lint`: eslint 0 errors, 6 warnings; tsc 0 errors.
- `CI=1 npx playwright test`: **743 passed, 4 skipped**, 0 flaky, 0 failed.
- `npx playwright test` (local, 4 workers): **743 passed, 4 skipped**, 0 flaky, 0 failed.

## CI failure on PR #69, second run — 2026-09-29

Run [36569435598](https://github.com/nofanto/Selara/actions/runs/36569435598) on `7574337`: the undo-cap test passed. Playwright still failed, **742 passed, 1 failed, 4 skipped**. The `dependencies.spec.ts` segment-arrow test failed on both attempts (`Received: 9`). That changes the note above ("Not changed here"): the flake predates M1, but it was now blocking CI, so it has been diagnosed and fixed.

- **Is it an M1 regression?** No. Under the same load (`--workers=8 --retries=0`, two rounds of 200 repeats each, alternating), the branch failed **43 of 400** and `main` (`8bf7e5e`) failed **42 of 400**, all with `Received: 9`. Without extra load: 0 of 100 on the branch.
- **CI artifact:** the uploaded `playwright-report` had no trace or screenshot for this test. Its only snapshot file was an unrelated leftover page.
- **Cause, from temporary instrumentation (not committed) over 200 loaded runs:**
  - The drag's mouse-down at the link handle (1241, 400) hit `legend-content` in every failing run, and `segment-action-link` in every passing run.
  - Positions were identical in passing and failing runs, and the handle always lies inside the floating legend's box.
  - The selected segment bar had both `z-[50]` and `hover:z-20`. Hover rules come later in the stylesheet, so a hovered selected segment dropped to 20, below the legend's `z-40`.
  - With the handle under the legend, this loops. Legend on top → bar not hovered → 50 → bar on top → hovered → 20.
  - Chromium updates hover on its own schedule, so under load mouse-down could arrive in the "legend on top" phase. The drag then never started.
- **Red:** new test in `initiative-bar-ux.spec.ts`, "a hovered selected segment stays above the floating legend". It failed **5 of 5** (`Expected: > 40`, `Received: 20`).
- **Fix** (`src/components/Timeline.tsx`): `hover:z-20` now applies only to unselected segments, so a selected segment stays at `z-[50]` while hovered.
- **Green:** the new test passed 5 of 5. The original dependencies test passed **200 of 200** under the same 8-worker load, down from about 10% failing.

After the fix:
- `npm run test:unit`: 30 files, **718 passed**.
- `npm run lint`: eslint 0 errors, 6 warnings; tsc 0 errors.
- `npm run build`: built.
- `CI=1 npx playwright test`: **744 passed, 4 skipped**, 0 flaky, 0 failed.
- `npx playwright test` (local): **744 passed, 4 skipped**, 0 flaky, 0 failed.

## Missing object stores: IndexedDB v20 repair — 2026-09-30

**Report.** A planner started the M1 branch against their existing browser profile. Two console errors followed:
- `Failed to load data from DB: NotFoundError: Failed to execute 'transaction' on 'IDBDatabase': One of the specified object stores was not found`, at `readPersistedWorkspace`, `db.ts:334`;
- the same error from `Failed to save data to DB`, at `App.tsx:801`.

The app showed its fallback workspace, and every save failed. The profile was cleared before its store list could be captured.

**Cause.** The database was at v19 but missing at least one store. `main` had skipped missing stores; M1's atomic read and write name every store. Decision and rationale: [ADR-0016](../../docs/adr/0016-repair-missing-object-stores-at-v20.md).

**Red:** `e2e/db-schema-repair.spec.ts`, 2 tests, `--retries=0`. Both seed a v19 database from a static page on the same origin. It holds the app's own template records, with one initiative renamed so it can't be mistaken for the fallback, plus a saved Version and the orphaned `dtsPhases` store.
- *Missing `decisions` and `lkptiDetails`:* **failed**. The seeded initiative never appeared, because the load failed and the fallback template was shown.
  - The first draft of this test checked a template initiative name. That passed on the fallback data, so the seed was made distinguishable and the load-error check moved first.
- *Complete v19:* **failed**, `Expected: 20, Received: 19`.

**Fix** (`src/lib/db.ts`): `DB_VERSION` 20. `upgrade()` now begins by creating any missing entity store, plus `versions`, with `keyPath: 'id'`, and `settings` out-of-line. Nothing existing is touched.

**Green:** both tests pass. Each asserts:
- version 20;
- every key path;
- every seeded record and the settings unchanged, and `dtsPhases` kept;
- the seeded workspace and snapshot shown, with no load or save error;
- an edit saved and still present after a reload.

Repeated with `--repeat-each=5 --retries=0`: **10 of 10**.

After the fix:
- `npm run test:unit`: 30 files, **718 passed**.
- `npm run lint`: eslint 0 errors, 6 warnings; tsc 0 errors.
- `npm run build`: built.
- `CI=1 npx playwright test`: **746 passed, 4 skipped**, 0 flaky, 0 failed.
- `npx playwright test` (local): **745 passed, 1 flaky, 4 skipped**.
  - The flaky test was `rpti-data-manager.spec.ts` "filed cost and remarks entered on the segment survive reload…" (T022). It failed once, showing the value missing after the reload, and passed on its retry.
  - This predates v20. With `--repeat-each=40 --retries=0` it failed with the same symptom 2 of 40 with v20, 1 of 40 on `fbc83d9` (before v20) and 3 of 40 on `main` (`8bf7e5e`). Not changed here.

## Reset picker can be closed — 2026-09-30

**Report.** **Data Manager → Clear data and start again** opened the template picker in reset mode with no way to close it, although nothing had changed yet. First-launch onboarding (`isReset=false`) should stay mandatory.

**Red:** 2 tests in the R04 section of `e2e/workspace-recovery-routes.spec.ts`, `--retries=0`.
- "the reset picker can be closed before choosing; nothing is written, including after reload": **failed**, timing out waiting for `getByRole('button', { name: 'Close' })` inside the picker.
- "first-launch onboarding stays mandatory: its picker has no Close": passed, as intended. It guards the fix rather than reproducing the bug.

**Fix:**
- `TemplatePickerModal` takes an optional `onClose`, and renders a Close button (×, accessible name "Close") only when `isReset` is true. It's disabled while an import or restore started from the picker is in progress.
- `App.tsx` closes the picker and clears reset mode. Nothing is read, written or deleted.

**Green:** all 4 R04 tests with `--repeat-each=3 --retries=0`: **12 of 12**. The close test checks the stored workspace is unchanged, both before and after a reload (`expectStoredUnchanged`).

After the fix:
- `npm run test:unit`: 30 files, **718 passed**.
- `npm run lint`: eslint 0 errors, 6 warnings; tsc 0 errors.
- `npm run build`: built.
- `CI=1 npx playwright test`: **748 passed, 4 skipped**, 0 flaky, 0 failed.
- `npx playwright test` (local): **748 passed, 4 skipped**, 0 flaky, 0 failed.

Documentation:
- User story 15 gains AC8 (reset Close) and AC9 (first launch has no Close).
- User story 28 gains a matching criterion.
- `docs/user-guide/01-getting-started/first-launch.md` describes Close in the reset steps.

## Review findings on `d4c7ff7` and `f339f77` — 2026-09-30

Codex reviewed both commits and raised three P2 findings. All three were reproduced with a temporary spec, since deleted, before any fix:
1. A raw page held a v19 connection; the app in a second tab showed only "Loading data..." after 8 s, and loaded as soon as the connection closed.
2. With a template preview open over the reset picker, Close was enabled. Five Shift+Tab presses reached it, and Enter closed the picker while the preview stayed open. Cancel then landed on Data Manager instead of the picker.
3. Opening the reset picker by keyboard left focus on `clear-and-start-again-btn`, behind the overlay. There was no `role="dialog"`, and after Close, focus fell to `BODY`.

No finding involved data loss. Codex found no migration-order, key-path, preserved-record or first-launch issue.

**1. Upgrades across open tabs** (`e2e/db-schema-repair.spec.ts`, "Upgrades across open tabs").
- **Red:**
  - With an older tab's v19 connection held, `storage-upgrade-blocked` was not found.
  - A raw v21 open from another tab returned "still blocked after 5s".
- **Fix** (`src/lib/db.ts`, `src/App.tsx`):
  - A `blocked` handler sets the storage state to `'blocked'`, and the loading screen says to close or reload the other Selara tabs. It clears once the open succeeds.
  - A `blocking` handler closes the connection (running transactions finish) and replaces `dbPromise` with a rejected `DatabaseSupersededError`, so no stale, resolved promise is left. A persistent `storage-superseded` notice offers Reload.
  - Later saves, including queued ones, reject with that error, and the save banner shows its message.
- **Green:**
  - The message appears, then the seeded workspace loads once the connection is released.
  - The v21 open succeeds, the notice shows, and a later edit shows the error banner.

**2. Picker inert under a preview** (R04, "while a replacement preview is open, the picker behind it cannot be reached").
- **Red:** focus landed inside the picker (`Expected: false, Received: true`).
- **Fix:** `TemplatePickerModal` takes `inert`, and App passes `!!openReplacement`. This covers Close and every other picker control, whether the preview came from a template, an import or a restore.
- **Green:** direct `.focus()` on Close and on **Start blank**, and 12 Shift+Tab presses, never reach the picker. After Cancel, the picker works and Close closes it.

**3. Dialog semantics and focus** (R04, "the reset picker is a labelled dialog…", plus the first-launch test).
- **Red:** `getByRole('dialog', { name: 'Clear data and start again' })` and `… 'Welcome to Selara'` were not found.
- **Fix:**
  - The panel has `role="dialog"`, `aria-modal="true"` and `aria-labelledby`, pointing at the heading.
  - On mount, focus moves to Close in reset mode, or to the heading (`tabIndex=-1`) on first launch.
  - Close returns focus to the element that was focused when the picker opened, then calls `onClose`.
  - A general focus trap for every modal is left to a follow-up.
- **Green:** the reset picker opens with focus on Close, and Enter on Close returns focus to **Clear data and start again**. The first-launch dialog takes focus.

The new tests, `--repeat-each=5 --retries=0`: **30 of 30**. The related specs (recovery routes, schema repair, template demo toggle, workspace templates): **46 of 46**.

After the fixes:
- `npm run test:unit`: 30 files, **718 passed**.
- `npm run lint`: eslint 0 errors, 6 warnings; tsc 0 errors.
- `npm run build`: built.
- `CI=1 npx playwright test`: **752 passed, 4 skipped**, 0 flaky, 0 failed.
- `npx playwright test` (local): **752 passed, 4 skipped**, 0 flaky, 0 failed.

CI on the two reviewed commits was green: run 36719290077 (`d4c7ff7`, 746 passed) and run 36720665528 (`f339f77`, 748 passed), with 0 flaky.

Documentation:
- ADR-0016's consequences now describe the `blocked` and `blocking` handling.
- The database diagram's v20 note mentions it.
- User story 15 (AC8/AC9) and story 28 gain criteria.
- The user guide (`11-import-export/backup-and-restore.md`) gains "When Selara updates with other tabs open".
