# AI Agent Use Case: Filing Readiness Check (Design Notes)

> **Closed as a feature direction** (2026-09-02) — see [`agent-exposure-architecture.md`](agent-exposure-architecture.md) for the architectural blocker common to all four of these, the routes considered, and why the family is closed rather than parked. Retained as a discovery record: this idea's audit produced real work, listed below.
> **Discovery outcome:** the rule engine became Data Health phase 2 — [issue #16](https://github.com/nofanto/Selara/issues/16), **shipped**.

> **Status:** **Superseded for its rule-engine content** by [issue #16](https://github.com/nofanto/Selara/issues/16) — Data Health phase 2 (decided 2026-09-02), whose design record is the "Phase 2 — Validity checks" section of [`data-completeness-report.md`](data-completeness-report.md). What remains here is only the agent-facing narration layer, which is still an idea with no design discussion behind it.
> **Context:** Part of a family of read-only agent use cases (alongside [Decision Log Q&A](agent-decision-log-qa.md), [Version Diff Narrative](agent-version-diff-narrative.md), and [Capacity/Budget Query](agent-capacity-budget-query.md)).

## What this doc proposed, and what happened to it

The original idea: let an agent answer "is this quarter's RPTI/LKPTI export actually ready to file?" by walking every row against the schemas' own validation rules before the user finds out at export time — or after OJK rejects the filing.

Refining it in September 2026 established that **the valuable part isn't an agent feature at all.** Two findings drove that:

1. **The check is deterministic.** Every rule worth enforcing (`go_live_date` format and future-dating, the §6 length caps, line breaks in flat-table cells, application-name uniqueness) is a pure function over `AppState`. Encoding a regulatory rule in a prompt rather than in tested code is precisely the failure mode `CLAUDE.md` philosophy point 1 and [ADR-0009](../docs/adr/0009-rpti-status-allow-list.md) exist to prevent.
2. **It belongs to an existing feature.** The shipped [Data Completeness Report](data-completeness-report.md) already checks *presence* (`!l[f.key]`) but never *validity*, and validity sits naturally downstream of presence. Once the reporting-period parameter was dropped (evaluate "not in the future" against today), nothing about the check was filing-specific enough to need its own home.

So the rule engine became **phase 2 of the data health report**, not a separate agent-facing report. The full decision record — the check list, the phase-as-classification decision, the rules deliberately *not* checked and why, the workspace-level RPTI currency finding — lives in [`data-completeness-report.md`](data-completeness-report.md).

## What's actually left here

A much smaller idea: an agent that **narrates and triages** phase 2's output. Given a list of `HealthIssue`s, answer "what do I need to fix before filing, and in what order" in prose — grouping related violations, distinguishing a systemic problem (nobody has ever filled in `platform`) from a one-off (one malformed date), and explaining *why* a given rule exists.

This is the same shape as [Version Diff Narrative](agent-version-diff-narrative.md): a language layer over deterministic, already-correct structured data, where the agent is never asked to reproduce the computation itself.

## Questions if this is ever picked up

- **Does it earn its keep?** Phase 2's `message` strings are already written to be human-readable, and the report already groups by phase and severity. The marginal value of a narration layer over a well-designed list is genuinely unclear — worth being honest about that before building.
- **Exposure mechanism:** an MCP read tool returning `HealthIssue[]` for the agent to narrate, versus a pre-grouping function that summarizes first.
- **Grounding:** the agent must describe only what the issue list contains, and must never assert a row is *compliant* — absence of a detected violation isn't proof of compliance, since several rules (§5.4, §5.5, §5.6) are deliberately not mechanically checked.

## Next step

None. Phase 2 is the tracked work; this narration layer stays an unprioritized idea. Of the issues these placeholders were originally weighed against, [#9](https://github.com/nofanto/Selara/issues/9) (LKPTI import) and [#10](https://github.com/nofanto/Selara/issues/10) (data completeness report) have shipped, as has [#13](https://github.com/nofanto/Selara/issues/13) (cross-tab sync); the only other open issue is [#5](https://github.com/nofanto/Selara/issues/5) (zero-knowledge share backend, PR #15).
