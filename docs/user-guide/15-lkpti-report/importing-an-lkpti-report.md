# Importing an Existing LKPTI Report

If your bank has already filed an LKPTI Format 3.2.6 report, you can upload it when you first open Selara and skip re-typing the application data it already contains.

## Uploading the file

On the template picker (shown the first time you open Selara, or after **Clear data and start again** in Data Manager), choose the **Import LKPTI Report** card and select your `.xlsx` file.

The importer only accepts the standard OJK Format 3.2.6 layout — the same single-sheet, 15-column, Indonesian-header layout Selara's own [LKPTI export](recording-lkpti-rows.md#exporting-to-excel) produces. If the file's sheet name or headers don't match exactly, the whole import is rejected up front with an error, and the template picker stays open so you can try a different file. No partial workspace is created.

A row with a problem — an unrecognized category code, backup strategy, or ownership label, or a go-live date that isn't `dd-mm-yyyy` text or a real date cell — is skipped individually rather than failing the whole file; you'll see how many rows were skipped and why after the import finishes.

## What gets built

From each valid row, Selara creates:

- An **Application Category** for the row's LKPTI category code (shared across every row with the same code).
- A placeholder **Asset**, named after the application, in that category — a starting point you'll likely want to reorganize afterward from Data Manager, since a real filed report doesn't say how your bank groups applications.
- A **Deliverable** (application) with its name, description, and developer set from the row.
- One open-ended **lifecycle segment**, starting on the row's go-live date, marked with a **Live** status — every row in a filed LKPTI report is, by definition, already in production.
- One **LKPTI row**, with all 15 fields populated directly from the imported data — including the fields (Platform, Database, DC/DRC Provider, Backup Strategy, System Owner, Ownership) that Selara has no other source for.

Nothing about Programmes, Strategies, Initiatives, Resources, Dependencies, Milestones, or Decisions is created — none of that exists in an LKPTI report. You add those afterward the same way you would in any other workspace.

## Regenerating afterward is safe

Clicking **Generate LKPTI Rows** in Data Manager after an import does **not** erase the data your import just populated. Generation only creates a new row for an application that doesn't have one yet; for a row that already exists, it refreshes the fields it can auto-derive (Category, Developer, DC/DR City & Country, Function Description) and leaves everything else — Platform, Database, DC/DRC Provider, Backup Strategy, System Owner, Ownership, Go-Live Date — exactly as it was.

---

- Previous: [Recording LKPTI Report Rows](recording-lkpti-rows.md)
- This is the last page in the guide.
