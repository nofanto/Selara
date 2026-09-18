# Exporting the RPTI Report

Open **Reports → RPTI Report**, enter the filing year, and click **Generate RPTI**. Review the generated application and infrastructure rows, then click **Export to Excel** to download `rpti-report-<year>.xlsx`. Its **Report Metadata** worksheet states the selected year; the **RPTI Format 3.1** worksheet keeps the regulatory columns.

The quarter is derived from qualifying lifecycle segments linked to the initiative and its target. Maintain those dates and links on the timeline. Infrastructure work uses Deliverable lifecycle segments too.

If generation cannot resolve an initiative’s target, the report names the problem and repair and withholds export. Choose **RPTI Target** on **Data Manager → Initiatives**, or split ambiguous work into one initiative per target, then generate again. Existing unsupported Asset-target rows also block export and name their migration to Deliverables.

The generated filing contains only the rows derived for your selected year — previously stored rows never join it silently. A stored row that belongs to another year is correctly absent with no warning. A stale row blocks only when it has no unique current canonical counterpart: repair the source Initiative or Deliverable named by the gate, then generate again. If multiple stored rows would claim the same generated plan line, the gate stays closed rather than silently dropping one.

Stored rows remain visible in the read-only **Data Manager → RPTI** tab. The general workspace export includes those stored records for backup; the Reports export is the filing generated for your selected year.

- Previous: [Recording an RPTI Row](recording-an-rpti-row.md)
- Next: [Recording LKPTI Rows](../15-lkpti-report/recording-lkpti-rows.md)
