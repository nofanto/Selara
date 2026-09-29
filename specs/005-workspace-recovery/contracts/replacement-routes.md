# Replacement routes and acceptance matrix

**Updated:** 2026-09-29. Implements U1/C1, FR-004–006/009–010/014–017 and SC-002/005–006. All cases describe required future behavior.

## Shared contract

Before preparing a preview, drain pending local writes, including History mutations. On any failed save, retain unsaved UI and the existing database, report the problem and block preparation. The guarantee does not retroactively make already-unsaved edits durable; no replacement may conceal that mismatch.

Read current records, settings, decisions and Versions coherently and retain that persisted base with the preview. Local/remote changes to any of them invalidate confirmation. Show refreshed current/incoming effects and require a new confirmation; never silently merge or overwrite changes against the old preview. Validate the base again inside the transaction that would replace it, before destructive writes. A broadcast is a prompt to refresh, not sufficient protection against a race.

While committing, prevent competing local edits, History create/delete, Undo/Redo and repeated confirmation. On conflict/failure, leave the previous workspace, stacks and preview available, with an actionable error (a conflicted preview must be refreshed before retry). On success, publish state and stack changes, close the operation and notify other tabs; synchronization includes Versions. A remote write that commits first causes a conflict; writes that happen after the replacement form later operations. Every workspace/History writer must participate in the same local coordination and appropriate transaction scopes so old queued local writes cannot restore stale content.

Previews show counts by current/incoming entity kind, retained/replaced/deleted History and decisions, settings replacement or retention, and compatibility warnings. Zero record counts do not hide settings changes. Empty-destination behavior follows the matrix. Escape/cancel before saving is equivalent to cancel; cancellation during an in-flight commit is unavailable rather than falsely reported as an abort.

## Route matrix

| ID / route | Preview and confirmation | History and decisions on success | Required verification |
|---|---|---|---|
| R01 Restore Backup | Always show validated full contents and settings before confirmation, even on an empty destination | Replace Versions and live decisions with the backup; preserve archival copies | Complete/empty restore, cancel, invalid/incomplete/future input, quota failure, retry, reload and fresh-profile equality |
| R02 Ordinary Import → Overwrite | Existing Import Preview gains current/incoming effects and explicit retention rules | Replace Versions as ordinary import specifies; missing Decisions preserves live log, explicit empty clears it | Missing-vs-empty Decisions, warned repairs, cancel, malformed rows, failed save without success notification, Undo/reload |
| R03 Open shared workbook | Preserve #62: confirmation when replaceable content exists; empty workspace may apply directly; settings effects explicit when confirming | Incoming Versions; incoming decisions or empty live log if absent (new workspace) | Populated/History-only/decisions-only destination, empty bypass, cancel, invalid file, failure/retry/reload, Undo including History |
| R04 Reset/template selection | Show selected template's incoming contents and all losses before confirmation when replacing existing content; selecting a template is not confirmation itself | Clear old Versions and decisions as a new workspace | Blank/demo choices, cancel, template-state validation, failed save, successful reload; fresh empty first-use selection remains direct |
| R05 Onboarding from returns | Parse/derive first; show incoming records, skipped/unresolved summary and replacement effects before replacing existing content | New workspace clears old Versions/decisions | Parse/derivation refusal, cancel, quota failure, retry, reload; preserve accepted unresolved-row rules; fresh empty first use uses existing import confirmation |
| R06 Incoming shared-link startup | Validate/decrypt before a replacement preview; show counts/settings and require confirmation | Preserve existing incoming semantics: replace Versions when supplied, otherwise retain current Versions; reset decisions to validated incoming log. Explicitly show retained History | Mock incoming payload locally: cancel, invalid/decryption failure, save failure/retry/reload, with/without Versions. Keep outbound sharing disabled; no live backend needed |
| R07 History snapshot restore | Existing confirmation gains effects on current records/settings and explicitly says History/live decisions are retained | Retain saved Versions and live decision log; ignore archival snapshot decisions for restoration | Cancel, malformed snapshot, warned legacy settings where already imported, failure/retry/reload, live-log invariance |
| R08 Undo/Redo of replacement | Direct existing action; no new confirmation modal. Disable during saving; validate operation base to avoid overwriting remote changes | Restore the captured state including Versions when captured; retain existing decisions semantics of that stack entry | Failed Undo and failed Redo leave both stacks unchanged, successful retry/reload, empty stacks, duplicate/remote conflict cases |

For R03/R04/R05 direct empty-workspace cases, cancellation means aborting selection before commit, not a new confirmation dialog. R08 has no cancel state; it must retain stacks on rejection/failure. Validate internal template/snapshot/stack payloads before mutation; a file-upload corruption case is not applicable to an internal-only route. These are explicit applicability distinctions for SC-002.

Ordinary Merge is not wholesale replacement, but it shares import result handling: await persistence before success, preserve existing merge semantics, and guard it against a replacement in progress. Existing regression coverage plus a failed-merge check verifies FR-014. R06 protection must not enable Share, deploy infrastructure, or change snapshot-retention policy incidentally.

## Concurrency cases

| ID | Trigger | Expected evidence |
|---|---|---|
| X01 | Local save pending when preview/backup requested | Wait for success; capture coherent data including Versions |
| X02 | Pending save fails | No preview/download/replacement; unsaved UI retained and explicit save problem |
| X03 | Local edit while preview open | Stale confirmation disabled; refreshed effects and reconfirmation required |
| X04 | Other tab changes records/settings/decisions/Versions while preview open | Same invalidation; History refreshes too |
| X05 | Other tab commits after preview check but before replacement write | Atomic comparison refuses stale replacement; remote state survives |
| X06 | Double confirmation or edit/History mutation/Undo during save | At most one replacement; competing local operation cannot race it |
| X07 | Transaction fails after some writes were queued | Abort leaves all affected stores unchanged; no success or stack mutation; retry works |
| X08 | Another tab reads after successful replacement | Coherent current data and History; its next backup cannot use stale Versions |

All tests compare current records, settings, live decisions and Versions before/after, plus reload where applicable. Business-link validity is not an acceptance gate: unresolved links survive as stored facts.
