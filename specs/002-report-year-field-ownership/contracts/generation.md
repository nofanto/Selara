# Contract: Year-Scoped Generation

The interfaces this feature exposes. Each numbered item is a property a test can hold.

## `generateRptiDetails(input, reportYear)`

Unchanged in shape — it already takes the year. What changes is who supplies it and what the
caller does with the result.

1. **The year is always supplied by a person's answer**, directly or as a default they saw and
   accepted. No caller may pass `new Date().getFullYear()` as a silent fallback.
2. **Output is a function of `(workspace, reportYear)` only.** Same inputs, same rows. Already
   true; must stay true, because it is what makes a return reproducible.
3. **Generating does not mutate the workspace.** Reports derives a transient result for display
   and export; no Data Manager generation path remains.
4. **`remarks` comes from the initiative**, not from a stored row, and must appear in the
   generated output for every row whose initiative carries one.
5. **`ppjtiRelatedParty` comes from the deliverable.** The derived `'n/a'` for a non-PPJTI
   developer is unchanged; the stored answer is used when the developer is PPJTI.

## `generateLkptiDetails(input, asAtDate)`

Gains a parameter. This is the behavioural change of the feature.

6. **An application is in the return when a live segment spans the as-at date** — `startDate <=
   asAt && endDate >= asAt`. Not "has ever gone live".
7. **A decommissioned application is absent.** One whose live period ended before the as-at date
   does not appear, whatever else exists on it.
8. **An application not yet live at the as-at date is absent**, preserving the rule that a future
   `go_live_date` is never emitted (OJK rule 5.3, and the reason `lkpti-golive-future` exists).
9. **The eight attributes are read from the deliverable**, and appear in the output identically
   to how they appear today when read from the stored row.
10. **Omitting `asAtDate` is not permitted.** There is no "today" default — the absence of a year
    is a question to ask, not a value to assume.

## Round trip

11. **Import then generate reproduces the return.** For every row a workspace can reproduce,
    every value the imported return supplied appears in the generated one, unchanged.
12. **What cannot be reproduced is named before a file is produced** — never silently absent.
13. **Repairing what data health flags is sufficient** to make (11) hold for the flagged row. No
    value the return already supplied may need re-keying.

## Attribute lift (deferred-migration safety)

14. **A workspace whose attributes sit on stored rows has them lifted onto deliverables on load**,
    before any generation can replace those rows.
15. **The lift is idempotent.** Running it twice changes nothing after the first.
16. **The lift never overwrites a value already on the deliverable.** Where both hold a value, the
    deliverable wins — it is the newer home and the one the preparer edits.
17. **The lift leaves the orphaned properties in place.** It does not delete them from the stored
    row, so a later migration tool can still find them.

## Version history

18. **Every field added by this feature is reported by the difference report when it changes.**
    `compareEntities` compares only fields named in its `getChanges` callback, so each addition
    needs an explicit line — see [#42](https://github.com/nofanto/Selara/issues/42).

## What must not change

19. **Both returns preserve their pre-existing filed values** for the same workspace, with the
    single intended exception of (7): a decommissioned application correctly leaving the LKPTI.
    Each post-feature export additionally states the selected year; byte identity with a
    pre-feature export is not a contract.
20. **Both Data Manager report tabs remain present and populated but read-only**, with no Generate
    action. The editable sources are Deliverables and Initiatives; Reports is the only generation
    and export path (FR-021).
21. **The workspace export/import round trip carries the new fields** with no change to
    `excel.ts` — `flatten()` is generic. Asserted, not assumed.
