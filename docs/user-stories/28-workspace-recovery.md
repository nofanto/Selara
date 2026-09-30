# User Story 28 — Workspace backup and recovery

As an individual IT planner, I want a complete portable backup and safe replacement so I can recover after browser data loss without losing History or decision links.

**Status:** Implemented 2026-09-29. See the [verification log](../../specs/005-workspace-recovery/verification.md) and [ADR-0015](../adr/0015-workspace-backup-and-conditional-replacement.md).

## Acceptance criteria

- Manual Backup downloads an unencrypted Excel workbook containing all supported current records, report evidence, versions, settings and decisions; nested values survive actual file serialization.
- Last download started records initiation and persists across reload; it never claims durable storage.
- Restore Backup previews current versus incoming contents and settings, and replaces only after confirmation and successful persistence.
- Cancel, malformed/incomplete backup and failed persistence leave current UI and stored workspace intact. Empty complete backups are supported.
- Incomplete older workbooks are directed to ordinary Import; missing historical display settings get documented defaults and warnings. An absent Decisions sheet preserves the live log in ordinary Import.
- Template/reset/onboarding, Open shared, ordinary overwrite and History restore share safe failure handling. Existing Undo of replacement includes History.
- The **Clear data and start again** picker can be closed before any choice, returning to the unchanged workspace with nothing written, including after a reload. First-launch onboarding stays mandatory, with no Close. *(Added 2026-09-30.)*
- When Selara updates its storage while another Selara tab is open, it never waits without saying why. An older tab holding the database gets a "close or reload your other Selara tabs" message on the loading screen, and loading resumes once it lets go. A tab superseded by a newer version asks to be reloaded, and any later save fails visibly instead of being lost silently. *(Added 2026-09-30.)*
- Recovery succeeds in a fresh profile after source-profile removal, comparing every field in the preservation inventory through the downloaded XLSX file.
- Pending saves finish before backup/preview; a save failure blocks preparation without discarding unsaved UI. Local or remote changes invalidate a preview and require renewed confirmation. The final save refuses a changed destination atomically.
- Edits, History mutations and repeated confirmation cannot race a replacement. Failed Undo/Redo leaves its recovery entries available; other tabs refresh History alongside current records.
- Complete/partial/corrupt/future input follows the workbook matrix. Structurally invalid data is rejected, while existing unresolved business links survive.
- Restore Backup does not repair snapshot settings; ordinary Import warns about display repairs and missing/invalid business settings without inventing reporting values.
- Generation or initiation failure preserves the previous initiation timestamp. If download starts but timestamp persistence fails, the message distinguishes those outcomes. A missing/unreadable stored timestamp does not invent a successful backup.
- The route matrix covers incoming shared-link startup while outbound sharing stays disabled; existing route-specific decision/History semantics are preserved.

See [design notes](../../requirement-specs/workspace-backup-recovery.md) and [specification](../../specs/005-workspace-recovery/spec.md).

## Where each criterion is verified

- Preservation through actual XLSX bytes, the field inventory, the workbook matrix, legacy handling and Import-only repairs: `src/lib/workspaceBackup.test.ts`, plus the live-log case in `src/lib/workspaceState.test.ts`.
- Backup, download-start status and timestamp, and fresh-profile recovery after deleting the source profile (a field-complete workspace, History-only, decisions-only and empty): `e2e/workspace-recovery.spec.ts`.
- Routes R01–R08 (preview, cancel, invalid input, failed save, retry, reload, History/decision effects, disabled outbound Share, failed Merge): `e2e/workspace-recovery-routes.spec.ts`.
- Concurrency X01–X08 (the X02 and X07 cases sit in the files above): `e2e/workspace-recovery-concurrency.spec.ts`.
- Actual outcomes, including flaky runs: [verification log](../../specs/005-workspace-recovery/verification.md).

Authoritative acceptance detail: [fields](../../specs/005-workspace-recovery/contracts/field-inventory.md), [workbook](../../specs/005-workspace-recovery/contracts/workbook.md), [routes](../../specs/005-workspace-recovery/contracts/replacement-routes.md).
