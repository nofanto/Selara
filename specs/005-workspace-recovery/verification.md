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
