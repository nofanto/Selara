# AI Agent Use Case: Version Diff Narrative (Design Notes)

> **Status:** Idea — not yet started. No design discussion has happened yet; this is a placeholder capturing the idea so it isn't lost, per the brainstorm in issue-#9's follow-up conversation about read-only AI agent capabilities for Selara.
> **Context:** Part of a family of read-only agent use cases (alongside [Filing Readiness Check](agent-filing-readiness-check.md), [Decision Log Q&A](agent-decision-log-qa.md), and [Capacity/Budget Query](agent-capacity-budget-query.md)).

## The idea

Let an agent answer "what changed since \<a saved version\>?" in plain English, instead of the user reading the raw History Diff Report themselves. Selara already computes a structured diff between two saved `Version` snapshots for that report — the narrative layer would sit on top of that existing computation, not replace it.

## Why this, specifically

The raw diff report is comprehensive but field-level — useful for an audit trail, less useful as a quick "catch me up" summary for a stakeholder who wants "what actually changed" grouped by initiative/deliverable rather than by raw field. An agent turning that structured diff into a short narrative is a natural language-model task sitting on top of deterministic, already-correct data — low risk, since the underlying diff computation isn't something the agent is being asked to reproduce itself.

## Questions to resolve before a real Step 0 design discussion

- **Which two points in time by default:** "since last quarter" implies some convention for quarter-tagged versions, which doesn't exist today — versions are just named snapshots with no report-period metadata. Does this feature require adding that convention, or does the agent just ask the user (or list available versions) each time?
- **Granularity/noise filtering:** a full diff between two snapshots months apart could be large. Does the narrative need to group/prioritize (e.g. "3 initiatives rescheduled, 1 deliverable went live" ahead of minor field tweaks), and if so, by what rule?
- **Grounding vs. hallucination risk:** the narrative should describe only what the structured diff actually contains — worth deciding upfront whether the agent gets the diff as pre-computed structured data (safer) or raw before/after entity dumps it has to diff itself (more flexible, more error-prone).
- **Exposure mechanism:** a read tool that returns the existing diff structure for the agent to narrate, or a new pure function that pre-groups/summarizes before handing off?

## Next step

None yet — this needs its own Step 0 design discussion (per `CLAUDE.md`) once prioritized against the other open issues (#5, #9, #10) and the other agent-use-case placeholders above. No code decisions have been made.
