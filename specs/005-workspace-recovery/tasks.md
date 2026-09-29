# Tasks: Workspace Backup and Recovery

**Updated:** 2026-09-29. Replaces the initial 13-task draft with explicit coverage for all seven accepted findings. Task IDs below are the current sequence; no old implementation task was executed.
**Scope:** Implementation authorized and carried out on 2026-09-29. Evidence is in the [verification log](verification.md).
**References:** [spec](spec.md), [plan](plan.md), [fields](contracts/field-inventory.md), [workbook](contracts/workbook.md), [routes](contracts/replacement-routes.md).

## Phase 1 — Documentation setup

- [x] T001 Record 1A/2A/3A in requirement-specs/workspace-backup-recovery.md and specs/005-workspace-recovery/spec.md.
- [x] T002 Produce the initial design artifacts in specs/005-workspace-recovery/ and docs/user-stories/28-workspace-recovery.md.
- [x] T003 Reconcile all seven accepted findings across specs/005-workspace-recovery/, append the dated decision amendment in requirement-specs/workspace-backup-recovery.md, and revalidate checklists/requirements.md using document consistency checks. This task changes no source or test files.

## Phase 2 — Failing tests and shared persistence foundation

Executed 2026-09-29. Red was observed for each suite before the behavior it covers; see [verification.md](verification.md).

- [x] T004 Write field-inventory coverage and actual-XLSX-byte equality tests in src/lib/workspaceBackup.test.ts. Exercise all fields, two distinct snapshots, archival decisions, optional/empty/zero/false/nested values, ID reuse, marker text, comma-bearing resource IDs, and loss-rejection cases. Record Red in specs/005-workspace-recovery/verification.md. (FR-002–003/018; SC-001)
- [x] T005 Write workbook acceptance/rejection and legacy repair unit tests in src/lib/workspaceBackup.test.ts: enumerate all 16 sheets, empty complete files, format/count/presence errors, duplicate scoped IDs/settings, orphaned snapshot envelopes, future markers, missing snapshot settings, display-only fallback and business-value preservation/disclosure. Add live-log/archival distinction cases in src/lib/workspaceState.test.ts. Record Red for new behavior and retain existing regression assertions. (FR-008–010/017; SC-004)
- [x] T006 Write failing Backup/Restore UI tests in e2e/workspace-recovery.spec.ts: actual download, deletion of disposable source profile, fresh-profile equality and reload; empty/History-only/decisions-only states; generation/initiation failure; timestamp write/read failure; successful timestamp reload. Record Red before T010/T011/T018. (FR-001–003/007/011/018; SC-001/003/007)
- [x] T007 Write failing route tests in e2e/workspace-recovery-routes.spec.ts for every applicable cell of R01–R08: preview, cancel, invalid input, post-enqueue quota/save failure, retry and reload, plus route-specific History/decision effects. Include ordinary failed Merge and disabled outbound Share regressions. Mock incoming URL shares without a live backend. Record Red before route changes; link existing #62 assertions where already Green. (FR-004–006/009–010/014/017; SC-002/005)
- [x] T008 Write failing concurrency tests in e2e/workspace-recovery-concurrency.spec.ts for X01–X08, including pending-save failure, local/remote preview invalidation, a commit between check/write, duplicate confirmation, History mutation during save, failed Undo/Redo retaining stacks, and remote History refresh before backup. Record Red before T009/T014–T016. (FR-015–016; SC-006)
- [x] T009 Implement coherent all-store reads, pending workspace/History write coordination and conditional atomic replacement in src/lib/db.ts; safely abort/observe request and transaction failures. Cover saveVersion/deleteVersion as well as saveAppData. Check the persisted base before writes in the same transaction. Do not add a revision entity or schema bump. (FR-005–006/015–016; SC-005–006)

## Phase 3 — US1: Portable recovery

**Independent evidence:** actual downloaded-file preservation after source-profile deletion, using every inventoried field and documented equality rules.

- [x] T010 [US1] Implement lossless authoritative-sheet serialization, marker escaping, archival decision/presence metadata, scoped completeness validation and pre-download serialized equality checks in src/lib/excel.ts and src/lib/workspaceBackup.ts. Keep supported legacy parsing distinct from new-format parsing; reject future markers and structural loss. Make T004/T005 pass for this slice. (FR-002–003/008/017–018; SC-001/004)
- [x] T011 [US1] Add named Backup/Restore Backup actions in src/components/DataControls.tsx, using a coherent saved workspace including Versions from src/App.tsx/src/lib/db.ts. Distinguish these from report/timeline exports and keep ordinary Import/Export available. Wire R01 preview and confirmation through T009’s awaited conditional commit so this slice is independently recoverable. Block preparation on failed pending saves and explain incomplete/unsupported input without mutation. (FR-001/003/007/014–015; SC-003)
- [x] T012 [US1] Verify T006's actual-file fresh-profile scenarios and inventoried equality, including source-profile deletion and after-reload comparison; record targeted results in specs/005-workspace-recovery/verification.md. Do not substitute a copied in-memory object for the downloaded workbook. (FR-002/007; SC-001/003)

## Phase 4 — US2: Safe replacement

**Independent evidence:** the R01–R08 matrix and X01–X08 cases pass with the specified applicability exceptions; no silent overwrite of a changed destination.

