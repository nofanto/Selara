# AI Agent Use Case: Version Diff Narrative (Design Notes)

> **Status:** **Superseded for its deterministic content** by [`diff-summary.md`](diff-summary.md) (decided 2026-09-02), which takes the regrouping, noise-filtering and significance-ranking work. What remains here is only the language layer on top, still an idea with no design discussion behind it and no exposure mechanism chosen.
> **Context:** Part of a family of read-only agent use cases (alongside [Filing Readiness Check](agent-filing-readiness-check.md), [Decision Log Q&A](agent-decision-log-qa.md), and [Capacity/Budget Query](agent-capacity-budget-query.md)).
> **Last refreshed:** 2026-09-02.

## What this doc proposed, and what happened to it

The original idea: let an agent answer "what changed since \<a saved version\>?" in plain English, instead of the user reading the raw History Diff Report themselves.

A Step 0 discussion on 2026-09-02 established that **most of the value isn't a language task.** What actually makes the existing report hard to read as a catch-up summary is its *axis* — `DiffResult` is keyed by entity type, so a single story ("Core Banking slipped a quarter, its mobile app went live, its LKPTI go-live date got filled in") is scattered across four sections and reassembled by the reader. Regrouping by asset, dropping cosmetic churn, and ranking filing-relevant edits first are all deterministic operations over data Selara already computes.

So that work became [`diff-summary.md`](diff-summary.md), now tracked as [issue #18](https://github.com/nofanto/Selara/issues/18) — a tested pure function in `src/lib/`, no agent involved. The full decision record, including the entity-graph finding that forced the asset-primary pivot and the `EntityDiff` id prerequisite, lives there.

This is the second placeholder in this family to split that way; [Filing Readiness Check](agent-filing-readiness-check.md) did the same when its rule engine became Data Health phase 2 ([issue #16](https://github.com/nofanto/Selara/issues/16)). Worth treating as a filter for anything else added here: **ask what's left once the deterministic part is removed.**

## What's actually left here

A language layer that turns the grouped, ranked summary into prose — connecting related changes across an asset into a sentence, and pitching the register for a stakeholder rather than an auditor. Same shape as what remains of [Filing Readiness Check](agent-filing-readiness-check.md): narration over deterministic, already-correct structured data, where the agent never reproduces the computation itself.

## The blocker, if this is ever picked up

**Selara has no agent surface at all.** No MCP, no LLM, no AI dependency in `package.json` or `src/`, and no backend of its own — it is a client-side React app whose data lives in the browser's IndexedDB (`src/lib/db.ts`). The "expose a read tool via MCP" assumption shared by all four placeholders in this family has nowhere to live: an MCP server runs on a machine and cannot reach a browser's IndexedDB.

That makes the first question architectural, and it is sharpened by what the data is — a bank's IT portfolio, feeding an OJK filing. Options considered on 2026-09-02, **decision explicitly deferred** until narration is actually prioritised:

| Option | Cost | The catch |
|---|---|---|
| **Export-mediated (BYO agent)** — a "copy summary as JSON/Markdown" button; the user pastes it into an agent they already trust | An afternoon | Not really an in-app feature. But Selara makes no privacy decision on the bank's behalf — the user makes it, per use |
| **In-app, user-supplied API key** | Moderate | Key sits in IndexedDB; portfolio data leaves the device to a third party; browser-side key exposure |
| **Backend-proxied** | Large | Direct conflict with [issue #5](https://github.com/nofanto/Selara/issues/5), which is deliberately building a backend that *cannot read* the data. A narration backend must |
| **Local in-browser model** (WebLLM/WebGPU) | Large | Privacy fully preserved, but heavy, and narration quality over a domain-specific diff is unproven |

This is a regulatory judgment, not an engineering one, and it is common to all four use cases in this family — worth deciding once, for all of them, rather than per feature.

## Questions if this is ever picked up

- **Does it earn its keep?** The same honest question [Filing Readiness Check](agent-filing-readiness-check.md) asks. Once `summarizeDiff` has grouped by asset, filtered noise and ranked by significance, the marginal value of prose over that list is genuinely unclear. Decide against the real output, not in the abstract.
- **Grounding:** the narrator receives the grouped summary as structured data and describes only what it contains — never raw entity dumps to diff itself. `computeDiff` existing argues strongly for this, and `summarizeDiff` more strongly still.
- **Which two points in time:** versions are named snapshots with no report-period metadata, so "since last quarter" has no convention to resolve against. Simplest answer is to list available versions and let the user pick.

## Resolved since the last refresh

- **"Current-state asymmetry" — not a blocker.** The earlier draft claimed comparing two saved versions would require a signature change. It doesn't: `computeDiff(baseVersion: Version, currentData: Version['data'])` types its second parameter as `Version['data']`, not as the live workspace, so `computeDiff(v3, v5.data)` works today. Both existing callers happen to pass live data and `VersionManager.tsx` hardcodes a "Current State / Today" label, but that is a UI assumption, not a computation one.

## Next step

None. [Issue #18](https://github.com/nofanto/Selara/issues/18), specified by [`diff-summary.md`](diff-summary.md), is the tracked work; this narration layer stays an unprioritised idea pending the architecture decision above. Of the issues these placeholders were originally weighed against, [#9](https://github.com/nofanto/Selara/issues/9) (LKPTI import) and [#10](https://github.com/nofanto/Selara/issues/10) (data completeness report) have shipped, as has [#13](https://github.com/nofanto/Selara/issues/13) (cross-tab sync); the open issues are [#18](https://github.com/nofanto/Selara/issues/18) (version diff consolidation + summary), [#16](https://github.com/nofanto/Selara/issues/16) (Data Health phase 2, PR #17) and [#5](https://github.com/nofanto/Selara/issues/5) (zero-knowledge share backend, PR #15).
