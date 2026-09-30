# Backup and Restore

Selara keeps your workspace in this browser. If the browser's data is cleared — or you move to another computer or browser profile — everything stored here goes with it, **including History**. Saved versions live in the same browser storage as the rest of your workspace, so they are not a backup.

A **backup** is one Excel file you keep somewhere else, holding the whole workspace so it can be restored exactly.

## What a backup contains

- Every current record: assets, deliverables, lifecycle segments, statuses, initiatives, programmes, strategies, milestones, dependencies, categories and resources.
- The stored RPTI and LKPTI rows, as they are — nothing is regenerated.
- History: every saved version, with its own records and settings.
- The decision log, with each decision's link to the saved version it was recorded against.
- Workspace settings, including column widths, collapsed groups, the default currency and the reporting years you gave at onboarding.

It does **not** contain your Undo history, which view you had open, or browser preferences such as having dismissed the welcome page. PDF, PNG and the RPTI/LKPTI report exports are not backups: they are pictures or filings, and can't be restored.

## Making a backup

1. Click **Backup** in the header (next to the search box).
2. Click **Download backup**.

Before the file is downloaded, Selara writes it, reads it back, and checks it matches your workspace field by field. If anything couldn't be kept exactly — for example a single text value longer than an Excel cell can hold — you get an error naming the record and field instead of a file, and nothing is downloaded.

If your latest change hasn't been saved in this browser, Backup refuses and says so rather than back up an older copy; your unsaved change stays on screen.

When it works, the panel says **Download started** and shows when. That is all a browser can tell Selara: it can't see whether the file was actually saved, or whether you cancelled the download. **Check that the file arrived where you keep backups.** The "last backup download started" time is kept in this browser only, and says nothing if it can't be read — it never claims a backup exists.

Values Selara doesn't recognise — a milestone type typed differently, a date in another format, a column added to an imported spreadsheet — are kept exactly as stored and listed after the download starts, so you know they're there.

## Restoring a backup

You can restore from **Backup → Restore from backup…**, or, in a new browser profile, from **Restore a backup** on the welcome screen.

1. Choose the backup file.
2. Selara checks it is a complete backup before anything else. If it isn't, nothing changes and you're told why:
   - **Damaged or inconsistent** — rows missing against the file's own counts, a row belonging to a saved version that isn't there, the same ID twice, or a cell that can't be read. Restore won't use it.
   - **Made by a newer version of Selara** — restore it with a version that supports that format.
   - **Incomplete** — an older export missing a sheet (such as Decisions) or a saved version's settings. Restore won't treat it as a backup. Use [Excel Import](excel-import.md) instead, which shows what it can bring in, and anything it had to repair, before you confirm.
   - **Not a workspace at all** — for example a filed RPTI or LKPTI return. Start from filed returns instead.
3. The preview shows, for each kind of record, how many you have now and how many the backup brings, and what happens to History, the decision log and settings. Confirm with **Restore backup**, or **Cancel** (or press Escape) to change nothing.

Success is reported only once everything is saved. If saving fails part-way, nothing is replaced — your workspace, History and decisions stay exactly as they were, and you can try again. A single **Undo** straight afterwards brings the previous workspace back, History included, until you reload.

Links that point at nothing — a decision about an initiative you later deleted, say — are restored exactly as they were. Data Health still reports them; restoring doesn't repair or remove them.

### Older exports

A file made by **Export** before backups existed can still be restored if it has every sheet and usable settings. Selara says it's an older export: those files couldn't keep column widths or collapsed groups, the decision copy inside each saved version, or the difference between a missing and an empty collection, and they list resource assignments separated by commas.

## If another tab changes the workspace

If the workspace changes while a restore preview is open — in this tab or another — the preview says so and **Restore backup** is disabled until you click **Refresh** and review the new numbers. If another tab saves a change in the moment between your confirming and the restore being written, the restore is refused rather than overwriting that change.

## When Selara updates with other tabs open

Occasionally a new Selara version changes how your data is stored in the browser. That has to happen in one tab at a time:

- **"Close or reload your other Selara tabs to continue"** on the loading screen means an older Selara tab is still open. Close it, or reload it, and this page carries on by itself. Nothing is lost while it waits.
- **"Selara was updated in another tab. Reload this tab to continue"** means a newer Selara opened elsewhere. Click **Reload**. Until you do, this tab can't save, and changes made in it since the message appeared are not stored. Any save you try says so.

---

- Previous: [Restoring a Version](../10-version-history/restoring-a-version.md)
- Next: [Excel Import](excel-import.md)
