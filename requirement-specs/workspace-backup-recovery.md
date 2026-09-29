# Workspace backup and recovery — M1 design notes

**Started:** 2026-09-28
**Status:** Q1–Q3 accepted on 2026-09-28 (1A, 2A, 3A); all seven analysis-remediation proposals accepted on 2026-09-29. Implemented on 2026-09-29; see the implementation-findings amendment, "Implemented" below, [ADR-0015](../docs/adr/0015-workspace-backup-and-conditional-replacement.md) and the [verification log](../specs/005-workspace-recovery/verification.md).
**Scope:** [First-release roadmap](first-release-roadmap.md), R1-04–06 / D4.
**Draft specification:** [005-workspace-recovery](../specs/005-workspace-recovery/spec.md).

## Decided / existing constraints

- The user requested completion of M1. Keep the existing local-first architecture.
- #62 is completed: Open shared confirms replacement of nonempty workspaces and supports Undo, including replaced History. Extend this foundation.
- Backup must preserve current entities, stored report evidence, saved versions, decisions and version links, and supported workspace settings.
- Replacement requires a preview of its effects. Cancellation, invalid input and persistence failure must leave the prior workspace intact; success requires completed persistence.
- Local History is not recovery after browser storage loss. Prove recovery using a downloaded file and a fresh browser profile.
- ADR-0011 remains authoritative: restoring a History snapshot preserves the live decision log. Full workspace recovery and restoring one History snapshot have different purposes.
- Existing ordinary import compatibility preserves current decisions when an older workbook has no Decisions sheet. An explicitly empty sheet means no decisions. Do not silently reverse this rule.
- Filing metadata belongs to M4. Repeat recovery verification when that metadata is added.

## Current implementation findings

- `src/lib/excel.ts` writes current records and version records into shared sheets using a version envelope. Decisions are exported once, keeping `Decision.versionId` as a link.
- `TimelineSettings` contains nested column widths and collapsed-group arrays. They need actual file round-trip coverage before the workbook can be called complete. Resource IDs also need lossless coverage.
- A version whose settings fail sanitisation receives `{}`; this is the existing TypeScript baseline error. Fixing its type requires a defined compatibility policy.
- `App.handleUpdate` mutates UI state before saving and catches persistence errors without propagating failure to its caller.
- `DataControls.handleOverwriteImport` calls `onImport` and immediately reports success. It does not wait for persistence.
- The guide recommends History as a backup against browser-data loss; that statement must be corrected.
- Inventory replacement paths during planning: ordinary overwrite import, Open shared, reset/template/onboarding replacement, explicit backup restore, incoming shared-link startup, and saved-version restore. Hosted sharing stays disabled, but reachable incoming paths need accounting.

## Decisions — 2026-09-28

### Q1 — Format and privacy

**Accepted:** Reuse the unencrypted Excel workbook if a complete round-trip test proves it preserves the supported contract; defer password protection.

**Alternatives:** A dedicated backup format alongside spreadsheet interchange provides a clearer recovery contract but adds another format to maintain. Password protection adds key recovery and usability requirements.

**Decision:** 1A accepted. If workbook limitations prevent complete preservation, bring the evidence back before switching formats.

### Q2 — Older and incomplete files

**Accepted:** Complete supported workbooks qualify for Restore Backup. Incomplete older files use ordinary Import, with explicit limitations. Missing snapshot display settings receive documented defaults and a warning; preserve independently valid reporting years and business settings rather than inheriting unrelated live-workspace values. Define the exact fallback during planning after this policy is settled.

**Alternatives:** Allow incomplete files through Restore Backup after a loss preview, or reject missing snapshot settings instead of repairing them. Rejection is stricter but reduces recovery options. Treating partial data as a complete backup risks misleading users.

**Decision:** 2A accepted. Existing missing-Decisions compatibility remains in force.

### Q3 — Backup reminders

**Accepted:** Manual Backup action plus an accurately labelled last download-start time. It records initiation, not proof of durable file storage.

**Alternatives:** A reminder before replacement, or recurring reminders. These need trigger and dismissal policies and add scope beyond a manual recovery path.

**Decision:** 3A accepted.

