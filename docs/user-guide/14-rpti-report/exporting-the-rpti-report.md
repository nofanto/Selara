# Exporting the RPTI Report

Open **Reports → RPTI Report**, enter the filing year, and click **Generate RPTI**. Review the generated application and infrastructure rows, then click **Export to Excel** to download `rpti-report-<year>.xlsx`. Its **Report Metadata** worksheet states the selected year; the **RPTI Format 3.1** worksheet keeps the regulatory columns.

The quarter is derived from each live lifecycle segment linked to an Initiative; that same segment names the row's Deliverable. Maintain those dates and links on the timeline. Infrastructure work uses Deliverable lifecycle segments too.

If generation cannot reproduce stored filing evidence, the report names the problem and repair and withholds export. Create or correct the item on **Data Manager → Deliverables**, then use the lifecycle segment panel on the **Visualiser timeline** to select both that Deliverable and the Initiative it implements. Existing unsupported Asset-target rows require the same migration. One Initiative may legitimately implement several Deliverables; each live lifecycle segment is its own filing identity, so that arrangement is not ambiguous.

The generated filing contains only the rows derived for your selected year — previously stored rows never join it silently. A stored row that belongs to another year is correctly absent with no warning. A stale row blocks only when it has no unique current implementation counterpart: repair the lifecycle segment named by the gate, then generate again. If multiple stored rows would claim the same implementation, or one legacy row could match several implementations, the gate stays closed rather than silently choosing or dropping one.

Stored rows remain visible in the read-only **Data Manager → RPTI** tab. The general workspace export includes those stored records for backup; the Reports export is the filing generated for your selected year.

- Previous: [Recording an RPTI Row](recording-an-rpti-row.md)
- Next: [Recording LKPTI Rows](../15-lkpti-report/recording-lkpti-rows.md)
