# Validation guide

**Updated:** 2026-09-29. These are planned implementation checks. No test below is claimed to have run or passed; current authorization is documentation only.

## Prerequisites

Install the repository dependencies and Playwright Chromium when implementation is authorized. Use disposable browser profiles and fictional fixtures only. The existing dev server uses port 3000; existing tests and new tests must share the intended isolated test instance. Before implementation, write each new test and observe its meaningful failure; retain existing Green regressions.

## Targeted commands after test files exist

- `npx vitest run src/lib/workspaceBackup.test.ts src/lib/workspaceState.test.ts`
- `npx playwright test e2e/workspace-recovery.spec.ts e2e/workspace-recovery-routes.spec.ts e2e/workspace-recovery-concurrency.spec.ts e2e/open-shared-confirmation.spec.ts --retries=0`

## Scenario checklist

1. Build the [field-inventory fixtures](contracts/field-inventory.md), including all fields, two distinct snapshots, archival decisions, live links and nested settings. Assert actual workbook → XLSX bytes → parse equality. Exercise optional absence/empty/zero/false, marker-prefixed text and unsupported-value failure. Assert a new unclassified interface field fails inventory coverage.
2. Initiate Backup through the UI, retain its actual downloaded file outside the source profile, close/delete that disposable profile, and Restore Backup in a fresh profile. Confirm its preview, reload, and compare the entire inventoried workspace. Repeat for empty, History-only and decisions-only states. Do not seed the destination with a copied source object.
3. Exercise every [workbook acceptance row](contracts/workbook.md): complete current/legacy, missing sections/settings, duplicate IDs/settings, unknown snapshot envelopes, malformed cells/counts, unresolved business references and future versions. Rejected input never mutates state. Partial files use ordinary Import; display repairs are warned and do not fabricate business settings.
4. Execute [R01–R08](contracts/replacement-routes.md) with populated records, Versions and decisions. Assert applicable previews/cancel, failure after some writes are queued, retry and reload. For incoming URL sharing use mocked payload/decryption failure, never a live backend. Confirm outbound Share stays disabled and ordinary Merge/Export still work.
5. Execute X01–X08: drain pending saves, fail a pending save, invalidate a local/remote preview, force a competing commit at the final transaction boundary, repeat confirmation, attempt History mutation during persistence, fail Undo/Redo and verify both stacks, then verify another tab refreshes Versions before backup. A late broadcast must not be needed to prevent the transaction race.
6. Exercise the backup outcome matrix: fail generation and initiation (old timestamp stays), succeed initiation but fail timestamp storage (truthful separate message), reload with missing/unreadable timestamp, and succeed/reload normally. No reminder UI and no saved-file guarantee.
7. Read the shipped guide walkthrough against the actual UI: Backup vs report/timeline export, profile-loss recovery, supported legacy limits and History/live-log restoration semantics must match.

## Required final gates

Run `npm run test:unit`, `npx playwright test`, `npm run build`, and `npm run lint`. Record targeted Red/Green and full-suite outcomes, including retries or unresolved failures, in verification.md when implementation starts. Clear the typecheck baseline only after the underlying error is fixed. Update M1 completion only after every required gate and recovery scenario succeeds.
