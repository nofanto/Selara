# User Story 27: Repair an Unresolved Imported RPTI Row from Its Finding

## Story

> **As** a preparer reviewing an imported RPTI filing,
> **I want** to resolve an unmatched filed upgrade from its Data Health finding,
> **So that** the workspace can reproduce what was filed without re-keying known values.

## Background and decisions

The stored row remains read-only evidence. The repair changes planning entities in one undoable update. The product rules, alternatives and measured sample mismatch are in [Q22](../../requirement-specs/report-rows-as-projections.md#q22--an-unresolved-row-is-repaired-semi-automatically-from-the-finding-2026-09-25); the full scope is [spec 004](../../specs/004-repair-from-finding/spec.md).

## Acceptance Criteria

### AC1 — Create a missing application

- [x] An unresolved application upgrade finding offers “The bank runs it, but the inventory doesn't list it.” Its form pre-fills the filed category, developer classification, related party, locations, quarter and Keterangan from the stored row; name and year from the initiative name; and cost from the initiative's current budget, clearly labelled for checking.
- [x] For a filed PPJTI developer, the form requires a provider name because the return does not supply one. The quarter and year cannot be edited.
- [x] Confirming creates the application and asset, a continuous live phase beginning in the prior year, and the filed live implementation with its cost and Keterangan. The form says that this also adds the application to the prior year's inventory.
- [x] The initiative moves to the new asset, the finding clears, and the regenerated filed-year RPTI row matches every filed column. Cancel changes nothing; Undo restores the finding in one step.

### AC2 — Resolve to an existing entry

- [x] An unresolved row offers “It's this existing entry.” Suggestions rank likely same-kind matches first, support search, and never select one automatically. Infrastructure rows offer only this option.
- [x] If the selected entry lacks live history before the filed quarter, the form shows the prior live phase it will add. The implementation still files as an upgrade.
- [x] The form compares what the selected entry would file with the stored row for category, developer, related party and locations. For each difference, the preparer chooses whether to update the entry or keep its current value; updating an entry also affects LKPTI.
- [x] Confirming creates the filed implementation, moves the initiative to the selected entry's asset, and clears the finding. Every update or keep choice is reflected in the regenerated return.

### AC3 — Preserve inventory continuity

- [ ] A synthetic prior live phase made during RPTI import keeps an application in each year-end LKPTI inventory through the shared planning horizon, while the imported RPTI remains an upgrade and the prior phase files no row of its own.
- [ ] A legacy one-year importer phase that causes a missing inventory year raises a non-blocking Data Health warning. It extends only on confirmation; a phase the preparer edited is left alone.

## Boundaries

- [x] Repair is offered only for an unanchored `rpti-import-unresolved-*` row, never for a deleted Deliverable's row.
- [x] Confirmation rechecks that the row and initiative are still eligible, and applying twice cannot duplicate the implementation.
- [x] Ordinary Deliverable creation continues to create no lifecycle segment.
