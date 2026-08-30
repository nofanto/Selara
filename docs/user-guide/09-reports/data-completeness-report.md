# Data Completeness Report

The Data Completeness report is a single view of everything that's incomplete or broken elsewhere in your workspace — records pointing at something that's been deleted, and fields left blank because nothing could auto-fill them. Neither of these is visible anywhere else in the app.

## Opening the report

Go to **Reports → Data Completeness**.

## Reading the issue list

Each issue has a severity:

- **Error** (red) — a **dangling reference**. Some field on a record points at another record — an Asset, an Initiative, a Resource, and so on — that no longer exists, usually because that record was deleted without the thing pointing at it being cleaned up.
- **Warning** (amber) — a **report-generation gap**. A Deliverable is eligible to appear in the RPTI or LKPTI report, but a field it needs has no value and no way to auto-fill one — so the report will export with a blank cell, or the Deliverable won't generate a row at all.

Use the **All / Errors / Warnings** filter at the top to narrow the list.

## Fixing an issue

Click any issue to jump straight to where it can be fixed:

- Most issues open **Data Manager**, on the tab that owns the record, with the record's name already typed into the search box at the top — so the row you need is the one already showing.
- An issue on a portfolio **Decision** opens the **Decisions** view instead, since decisions aren't managed in Data Manager.

This report is read-only — there's no editing here. It only tells you what needs attention and takes you to the screen where you'd normally make that fix.

## Why gaps are scoped to eligible records

The report doesn't flag every blank field in the workspace — only ones that would actually affect a generated report. For example, a Deliverable with no lifecycle segments at all isn't checked for a missing regulatory category, because it can't generate an RPTI or LKPTI row yet regardless; once it has a segment that makes it eligible for one of those reports, a missing category starts being flagged.

---

- Previous: [History Diff Report](history-diff-report.md)
- Next: [Saving a Version](../10-version-history/saving-a-version.md)
