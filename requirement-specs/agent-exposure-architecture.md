# Read-Only Agent Use Cases: Exposure Architecture and Close-Out — Design Notes

> **Status:** **Decided — closed as a feature direction** (2026-09-02). The four `agent-*.md` placeholders are retained as a discovery record, not as pending work. This doc records the architectural blocker once, so the other four don't each restate it, and explains why the family is closed rather than parked.
> **Context:** Four read-only agent use cases were captured as placeholders during the issue-#9 follow-up conversation: [Filing Readiness Check](agent-filing-readiness-check.md), [Version Diff Narrative](agent-version-diff-narrative.md), [Decision Log Q&A](agent-decision-log-qa.md), and [Capacity/Budget Query](agent-capacity-budget-query.md). All four named "an MCP read tool" as the exposure mechanism. None of them can have one.

## Context and Problem Statement

Every placeholder in the family assumed the same delivery shape: expose Selara's computed data through an MCP read tool, and let an agent answer questions over it. That assumption was never checked against the codebase, and it does not hold.

**An MCP server is a process on a machine. Selara's data is in a browser origin's IndexedDB** (`src/lib/db.ts`, via `idb`). There is no path between them. Selara is a client-side React + Vite app with no backend of its own — the only server it contacts is the inherited Scenia share endpoint in `src/lib/share.ts`, which is someone else's infrastructure and, by design, holds only ciphertext it cannot read.

There is also no AI surface of any kind to extend: no MCP, no LLM client, no model dependency anywhere in `package.json` or `src/`.

So the first question for this family was never "which use case is most valuable" — it was "how would an agent reach the data at all."

## Decided

### 1. The exposure question, answered once

Four routes exist. All were considered on 2026-09-02; none is being taken.

