# Workbook and replacement contract

**Updated:** 2026-09-29. Implements accepted proposals 2, 4, 5 and 6 (U2/U3/I1/U4). This is a planned contract, not shipped behavior.

## Contents and supported formats

Backup is an unencrypted `.xlsx` workbook. Existing entity sheets remain authoritative; no hidden duplicate workspace snapshot is introduced. Supported records/fields, optional collection presence, archival decision copies and comparison rules are in the [field inventory](field-inventory.md).

The following 16 data sheets are required for complete restoration, including when a collection is empty:

| Sheet | Contents / version treatment |
|---|---|
| Initiatives | Current and historical Initiative records |
| Assets | Current and historical Asset records |
| AssetCategories | Current and historical AssetCategory records |
| Programmes | Current and historical Programme records |
| Strategies | Current and historical Strategy records |
| Milestones | Current and historical Milestone records |
| Dependencies | Current and historical Dependency records |
| Deliverables | Current and historical Deliverable records |
| DeliverableSegments | Current and historical DeliverableSegment records |
| DeliverableStatuses | Current and historical DeliverableStatus records |
| Resources | Current and historical Resource records |
| RptiDetails | Current and historical stored RPTI evidence, without regeneration |
| LkptiDetails | Current and historical stored LKPTI evidence, without regeneration |
| TimelineSettings | Exactly one current row and one row per saved Version |
| Versions | Unique version IDs, names, timestamps, optional description and archival/presence metadata |
| Decisions | The live decision log; versionId remains its link to a Version |

New workbooks additionally carry `SelaraBackup` with `formatVersion: 1` and `cellEncoding: selara-json-v1`. Absence of this sheet selects only the recognized legacy layout described below; an existing unknown or malformed marker must never fall back to legacy parsing. New metadata records expected row counts per sheet and per version/current scope, plus presence of optional snapshot collections. Validate these counts against decoded contents. This detects structural omissions; it is not a tamper-proof signature or a promise to detect every external spreadsheet edit.

In versioned sheets, empty envelope `versionId` means current data; a nonempty envelope must identify a Versions row. `Decisions.versionId` is a business link, not this envelope. Archival `Version.data.decisions`, when present, uses a distinct Versions metadata field encoded as a nested value, preserving its own links. Optional snapshot collections keep absent versus explicitly empty using presence metadata. These fields do not create new Versions or a second source for current records.

## Cell preservation

For format 1, nested objects/arrays use the `__SELARA_JSON_V1__:` prefix plus JSON. Literal strings beginning with that prefix are escaped using the same prefix followed by their JSON string representation; decoding happens once and only for format 1. Preserve empty strings and nonempty text exactly. Reject malformed encoded cells and wrong decoded field types. Legacy text is never interpreted as marked JSON merely because it happens to start with this prefix.

Resource ID arrays in format 1 use this encoding, avoiding comma splitting. Recognized legacy resource IDs use the existing comma-separated representation with a disclosed limitation: distinctions already lost in an older export cannot be recovered. Supported legacy nested settings must already be represented in the recognized field-specific JSON form or be absent optional fields; malformed representations require ordinary Import diagnostics rather than silent omission.

Validate all populated required fields and optional fields against the supported field types; validate finite numbers, enum values and dates without introducing a new regulatory-readiness gate. Before download, check that the actual serialized and decoded output equals the export input under the inventory's comparison rules. If an Excel cell/worksheet limit or unsupported value would prevent preservation, fail generation with the affected field/record identified. Do not truncate, drop fields, or silently switch format. Raise an actual format limitation before changing the accepted 1A policy.

## Acceptance and rejection matrix

