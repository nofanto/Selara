# AI Agent Use Case: Decision Log Q&A (Design Notes)

> **Status:** Idea — not yet started. No design discussion has happened yet; this is a placeholder capturing the idea so it isn't lost, per the brainstorm in issue-#9's follow-up conversation about read-only AI agent capabilities for Selara.
> **Context:** Part of a family of read-only agent use cases (alongside [Filing Readiness Check](agent-filing-readiness-check.md), [Version Diff Narrative](agent-version-diff-narrative.md), and [Capacity/Budget Query](agent-capacity-budget-query.md)).

## The idea

Let an agent answer questions like "why did we decide to do X" or "what's the current status of the Y decision" by reading Selara's existing in-app portfolio decision log ([ADR-0002](../docs/adr/0002-in-app-decision-log.md)) — the `Decision` entity already stores `context`, `consideredOptions`, `decisionOutcome`, `consequences`, `status`, and an optional `supersededBy` chain, plus an optional link to the `Initiative`/`Programme`/`Asset` it's about.

## Why this, specifically

This is retrieval Selara can do that a plain spreadsheet fundamentally can't — the decision log already captures the *why*, not just the *what*, matching `CLAUDE.md`'s own philosophy point 4 ("rejected alternatives are as valuable as decisions"). An agent that can answer "why was the X approach rejected for this initiative" turns a record that today only gets read if someone happens to open the right decision manually into something actually queryable.

## Questions to resolve before a real Step 0 design discussion

- **Retrieval shape:** is this pure lookup (agent reads one or a few `Decision` records verbatim and answers), or does it need to summarize/reason across many decisions at once (e.g. "what decisions have we reversed this year")?
- **`supersededBy` chains:** should the agent automatically follow and explain a chain of superseding decisions, or only ever answer about the current one unless asked?
- **Linking to portfolio context:** a `Decision` can optionally link to an `Initiative`/`Programme`/`Asset` (`linkedEntityType`/`linkedEntityId`). Should answering "why did initiative A change" also search decisions *linked* to A, or only decisions that mention it in free text?
- **No-match handling:** what should the agent say when no decision record actually explains something — Selara has no requirement that every change be logged as a `Decision`, so absence isn't proof nothing happened.
- **Exposure mechanism:** MCP read tool over the `decisions` store, or something richer (semantic search once decision volume grows)?

## Next step

None yet — this needs its own Step 0 design discussion (per `CLAUDE.md`) once prioritized against the other open issues (#5, #9, #10) and the other agent-use-case placeholders above. No code or schema decisions have been made.
