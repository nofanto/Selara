# Data model

**Updated:** 2026-09-29. Implemented as described, with no schema change (IndexedDB remains v19); see [ADR-0015](../../docs/adr/0015-workspace-backup-and-conditional-replacement.md) and the [verification log](verification.md).

## Portable records

Existing AppState, Version and Decision records remain. The [field inventory](contracts/field-inventory.md) enumerates every included field, nested value, optional collection and exclusion. Archival Version.data.decisions survives backup; History restore still preserves the live decision log. Business references may be unresolved and are preserved.

## Workbook metadata

[The workbook contract](contracts/workbook.md) defines the existing 16 data sheets plus format 1 SelaraBackup metadata (formatVersion, cellEncoding, counts per sheet/scope and optional snapshot collection presence). Versions metadata stores archival decision copies separately from the live Decisions sheet. These are file serialization metadata, not new IndexedDB entities or another workspace snapshot system.

Restore validates required sheets/settings, scoped unique IDs, version envelopes, counts, types and encoding before mutation. Legacy files are accepted only under the named legacy layout rules; missing snapshot settings require ordinary Import, which reports display repairs and missing business settings separately. Unknown future formats are rejected.

## Local operation state

- Last backup download-start time: localStorage ISO timestamp, excluded from portable workspace/Versions; failure to persist it is independent of download initiation.
- Pending writes/failures: local operation tracking used to drain saves before backup/preview and prevent exporting stale persisted state as current work.
- Preview base: coherent persisted current records, settings, decisions and Versions used for equality comparison at confirmation/commit. Temporary, not a saved Version.
- Replacement status: preparing → preview → saving → committed; preparing failure retains unsaved work, preview cancellation leaves current data alone, changed base returns to stale/refresh, and save failure retains the prior workspace and stacks.
- Busy guard: prevents competing local edits/History actions/repeated confirmation while saving. Undo/Redo are direct actions with conditional persistence and post-success stack updates.

A coherent readonly transaction captures state. A conditional readwrite transaction compares the expected persisted base before mutation; no new revision field or database version is required. Remote sync includes Versions. Details and exceptions live in the [route matrix](contracts/replacement-routes.md).
