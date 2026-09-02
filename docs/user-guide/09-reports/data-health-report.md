# Data Health Report

The Data Health report is a single view of everything that's incomplete, broken, or *illegal* elsewhere in your workspace — records pointing at something that's been deleted, fields left blank because nothing could auto-fill them, and values that are filled in but would be rejected when you file. None of these is visible anywhere else in the app.

## Opening the report

Go to **Reports → Data Health**.

## The verdict line

At the top of the report is a one-line summary, so you don't have to count the list yourself:

- **"Ready to file — no data-health issues found."** Nothing to fix.
- **"Not ready to file — 2 validity errors, 5 completeness gaps."** At least one value in the workspace would be rejected at filing time. Fix the validity errors first.
- **"No validity errors — 5 completeness gaps and 1 validity warning left to review."** Nothing would be outright rejected, but there's still work outstanding.

A workspace with only completeness gaps is never described as ready to file — a blank cell is still a blank cell.

## The two phases

Every issue belongs to one of two phases, which answer different questions:

- **Completeness** — *is this reference resolvable, and is this value present?* A record pointing at a deleted Asset; a Deliverable with no lifecycle segments; an LKPTI row with no Platform filled in.
- **Validity** — *is the value that **is** present actually legal?* A Go-Live Date of `31-02-2021`; a Function Description of 900 characters against the schema's 500-character cap; two applications sharing a name.

Both phases always run. A workspace full of completeness gaps — which every real workspace has — never hides its validity errors behind them.

## Reading the issue list

Alongside its phase, each issue has a severity:

- **Error** (red) — a dangling reference, or a value the OJK schema would reject outright: a malformed or impossible date, a date in the future, or text over a field's character cap.
- **Warning** (amber) — a report-generation gap, or a value that is legal but problematic: a duplicate application name, text carrying a line break or stray whitespace into a flat spreadsheet cell, or a workspace currency that isn't IDR.

Two filter groups sit above the list and **combine**: **All / Errors / Warnings** for severity, and **Both phases / Validity / Completeness** for phase. So "every error, whichever phase it came from" and "just the validity warnings" are both one click away.

## Fixing an issue

Click any issue to jump straight to where it can be fixed:

- Most issues open **Data Manager**, on the tab that owns the record, with the record's name already typed into the search box at the top — so the row you need is the one already showing.
- An issue on a portfolio **Decision** opens the **Decisions** view instead, since decisions aren't managed in Data Manager.
- The application-name checks open the **Deliverables** tab, because that's where the name is edited, even though the problem shows up in the LKPTI export.
- The workspace currency issue opens the **RPTI** tab, where the currency is set. It's a property of the workspace rather than of any one record, so nothing is pre-filled into the search box.

This report is read-only — there's no editing here. It only tells you what needs attention and takes you to the screen where you'd normally make that fix.

## Two things worth knowing

**"Not in the future" means not in the future *today*.** The Go-Live Date check compares against the current date, because a reporting-period end isn't something the app models. If you're preparing a filing for a period that has already closed, a go-live date falling after that period's end won't be flagged.

**A non-IDR workspace currency can't be fixed row by row.** RPTI requires IDR-equivalent amounts, and this app deliberately reports in a single workspace-wide currency with no per-row conversion. If the workspace currency isn't IDR, the export can't be schema-compliant no matter how many individual rows you correct — which is why it's reported once, against the workspace itself.

## Why gaps are scoped to eligible records

The report doesn't flag every blank field in the workspace — only ones that would actually affect a generated report. For example, a Deliverable with no lifecycle segments at all isn't checked for a missing regulatory category, because it can't generate an RPTI or LKPTI row yet regardless; once it has a segment that makes it eligible for one of those reports, a missing category starts being flagged.

The same principle applies to validity: each check is guarded on the value being present. An empty Go-Live Date is a completeness gap, not an invalid date, and is never reported as both.

---

- Previous: [History Diff Report](history-diff-report.md)
- Next: [Saving a Version](../10-version-history/saving-a-version.md)
