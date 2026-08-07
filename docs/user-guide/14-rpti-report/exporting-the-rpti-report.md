# Auto-Suggested Quarters and Exporting

The **Planned Implementation Time** column in RPTI reports which quarter a development is expected to go live. Scenia can suggest this automatically for application rows, based on the application's lifecycle segments.

## How auto-suggestion works

An application's lifecycle is tracked through **Lifecycle Segments** (see [Lifecycle Segments](../05-applications/lifecycle-segments.md)) — phases like Planned, Funded, In Production, and Sunset. When a segment is linked to the same initiative as an RPTI row and its status represents "live" (In Production by default, or any status your workspace has marked as the live status), Scenia suggests that segment's start date as the row's quarter.

To make a segment eligible for suggestion:

1. Open the application's lifecycle segment (double-click its swimlane, or click an existing segment bar).
2. Set its **Initiative** field to the initiative driving that phase.
3. Save.

Back on the RPTI row form, once both the same Initiative and Application are selected, a suggestion banner appears if a matching segment is found — click **Use this** to accept it, or leave the quarter dropdown to enter one manually.

Asset/infrastructure rows don't have a lifecycle segment concept, so their quarter is always entered manually. The form offers a **Copy date from an existing milestone** shortcut if the target asset already has a relevant milestone recorded.

## Exporting to Excel

Click **Export to Excel** on the RPTI Report screen to download a spreadsheet matching the exact Format 3.1 layout — one row per RPTI record, with all 11 required columns. This is separate from the general workspace Excel export (which includes a raw backup copy of your RPTI data alongside every other entity type, for full round-trip import/export).

---

- Previous: [Recording an RPTI Row](recording-an-rpti-row.md)
- This is the last page in the guide.
