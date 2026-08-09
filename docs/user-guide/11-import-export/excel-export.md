# Excel Export

![Excel export button in Data Manager](../../public/features/excel-export-data-manager.png)

Exporting to Excel produces a structured `.xlsx` file containing your full portfolio data. Use this to share data with stakeholders who work outside Selara, feed downstream reporting tools, or create an offline backup of the current state.

## How to export

1. Open the **Data Manager** panel.
2. Click **Export Excel**.

The file downloads automatically. No configuration or confirmation step is required.

## File contents

The exported workbook contains one sheet per data type:

| Sheet | Contents |
|---|---|
| **Initiatives** | All initiatives with their fields (including CapEx and OpEx) |
| **Assets** | All application assets |
| **AssetCategories** | All asset category groupings |
| **Programmes** | All programmes |
| **Strategies** | All strategies |
| **Milestones** | All milestones |
| **Dependencies** | All initiative dependency relationships |
| **Applications** | All applications linked to assets |
| **ApplicationSegments** | All application lifecycle segments |
| **ApplicationStatuses** | All named status labels for segments |
| **Resources** | All people and roles in the resources roster |
| **Versions** | Metadata for all saved history snapshots |
| **TimelineSettings** | Configuration settings (zoom, start date, toggles) for the current state and snapshots |

### Version History Preservation

Unlike simple backups, Selara's Excel export preserves your entire **Version History**. When you export:
- The **Versions** sheet captures the name, timestamp, and description of every snapshot you've saved.
- All other data sheets include a **`versionId`** column. Rows where this is blank represent your current "live" data; rows with an ID correspond to data from a specific historical snapshot.

This allows you to move your entire project history between browsers or share a complete time-travel enabled portfolio with a colleague.

## Keeping exports current

The export reflects the state of the portfolio at the moment you click the button. It is not a live feed. If you share the file with others and the portfolio changes afterward, export again to produce an updated file.

---

- Previous: [Excel Import](excel-import.md)
- Next: [PDF & SVG Export](pdf-svg-export.md)
