# Excel Import

![Excel import preview modal](../../public/features/excel-import-preview-modal.png)

Importing an `.xlsx` file lets you load portfolio data prepared outside Selara — from a spreadsheet maintained by another team, a migration from a legacy tool, or a bulk update prepared offline.

## Supported file format

Upload a `.xlsx` file. The importer reads the following sheets by name: **Initiatives**, **Assets**, **AssetCategories**, **Programmes**, **Strategies**, **Milestones**, **Dependencies**, **Deliverables**, **DeliverableSegments**, **DeliverableStatuses**, **Resources**, **RptiDetails**, **LkptiDetails**, **Decisions**, **TimelineSettings**, **Versions**. Sheets with unrecognised names are ignored. Column headers must match the expected field names; the schema warnings panel reports any mismatches (see below).

## Uploading a file

**To open a colleague's file as your workspace:** click **Open shared** on the right of the header and select the `.xlsx` file. It **replaces your whole workspace**, including History snapshots and decisions. If your workspace has any data, Selara first asks you to confirm and shows, for each kind of record, how many you have now and how many the file brings, and what happens to History, decisions and settings. **Cancel** changes nothing. After replacing, a single **Undo** brings your previous workspace back, but only until you reload the page, so [download a backup](backup-and-restore.md) first if you want to keep it.

**To merge into or overwrite your workspace with a preview:**

1. Click **Import** on the right of the header.
2. Select your `.xlsx` file. The **Import Preview** modal opens.

## Reviewing the preview
The preview shows the parsed data before anything is written to your portfolio, with a row count per sheet found — Initiatives, Assets, Deliverables, Deliverable Segments, Deliverable Statuses, Resources, Categories, RPTI Details, and more. Check the row counts and sample values to confirm the file was read correctly.

If the file was exported from Selara, the preview will also show the number of **History Snapshots** found. Importing these snapshots allows you to restore the full version history of the portfolio.

Below the counts, **If you overwrite** compares your workspace now with what **Overwrite All Data** would leave, and states what happens to History, the decision log and timeline settings. It also lists anything the file needed repairing — see [Repairs](#repairs-to-older-files) — and, if the file has no usable timeline settings, that yours are kept.

If any required fields are missing or unrecognised column names are found, a **Schema Warnings** panel appears above the preview listing each issue by sheet and column. Address the warnings in your spreadsheet and re-upload, or proceed if the warnings are acceptable (for example, optional fields you intentionally omitted).


A missing `startDate` value on an initiative will not crash the timeline; the initiative will appear without a start position until the field is populated.

## Validation rules

Import validates your data before completing. If any **error-severity** issues are found, the import is blocked and an error notification displays the issues. You must fix the issues in your spreadsheet and re-upload.

**Blocking validations (import cannot proceed until fixed):**

| Field | Validation | Error message example |
|-------|------------|----------------------|
| `name` (initiatives) | Cannot be empty | "name" missing in 1 record |
| `startDate` / `endDate` | Must be valid ISO date (YYYY-MM-DD) | Row 1: invalid date format for "startDate" |
| `startDate` / `endDate` | startDate must be ≤ endDate | Row 1: startDate must be before or equal to endDate |
| `capex` / `opex` | Cannot be negative | Row 1: "capex" cannot be negative |

**Non-blocking warnings (import can proceed):**

| Field | Issue |
|-------|-------|
| Any | Missing optional fields |
| Any | Unknown column names |

After fixing validation errors, re-upload the corrected file.

## Choosing an import mode

The modal offers two modes:

### Merge Data

- Initiatives and other records with an `id` matching an existing record are updated in place.
- Records with new `id` values are added.
- Existing records whose `id` does not appear in the file are left untouched — this includes RPTI Detail rows: merging a file with no **RptiDetails** sheet leaves your existing RPTI report data exactly as it was.

### Files exported before the Decisions sheet existed

Older exports carry no **Decisions** sheet at all. Importing one with **Overwrite All Data** leaves
your decision log exactly as it was, rather than emptying it: a file that cannot speak about
decisions is not the same as a file saying you have none. A file that *does* carry a Decisions
sheet replaces the log as you would expect.

Use **Merge Data** when your file contains a partial update or additions to an existing portfolio.

### Overwrite All Data

- All current portfolio data is replaced with the contents of the file, including RPTI Detail rows.
- Records not present in the file are deleted.

Use **Overwrite All Data** when the file represents the complete intended state of the portfolio.

## Repairs to older files

Import can bring in files that aren't complete backups. When a saved version in the file has missing or invalid timeline display settings, Import fills in display defaults so the version can still be opened, and lists every repair in the preview:

| Setting | Default used |
|---|---|
| Start date | 2000-01-01 — only where the timeline starts; not a business date |
| Months shown | 12 |
| Budget display | label |
| Descriptions, conflict detection, relationships | off |
| Empty rows | show |
| Snap to period | month |

Valid settings in the file are kept, including the reporting years and currency. Missing or invalid business settings — the onboarding reporting years, the default currency, the cluster name — are listed and left unset. They are never copied from your current workspace or made up. [Restore Backup](backup-and-restore.md) never repairs; it sends such files here.

## Confirmation and notifications

The success notification appears only once the import has been saved. If saving fails, Overwrite leaves your workspace as it was and shows why in the preview, so you can try again; a failed Merge says it could not be saved. If your workspace changed while the preview was open — for example in another tab — the preview asks you to refresh before overwriting. No browser `alert()` dialogs are used.

---

- Previous: [Backup and Restore](backup-and-restore.md)
- Next: [Excel Export](excel-export.md)
