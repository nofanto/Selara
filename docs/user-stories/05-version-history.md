# User Stories — Version History & Snapshots

## US-VH-01: Save a Named Version Snapshot

**As an** IT portfolio manager,
**I want** to save a named snapshot of the current portfolio state,
**so that** I can preserve a baseline before making significant changes.

**Acceptance Criteria:**
- A "Save Current State" button opens a form to enter a version name and optional description
- Saving creates a version entry visible in the version history list
- Saved versions are deep clones — mutations after saving do not affect the snapshot
- Snapshot data is persisted in full to IndexedDB (survives page reload)

---

## US-VH-02: Restore a Previous Version

**As an** IT portfolio manager,
**I want** to restore a previous snapshot,
**so that** I can undo large batches of changes or roll back to a known-good state.

**Acceptance Criteria:**
- Selecting a version and clicking "Restore" shows a confirmation modal
- Confirming overwrites the current *plan* state with the snapshot data
- The portfolio decision log is **not** rolled back: decisions recorded since the snapshot survive the restore, because the log records why choices were made rather than forming part of the plan itself (see [ADR-0011](../adr/0011-history-tab-decisions-as-audit-trail.md))
- The VersionManager closes automatically after a successful restore
- If the selected version is deleted while the comparison report is open, the app does not crash

---

## US-VH-03: Delete a Version

**As an** IT portfolio manager,
**I want** to delete old version snapshots I no longer need,
**so that** the history list stays manageable.

**Acceptance Criteria:**
- A delete button is available for each version entry
- Clicking delete shows a confirmation modal
- Confirming removes the version from IndexedDB

---

## US-VH-04: Compare Two Versions with a Diff Report

**As an** IT portfolio manager,
**I want** to compare two versions and see a diff report highlighting what changed,
**so that** I can communicate the impact of planning decisions to stakeholders.

**Acceptance Criteria:**
- A "Difference Report" can be generated between a saved baseline version and the current state
- The diff report shows which entities were added, removed, or modified, across every type the comparison covers (assets, programmes, strategies, initiatives, relationships, milestones, deliverables, deliverable segments, app statuses, resources, categories, decisions, RPTI and LKPTI details)
- The diff report opens on a per-asset summary, with the entity-type breakdown above behind a **Summary / All changes** toggle (see [US-VH-06](#us-vh-06-read-a-diff-as-a-summary-by-asset))
- The diff report is accessible from the Reports view under "History Differences"
- An empty state is shown in the report when no versions have been saved
- A version selector appears once at least one version exists
- An appropriate error message is shown if versions fail to load

---

## US-VH-05: Preserve Version History in Excel Export/Import

**As an** IT portfolio manager,
**I want** my version history to be included when I export or import an Excel file,
**so that** I can move my complete time-travel enabled portfolio between devices or backup the full history offline.

**Acceptance Criteria:**
- Excel export includes a "Versions" sheet with metadata for all snapshots
- All data sheets in the export include a `versionId` column to distinguish snapshots from live data
- Import preview displays the count of "History Snapshots" found in the file
- Both "Merge" and "Overwrite" import modes correctly restore the version history array to IndexedDB
- Importer maintains backward compatibility for files without versioning information

---

## US-VH-06: Read a Diff as a Summary by Asset

**As an** IT portfolio manager returning to a plan after a period away,
**I want** the difference report to open on a per-asset summary rather than a list ordered by entity type,
**so that** I can see what happened to each system as one story instead of reassembling it from a dozen separate sections.

**Acceptance Criteria:**
- Both diff surfaces — the Version Comparison modal and the Reports "History Differences" card — show a **Summary / All changes** toggle, and open on **Summary**
- **All changes** shows the existing entity-type view unchanged; nothing is lost by adding the summary
- Summary groups every change under the asset it belongs to, with a portfolio-level group for changes that have no asset (programmes, strategies, resources, categories, app statuses, decisions, and relationships that span two assets)
- Within a group, changes about the same deliverable appear together under that deliverable's name; changes with no deliverable (the asset itself, initiatives, milestones) appear above them
- Groups and clusters are ordered by significance: RPTI and LKPTI changes first, then things added or removed, then everything else. The portfolio-level group is always last
- Cosmetic-only changes (programme, strategy and app-status colours; category ordering) are excluded from the summary and remain visible under All changes
- When every change was cosmetic, Summary says so and reports how many were hidden — it does not render blank
- When an asset was itself added or removed, its group states that one fact with a count of what came with it, rather than listing every child
- A group heading names its asset, and a cluster heading names its deliverable, even when that asset or deliverable was deleted in the change being reported

**Design notes:** [`requirement-specs/diff-summary.md`](../../requirement-specs/diff-summary.md) §§2-3, 6-8.
