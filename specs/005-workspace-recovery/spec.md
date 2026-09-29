# Feature Specification: Workspace Backup and Recovery

**Feature Branch**: Not created; specification drafted on `main`.
**Created**: 2026-09-28
**Status**: Requirements refined on 2026-09-29 following acceptance of all seven analysis proposals. Q1–Q3 remain 1A/2A/3A. Documentation phase only; implementation has not started.
**Input**: User description: "lets finish M1, do you think we'll need speckit?"

## User Scenarios & Testing

### User Story 1 — Recover without the original browser (Priority: P1)

As an individual bank IT planner, I can download a clearly named workspace backup and restore it in another browser profile, so losing browser storage does not lose my saved work.

**Why this priority**: Recovery is the foundation of safe individual use.
**Independent Test**: Back up a representative workspace, remove its disposable source profile, restore in a fresh profile, and compare every field in the [preservation inventory](contracts/field-inventory.md), including history and settings.

**Acceptance Scenarios**:

1. **Given** current planning records, stored RPTI/LKPTI evidence, multiple saved versions and decisions linked to those versions, **when** I back up and restore, **then** all supported values and links survive.
2. **Given** a backup download starts, **when** I see its status, **then** it describes initiation without claiming that the file was safely stored.
3. **Given** an empty workspace or a workspace containing only History or decisions, **when** I back up and restore it, **then** its contents are faithfully recovered.
4. **Given** a value cannot be represented without loss in the workbook, **when** I request Backup, **then** I receive an actionable error before download and the prior initiation timestamp remains unchanged.
5. **Given** a download starts but its timestamp cannot be stored, **when** status is shown, **then** it says the download started and the timestamp could not be remembered, without claiming file-storage success or download failure.

### User Story 2 — Replace work deliberately (Priority: P1)

As a planner, I can inspect what replacement will change and cancel before it happens, so choosing the wrong file does not destroy work.

**Why this priority**: Several entry points replace the same workspace and must offer consistent protection.
**Independent Test**: Exercise every route in the [replacement matrix](contracts/replacement-routes.md) with populated current state, History and decisions; apply its route-specific confirmation and cancellation rules.

**Acceptance Scenarios**:

1. **Given** existing work, **when** I request a preview-based replacement, **then** I see current and incoming content counts and the effect on History and decisions before confirming.
2. **Given** a replacement preview, **when** I cancel, **then** current records, settings, History and decisions are unchanged, including after reload.
3. **Given** confirmed valid input, **when** saving completes, **then** the displayed and persisted workspace agree and success is reported only then.
4. **Given** Open shared already supports Undo, **when** its replacement completes, **then** Undo continues to restore the replaced workspace and History.
5. **Given** pending local saves, **when** I request a replacement preview, **then** preparation waits for them; failure keeps the existing work visible and blocks replacement.
6. **Given** an open preview, **when** a local edit or another browser tab changes current records, settings, decisions or History, **then** the old confirmation becomes invalid and refreshed effects must be confirmed.
7. **Given** replacement is saving, **when** an edit, History mutation or repeated confirmation is attempted, **then** it cannot race or duplicate the replacement. A change from another tab before the atomic commit makes the preview stale instead of being overwritten.

### User Story 3 — Recover from failed operations (Priority: P1)

As a planner, I receive a truthful failure message and keep my previous workspace when a restore cannot complete.

**Why this priority**: A replacement that only partly succeeds defeats the backup safeguard.
**Independent Test**: Supply corrupt input and simulate unavailable or full storage at replacement time; compare state before, after failure and after reload.

**Acceptance Scenarios**:

1. **Given** malformed input, **when** I attempt restoration, **then** the operation explains the problem without mutating current work.
2. **Given** valid input and a failed save, **when** replacement is attempted, **then** there is no success message and the previous workspace remains available in the interface and after reload.
3. **Given** an incomplete older file, **when** I choose Restore Backup, **then** I am directed to ordinary Import with the missing sections/settings explained; Restore Backup performs no repair.
4. **Given** missing snapshot display settings, **when** ordinary Import repairs them, **then** documented display defaults and a warning are provided while valid reporting settings survive; missing or invalid business settings are disclosed without being invented.
5. **Given** a previous backup initiation, **when** I reload, **then** its timestamp remains labelled as download initiation, not proof of storage.
6. **Given** a file has duplicate IDs within one collection, rows assigned to a nonexistent snapshot, or an unsupported future format version, **when** I attempt restore, **then** the file is rejected without mutation or silently dropped rows.
7. **Given** an unresolved business reference exists in the backed-up source, **when** I restore a structurally valid file, **then** the reference survives unchanged.
8. **Given** replacement or its Undo/Redo fails, **when** I retry, **then** the prior workspace and recovery stacks are still available; success is never announced for the failed attempt.

### Edge Cases

- Empty current state, History-only state, and decisions-only state.
- Explicitly empty sheets versus absent sheets in older files.
- Missing or invalid settings on a historical snapshot, including valid reporting years alongside invalid display fields.
- Nested settings, resource ID arrays, multiline text, zero and false values, and absent optional values.
- A missing decision target already present in the source must not be silently repaired or discarded by backup.
- Corrupt files, unsupported layouts, duplicate identifiers, malformed snapshot contents, and storage failure.
- Edits or a second replacement while a replacement save is pending; pending previews must not silently overwrite newer changes.
- Browser download cancellation cannot be reliably treated as successful durable storage.

