# User Story 24: History Tab — Recording Why, Where People Already Look

## Story

> **As** an IT portfolio manager,
> **I want** to record *why* a change was made at the moment I snapshot it, and to see that reasoning again when I compare versions,
> **So that** the portfolio's rationale survives beyond the people who remember it, instead of living only in a diff that shows what moved but never why.

---

## Background

Selara has two surfaces that answer "what happened to this portfolio": **Version History**
(a modal — save a snapshot, diff two of them, restore one) and the **Decision log**
(a full-page tab of MADR records, added by [ADR-0002](../adr/0002-in-app-decision-log.md)).

[PR 1 of issue #29](../../requirement-specs/decision-version-history-merge.md) settled that
these must *not* become one entity — a Version is an immutable, mechanically-diffable
snapshot of *what* changed; a Decision is a mutable record of *why*, with its own status
lifecycle. It fixed the data-model defect underneath ([ADR-0011](../adr/0011-history-tab-decisions-as-audit-trail.md))
and added `Decision.versionId`.

This story is the other half, and it exists because of an observed behaviour problem:
**users rely on Version History to understand changes and rarely record decisions at all.**
The log sits empty while people read diffs.

That is not misuse. The product prices the two apart:

| | Version History | Decision log |
|---|---|---|
| Cost to produce | zero — the diff is generated | seven fields, all shown at once |
| Trigger | in-flow, at a natural moment | none — a destination you must remember |
| Payoff | immediate, to yourself | deferred, to someone else — and invisible everywhere in the app |

Two of those are self-inflicted. ADR-0002's own driver was *"minimize overhead for small,
routine decisions"* — the data model honours it, the form does not. And the Save Version
dialog's description field already carries the placeholder **"What changes does this version
capture?"**: the app is *already* asking the decision-log question, in the wrong container,
unstructured and unsearchable.

So the goal is not to push people toward the Decisions tab. It is to **capture the decision
where the habit already is, and make having written one visibly worthwhile.**

Full design and the rejected alternatives: [`requirement-specs/decision-version-history-merge.md`](../../requirement-specs/decision-version-history-merge.md) §6.

---

## Acceptance Criteria

### AC1 — One destination

- Version History is no longer a modal; it lives inside the tab previously called **Decisions**, now renamed **History**.
- Header navigation stays at five items.
- The tab's default view is a single chronological stream interleaving **versions** (generated) and **decisions** (authored), newest first.
- A filter narrows the stream to decisions alone, preserving the ability to scan the log on its own the way a filing reviewer would.

### AC2 — Capture at save time (the trigger)

- The Save Version dialog offers an optional step to record *why* alongside the snapshot.
- Opting in creates a `Decision` linked to that version via `versionId`, seeded from the version's description.
- The new decision defaults to status **`accepted`** — the snapshot exists because a change was made, so the record describes work already done.
- The decision is created within the save transaction, but **only** when the user opts in *and* supplies a non-empty title. Abandoning the dialog leaves no half-written record.
- Saving a version without recording a decision remains a single, unobstructed action.

### AC3 — Payoff in the Difference Report (the reinforcement)

- Running a difference report between two versions also lists the decisions covering that span.
- "Covering that span" is a **union**: decisions explicitly linked by `versionId` to either endpoint, **plus** decisions whose `createdAt` falls between the two version timestamps, deduplicated.
- A span with changes but no decisions says so explicitly, so the absence reads as a visible gap rather than going unnoticed.

### AC4 — Lower the cost of writing one (progressive disclosure)

- The decision form shows **Title** and **Decision Outcome** up front.
- Context, Considered Options, Consequences and the entity link are collapsed behind an "Add detail" affordance.
- A decision remains saveable with a title alone, as it is today — this changes presentation, not validation.

### AC5 — Navigating between the two

- A decision carrying a `versionId` links to that version's snapshot and its diff.
- A version in the stream shows the decisions attached to it, if any.

### AC6 — Nothing is ever mandatory

- No mechanism in this story blocks or gates saving a version.
- There is no forced prompt, no required field beyond the existing title, and no modal a user must dismiss to finish a save.

> **Why this is an explicit criterion:** Selara's output is an OJK regulatory filing. A decision log
> padded with coerced "update" / "fix" entries is *worse* than a sparse honest one — it destroys the
> signal that makes the log worth consulting. Every mechanism here is an invitation, never a gate.

### AC7 — Documentation follows the rename

- `HelpView`'s `SECTIONS` nav, `docs/user-guide/10-version-history/` and `docs/user-guide/13-decisions/` reflect the merged tab.
- `e2e/decisions.spec.ts` and `e2e/version-history.spec.ts` are updated for the new navigation.

---

## Out of Scope

- **Backfill** — promoting existing version descriptions into decisions is PR 3.
- **[Issue #22](https://github.com/nofanto/Selara/issues/22)** — the export/import round-trip gap keeps its own fix.
- Multi-version links: `Decision.versionId` stays singular until something needs otherwise.

---

## How this will be judged

Selara is local-first with no telemetry, so the app cannot report whether any of this worked.
Success is an observation the product owner makes, sequenced:

1. **Adoption first** — what share of saved versions end up with a linked decision.
2. **Quality once the log is non-empty** — whether those decisions explain something a diff
   cannot: rationale, rejected options, constraints.

A quality bar is meaningless against an empty log, which is why the order matters. Note that
AC6 and criterion 2 pull against any temptation to inflate criterion 1 by nagging.
