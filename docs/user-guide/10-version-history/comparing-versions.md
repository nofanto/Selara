# Comparing Versions

![Version comparison diff report](../../public/features/version-history-diff-report.png)

The diff report lets you see exactly what changed between a saved baseline and your current portfolio state. Use it to audit changes before a board review, document decisions after a planning cycle, or investigate how the plan evolved over time.

## Opening the diff report

1. Navigate to the **Reports** view.
2. Select **History Differences** from the report list.
3. If no versions have been saved, the panel shows an empty state with a prompt to save your first version. Follow the link to [Saving a Version](saving-a-version.md).
4. If one or more versions exist, a version selector appears. Choose the saved version you want to compare against your current state.

## Reading the diff report

Every change falls into one of three categories, in both views:

| Category | Meaning |
|---|---|
| **Added** | Items present in the current state but not in the selected baseline |
| **Removed** | Items present in the baseline but deleted from the current state |
| **Changed** | Items present in both, where one or more fields have changed |

Changed rows show the old and new values for each changed field.

The report offers two views of the same comparison, chosen with the **Summary / All changes** toggle at the top.

### Summary — what happened to each system

The default. Changes are grouped by the **asset** they belong to, so everything that happened to one system reads as a single story instead of being scattered across a dozen type headings. Within a group, changes about the same deliverable are kept together under that deliverable's name; changes that belong to the asset itself — the asset record, its initiatives and its milestones — sit above them.

Groups are ordered by significance rather than alphabetically:

1. **RPTI and LKPTI changes** first. These feed the OJK filing directly, so a one-field edit here outranks a large edit elsewhere.
2. **Things added or removed** next — a change of scope, not drift.
3. **Everything else** after that: schedule moves, budget changes, renames, status changes.

Changes with no asset — programmes, strategies, resources, categories, app statuses, decisions, and relationships that span two assets — collect in a **Portfolio-level** group, always last.

Two things the summary does deliberately:

- **Cosmetic changes are left out.** Programme, strategy and app-status colours, and category ordering, are real changes but tell you nothing about the plan. They stay in **All changes**. If a comparison turns out to contain *only* cosmetic changes, the summary says so and reports how many it hid, rather than looking empty.
- **An added or removed asset is stated once.** If a whole asset was deleted, its group says so with a count of what went with it ("Went with it: 2 initiatives, 3 deliverables, 6 segments") instead of repeating the same fact on every child. The individual rows are still in **All changes**.

### All changes — the full audit trail

The complete breakdown by entity type. Every type the comparison covers gets a section, and sections with nothing to report are omitted:

Assets · Programmes · Strategies · Initiatives · Relationships · Milestones · Deliverables · Deliverable Segments · App Statuses · Resources · Categories · Decisions · RPTI · LKPTI

Nothing is filtered here — including the cosmetic changes the summary sets aside. Use this view when you need to account for every field that moved.

The **History Differences** report and the **Difference Report** reached from the Version Manager render the same content — they are two entry points to one comparison, so neither shows anything the other hides.

## Limitations

The diff compares the selected saved version against the live current state only. Comparing two arbitrary saved versions against each other is not supported; save a version immediately after the state you want as "version A", then compare from there.

If a version fails to load — for example because its IndexedDB record was removed outside the app — an error message is shown in place of the report. Saving a new version and retrying will resolve the issue.

## Decisions in this span

Every difference report opens with **Decisions in this span** — the entries from your
[decision log](../13-decisions/recording-a-decision.md) that explain the changes being shown.

A decision appears there if either:

- it is **linked to one of the two versions** being compared (for example, recorded from the save dialog), or
- it was **recorded between the two versions' timestamps**.

Both rules apply, so a decision written weeks later about an earlier change still shows up as long
as it was linked, and a decision nobody linked still shows up if it falls in the period.

If nothing matches, the report says so explicitly rather than staying silent. That is deliberate:
a set of changes with no recorded reasoning is worth noticing, not worth hiding.

---

- Previous: [Saving a Version](saving-a-version.md)
- Next: [Restoring a Version](restoring-a-version.md)
