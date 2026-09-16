# Specification Quality Checklist: OJK-First Onboarding and RPTI Return Import

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-13
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain — all three resolved 2026-09-14
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

Three clarifications remain, all of the same kind: the Format 3.1 layout carries **less
information than Selara's data model needs**, and no default can be inferred from the file itself.

- **FR-010** — a return has one row per planned item; Selara groups planned work into initiatives,
  and `RptiDetail.initiativeId` is not optional. Something must decide the grouping.
- **FR-011** — the return states a planned implementation *quarter* with no year and no dates.
  Imported work has to occupy some period, and "new" versus "upgrade" may warrant different
  placement.
- **FR-012** — the 13-column layout has **no year column at all**, yet an RPTI is a plan *for a
  year*, and generation is year-scoped.

These were genuine gaps in the source data rather than under-specification of the feature, which is
why they went to the product owner rather than being filled with reasonable defaults. Per the
project constitution (Principle II, *Nothing Ambiguous Gets Built Silently*) they were settled
before planning rather than guessed at in implementation.

**Resolved 2026-09-14:**

- **FR-010** — one piece of planned work per row. Rows are individually costed and individually
  timed, so grouping them would discard filed data. Timeline density is a presentation problem,
  not a reason to lose per-row CapEx/OpEx.
- **FR-011 / FR-011a** — pre-launch period ending at the close of the stated quarter, then live
  from that point; a row filed as an *upgrade* additionally carries a preceding live period,
  because an upgrade targets something already running. Both derive from a column the return
  already carries rather than from an invented distinction.
- **FR-012** — the reporting year is asked for at import and never guessed. The layout carries no
  year, and every imported row's timing depends on it.

All checklist items pass. Ready for `/speckit-plan`.

## Revision 2026-09-14 — onboarding flow settled

Asking "what will the user actually see?" surfaced two gaps the first draft had missed, both now
closed:

- **Demo data would have become unreachable.** It is reachable today only through the technology-
  catalogue card this feature removes, which would have violated SC-006. Now FR-003: it is offered
  as a way of starting empty.
- **Two returns, but the spec allowed only two starting choices.** Resolved as one "start from your
  filed returns" path with two labelled slots rather than one detect-anything upload — which keeps
  the required/optional distinction visible and validates the right format per slot.

Also settled, changing the shape materially:

- **LKPTI required, RPTI optional**, LKPTI processed first so the plan is read against a known
  inventory.
- **A reporting year per return, and they may differ.** An inventory *as at* 2026 beside a plan
  *for* 2027 is the normal pairing, not an edge case. Asking once would have been wrong most of the
  time.
- **Onboarding runs once**, for an empty workspace only. Ongoing bulk import is the import/export
  feature's job. This is what keeps judgement-based reconciliation out of the first-run experience.
- **Unresolved upgrade references surface in data health** rather than being guessed at or silently
  duplicated, and onboarding ends on that review.

One consequence recorded rather than solved: a freshly imported workspace is sparse, data health is
already dense on sparse workspaces, and onboarding now ends there. The list will be long. Making it
workable is a known separate concern, not something this feature fixes.


## Revision 2026-09-14 — `/speckit-analyze` findings resolved

Analysis found one CRITICAL and one HIGH issue; both were resolved by a single architectural
principle from the product owner: **imported data is persisted into the workspace itself, not into a
separate import space.**

- **F1 (CRITICAL)** — FR-019 said an unresolved upgrade reference was "reported for review" while
  data-model.md said it surfaced in data health. Those could not both hold, because
  `computeDataHealth` derives from persisted state and FR-019 created nothing. **Resolved**: the row
  *is* imported, with an unresolved `RptiDetail.targetId`, and data health's existing `rpti-target`
  check reports it. No new rule, no new store. T017a now proves that rule covers the import case
  rather than assuming it.
- **F2 (HIGH)** — a partial failure between the two imports was addressed nowhere, and FR-011
  (leave the workspace as it was) contradicted FR-007 (RPTI optional). **Resolved**: each return
  commits on its own success, a failed RPTI leaves a valid LKPTI-only workspace, and recovery is the
  existing start-over mechanism.
- **F3 (MEDIUM)** — the import summary had no test. **Resolved**: T011 now asserts skipped rows are
  listed with position and reason.
- **F4 (LOW)** — FR-006 has no task because it is existing behaviour, already covered by
  `e2e/workspace-templates.spec.ts:146`. No action; recorded so it does not read as an omission.

Two alternatives were considered and rejected for F1, both recorded in data-model.md: creating the
Deliverable anyway and flagging it (silently manufactures an application the bank never filed), and
a separate import-results store (a second home for findings, with its own lifecycle, that would not
survive a reload).