## Requirements

### Functional Requirements

- **FR-001**: Provide clearly named Backup and Restore Backup actions and distinguish them from formatted report and timeline exports.
- **FR-002**: Preserve every field in the [field inventory](contracts/field-inventory.md), for current and historical records, stored report evidence, decisions and links, and workspace settings. Apply its equality and exclusion rules, including archival snapshot decision copies.
- **FR-003**: Reuse the unencrypted Excel workbook, with complete supported-field preservation demonstrated before delivery. Password protection is deferred.
- **FR-004**: Follow the [replacement matrix](contracts/replacement-routes.md): show current/incoming contents, settings effects, History and decision behavior before confirmation for preview-based routes. Undo/Redo retain their direct-action behavior and receive the same persistence protection.
- **FR-005**: Cancellation, invalid input and failed persistence must preserve the prior displayed and persisted workspace.
- **FR-006**: Report replacement success only after all affected state is durably saved; prevent partial application and misleading success messages.
- **FR-007**: Support recovery into a fresh browser profile independently of the source profile and local History.
- **FR-008**: Apply the [workbook acceptance matrix](contracts/workbook.md). Restore complete supported and recognized complete legacy workbooks without repair. Direct incomplete files to ordinary Import; only that route repairs snapshot display settings using documented defaults and warnings. Preserve valid business settings and disclose absent/invalid ones without inventing them.
- **FR-009**: Preserve the existing ordinary-import distinction between an absent Decisions sheet and an explicitly empty sheet, as recorded in the existing decision.
- **FR-010**: Preserve existing snapshot-restoration semantics for the live decision log; distinguish that operation from full workspace restoration.
- **FR-011**: Provide manual backup and a persisted, accurately labelled last download-start time. Do not add replacement or recurring reminders.
- **FR-012**: Explain that local History is lost with browser storage and that an initiated download does not prove the file was saved.
- **FR-013**: Document backup contents, omissions, compatibility and recovery steps. Do not claim that report exports or timeline images are full backups.
- **FR-014**: Keep ordinary spreadsheet interchange available and hosted sharing disabled. Protect the already reachable incoming shared-link route without enabling link creation or deploying a backend.
- **FR-015**: Complete pending saves before preparing a replacement preview. On failure block replacement and retain visible unsaved work. Invalidate previews after local or remote changes; require refreshed effects and a new confirmation. Detect a changed destination atomically with replacement.
- **FR-016**: During replacement persistence, prevent competing local edits, History changes and repeated confirmation. Publish UI, recovery-stack changes and success only after the save succeeds. Include History in synchronization with other tabs.
- **FR-017**: Reject corrupt, structurally inconsistent or unsupported-future backup files without mutation or dropped rows. Preserve pre-existing unresolved business references. Define validation separately from regulatory readiness checks.
- **FR-018**: Fail backup visibly before download if supported data cannot be represented without loss. Leave the previous download-start timestamp unchanged on generation or initiation failure. If initiation succeeds but timestamp storage fails, distinguish those outcomes truthfully.

### Key Entities

- **Workspace**: Current planning records, stored report evidence, settings, History and live decision log.
- **Backup**: A portable representation of the supported workspace at export time.
- **History snapshot**: An existing saved Version; backup preserves it without introducing another snapshot system.
- **Replacement preview**: The proposed effect on existing records, settings, History and decisions, plus applicable compatibility warnings.
- **Backup initiation record**: An accepted local timestamp describing download initiation, not a guarantee of storage.
- **Preview base state**: The coherent saved workspace against which replacement was reviewed; changes invalidate confirmation. This is temporary operation context, not a new saved Version.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every inventoried field is covered by populated and optional-value fixtures and survives actual XLSX serialization and fresh-profile restoration under the documented equality rules. The inventory-to-type coverage check fails when a new field is unclassified.
- **SC-002**: Every row of the replacement matrix passes its applicable preview, cancel, invalid-input, failed-save, retry and reload checks, including decision/History semantics.
- **SC-003**: The recovery walkthrough succeeds after the disposable source browser profile is deleted, using only the downloaded backup.
- **SC-004**: Every documented supported legacy-file fixture has a deterministic outcome with visible limitations or repairs; unsupported files give an actionable error without replacement.
- **SC-005**: No tested failed replacement reports success, and successful replacements retain their contents after reload.
- **SC-006**: Pending-save failure, stale local/remote preview, duplicate confirmation, competing History mutation and cross-tab commit-race scenarios pass without unconfirmed replacement or lost recovery entries.
- **SC-007**: Generation failure, initiation failure, timestamp-storage failure and successful initiation/reload each produce the specified status and timestamp outcome.

## Assumptions

- Scope is roadmap M1 (R1-04–06). #62 provides an implemented starting point, not evidence that all M1 work is complete.
- Product decisions Q1–Q3 and the 2026-09-29 remediation amendment are accepted in [the design notes](../../requirement-specs/workspace-backup-recovery.md). The accepted options are 1A, 2A and 3A.
- Filing metadata, new onboarding samples, parser dialect expansion, public hosting and recurring-reminder policy beyond the selected option belong to separate work.
- Existing reporting rules and ADR-0011 remain in force.
- The 2026-09-29 instruction authorizes documentation updates only. Implementation remains a separate user instruction.
- Application code and tests will follow the repository's requirements-first and Red/Green workflow with Step 0 decisions settled.
