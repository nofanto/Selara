# AI Agent Use Case: Capacity / Budget Query (Design Notes)

> **Status:** Idea — not yet started. No design discussion has happened yet; this is a placeholder capturing the idea so it isn't lost, per the brainstorm in issue-#9's follow-up conversation about read-only AI agent capabilities for Selara.
> **Context:** Part of a family of read-only agent use cases (alongside [Filing Readiness Check](agent-filing-readiness-check.md), [Decision Log Q&A](agent-decision-log-qa.md), and [Version Diff Narrative](agent-version-diff-narrative.md)).

## The idea

Let an agent answer ad hoc natural-language questions like "is anyone overbooked in Q3" or "what's our CapEx by programme this year" — grounded in the same computed data Selara's existing Capacity Report and Budget Report already produce, not re-derived from raw entities by the agent itself.

## Why this, specifically

Both reports already do the real work (resource allocation across the timeline; spend breakdown by programme/strategy/category). The gap is that today a user has to open the report, pick the right grouping/filter, and read it themselves — an agent that can take a free-form question and route it through the same computation removes that manual step without introducing any new business logic to get wrong.

## Questions to resolve before a real Step 0 design discussion

- **Question shape:** a fixed set of supported question templates (fixed = predictable, but narrow), or open-ended natural-language querying over the reports' computed output (more flexible, harder to guarantee correctness of the *routing*, i.e. the agent picking the right filter/grouping)?
- **Time-range parsing:** "this year," "Q3," "next quarter" need to resolve against `TimelineSettings`' configured date window and the workspace's actual data — worth deciding whether the agent gets a pre-resolved date range or has to interpret relative time itself.
- **Currency:** since [ADR-0006](../docs/adr/0006-rpti-auto-fill-and-single-currency.md) made currency a single workspace-wide setting (no per-row currency or FX conversion), a budget query is at least simpler than it would've been — but worth confirming that's still a safe assumption for whatever this feature ends up doing (e.g. comparing figures across differently-configured workspaces, if that's ever in scope).
- **Exposure mechanism:** MCP tools that mirror the existing report computations 1:1 (`getCapacityReport`, `getBudgetReport`-shaped), or a more general query interface?

## Next step

None yet — this needs its own Step 0 design discussion (per `CLAUDE.md`) once prioritized against the other open issues (#5, #9, #10) and the other agent-use-case placeholders above. No code decisions have been made.