| Route | What it means | Why not |
|---|---|---|
| **Export-mediated** (BYO agent) | User exports a workspace snapshot; their own agent reads the file. Cheapest by far, and Selara makes no privacy decision on the user's behalf | Selara has **no JSON export** — `DataControls` offers Excel, PDF and PNG only. The Excel export is a genuine 15-sheet near-full round-trip, so it is machine-readable, but `.xlsx` is a poor grounding format. Fatally for one use case, it **omits `decisions` entirely** (see §3) |
| **In-app model call**, user-supplied API key | Browser calls a model provider directly | The data is a bank's IT portfolio feeding an OJK filing. Sending it to a third-party API is a security review, not a preference — realistically dead on arrival in the deployment context this product exists for |
| **Backend-proxied** | Selara gains a server that brokers model calls | Direct conflict with [issue #5](https://github.com/nofanto/Selara/issues/5), which is deliberately building a share backend that **cannot read** workspace data. A narration backend must read exactly what that one is designed not to |
| **Local model** (WebLLM/WebGPU) or a **localhost MCP bridge** | Data never leaves the device | Preserves the privacy posture, but both are real infrastructure: a bridge needs the user to run a process plus browser→localhost CORS work; an in-browser model is heavy and its narration quality over domain-specific structured data is unproven |

**Decision: none of the above, because the feature direction itself is being closed (§2).** Recorded here so the question is not re-opened from scratch — if it ever is, export-mediated is the only route compatible with both the local-first architecture and a bank's security posture, and it would require a JSON export as a prerequisite.

### 2. The family is closed as a feature direction, not parked

Four of four placeholders, checked against the code, turned out to have their value in a **deterministic core** rather than in the agent layer:

| Placeholder | What the code check found | Where the value went |
|---|---|---|
| Filing Readiness Check | Every rule worth enforcing is a pure function over `AppState`. Encoding a regulatory rule in a prompt is the failure mode `CLAUDE.md` philosophy 1 exists to prevent | Became Data Health phase 2 — [issue #16](https://github.com/nofanto/Selara/issues/16), shipped |
| Version Diff Narrative | The report's problem was its *axis*, not its prose. Regrouping, noise filtering and ranking are all deterministic. The check also found two diff implementations, one missing 8 of 14 entity types including RPTI/LKPTI | Became [issue #18](https://github.com/nofanto/Selara/issues/18); phase 1 shipped |
| Decision Log Q&A | The data cannot leave the app — `excel.ts` has no Decisions sheet — and the overwrite import path silently wipes the log | Became [issue #22](https://github.com/nofanto/Selara/issues/22) (data-loss bug) |
| Capacity / Budget Query | The Capacity Report does not compute capacity. It counts assignments per resource with no date-overlap analysis, and the data model has **no capacity attribute at all** — no FTE, effort or allocation on `Resource` or `Initiative` | Blocked on a capacity model that does not exist; an ADR-worthy data-model question, not a refactor |

**Reasoning.** Four for four is no longer a coincidence; it is a finding about where this product's value sits. Selara's hard problems are domain-rule correctness over structured data, and that is exactly the class of problem a tested pure function solves better than a prompt. The agent framing was a genuinely productive **discovery device** — it produced issues #16, #18 and #22, and none of those would have been found by looking at the reports directly — but it was consistently the wrong lens on the resulting work.

Closing is also the honest option. Leaving four "someday" ideas in `requirement-specs/` implies a roadmap that does not exist, and each refresh cycle spent re-litigating them has a cost.

**Rejected — keep them open with the blocker recorded.** Lowest commitment, and it was the tempting option. But it leaves the family in exactly the state that produced two rounds of refresh churn: documented, unbuildable, and re-examined every time someone reads the folder.

**Rejected — commit to export-mediated for the whole family.** Would make a JSON workspace export the prerequisite for all four. That builds an export nobody has asked for, in service of features whose value each doc already describes as unclear.

### 3. What the audit found on the way

Recorded here because these outlive the placeholders:

- **`excel.ts` writes 15 sheets and none is `Decisions`**, while `DataControls.tsx:177` sets `decisions: importPreviewData.decisions || []` on overwrite import. Export → Overwrite All Data silently destroys the decision log. Filed as [#22](https://github.com/nofanto/Selara/issues/22).
- **`ReportsView` splits cleanly along inheritance lines.** Data-health, RPTI, LKPTI and version-history have extracted, tested pure functions in `src/lib/`; budget, capacity, maturity-heatmap and initiatives-dependencies compute inline. The extracted ones are Selara's own work under `CLAUDE.md`; the inline ones are inherited Scenia code that predates the discipline. A consistent seam, not four separate messes.
- **Two undocumented domain rules live in the Budget and Capacity reports.** `assigned.length >= 3` colours a resource red — what counts as overloaded, expressed as a Tailwind class, with no doc, no test and no allowance for part-time resources. And `.filter(r => r.total > 0)` hides zero-budget programmes, strategies and categories from the Budget Report. Both are defensible; neither is written down.

## Open questions

- **What "capacity" should mean in Selara.** The only genuinely unexplored domain question the audit surfaced, and the one with real product value. Needs a Step 0 with the domain owner and probably an ADR, since `Resource` and `Initiative` would both gain fields. Independent of anything agent-related.

## Reopening criteria

This is closed, not forbidden. It would be worth revisiting if any of these changes:

1. Selara gains a JSON workspace export for other reasons, making export-mediated grounding nearly free.
2. A deterministic feature ships whose *output* is genuinely hard to read — the narration layers were rejected partly because `HealthIssue.message` strings and grouped diffs are already legible.
3. The deployment context changes such that portfolio data may leave the device under an approved review.

## Related

- [`agent-filing-readiness-check.md`](agent-filing-readiness-check.md), [`agent-version-diff-narrative.md`](agent-version-diff-narrative.md), [`agent-decision-log-qa.md`](agent-decision-log-qa.md), [`agent-capacity-budget-query.md`](agent-capacity-budget-query.md) — the four placeholders, retained as the discovery record.
- [`data-completeness-report.md`](data-completeness-report.md) and [`diff-summary.md`](diff-summary.md) — where two of the four actually landed.
