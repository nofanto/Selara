# AI Agent Use Case: Version Diff Narrative (Design Notes)

> **Status:** Idea — not yet started. No design discussion has happened yet; this is a placeholder capturing the idea so it isn't lost, per the brainstorm in issue-#9's follow-up conversation about read-only AI agent capabilities for Selara.
> **Context:** Part of a family of read-only agent use cases (alongside [Filing Readiness Check](agent-filing-readiness-check.md), [Decision Log Q&A](agent-decision-log-qa.md), and [Capacity/Budget Query](agent-capacity-budget-query.md)).
> **Last refreshed:** 2026-09-02.

## The idea

Let an agent answer "what changed since \<a saved version\>?" in plain English, instead of the user reading the raw History Diff Report themselves. Selara already computes a structured diff between two saved `Version` snapshots for that report — the narrative layer would sit on top of that existing computation, not replace it.

## Why this, specifically

The raw diff report is comprehensive but field-level — useful for an audit trail, less useful as a quick "catch me up" summary for a stakeholder who wants "what actually changed" grouped by initiative/deliverable rather than by raw field. An agent turning that structured diff into a short narrative is a natural language-model task sitting on top of deterministic, already-correct data — low risk, since the underlying diff computation isn't something the agent is being asked to reproduce itself.

## What the codebase already provides

`computeDiff(baseVersion, currentData): DiffResult` in `src/lib/diff.ts` — already a pure function in `src/lib/` with a structured return type, so the "grounding" option below is available today with no extraction work. Of the four placeholders, this is the one whose foundation is most ready to build on.

## Questions to resolve before a real Step 0 design discussion

- **Which two points in time by default:** "since last quarter" implies some convention for quarter-tagged versions, which doesn't exist today — versions are just named snapshots with no report-period metadata. Does this feature require adding that convention, or does the agent just ask the user (or list available versions) each time?
- **Current-state asymmetry:** `computeDiff` compares a saved `Version` against *current* data, not two saved versions against each other. If "what changed between v3 and v5" is in scope, that's a signature change, not just a narration layer.
- **Granularity/noise filtering:** a full diff between two snapshots months apart could be large. Does the narrative need to group/prioritize (e.g. "3 initiatives rescheduled, 1 deliverable went live" ahead of minor field tweaks), and if so, by what rule?
- **Grounding vs. hallucination risk:** the narrative should describe only what the structured diff actually contains — worth deciding upfront whether the agent gets `DiffResult` as pre-computed structured data (safer) or raw before/after entity dumps it has to diff itself (more flexible, more error-prone). The existence of `computeDiff` argues strongly for the former.
- **Exposure mechanism:** a read tool that returns `DiffResult` for the agent to narrate, or a new pure function that pre-groups/summarizes before handing off?

## Next step

None yet — this needs its own Step 0 design discussion (per `CLAUDE.md`) once prioritized. Of the issues these placeholders were originally weighed against, [#9](https://github.com/nofanto/Selara/issues/9) (LKPTI import) and [#10](https://github.com/nofanto/Selara/issues/10) (data completeness report) have since shipped, as has [#13](https://github.com/nofanto/Selara/issues/13) (cross-tab sync); the only open issue is [#5](https://github.com/nofanto/Selara/issues/5) (zero-knowledge share backend, PR #15). No code decisions have been made.
