# Specification Quality Checklist: Report Year and Report-Row Field Ownership

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-18
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
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
- [ ] No implementation details leak into specification

## Notes

**Resolved since the first draft.** The original FR-001 and FR-009 markers are answered: the
report year is asked when a return is generated from the Reports menu, never stored on a row and
never taken from the clock, and generation is the inverse of import. The LKPTI gets the same
treatment, with its year meaning *as at 31 December* — which changes which applications qualify
rather than filtering stored rows.

**FR-026 resolved: no in-app reference record.** Confirming a generated return matches the filed
one is the preparer's own comparison against the file they still hold. The product owner's call,
and a reasonable one — the imported file does not stop existing when it is imported.

Two consequences recorded in the spec rather than left implicit:

- The *guarantee* is enforced by SC-001 as an automated check, not by the preparer. The manual
  comparison confirms it for their particular data; it is not the only thing standing between a
  lost field and a wrong filing.
- Manual comparison does not scale evenly. Thirteen rows is a glance; 240 rows across fifteen
  columns is roughly 3,600 cells. That is why FR-024 and FR-027 matter — whatever the tool can
  detect it must say loudly, precisely because the backstop is a person reading two
  spreadsheets.

**"No implementation details leak" is marked incomplete deliberately.** Several requirements
name concrete fields (`platform`, `dcProvider`, `Keterangan`) and two cite issue numbers for
mechanism (#42's field-by-field diff). These are not implementation leakage in the usual sense
— they are the regulatory vocabulary of the two OJK returns and the reason a requirement exists
at all. Stating FR-011 without naming the fields would make it untestable. Recorded here rather
than silently rewritten into vagueness.

Everything else passes.
