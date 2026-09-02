# AI Agent Use Case: Capacity / Budget Query (Design Notes)

> **Closed as a feature direction** (2026-09-02) — see [`agent-exposure-architecture.md`](agent-exposure-architecture.md) for the architectural blocker common to all four of these, the routes considered, and why the family is closed rather than parked. Retained as a discovery record: this idea's audit produced real work, listed below.
> **Discovery outcome:** the audit found the Capacity Report does not compute capacity (no date-overlap analysis) and the data model has no capacity attribute at all — no FTE, effort or allocation on `Resource` or `Initiative`. What "capacity" should mean is now the one open domain question, recorded in [`agent-exposure-architecture.md`](agent-exposure-architecture.md).

> **Status:** Idea — not yet started, and the furthest from ready of the four (see "What the codebase already provides" below). No design discussion has happened yet; this is a placeholder capturing the idea so it isn't lost, per the brainstorm in issue-#9's follow-up conversation about read-only AI agent capabilities for Selara.
> **Context:** Part of a family of read-only agent use cases (alongside [Filing Readiness Check](agent-filing-readiness-check.md), [Decision Log Q&A](agent-decision-log-qa.md), and [Version Diff Narrative](agent-version-diff-narrative.md)).
> **Last refreshed:** 2026-09-02.

## The idea

Let an agent answer ad hoc natural-language questions like "is anyone overbooked in Q3" or "what's our CapEx by programme this year" — grounded in the same computed data Selara's existing Capacity Report and Budget Report already produce, not re-derived from raw entities by the agent itself.

## Why this, specifically

Both reports already do the real work (resource allocation across the timeline; spend breakdown by programme/strategy/category). The gap is that today a user has to open the report, pick the right grouping/filter, and read it themselves — an agent that can take a free-form question and route it through the same computation removes that manual step without introducing any new business logic to get wrong.

## What the codebase already provides

Less than the premise above assumes, and this is the main thing the refresh turned up. Unlike `computeDiff` (`src/lib/diff.ts`) and `computeDataHealth` (`src/lib/dataHealth.ts`), **the Budget and Capacity computations are not extracted pure functions** — they're computed inline inside `src/components/ReportsView.tsx`'s render path (`byProgramme`/`byStrategy`/`byCategory` and the capacity aggregation), interleaved with the JSX that displays them.

So "grounded in the same computed data the reports already produce" isn't reusable as stated: it first requires lifting those computations into `src/lib/` behind a tested pure function, the way `computeDataHealth` was built. That's a prerequisite refactor with its own regression risk against the existing report UI — worth pricing into any prioritization of this use case, and worth doing on its own merits regardless of whether the agent feature ever ships.

## Questions to resolve before a real Step 0 design discussion

- **Extraction first?** Does this use case start with the `ReportsView` → `src/lib/` refactor as a separate, independently valuable piece of work, or does it stay blocked until someone wants both?
- **Question shape:** a fixed set of supported question templates (fixed = predictable, but narrow), or open-ended natural-language querying over the reports' computed output (more flexible, harder to guarantee correctness of the *routing*, i.e. the agent picking the right filter/grouping)?
- **Time-range parsing:** "this year," "Q3," "next quarter" need to resolve against `TimelineSettings`' configured date window and the workspace's actual data — worth deciding whether the agent gets a pre-resolved date range or has to interpret relative time itself.
- **Currency:** since [ADR-0006](../docs/adr/0006-rpti-auto-fill-and-single-currency.md) made currency a single workspace-wide setting (no per-row currency or FX conversion), a budget query is at least simpler than it would've been — but worth confirming that's still a safe assumption for whatever this feature ends up doing (e.g. comparing figures across differently-configured workspaces, if that's ever in scope).
- **Exposure mechanism:** MCP tools that mirror the existing report computations 1:1 (`getCapacityReport`, `getBudgetReport`-shaped), or a more general query interface?

## Next step

None yet — this needs its own Step 0 design discussion (per `CLAUDE.md`) once prioritized, and carries the extraction prerequisite above on top of that. Of the issues these placeholders were originally weighed against, [#9](https://github.com/nofanto/Selara/issues/9) (LKPTI import) and [#10](https://github.com/nofanto/Selara/issues/10) (data completeness report) have since shipped, as has [#13](https://github.com/nofanto/Selara/issues/13) (cross-tab sync); the only open issue is [#5](https://github.com/nofanto/Selara/issues/5) (zero-knowledge share backend, PR #15). No code decisions have been made.