- [x] T013 [US2] Implement route-specific previews and awaited result handling in src/App.tsx, src/components/DataControls.tsx, src/components/TemplatePickerModal.tsx, src/components/HistoryView.tsx and src/components/ConfirmModal.tsx. Complete R02–R07, including incoming share startup, and verify consistency with R01; preserve each route's decision/History policy and empty-workspace exception. Display current/incoming counts, settings effects and all compatibility limitations. (FR-004–006/009–010/014; SC-002/005)
- [x] T014 [US2] Implement preview-base capture, pending-save blocking, local/remote invalidation, renewed confirmation and busy interaction protection in src/App.tsx using the conditional transaction from T009. No stale preview may overwrite a newer base. (FR-015–016; SC-006)
- [x] T015 [US2] Coordinate History create/delete callbacks in src/components/HistoryView.tsx and remote synchronization in src/App.tsx so pending History writes cannot race replacement, Versions refresh with other state, and an older asynchronous sync read cannot publish over a newer commit. (FR-002/015–016; SC-001/006)
- [x] T016 [US2] Make replacement Undo/Redo (R08) in src/App.tsx persist conditionally before changing stacks, retaining both stacks on failure and rejecting stale remote bases. Preserve #62 Undo of History and direct-action behavior without adding a confirmation modal. (FR-005–006/016; SC-002/005–006)

## Phase 5 — US3: Failure handling and compatibility

**Independent evidence:** invalid/partial files and injected storage faults leave the old workspace available; timestamp errors truthfully distinguish download from local bookkeeping.

- [x] T017 [US3] Surface ordinary-Import-only display repairs, absent/invalid business-setting disclosures, missing-vs-empty Decisions behavior and inherited current-settings warnings in src/lib/excel.ts, src/lib/workspaceBackup.ts and src/components/DataControls.tsx. Restore Backup must never silently repair. Clear the existing snapshot-settings type error through the accepted fallback, not a cast. (FR-008–010/017; SC-004)
- [x] T018 [US3] Implement the backup outcome matrix in src/components/DataControls.tsx and relevant helpers: generation/initiation errors retain the old timestamp, timestamp-write failure reports a started download separately, unreadable/missing timestamp shows no invented value, and successful initiation survives reload. No reminders. (FR-011/018; SC-007)
- [x] T019 [US3] Verify all workbook cases, R01–R08 and X01–X08 using targeted unit/E2E files; fix issues and record Red/Green evidence in specs/005-workspace-recovery/verification.md. Assert no false success, no partial writes, unchanged live-log semantics on History restore, retained recovery stacks, successful retry and reload. (FR-002/004–011/014–018; SC-001–007)

## Phase 6 — Documentation and required gates

- [x] T020 Update docs/user-guide/01-getting-started/what-is-selara.md, docs/user-guide/10-version-history/, docs/user-guide/11-import-export/, README.md, docs/user-stories/28-workspace-recovery.md and requirement-specs/workspace-backup-recovery.md to describe shipped behavior and actual verification evidence. Explain local History loss, portable contents/exclusions, legacy limits and download-initiation wording. (FR-012–013)
- [x] T021 Write the next numbered ADR under docs/adr/ and update docs/database-diagram.md for the workbook contract and local operational metadata; document that no new business entity/IndexedDB schema version is required. Record synchronization/conditional replacement rationale without changing ADR-0011. (FR-002/010–011/013/015–016)
- [x] T022 Run npm run test:unit, npx playwright test, npm run build and npm run lint. Record actual outcomes and retries/failures in specs/005-workspace-recovery/verification.md; set the TypeScript baseline to zero in .github/workflows/ci.yml only once the error is fixed. Retain ordinary interchange and disabled-sharing regression checks. (FR-014; SC-001–007)
- [x] T023 Update requirement-specs/first-release-roadmap.md M1 completion evidence only after T019–T022 succeed; link the originating story and verification. Do not mark M1 complete from planning artifacts. (FR-013; SC-001–007)

## Dependencies and execution

T001 → T002 → T003 precede any authorized implementation. T004–T008 establish Red before T009–T018. T009 supplies the coherent/conditional persistence boundary; T010 supplies serialization; T011 integrates their UI. T013–T016 complete route/concurrency semantics before final route verification. T011 includes the R01 integration needed for T012; T012 cannot be marked complete until actual fresh-profile recovery passes. T017/T018 finish compatibility and failure messages before T019. T020–T023 follow verified behavior.

Tests in separate unit/E2E files can be authored independently after T003; browser fault/competing-tab runs should be isolated. App.tsx and DataControls.tsx edits must be sequential. This describes task concurrency, not permission to start agents or implementation. All three stories are required for M1; no deployment/commit/push is implied.

## Requirement coverage

| Requirement | Tasks |
|---|---|
| FR-001 | T006, T011 |
| FR-002 | T004, T006, T010, T012, T015 |
| FR-003 | T004, T010, T011 |
| FR-004 | T007, T013 |
| FR-005 | T007, T009, T013, T016, T019 |
| FR-006 | T007, T009, T013, T016, T019 |
| FR-007 | T006, T011, T012 |
| FR-008 | T005, T010, T017 |
| FR-009 | T005, T007, T013, T017 |
| FR-010 | T005, T007, T013, T017 |
| FR-011 | T006, T018 |
| FR-012 | T020 |
| FR-013 | T020, T021, T023 |
| FR-014 | T007, T011, T013, T022 |
| FR-015 | T008, T009, T011, T014, T015 |
| FR-016 | T008, T009, T014, T015, T016 |
| FR-017 | T005, T007, T010, T017 |
| FR-018 | T004, T006, T010, T018 |
| SC-001 | T004, T006, T010, T012, T019 |
| SC-002 | T007, T013, T016, T019 |
| SC-003 | T006, T012 |
| SC-004 | T005, T010, T017, T019 |
| SC-005 | T007, T009, T013, T016, T019 |
| SC-006 | T008, T009, T014, T015, T016, T019 |
| SC-007 | T006, T018, T019 |
