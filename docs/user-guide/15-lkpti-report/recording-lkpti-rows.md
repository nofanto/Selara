# Recording LKPTI Report Rows

LKPTI Format 3.2.6 (Daftar Aplikasi) is Indonesia's OJK-regulated Application List — a point-in-time inventory of applications currently running at the bank. Unlike the RPTI report, it isn't about planned development activity; it's a snapshot of what's actually live, with details like platform, database, backup strategy, and ownership.

LKPTI rows are managed in **Data Manager → LKPTI**, the same spreadsheet-style editor used for every other entity in Selara. The **LKPTI Report** screen under Reports is a read-only summary of the same data, plus the Excel export.

## Opening the LKPTI tab

Go to **Data Manager** in the top navigation bar and select the **LKPTI** tab.

## Creating a Row

1. Click **Add Row**.
2. Set the **Deliverable** column to the application this row is about.
3. Set the **Category** — one of the 13 LKPTI application category codes (customer management, payments, digital services, etc. — infrastructure-only RPTI codes like Data Center or Security Systems don't apply to this report).
4. Fill in **Platform**, **Database**, **DC City/Country**, **DC Provider**, **DR City/Country**, **DRC Provider**, **Backup Strategy**, **System Owner**, **Developer**, **Go-Live Date**, and **Ownership** as applicable.

## Auto-Generating Rows

Instead of adding rows by hand, click **Generate LKPTI Rows** at the top of the tab to build rows automatically. Unlike RPTI generation, this isn't scoped to a report year — it's a point-in-time inventory, so it always reflects current state:

- A row is generated for every Deliverable that has already gone live — that is, it has a lifecycle segment marked as live (In Production by default, or any status your workspace has marked as the live status) **whose start date has arrived**. A Deliverable that's only ever been Planned or Funded doesn't qualify, and neither does one whose In Production phase starts later this year or next: LKPTI requires a go-live date that isn't in the future.
- Once an application has gone live it stays on the report, even after its In Production segment ends and it moves to Sunset or Out of Support. It's still something your bank ran, so it remains reportable — remove it by deleting the row when it's genuinely out of scope for the filing.
- **Category**, **Developer**, and the **DC/DR City/Country** fields auto-fill the same Deliverable-first, Asset-Category-fallback pattern as RPTI generation — see [Recording an RPTI Row](../14-rpti-report/recording-an-rpti-row.md) for how that cascade works. **Developer** specifically only auto-fills to `inhouse`; when the Deliverable's developer is a third party, the actual provider name has to be entered manually here, since LKPTI wants the provider's name, not just a generic marker.
- **Function Description** auto-fills from the deliverable's own **Description** field (set on the [Deliverables tab](../05-applications/adding-applications.md)) when one is set.
- **Go-Live Date** is suggested from the earliest live-status lifecycle segment's start date, converted to the `dd-mm-yyyy` format the LKPTI form expects.
- **Platform**, **Database**, **DC/DRC Provider**, **Backup Strategy**, **System Owner**, and **Ownership** have no auto-fill source in Selara's data model — these always need to be entered manually.

Generating is safe to run repeatedly: it never removes or blanks out an existing row. A new row is only created for an application that doesn't have one yet — for a row that already exists (whether from a prior generation, manual entry, or an [LKPTI report import](importing-an-lkpti-report.md)), only the auto-fillable fields above are refreshed; anything with no auto-fill source is left exactly as you last set it.

## Editing and Deleting

Edit any cell inline, the same as any other Data Manager table. Click the trash icon on a row to delete it. Deleting the Deliverable a row targets removes that LKPTI row automatically.

## Exporting to Excel

Go to **Reports → LKPTI Report** and click **Export to Excel** to download a spreadsheet matching the exact LKPTI Format 3.2.6 layout — one row per application, with all 15 required columns and Indonesian headers. This is separate from the general workspace Excel export (which includes a raw backup copy of your LKPTI data alongside every other entity type, for full round-trip import/export).

Already have a filed LKPTI report? See [Importing an Existing LKPTI Report](importing-an-lkpti-report.md) to build your starting workspace from it instead of adding rows by hand.

---

- Previous: [Exporting the RPTI Report](../14-rpti-report/exporting-the-rpti-report.md)
- Next: [Importing an Existing LKPTI Report](importing-an-lkpti-report.md)
