# Restoring a Version

![Restore version confirmation modal](../../public/features/version-history-restore-modal.png)

Restoring replaces your entire current portfolio state with a previously saved version. Use this to roll back an unwanted change or to reset to an approved baseline.

## Before you restore

Restoration is destructive: any changes made since the selected version was saved will be lost. If you want to keep a record of the current state, [save it as a version](saving-a-version.md) before proceeding.

**One deliberate exception: your [decision log](../13-decisions/recording-a-decision.md) is never rolled back.** Decisions recorded since the snapshot was taken survive the restore untouched. The log is a record of *why* choices were made, not part of the plan data itself — rolling it back would delete the very decision explaining why you restored. See [ADR-0011](../../adr/0011-history-tab-decisions-as-audit-trail.md).

## How to restore a version

1. Open the **History** tab in the header navigation.
2. Select the version you want to restore in the list. Its details open on the right.
3. Under **Restore Version**, click **Restore to Current**.
4. Read the confirmation modal, which names the version and warns that the current state will be overwritten.
5. Click **Restore**.

The app loads the saved state, the History tab closes automatically, and you are returned to the timeline with the restored data.

## After restoring

The restoration writes the saved snapshot back into IndexedDB as the active state. The version history list itself is unchanged — the version you restored from remains available for future comparisons or restores. The decision log is likewise left as it was.

If you realise the restore was a mistake, use **Undo** (Cmd/Ctrl+Z) straight away: a restore is one change on the undo history, which holds your last 10 changes. For a durable recovery point, save a version before restoring.

---

- Previous: [Comparing Versions](comparing-versions.md)
- Next: [Excel Import](../11-import-export/excel-import.md)
