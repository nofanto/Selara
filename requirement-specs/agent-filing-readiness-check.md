# AI Agent Use Case: Filing Readiness Check (Design Notes)

> **Status:** Idea — not yet started. No design discussion has happened yet; this is a placeholder capturing the idea so it isn't lost, per the brainstorm in issue-#9's follow-up conversation about read-only AI agent capabilities for Selara.
> **Context:** Part of a family of read-only agent use cases (alongside [Decision Log Q&A](agent-decision-log-qa.md), [Version Diff Narrative](agent-version-diff-narrative.md), and [Capacity/Budget Query](agent-capacity-budget-query.md)) chosen deliberately over write access — an agent silently misclassifying or auto-filing a wrong regulatory row is the exact failure mode `CLAUDE.md`'s philosophy and [ADR-0009](../docs/adr/0009-rpti-status-allow-list.md) exist to prevent, so read-only analysis is the safer starting point.

## The idea

Let an agent answer "is this quarter's RPTI/LKPTI export actually ready to file?" — walking every generated/manual row against the schema's own validation rules (`rpti-schema.md`, `lkpti-schema.md`) before the user finds out about a problem at export time or, worse, after filing with the regulator.

## Why this, specifically

Both report schemas already encode validation rules the app doesn't currently enforce proactively (e.g. LKPTI's rule 5.3 — `go_live_date` must not be in the future relative to the reporting period end date). Today a user only discovers a violation by reading the exported spreadsheet closely or having OJK reject the filing. A readiness check surfaces that before export, which is a real correctness win in the exact area (`docs` philosophy point 1) this codebase treats as highest-stakes.

## Questions to resolve before a real Step 0 design discussion

- **Scope:** RPTI only, LKPTI only, or both — the two reports have different validation rules and different generation triggers (year-scoped vs. point-in-time).
- **Relationship to issue #10** (data completeness report — dangling references, report-generation gaps): is a filing-readiness check a specialization of that report, a separate feature that reuses its detection logic, or fully independent? Issue #10 hasn't had its own Step 0 design discussion yet either.
- **What counts as "ready":** schema field-validation only (values present, in range, correctly formatted), or does it also include completeness (every live/qualifying Deliverable actually has a row at all — the generation rule's own precondition)?
- **Exposure mechanism:** a pure function in `src/lib/` callable from both the existing UI (a "Check before export" button) and an agent (via MCP), or agent-only?
- **Where "impact" ends:** does the check just list violations, or also suggest fixes (e.g. "this row's go-live date is in the future — did you mean to exclude it from this filing period")?

## Next step

None yet — this needs its own Step 0 design discussion (per `CLAUDE.md`) once prioritized against the other open issues (#5, #9, #10) and the other agent-use-case placeholders above. No code, schema, or UI decisions have been made.
