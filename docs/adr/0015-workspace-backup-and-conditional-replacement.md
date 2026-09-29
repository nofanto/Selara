# ADR-0015: Back up to a verified Excel workbook, and replace the workspace only against a reviewed base

## Status

Accepted

## Context and Problem Statement

Roadmap milestone M1 (R1-04–06) asks that a planner can recover without their original browser profile, and that replacing the workspace is hard to do by mistake. Selara keeps everything in one browser's IndexedDB; the History tab holds saved versions *in that same database*, so it is no protection against losing the browser's data. The design notes are [`requirement-specs/workspace-backup-recovery.md`](../../requirement-specs/workspace-backup-recovery.md); the specification and contracts are under [`specs/005-workspace-recovery/`](../../specs/005-workspace-recovery/spec.md); the story is [user story 28](../user-stories/28-workspace-recovery.md).

Two problems sat under the feature:

1. **The ordinary Excel export was not a lossless copy.** Measured against SheetJS 0.20.3 with real XLSX bytes, it silently dropped nested values (timeline column widths, collapsed groups), joined `Initiative.resourceIds` with commas (so an ID containing a comma became two), turned `\r\n` into `\n`, decoded literal `_xHHHH_` text as Excel escapes, replaced `U+FFFE`/`U+FFFF` and lone surrogates, wrote an absent version description as `''`, and did not carry the archival decision copy inside each saved version. Nothing detected a missing row.
2. **Replacement was optimistic and unconditional.** `App.handleUpdate` changed the screen before saving and swallowed save failures; Import → Overwrite reported success before the save finished; seven routes replaced the whole workspace with different, partly unprotected, confirmation; and nothing stopped a preview reviewed in one tab from overwriting a change another tab had just saved.

## Decision Drivers

- A backup must be *demonstrably* complete: every inventoried field, current and historical, through the actual file, into a fresh profile (SC-001/SC-003).
- One portable format the planner already understands (decision 1A), rather than a second format to maintain.
- No success message, Undo entry or screen change for a replacement that did not fully save (FR-005/006).
- A preview reviewed against old data must never overwrite newer data, including a change from another tab whose broadcast has not arrived yet (FR-015/016).
- No new business entity and no IndexedDB schema version for bookkeeping.

## Considered Options

- **A. The existing workbook, made lossless and self-checking** (format 1): the same 16 entity sheets as the source of truth, a `SelaraBackup` marker sheet with row counts, a JSON cell encoding for nested and at-risk values, and a pre-download read-back comparison.
- **B. A separate JSON backup format** beside the workbook.
- **C. A hidden full-workspace JSON snapshot inside the workbook**, alongside the visible sheets.
- For replacement: **D. a conditional replacement** — compare a fingerprint of the reviewed stored base inside the replacing transaction; **E. a persisted revision counter**; **F. rely on the cross-tab broadcast** to invalidate stale previews.

## Decision Outcome

Chosen options: **A** for the backup and **D** for replacement.

**Backup** — `src/lib/workspaceBackup.ts`:

- `FIELD_INVENTORY` classifies every member of every backed-up interface. Its type makes an unclassified new field a compile error, and `workspaceBackup.test.ts` parses `src/types.ts` so it also fails at test time.
- `createBackup` validates structure (required fields, declared JS types, finite numbers, unique IDs per scope). Off-list enum values and non-ISO dates are *preserved and disclosed*, not rejected (design notes, 2026-09-29 amendment). It then writes real XLSX bytes, reads them back through `readBackupWorkbook` — the same reader Restore Backup uses — and refuses to return a file that isn't equal under the inventory's rules (`workspacesEqual`). Only then does `BackupControls` start the download.
- `readBackupWorkbook` classifies a file as complete (format 1, or a recognised legacy export), incomplete (sent to ordinary Import), or rejected (corrupt, inconsistent counts, unknown snapshot envelopes, duplicate IDs, a future format). It never repairs. Snapshot display repairs happen only in ordinary Import (`repairSnapshotSettings` in `src/lib/excel.ts`), which replaced the `|| {}` that was the repository's one TypeScript error.