## Rejected alternatives

- A separate backup format and password protection are deferred to keep one portable workbook workflow; completeness must be demonstrated.
- Restoring incomplete files as complete backups is rejected because it obscures omissions. Rejecting recoverable snapshot display settings is rejected in favor of visible, documented defaults.
- Replacement and recurring reminders are deferred; manual backup and a truthful initiation timestamp are sufficient for M1.

## Amendment — 2026-09-29: accepted analysis remediation

The product owner accepted proposals 1–7 to resolve findings U1, U2, C1, U3, I1, U4 and I2. The initial decisions above remain recorded; the following details supersede the earlier broad descriptions where necessary.

1. **U1 — Coherent previews and saves.** Drain pending local saves before preparing a replacement preview. A failed save blocks preparation without discarding unsaved work. Local or remote changes invalidate an open preview; refresh its effects and require confirmation again. Guard edits, History changes and duplicate confirmation during saving. Compare the preview's base state against persisted state atomically with replacement so another tab cannot win the gap between checking and writing.
2. **U2 — Complete-file contract.** Enumerate sheets, metadata, settings, row identities and validation in the workbook contract. Allow complete supported and complete recognized legacy files, including empty workspaces. Incomplete files go to ordinary Import; corruption, duplicate IDs within a collection, unknown snapshot envelopes and unsupported future format versions are rejected without mutation. Unresolved business references already present in the source remain intact.
3. **C1 — Route matrix.** Explicitly cover Restore Backup, ordinary overwrite, Open shared, reset/template selection, return onboarding, incoming shared-link startup, History restore and replacement Undo/Redo. Hosted sharing remains disabled; the existing incoming path still needs protection. List route-specific confirmation, cancellation, validation, failure and History/decision semantics.
4. **U3 — Preservation inventory.** Enumerate current and historical fields, nested settings and archival snapshot decision copies. Define equality, meaningful absence and exclusions. Test actual XLSX bytes. Unsupported/unrepresentable values cause a visible export failure before download; never silently truncate or discard. Escalate genuine Excel limitations before changing the chosen format.
5. **I1 — Repairs only in ordinary Import.** Restore Backup does not repair incomplete snapshot settings. It directs the user to ordinary Import, where display-only defaults and a warning apply. Preserve valid reporting years/currency; disclose missing or invalid business settings without inventing values as part of display repair.
6. **U4 — Export versus timestamp failures.** Failed generation/download initiation leaves the old initiation timestamp unchanged. Successful initiation followed by timestamp-storage failure reports those two outcomes separately. Cancellation by the browser/user after initiation is not evidence of durable storage.
7. **I2 — Honest readiness.** Remove stale conditional wording, reopen affected quality checks during revision, and revalidate only after the artifacts agree. Documentary readiness does not mean tests passed or implementation is complete.

**Rejected alternatives and reasons:** A saving-only lock does not protect an already stale preview. Silently merging a changed destination would disregard the replacement the user approved. Sheet names alone cannot establish structural completeness. Dropping malformed rows or treating unknown format versions as legacy conceals loss. Rejecting unresolved business links would make recovery depend on correcting the bank's data. Repairing inside Restore would misrepresent a partial file as a complete backup. A universal JSON snapshot would create a competing source of truth. Treating timestamp persistence failure as download failure misstates what happened.

**Supporting contracts:** [Workbook](../specs/005-workspace-recovery/contracts/workbook.md), [field inventory](../specs/005-workspace-recovery/contracts/field-inventory.md), [replacement routes](../specs/005-workspace-recovery/contracts/replacement-routes.md).

## Amendment — 2026-09-29: implementation findings

Implementation was authorized on 2026-09-29. Two points surfaced before code and are settled here.

