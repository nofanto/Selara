# Excel Export

![Excel export button in Data Manager](../../public/features/excel-export-data-manager.png)

Exporting to Excel produces a structured `.xlsx` file containing your full portfolio data. Use this to share data with stakeholders who work outside Selara or feed downstream reporting tools. To keep a copy you can restore, use [Backup](backup-and-restore.md) instead: it writes the same sheets without the losses described below, and checks the file before download.

## How to export

1. Click **Export** on the right of the header.

The file downloads automatically. No configuration or confirmation step is required.

## File contents

The exported workbook contains one sheet per data type:

| Sheet | Contents |
|---|---|
| **Initiatives** | All initiatives with their fields (including CapEx and OpEx) |
| **Assets** | All assets |
| **AssetCategories** | All asset category groupings, including their default RPTI category code and DC/DR location |
| **Programmes** | All programmes |
| **Strategies** | All strategies |
| **Milestones** | All milestones |
| **Dependencies** | All initiative dependency relationships |
| **Deliverables** | All deliverables linked to assets, including their RPTI category/developer/DC-DR overrides |
| **DeliverableSegments** | All deliverable lifecycle segments |
| **DeliverableStatuses** | All named status labels for segments |
| **Resources** | All people and roles in the resources roster |
| **LkptiDetails** | A raw backup copy of every stored LKPTI report row — separate from the formatted Format 3.2.6 report export |
| **RptiDetails** | A raw backup copy of every RPTI report row (see [Recording an RPTI Row](../14-rpti-report/recording-an-rpti-row.md)) — separate from the formatted "Format 3.1" report export |
| **Decisions** | Every record in your [portfolio decision log](../13-decisions/recording-a-decision.md), including its MADR fields, status, and any links |
| **Versions** | Metadata for all saved history snapshots |
| **TimelineSettings** | Configuration settings (zoom, start date, default currency, toggles) for the current state and snapshots |

### Version History Preservation

Unlike simple backups, Selara's Excel export preserves your entire **Version History**. When you export:
- The **Versions** sheet captures the name, timestamp, and description of every snapshot you've saved.
- All other data sheets include a **`versionId`** column. Rows where this is blank represent your current "live" data; rows with an ID correspond to data from a specific historical snapshot.

The **Decisions** sheet is the one exception: it has no version envelope. Your decision log is a
record *about* the portfolio rather than part of its state, so it is exported once, as it stands
now, and is not snapshotted per version — see [ADR-0011](../../adr/0011-history-tab-decisions-as-audit-trail.md).
Its own `versionId` column means something different: the snapshot that a decision was recorded
against, if any.

This allows you to move your entire project history between browsers or share a complete time-travel enabled portfolio with a colleague.

The ordinary export is not a complete copy, though. It can't keep nested settings (column widths, collapsed groups) or the decision copy saved inside each version, and it lists resource assignments separated by commas. Some text also changes in Excel: Windows line endings, and text that looks like an Excel escape code. For recovery, use [Backup](backup-and-restore.md).

## Keeping exports current

The export reflects the state of the portfolio at the moment you click the button. It is not a live feed. If you share the file with others and the portfolio changes afterward, export again to produce an updated file.

---

- Previous: [Excel Import](excel-import.md)
- Next: [PDF & SVG Export](pdf-svg-export.md)
