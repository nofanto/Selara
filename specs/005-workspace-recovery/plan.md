# Implementation Plan: Workspace Backup and Recovery

**Branch**: main (feature directory independent of branch) | **Updated**: 2026-09-29 | **Spec**: [spec.md](spec.md)
**Status**: Implemented 2026-09-29 (implementation authorized the same day). Outcomes are in the [verification log](verification.md).

## Summary

Complete M1 with the existing Excel workbook, lossless cells and explicit completeness validation. Provide manual Backup/Restore Backup and truthful initiation status. Prepare previews from coherent saved state; invalidate stale previews and compare their base atomically before replacement. Publish replacement UI, stack changes and success only after persistence. Preserve ordinary import and History semantics.

## Technical Context

TypeScript 5.8, React 19, Vite 6, SheetJS 0.20.3, idb 8. Browser-only local workspace. Existing IndexedDB database v19 stores can hold this work; no new business entity, cloud service or snapshot system. Vitest covers serializers, validators and equality; Playwright covers actual downloads, profiles, replacement routes, cross-tab behavior and injected failures. No new latency or regulatory-readiness claim.

## Authoritative contracts

- [Field inventory](contracts/field-inventory.md): every supported field, equality, archival snapshot decisions and exclusions; fails loudly for an unclassified new field.
- [Workbook](contracts/workbook.md): 16 data sheets, format 1 marker, cell escaping, scoped counts/presence metadata, legacy acceptance/rejection and ordinary-Import-only repairs.
- [Replacement routes](contracts/replacement-routes.md): R01–R08 and concurrency X01–X08, including incoming URL sharing and preserved route-specific History/decision semantics.
- [Data model](data-model.md), [research](research.md), [validation guide](quickstart.md).

## Persistence and concurrency design

1. Coordinate pending local workspace writes and History create/delete. Before backup or preview, await completion; a failed save blocks the operation while preserving visible unsaved work. Keep ordinary edits optimistic, with explicit tracking of pending/failed writes rather than assuming their UI is committed.
2. Read all workspace stores, settings and Versions in one readonly transaction to capture a coherent base. A backup serializes that state. A preview retains it as temporary operation context; it is not another saved Version.
3. Local updates or broadcasts invalidate an open preview; reload all stores including Versions and require renewed confirmation. Broadcasts are advisory: inside one readwrite transaction, compare current persisted contents with the approved base before any clear/write. If different, abort as stale. A canonical structural comparison using the field-inventory rules avoids introducing a persisted revision entity or schema migration.
4. A synchronous local guard plus visible/inert busy UI prevents competing edits, History actions and repeated confirmation while committing. Coordinate saveVersion/deleteVersion with workspace writes. Undo/Redo stacks change only after successful persistence; detect a remote change against their operation base rather than overwriting it.
5. Save all affected records/settings/Versions in the existing atomic transaction; safely abort after request or quota errors and observe transaction completion rejection. On failure keep old UI/stacks and retry context. On success publish the new UI/stacks, close the preview, clear prior operation errors and notify other tabs. Remote sync reads Versions as well as current records; avoid publishing an older in-flight sync read after a newer local commit.

The atomic base comparison closes the check-versus-write race even if a broadcast arrives late. Local coordination also prevents queued old local saves or History writes from running after replacement. General concurrent editing/merge resolution remains out of scope: a stale operation is rejected for refresh, not automatically merged.

## Serialization and compatibility design

Use existing entity sheets as the source of truth. Format 1 adds a SelaraBackup marker, scoped counts and optional collection-presence metadata; Versions metadata preserves archival decision arrays without creating another current-state copy. Encode nested cells and escape literal marker-prefixed strings exactly as contracted. Compare actual serialized/decoded output before download and reject any loss.

Complete restore validates raw structure before existing tolerant import normalization could discard or synthesize data. Duplicate IDs, unknown snapshot envelopes, bad metadata and unsupported future versions cannot fall through to legacy parsing. Unresolved business references stay unchanged. Existing partial ordinary Import remains a separate path with visible limitations; snapshot display repair never occurs inside Restore Backup.

Generation/initiation failures retain the old timestamp. Timestamp persistence failure after successful invocation reports a started download plus an unremembered time. No reminder policy or durable-storage claim is added.

## Constitution Check

The product owner accepted 1A/2A/3A and all seven remediation proposals; [design notes](../../requirement-specs/workspace-backup-recovery.md) retain reasons and rejected alternatives. Reporting rules and ADR-0011 remain unchanged. Tests must show Red before their implementations, with explicit dependencies in tasks; all required full suites/build/static gates remain. Future implementation documentation includes the originating story/design notes, user guide, README, ADR and database diagram. No automatic commit/push/deployment. Documentation readiness is separate from implementation verification.

## Project Structure

- src/lib/excel.ts, src/lib/workspaceBackup.ts: actual-byte preservation, completeness validation, repair diagnostics and reusable equality.
- src/lib/db.ts: coherent reads, coordinated writes and conditional atomic replacement; safe abort handling.
- src/lib/workspaceState.ts: existing replacement summary/restoration semantics reused.
- src/App.tsx: preview lifecycle, route integration, operation guard, Undo/Redo and remote synchronization.
- src/components/DataControls.tsx: backup/restore controls, awaited import outcomes and timestamp status.
- src/components/HistoryView.tsx, src/components/TemplatePickerModal.tsx, src/components/ConfirmModal.tsx: route effects, awaited callbacks and busy/invalidation behavior.
- src/lib/workspaceBackup.test.ts, src/lib/workspaceState.test.ts: inventory, actual-byte equality, validators and live-log rules.
- e2e/workspace-recovery.spec.ts, e2e/workspace-recovery-routes.spec.ts, e2e/workspace-recovery-concurrency.spec.ts: download/profile, R01–R08 and X01–X08 tests.
- docs/user-stories/28-workspace-recovery.md and supporting documentation listed in tasks.

## Execution boundaries

All planning tasks and document checks are allowed now. Source-code/test work remains unstarted. When authorized, write and observe the named failing tests before implementing the behavior they cover. Deliver all three stories; a backup button alone does not complete M1. Full verification follows targeted Green, and no milestone checkbox is completed from documentary evidence alone.