1. **Enum and date validation preserves and discloses; it doesn't block.** The workbook contract says to "validate enum values and dates". Real workspaces can hold off-list values that came in through older imports, such as a milestone type `Info`, a hand-typed `categoryCode`, or a `startDate` of `2026/01/01`. **Decided (product owner):** Backup and Restore Backup are strict about *structure*: required fields present, declared JS types (string, number, boolean, string arrays, the nested settings maps), finite numbers, and decodable cells. Off-list enum values and non-ISO dates are backed up and restored exactly as stored and are listed as notices in the backup status and the restore preview. **Rejected:** failing backup generation and rejecting the file on such values. That would mean a planner with one odd value can't back up at all, which inverts the purpose of a recovery path, and it would turn a data-quality finding into a backup gate, contrary to "no acceptance decision … requires all Data Health warnings to be resolved".
2. **More strings need the escaped cell form than the prefix case.** A round trip of actual XLSX bytes through SheetJS 0.20.3 showed silent loss beyond marker-prefixed text. `\r\n` comes back as `\n`. Literal `_xHHHH_` sequences are decoded as Excel escapes, so `_x0041_` comes back as `A`. `U+FFFE`/`U+FFFF` and lone surrogates become replacement characters. Objects, arrays and `null` are dropped entirely, and cells longer than 32,767 characters can't be written. Format 1 therefore uses the escaped form (`__SELARA_JSON_V1__:` plus a JSON string) for *any* string that wouldn't survive raw, not only for marker-prefixed text. The escaped JSON text itself avoids `_x` sequences and non-XML characters. The decoder is unchanged: one prefix, one `JSON.parse`. Values that still can't fit a cell fail generation with the record and field named, as the contract already requires. The pre-download equality check remains the backstop for any case missed here.

## Implemented — 2026-09-29

What shipped matches the contracts. Where implementation had to choose, it chose as follows.

- **Backup refuses what it can't restore.** Generation runs the same structural checks as Restore. A saved version with incomplete timeline settings therefore fails backup with the version named. Such versions exist only where an older ordinary Import wrote `{}`, which Import now repairs instead. The alternative, a backup that Restore would then refuse, was rejected: it would look like a backup and not be one.
- **Unknown fields on records are preserved and disclosed**, e.g. a column added to an imported spreadsheet. They round-trip exactly. Unknown *collections* inside a saved version have no sheet to go to, so they fail backup with the version named rather than being dropped.
- **An older export that doesn't match current record shapes goes to Import, not rejection.** Examples are a missing required field, or a value of an older type. Import already normalises those shapes. Rejection stays for corruption: unreadable cells, duplicate IDs, orphaned snapshot rows, and counts that disagree with the file's own metadata.
- **Current settings in a backup are the stored ones when complete.** If the stored settings are an older, incomplete shape, the backup uses them as the screen presents them, with defaults filled in, since that is the only form Restore accepts.
- **Recovery starts where a fresh profile opens.** The template picker offers "Restore a backup". When the browser still holds History or decisions but no current records, it also offers "Download backup". That state opens on the picker too, and the picker covers the header's Backup button.
- **Backup lives in the header next to search, in every view.** Placing it among the export buttons made the toolbar wrap to a third row at 1280px wide, pushing timeline content under the legend.
- **Escape cancels a replacement preview.** This is opt-in on `ConfirmModal`, because other callers sit inside panels with their own Escape handling.
- **Undo and Redo don't wait on a failed ordinary save.** Unlike a preview, they compare against what this tab last stored. Undoing a change whose save failed therefore restores the stored state and clears the failure, rather than being blocked by it.

**Accepted limitation, to revisit if real workspaces hit it:** an Excel cell holds at most 32,767 characters. A value that long fails backup with the record and field named. The most plausible case is one saved version's archived decision copy, written as a single encoded cell. Splitting values across cells would lift the limit, but is not built.

## Open questions

None from the accepted proposals. A newly discovered domain ambiguity or an Excel limitation that prevents preservation must be raised before dependent implementation; this is not permission to silently narrow the contract.

## Required verification

- Round-trip all supported current and historical fields through actual downloaded-file serialization, including nested settings, optional values and decision links.
- Restore into a fresh profile after deleting the disposable source profile.
- Verify every replacement entry point: preview, cancel, invalid input, successful persistence and failed persistence.
- Inject storage/quota failure; no success message or partial replacement, including after reload.
- Exercise documented old-workbook compatibility and distinguish missing sections from explicitly empty sections.
- Run full Vitest and Playwright suites, production build and static checks; clear the existing typecheck baseline once fixed.
