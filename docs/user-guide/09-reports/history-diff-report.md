# History Diff Report

![History diff report comparing a saved version with the current portfolio](../../public/features/history-diff-report.png)

The History Diff report compares a saved version of your portfolio with its **current** state. Use it to see what has changed since a baseline: after a planning cycle, before a review, or to produce a change summary for stakeholders.

## Before you start

The report needs at least one saved version. If none exists it shows **No saved versions**. See [Saving a Version](../10-version-history/saving-a-version.md).

## Running the comparison

1. Go to **Reports → Version History**. The report is headed **History Differences**.
2. Choose a saved version from the selector.
3. Click **Run Difference Report**.

The comparison is always between the version you chose and your current portfolio. Comparing two saved versions with each other is not supported. To compare against an older state, save a version at that point, then compare from it.

The same comparison is available from the **History** tab: select a version, then click **Run Difference Report**. Both entry points show the same content.

## Reading the result

The report groups every change as **Added**, **Removed** or **Changed**, and offers a **Summary** view (grouped by asset, most significant first) and an **All changes** view (the full audit trail by entity type). It opens with the **Decisions in this span** recorded against the comparison. See [Comparing Versions](../10-version-history/comparing-versions.md) for a full description of both views.

## Error states

If a saved version cannot be loaded, for example because its record was removed outside the app, an error message is shown in place of the report. Choose a different version, or check in the **History** tab that the version still exists.

---

- Previous: [Maturity Heatmap Report](maturity-heatmap-report.md)
- Next: [Data Health Report](data-health-report.md)