| Case | Restore Backup outcome | Ordinary Import / explanation |
|---|---|---|
| Supported format 1, required sheets and valid content | Preview and allow | Interchange remains available |
| Complete empty workspace with settings and empty collection sheets | Preview and allow | Zero rows is not corruption |
| No marker, recognized legacy layout, all 16 sheets, usable current/snapshot settings, valid row shapes | Preview and allow with legacy-limitations notice | Recover what the file carries; do not claim reconstruction of values lost before this import |
| Missing required collection sheet, missing current/snapshot settings, or display settings requiring repair | No mutation; list omissions and direct to ordinary Import | Preview partial contents and applicable repairs; never label this a complete backup |
| Optional field/optional snapshot collection absent as allowed by inventory | Allow; preserve absence | Not a missing required section |
| Malformed file/cell, invalid row shape/type, duplicate IDs within a scope, duplicate settings rows, inconsistent counts/presence metadata | Reject without mutation | Do not recommend bypassing corruption via Import or silently skip rows |
| Versioned row or metadata references a nonexistent snapshot envelope | Reject without mutation | A structural association differs from an unresolved business link |
| Existing business link points to a missing entity/Version, including Decision.versionId | Preserve and allow if otherwise structurally valid | Existing Data Health findings stay available; do not remap or delete references |
| Unsupported future formatVersion/cellEncoding | Reject; explain that a compatible Selara version is needed | Do not decode as legacy or force import |
| Formatted RPTI/LKPTI report instead of workspace workbook | Reject as a backup; name the appropriate report-import workflow | Do not imply ordinary workspace Import can parse a regulatory return |

IDs must be nonempty strings and unique within each collection and scope (current or a particular Version). The same entity ID in current state and a saved snapshot is expected. Versions IDs are unique globally within the workbook. Multiple historical settings rows, rows with unknown envelopes, and counts that disagree with metadata are structural errors. For new files, an absent optional snapshot collection must have no corresponding rows; a present empty collection has count zero. Legacy files have no presence/count metadata, so only the content present can be verified; disclose that absent and empty historical collections may be indistinguishable there.

No acceptance decision reclassifies a bank record, rewrites report evidence, invents missing business dates, or requires all Data Health warnings to be resolved. Unsupported present fields that cannot be faithfully decoded must be identified rather than silently discarded.

## Legacy repairs: ordinary Import only

Restore Backup never repairs settings. A legacy file needing repairs goes to ordinary Import, which previews every repair and limitation before confirmation. For missing/invalid historical display fields, preserve valid individual values and supply only these required display defaults:

| Field | Fallback |
|---|---|
| startDate | 2000-01-01 (viewport only, not an implementation/go-live date) |
| monthsToShow | 12 |
| budgetVisualisation | label |
| descriptionDisplay | off |
| emptyRowDisplay | show |
| snapToPeriod | month |
| conflictDetection | off |
| showRelationships | off |

Absent optional display fields remain absent; invalid optional display fields are disclosed and omitted rather than copied into live state. Validate dates as real calendar dates and values against the field's allowed type. For historical `onboardingLkptiYear`, `onboardingRptiYear`, `defaultCurrency`, and other business-bearing settings, preserve valid values. Missing/invalid values are disclosed and left unset by this repair; do not borrow them from the destination or derive them from the display fallback. Existing report selection continues to require the user's visible choice. Any pre-existing ordinary Import behavior that keeps destination current settings when the file has none must be explicitly shown in the preview; it does not fill missing settings inside historical snapshots.

An absent Decisions sheet in ordinary Import → Overwrite preserves the current live log. An explicitly empty sheet clears it. Open shared is a new-workspace operation and keeps its existing reset behavior for an absent Decisions sheet, visibly explained in its preview. History restoration preserves the live log regardless of archival snapshot decision contents.

## Backup and timestamp outcome matrix

Backup captures one coherent saved workspace including Versions after pending local saves finish. A failed pending save blocks backup and retains visible unsaved work; do not export stale saved records while implying they include unsaved edits. Timestamp storage is local operational metadata, outside portable workspace/Versions.

| Event | Download / message | Persisted initiation timestamp |
|---|---|---|
| Pending-save or generation/serialization failure | No download; actionable failure | Unchanged |
| Browser download invocation throws/fails before initiation returns | No success claim; initiation error | Unchanged |
| Download invocation completes | “Download started”; user must verify the file was saved | Set to this initiation time |
| Invocation completes but local timestamp write fails | “Download started, but its time could not be remembered” | Previous stored value retained where available; UI does not claim new time was persisted |
| User cancels or browser blocks storage after initiation | Durability cannot be established | Initiation timestamp still describes an attempt |
| Reload with timestamp missing/unreadable | Show no known prior time; backup remains usable if otherwise possible | Do not invent a time or report successful backup |

No recurring or pre-replacement reminders. The static explanation of replacement and local-storage limitations remains. Timestamp storage failure must not roll back or repeat the download.
