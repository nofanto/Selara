# Research

## Excel preservation

Decision: Keep current entity sheets; encode nested arrays/objects in marked JSON cells and add a workbook format/completeness marker. Preserve old comma-separated resource IDs on legacy input. Test real XLSX bytes, not only in-memory sheets. Never use a duplicate hidden workspace snapshot as the authoritative backup.
Rationale: Existing sheets already carry current and versioned rows and decision links. Nested settings currently are not reliably represented as cells.
Alternatives: Separate JSON package rejected/deferred by 1A; hidden duplicate snapshots risk conflicting editable sources.

## Compatibility

Decision: New complete workbooks can restore, including empty ones. Legacy files require all supported sheets and usable settings to qualify; incomplete files go to Import. Missing historical display settings use fixed 2000-01-01/12-month display defaults with a warning, retaining valid independent settings. No business dates or reporting year are fabricated.
Rationale: Deterministic display fallback avoids borrowing unrelated destination-workspace state. Report-year defaults remain separately visible under existing behavior.

## Persistence

Decision: Keep the existing IndexedDB transaction. Replacement waits for saving before UI, Undo stack and success changes. A busy guard prevents another operation while replacement persists. Ordinary optimistic edit behavior is retained. Imports await a boolean result. Abort safely and consume transaction completion errors.
Rationale: Research found optimistic UI plus swallowed save errors, not a missing multi-store transaction. Blindly making all edits await persistence risks lost rapid edits from stale full-state callbacks.

## Scope

Decision: Last download-start time is local operational metadata, separate from historical workspace data. Preserve the live decision log on History restore; preserve deprecated snapshot decision copies in backup for faithful recovery, although restore still ignores those copies.
Alternatives: Recurrent reminders and encryption deferred by 3A/1A. No hosted sharing activation.

## Amendment — 2026-09-29: accepted analysis refinements

The initial rationale above is retained. These details supersede any earlier ambiguity; see the authoritative [workbook](contracts/workbook.md), [field inventory](contracts/field-inventory.md) and [routes](contracts/replacement-routes.md).

- **Decision:** Drain pending local workspace/History saves before coherent backup or preview; keep visible unsaved state on failure. Invalidate previews on local/remote change, compare the persisted base inside the replacement transaction, and coordinate History writers and remote readers. **Reason:** A save-only lock cannot close the open-preview or check/write race. **Rejected:** relying on broadcasts alone, silently merging a changed destination, or making all ordinary optimistic edits save-first without addressing stale queued callbacks.
- **Decision:** Classify complete, partial, corrupt and future-format inputs separately. Require the enumerated sheets, typed rows, scoped identities, settings and metadata consistency. Preserve unresolved business references. **Reason:** Sheets existing does not prove all rows are accounted for, and business discrepancies must not prevent recovery. **Rejected:** discarding malformed rows or interpreting unknown markers as legacy.
- **Decision:** Complete-file Restore never repairs settings; ordinary Import alone applies warned display defaults and exposes missing/invalid business settings. **Reason:** A repaired partial source must not masquerade as a complete backup. **Rejected:** inheriting destination reporting values or using the fallback viewport date as business evidence.
- **Decision:** Test every inventoried field with actual bytes, preserve archival decision copies separately, and reject serialization loss before download. **Reason:** One representative fixture is insufficient to establish complete field coverage. **Rejected:** silently truncating unsupported values or introducing a duplicate authoritative JSON workspace snapshot.
- **Decision:** Distinguish generation/initiation failure from timestamp-storage failure, and show no invented prior time if timestamp reading fails. **Reason:** Bookkeeping failure does not establish that download failed. **Rejected:** durable-storage claims and changing the previous initiation timestamp after failed generation.

No new business entity or database schema bump is planned: a temporary coherent base compared inside the existing transaction provides conflict detection. Planning verification does not assert these mechanisms already exist.
