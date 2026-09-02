# AI Agent Use Case: Filing Readiness Check (Design Notes)

> **Status:** Idea — not yet started, but the best-defined of the four after the refresh below. No design discussion has happened yet; this is a placeholder capturing the idea so it isn't lost, per the brainstorm in issue-#9's follow-up conversation about read-only AI agent capabilities for Selara.
> **Context:** Part of a family of read-only agent use cases (alongside [Decision Log Q&A](agent-decision-log-qa.md), [Version Diff Narrative](agent-version-diff-narrative.md), and [Capacity/Budget Query](agent-capacity-budget-query.md)) chosen deliberately over write access — an agent silently misclassifying or auto-filing a wrong regulatory row is the exact failure mode `CLAUDE.md`'s philosophy and [ADR-0009](../docs/adr/0009-rpti-status-allow-list.md) exist to prevent, so read-only analysis is the safer starting point.
> **Last refreshed:** 2026-09-02, against the shipped [Data Completeness Report](data-completeness-report.md).

## The idea

Let an agent answer "is this quarter's RPTI/LKPTI export actually ready to file?" — walking every generated/manual row against the schema's own validation rules (`rpti-schema.md`, `lkpti-schema.md`) before the user finds out about a problem at export time or, worse, after filing with the regulator.

## Why this, specifically

Both report schemas already encode validation rules the app doesn't currently enforce proactively (e.g. LKPTI's rule 5.3 — `go_live_date` must not be in the future relative to the reporting period end date). Today a user only discovers a violation by reading the exported spreadsheet closely or having OJK reject the filing. A readiness check surfaces that before export, which is a real correctness win in the exact area (`CLAUDE.md` philosophy point 1) this codebase treats as highest-stakes.

## What's changed since this was first written

The original draft asked how this relates to issue #10's data completeness report, which "hasn't had its own Step 0 design discussion yet either." It has since had one and shipped — [`data-completeness-report.md`](data-completeness-report.md), `computeDataHealth()` in `src/lib/dataHealth.ts`, [User Story 21](../docs/user-stories/21-data-completeness-report.md). That resolves the relationship question and narrows what's left for this feature:

- **`computeDataHealth` covers presence, not validity.** Its soft checks ask whether a value *resolved at all* — e.g. the LKPTI manual-only field check is a plain `!l[f.key]` falsiness test over `platform`, `database`, `goLiveDate`, and the other seven columns with no auto-fill source. Nothing in it evaluates whether a value that *is* present is actually legal under the schema's rules.
- **So the distinct territory here is value-level rule validation:** format (`^\d{2}-\d{2}-\d{4}$`), range, enum membership, and cross-field/period rules like 5.3's "not in the future relative to the reporting period end date." A row can be 100% clean by `computeDataHealth` and still be rejected by OJK.
- **Completeness is therefore a precondition, not a competitor.** The natural framing is that a filing-readiness check *composes* `computeDataHealth`'s report-scoped subset (don't re-implement the dangling-reference and blank-cell checks) and adds the rule layer on top.

It also settles the exposure question by precedent: `computeDataHealth` is a pure function in `src/lib/` computed live from `AppState` on render, surfaced as a `ReportsView` card with click-to-navigate, and unit-tested (29 tests). That's the pattern to follow rather than re-litigate — and a pure function in `src/lib/` is callable from both a UI button and an MCP tool without deciding between them.

## Questions to resolve before a real Step 0 design discussion

- **Scope:** RPTI only, LKPTI only, or both — the two reports have different validation rules and different generation triggers (year-scoped vs. point-in-time).
- **Reporting period as an input:** rule 5.3 is relative to "the reporting period end date," which isn't a stored concept today. Does the check take a period as a parameter, derive it from the generated report, or need a new field?
- **Composition boundary with `computeDataHealth`:** does readiness re-run it and merge results into one list, or present two sections ("incomplete" vs. "invalid")? They have different fix paths and arguably different urgency.
- **Where "impact" ends:** does the check just list violations, or also suggest fixes (e.g. "this row's go-live date is in the future — did you mean to exclude it from this filing period")?
- **Agent's actual role:** if the rule engine is a deterministic pure function, the agent's contribution is explanation and triage over its output, not the validation itself — worth being explicit about that split before building, so no schema rule ends up living only in a prompt.

## Next step

None yet — this needs its own Step 0 design discussion (per `CLAUDE.md`) once prioritized. Of the issues these placeholders were originally weighed against, [#9](https://github.com/nofanto/Selara/issues/9) (LKPTI import) and [#10](https://github.com/nofanto/Selara/issues/10) (data completeness report) have since shipped, as has [#13](https://github.com/nofanto/Selara/issues/13) (cross-tab sync); the only open issue is [#5](https://github.com/nofanto/Selara/issues/5) (zero-knowledge share backend, PR #15). No code, schema, or UI decisions have been made.
