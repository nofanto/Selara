# Contract: Year-Scoped Generation

The interfaces this feature exposes. Each numbered item is a property a test can hold.

## `projectRptiReturn(input, reportYear)`

*(Renamed from `generateRptiDetails` per Q11 of `requirement-specs/report-rows-as-projections.md`:
the old signature carried an optional `existingDetails`, and one caller used it — a 2027 plan line
appeared inside a 2026 filing. The input type now cannot name stored rows at all.)*

1. **The year is always supplied by a person's answer**, directly or as a default they saw and
   accepted. No caller may pass `new Date().getFullYear()` as a silent fallback.
2. **Output is a function of the canonical planning entities and `reportYear` only.** Stored
   report rows are not an input and cannot become members of the return; passing them is a
   compile error, asserted with `@ts-expect-error`, not merely discouraged.
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

14. **A workspace whose attributes sit on stored rows has them lifted before entering live state**
    through ordinary IndexedDB load, shared-workspace load, generic workbook import, or version
    restore, before any generation can replace those rows. Each entry path persists the lifted
    form immediately, folding it into an existing save where one already occurs. Cross-tab sync
    does not repeat the lift: it reads IndexedDB only after the writing tab has lifted and saved.
    An exported workbook beyond Selara's reach is lifted when it is re-imported.
15. **The lift is idempotent.** Running it twice changes nothing after the first.
16. **The lift never overwrites a value already on the deliverable.** Where both hold a value, the
    deliverable wins — it is the newer home and the one the preparer edits.
17. **The lift leaves non-cost orphaned properties in place, but removes legacy cost overrides.**
    `capexAmount`/`opexAmount` are deleted after their one-time lift and the cleaned rows are
    persisted; their absence is the durable completion signal that prevents a later reload from
    overwriting a newer Initiative cost. Other legacy properties remain available to later tooling.

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

## `reconcileRptiReturn(input)` — stored rows are evidence, not output (Q11)

22. **It returns findings, not rows.** Each finding carries a reason code, a message naming a
    source-side repair, and the stored row as evidence. Nothing of its output may be concatenated
    into a return or an export.
23. **The two axes stay independent.** A stored row reproducible in some year other than the
    selected one produces **no** finding — absence from the selected year is correct, not a
    defect. A row corresponds to a current canonical row by exact identity, by the same surviving
    Initiative after an explicit target repair, or by the same surviving target after an Initiative
    repair. Correspondence is one-to-one: multiple stored rows cannot claim one generated row.
24. **Global is the honest scope.** `RptiDetail` has no report year and none may be inferred
    (quarter, id suffix, segment link), so findings are stated per workspace, not per year: an
    unreproducible row blocks every year's export. Exact selected-year attribution is deferred to
    option 5 (see `merge-path-options.md`); no anchor may be invented to fake it.
25. **Reconciliation is read-only.** It never mutates the stored rows or the entities, asserted
    by a unit test on frozen inputs.

## Export and LKPTI identity evidence (Q12)

26. **Each downloaded workbook states the selected year in a `Report Metadata` worksheet and in
    its filename.** The regulatory data worksheet keeps its exact standard headers and column order,
    so the existing importer remains compatible.
27. **Newly imported LKPTI rows retain the filed application name as identity evidence.** If their
    target id later becomes stale, exactly one same-name Deliverable clears the finding. An older
    orphan without that evidence directs the preparer to re-import; identity is never guessed by
    elimination or report-content equality.
