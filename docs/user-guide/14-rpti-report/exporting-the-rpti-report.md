# Exporting the RPTI Report

The **Planned Implementation Time** column in RPTI reports which quarter a development is expected to go live. If you leave the **Quarter** column blank for an application-target row in Data Manager, Selara fills it in automatically at export time, based on the application's lifecycle segments.

## How the export-time quarter fallback works

An application's lifecycle is tracked through **Lifecycle Segments** (see [Lifecycle Segments](../05-applications/lifecycle-segments.md)) — phases like Planned, Funded, In Production, and Sunset. When a segment is linked to the same initiative as an RPTI row and its status represents "live" (In Production by default, or any status your workspace has marked as the live status), that segment's start date is used as the row's quarter wherever the row's own **Quarter** column is empty — both on the read-only RPTI Report screen and in the Excel export.

To make a segment eligible:

1. Open the application's lifecycle segment (double-click its swimlane, or click an existing segment bar).
2. Set its **Initiative** field to the initiative driving that phase.
3. Save.

Asset/infrastructure rows don't have a lifecycle segment concept, so their quarter always needs to be entered directly in the **Quarter** column in Data Manager.

## Exporting to Excel

Go to **Reports → RPTI Report** and click **Export to Excel** to download a spreadsheet matching the exact Format 3.1 layout — one row per RPTI record, with all 11 required columns. This is separate from the general workspace Excel export (which includes a raw backup copy of your RPTI data alongside every other entity type, for full round-trip import/export).

---

- Previous: [Recording an RPTI Row](recording-an-rpti-row.md)
- This is the last page in the guide.
