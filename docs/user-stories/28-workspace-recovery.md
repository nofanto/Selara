# User Story 28 — Workspace backup and recovery

As an individual IT planner, I want a complete portable backup and safe replacement so I can recover after browser data loss without losing History or decision links.

**Status:** Requirements refined on 2026-09-29; documentation only, not implemented.

## Acceptance criteria

- Manual Backup downloads an unencrypted Excel workbook containing all supported current records, report evidence, versions, settings and decisions; nested values survive actual file serialization.
- Last download started records initiation and persists across reload; it never claims durable storage.
- Restore Backup previews current versus incoming contents and settings, and replaces only after confirmation and successful persistence.
- Cancel, malformed/incomplete backup and failed persistence leave current UI and stored workspace intact. Empty complete backups are supported.
- Incomplete older workbooks are directed to ordinary Import; missing historical display settings get documented defaults and warnings. An absent Decisions sheet preserves the live log in ordinary Import.
- Template/reset/onboarding, Open shared, ordinary overwrite and History restore share safe failure handling. Existing Undo of replacement includes History.
- Recovery succeeds in a fresh profile after source-profile removal, comparing every field in the preservation inventory through the downloaded XLSX file.
- Pending saves finish before backup/preview; a save failure blocks preparation without discarding unsaved UI. Local or remote changes invalidate a preview and require renewed confirmation. The final save refuses a changed destination atomically.
- Edits, History mutations and repeated confirmation cannot race a replacement. Failed Undo/Redo leaves its recovery entries available; other tabs refresh History alongside current records.
- Complete/partial/corrupt/future input follows the workbook matrix. Structurally invalid data is rejected, while existing unresolved business links survive.
- Restore Backup does not repair snapshot settings; ordinary Import warns about display repairs and missing/invalid business settings without inventing reporting values.
- Generation or initiation failure preserves the previous initiation timestamp. If download starts but timestamp persistence fails, the message distinguishes those outcomes. A missing/unreadable stored timestamp does not invent a successful backup.
- The route matrix covers incoming shared-link startup while outbound sharing stays disabled; existing route-specific decision/History semantics are preserved.

See [design notes](../../requirement-specs/workspace-backup-recovery.md) and [specification](../../specs/005-workspace-recovery/spec.md). Verification evidence will be recorded when complete.

Authoritative acceptance detail: [fields](../../specs/005-workspace-recovery/contracts/field-inventory.md), [workbook](../../specs/005-workspace-recovery/contracts/workbook.md), [routes](../../specs/005-workspace-recovery/contracts/replacement-routes.md).
