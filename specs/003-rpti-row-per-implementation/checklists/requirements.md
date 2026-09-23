# Specification Quality Checklist: An RPTI row is one planned implementation, not one initiative

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-19
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain — **Q1, Q2 and Q3 all answered 2026-09-22**
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

**All three clarifications answered on 2026-09-22.** They were recorded in the spec rather than as
inline markers, because each changes what gets filed:

- **Q1 (cost grain)** — **answered: cost on the implementation**, with the initiative's figure
  derived. It reversed Q7, and in doing so reversed Q10 as well: the product owner confirmed that
  one initiative may file for several applications. Both reversals keep Q7's original principle —
  "one piece of work, one budget" — and change only what counts as the piece of work.
- **Q2 (what counts as one implementation)** — **answered: A**, a transition into production.
  Settled by Q16 of the design notes rather than by preference: retirement leaves through the LKPTI,
  so the branch option C existed to serve has nothing left to cover.
- **Q3 (year membership)** — **answered: A**, a row belongs to the year its implementation happens.
  Carries a behaviour change: a workspace filing such a row today will stop, and the release must
  say so rather than let it be discovered.

Everything else passes. The spec deliberately names the four decisions it revises (FR-008 to
FR-011) rather than contradicting them silently, per the constitution's requirement that rejected
and revised alternatives are recorded.

**This spec now reverses two decisions rather than extending them** (FR-008, FR-009). That is a
larger change than it first appeared, and the plan should treat it as such: the multi-target error
must be removed, target inference loses its purpose, and reconciliation's canonical identity moves.

**Two risks worth carrying into planning**, both learned from the previous feature:

1. **The published sample could not exercise this feature before Phase 5** — it held 13 rows across
   13 initiatives, one implementation each. It now holds 14 rows, including two implementations of
   Open API Banking Platform. FR-018 exists because a fixture that pre-satisfies the condition under
   test is how several defects reached review in 002.
2. **Q1 option A reintroduces a two-source value**, which is the exact shape of the silent-overwrite
   defect found in 002 (a stored figure beating a newer canonical edit on every reload). If A is
   chosen, the precedence rule needs a test that fails when the precedence is reversed.