**Replacement** — `src/lib/db.ts` and `src/App.tsx`:

- Every workspace and History write goes through one queue (`enqueueWrite`, built on the existing `createSerialAsyncRunner`). `drainWrites` waits for it and fails if the last save of on-screen work failed.
- `readPersistedWorkspace` reads every store, settings and History in one transaction. A preview keeps that base and its `workspaceFingerprint`.
- `replaceWorkspace(data, expectedFingerprint, fingerprint)` reads the stores again *inside* the readwrite transaction and aborts with `StaleWorkspaceError` before any write if they no longer match. IndexedDB's all-or-nothing transactions mean a failure changes no store.
- `App.commitReplacement` publishes the new state, the Undo entry, the cross-tab notice and any success message only after that commit. Every route — Restore Backup, Import → Overwrite, Open shared, template reset, onboarding, incoming share links, History restore — goes through it, and Undo/Redo use the same conditional write against what the tab last stored.
- A local revision counter (in memory, not persisted) marks an open preview stale on any local edit or remote sync; the planner must refresh before confirming. A busy guard blocks edits, History changes, Undo and a second confirmation while a replacement saves.

### Pros and Cons of the Options

#### A. The existing workbook, lossless and self-checking

- Good, because one file serves recovery and remains readable in Excel; ordinary Import can still read a backup.
- Good, because the read-back comparison turns "we think it's lossless" into a check that runs on every backup, so an unforeseen SheetJS behaviour fails loudly before download instead of at recovery.
- Bad, because an Excel cell holds at most 32,767 characters. A single value that long — most plausibly one version's archived decisions in the encoded form — fails backup with the record named, rather than being split across cells. That limit is accepted for now and must be revisited if real workspaces hit it.
- Bad, because the file is unencrypted (password protection deferred by 1A).

#### B. A separate JSON backup format

- Good, because there are no cell limits or Excel quirks.
- Bad, because it adds a second format to maintain and explain, and 1A chose one workbook.

#### C. A hidden JSON snapshot inside the workbook

- Bad, because two copies of the same data in one file can disagree, and nothing says which one wins.

#### D. Conditional replacement against a fingerprint of the reviewed base

- Good, because it closes the check-then-write race inside one transaction, whether or not a broadcast arrives.
- Good, because it needs no schema change or persisted revision.
- Bad, because it reads and fingerprints the whole workspace on each replacement, Undo and Redo — acceptable at the sizes Selara holds, and never on ordinary edits.

#### E. A persisted revision counter

- Bad, because it needs a schema bump and a write on every edit, and every writer must remember to bump it.

#### F. Rely on the broadcast

- Bad, because a broadcast can arrive after the other tab's write and after this tab's confirmation. It is kept as a prompt to refresh, not as the protection.

## Consequences

- Backup is a manual action with an honest status: "download started" is all the browser can confirm. The last start time is local operational metadata in `localStorage` (`selara-last-backup-started`), outside every workspace and backup.
- A fresh browser profile can restore from the template picker, which is where it opens.
- Replacing an existing workspace from a template or from filed returns now shows a preview; first use on an empty workspace stays direct. Existing E2E flows that reset a populated workspace confirm once more.
- History writes now go through the app (`HistoryView` no longer calls `db.ts` directly), are broadcast to other tabs, and are read back by cross-tab sync.
- ADR-0011 is unchanged: History restore keeps the live decision log; full Restore Backup replaces it with the backup's, and keeps each snapshot's archival copy.
- Any future persisted field must be classified in `FIELD_INVENTORY` before it compiles; M4's filing metadata must repeat the recovery verification.
- Ordinary edits remain optimistic. Two tabs editing at once is still out of scope (`requirement-specs/cross-tab-sync.md`); only whole-workspace replacement and Undo/Redo refuse a changed base.
