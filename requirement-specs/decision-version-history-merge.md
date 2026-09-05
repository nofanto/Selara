# Merging the Decision Log and Version History — Design Notes

> **Status:** §§1-5 decided and implemented in PR 1; §6 (adoption) drafted, with open questions still to resolve before PR 2. Resolves the design questions raised when reviewing why Selara has two apparent places to "manage changes". Tracked by [issue #29](https://github.com/nofanto/Selara/issues/29) across three PRs — see "Phasing". The data-model rule is recorded as [ADR-0011](../docs/adr/0011-history-tab-decisions-as-audit-trail.md).

## Context and Problem Statement

Selara currently exposes two surfaces that both appear to answer "what happened to this portfolio":

- **Version History** (`src/components/VersionManager.tsx`) — a modal behind a toolbar icon. Saves a named, described, full-state snapshot; lists snapshots; diffs two of them via `computeDiff`/`DiffSections`; restores one.
- **The Decision log** (`src/components/DecisionsView.tsx`) — a full-page tab added by [ADR-0002](../docs/adr/0002-in-app-decision-log.md). MADR-structured records (`context`, `consideredOptions`, `decisionOutcome`, `consequences`) with a status lifecycle and an optional link to one Initiative, Programme, or Asset.

A user asked to merge them. The question is what "merge" should mean, because the two are not the same kind of record.

There is also a third log — the git-tracked `docs/adr/` engineering ADRs — which is explicitly *not* in scope. ADR-0002 already drew that line: `docs/adr/` is for developers reasoning about Selara's codebase, the in-app log is for portfolio managers reasoning about their portfolio. Different audiences, different lifecycles, one of them lives in a user's browser. That separation stands.

---

## Decided

### 1. Merge the destination, not the data

The two records have genuinely different shapes:

| | Version | Decision |
|---|---|---|
| Answers | *what* changed | *why* it changed |
| Mutability | immutable snapshot | mutable; `proposed → accepted → deprecated/superseded` |
| Derivable? | yes — `computeDiff` generates the diff mechanically | no — only a human can write the rationale |
| Can stand alone? | yes (a routine save before experimenting) | yes (a `proposed` decision nobody has enacted) |

**Rejected: collapse them into one entity.** Either direction trades badly. Folding MADR fields onto `Version` would demand rationale for every "save before I try something" snapshot. Folding a snapshot onto `Decision` would make every record carry a `structuredClone` of the whole workspace — and a `proposed` decision *cannot* have one, because the change hasn't happened yet. Cardinality isn't 1:1 either: one decision commonly plays out across several saves.

**Chosen:** keep two stores, merge the surface. Both live under one tab, and a decision may point at the snapshot that enacted it.

### 2. Decisions are an audit trail, not workspace state

This is the load-bearing decision; it is recorded separately as [ADR-0011](../docs/adr/0011-history-tab-decisions-as-audit-trail.md).

`Version.data` currently snapshots the `decisions` array (`src/types.ts:304`), and `handleRestoreVersion` (`src/App.tsx:669`) writes it back wholesale:

```ts
handleUpdate({ ...version.data, /* … */ decisions: version.data.decisions ?? [], /* … */ });
```

So restoring a March snapshot deletes every decision recorded since March — including the one explaining why the restore happened. There is no E2E coverage of that path, which is why it went unnoticed.

Five paths replace the log wholesale, but they are not all the same defect:

| Path | Site | Correct? |
|---|---|---|
| Version restore | `src/App.tsx:669` | **No — the bug** |
| Export → Overwrite All Data | `src/components/DataControls.tsx:177` | **No** — [issue #22](https://github.com/nofanto/Selara/issues/22), separate fix |
| Template selection | `src/App.tsx:366` | Yes |
| Viewer import | `src/App.tsx:427` | Yes |
| LKPTI import | `src/App.tsx:475` | Yes |

The discriminator is **entity identity**. Restore re-loads *the same workspace* — the initiatives, programmes and assets a decision references still exist under the same IDs — so the log stays meaningful and must survive. The three template-shaped paths establish a *new* workspace: each bases its state on `getTemplateData(...)`, which seeds `decisions: []` (`src/lib/workspaceTemplates.ts:99`), and each resets `versions` too. Carrying a log across one of those would strand every record against a `linkedEntityId` that no longer resolves.

Issue #22 named the reason for its own vector: the decision log *"is the one entity in the model that holds reasoning rather than state."* Generalised into a rule: **an operation that preserves entity identity must preserve the decision log; an operation that establishes a new workspace resets it.**


### 3. `Decision.versionId`, not `Version.decisionIds[]`

A decision may optionally reference the snapshot that enacted it, so the reader can jump from "why we did this" to the before/after diff.

The link lives on `Decision` because a decision is typically linked *after* the snapshot exists, and `Version` must stay immutable — the whole point of a snapshot is that it does not change after it is taken. Putting a mutable `decisionIds[]` on `Version` would mean rewriting saved snapshots, which also complicates the "don't snapshot the log" rule above.

Optional, because `proposed` decisions have no snapshot, and because most decisions will never bother.

### 4. Old snapshots keep the field; restore stops reading it

`Version.data.decisions` stays in the type as a deprecated optional so previously saved versions still parse. Restore simply stops reading it — the live log is left untouched.

**Rejected: migrate decisions found only in old snapshots back into the live store.** A decision absent from the live log was deleted, and deletion should mean deletion; resurrecting records from a snapshot is a feature nobody asked for and would surprise anyone who deliberately removed one.

### 5. The tab is renamed **History**

Version History moves out of its modal and becomes a pane inside the existing Decisions tab (`src/App.tsx:923`), renamed **History**. Header nav stays at five items.

ADR-0002 rejected the modal shape for decision records because long-form MADR fields "read poorly in a cramped popup". The same reasoning applies to a diff view. This **amends** ADR-0002's UI outcome rather than superseding it — its core decision, that the decision log deserves a full-page tab, is what makes this possible.

Rename churn is accepted: `e2e/decisions.spec.ts`, the `HelpView` `SECTIONS` nav, and `docs/user-guide/10-version-history/` + `13-decisions/`.

---

### 6. The adoption problem: give the log a trigger and a payoff

Merging the surfaces does not by itself change behaviour. The observed problem is that **users rely on Version History to understand what changed, and rarely record decisions at all** — the log is where the *why* is supposed to live, and it sits empty while people read diffs.

That is not misuse. The product currently prices the two apart, in three ways:

| | Version History | Decision log |
|---|---|---|
| **Cost to produce** | zero — `computeDiff` generates the diff | seven fields, all rendered at once in `DecisionsView` |
| **Trigger** | in-flow, at a natural moment ("snapshot before I touch this") | none — a destination you must remember to visit |
| **Payoff** | immediate, to yourself | deferred, to someone else — and writing one changes nothing visible anywhere in the app |

Two of those are self-inflicted and worth stating plainly:

- ADR-0002's own driver was *"minimize overhead for small, routine decisions — not every field should be mandatory."* The **data model honours it** (everything after `title` is optional); the **form does not** — `DecisionsView` renders Title, Status, Context, Considered Options, Decision Outcome, Consequences, Linked to and Item as one flat wall, which reads as an obligation.
- The Save Version dialog's description field is labelled *"Description (Optional)"* with the placeholder **"What changes does this version capture?"** (`VersionManager.tsx:68-72`). The app is **already asking the decision-log question**, in the wrong feature, unstructured and unsearchable. Users are performing the right behaviour in the wrong container — which is a far better starting position than indifference.

The fix is therefore not to push people toward the Decisions tab, but to **capture the decision where the habit already is, and make having written one visibly worthwhile.**

#### 6a. Capture at save time — *the trigger*

The Save Version dialog gains an optional "record why" step. Accepting it creates a `Decision` pre-linked by `versionId`, seeded from the version description. No navigation, no new habit to learn — it converts the existing behaviour rather than competing with it. Highest-leverage change of the five.

#### 6b. Surface decisions inside the Difference Report — *the payoff*

Running a diff between two versions also shows the decisions covering that span. Today decisions have **zero presence in the one surface people actually use**, so authoring one is unrewarded. This closes the loop: writing a decision makes your own diffs more informative.

#### 6c. One chronological stream in the History tab — *the frame*

Rather than two lists sharing a tab, interleave them: versions (generated) and decisions (authored) on one timeline. Users get the change feed they already want, and a large diff with no decision beside it reads as a **visible gap** rather than an absence nobody notices.

#### 6d. Progressive disclosure on the decision form — *lower the cost*

Title and Decision Outcome up front; Context, Considered Options, Consequences and the entity link collapsed behind "Add detail". Makes ADR-0002's stated driver real in the UI for the first time.

#### 6e. Backfill from existing descriptions — *seed it*

A one-time, user-invoked "promote to decision" action on any version that has a description but no linked decision. An empty log signals "nobody uses this"; a populated one signals the reverse. User-invoked rather than automatic — bulk-manufacturing records from terse snapshot notes would create exactly the noise 6f warns about.

#### 6f. Non-goal: never make a decision mandatory

Saving a version must not require recording a decision, and no nudge may block the save. In a tool whose output is an OJK filing, a log padded with coerced "update" / "fix" entries is **worse than a sparse honest one** — it destroys the signal that makes the log worth consulting at all. Every mechanism above is an invitation; none is a gate.

#### How this will be judged

Selara is local-first with no telemetry, so the app cannot report whether adoption improved. The success test is an observation only the product owner can make: **are decisions being written, and do they explain changes that a diff alone would not?** Worth agreeing what "better" looks like before building, since nothing here can be measured after the fact.

---

## Phasing

Three PRs under one issue, so the schema work stays reviewable without UI noise and the adoption work is not gated on it:

**PR 1 — data model (implemented, `feat/decisions-audit-trail`).** Add `Decision.versionId?`. Stop version restore clobbering the log, and comment the three template-shaped paths so their reset reads as deliberate. Vitest for the rule, Playwright for restore-preserves-decisions.

**PR 2 — the History tab and the capture loop.** No longer a refactor: folding `VersionManager` into the tab is the *vehicle* for §6, not the goal. Covers 6a (capture at save), 6b (decisions in the Difference Report), 6c (interleaved stream), 6d (progressive disclosure), and the `versionId` link surfaced in both directions. Needs its own user story with acceptance criteria before implementation. Updates guide pages, `HelpView` nav, and the affected E2E specs.

**PR 3 — backfill.** 6e, split out because it is independent of the tab work and easy to defer.

No IndexedDB `DB_VERSION` bump is required: the `decisions` store already exists (created at version 14, `src/lib/db.ts:165`) and `versionId` is an unindexed optional field.

## Out of scope

- **Issue #22** keeps its own fix — a `Decisions` sheet in `src/lib/excel.ts` plus `importValidation.ts` handling. It is self-contained and already has a good plan. It cites ADR-0011 for the principle; the two do not need to land together.
- Merging `docs/adr/` into anything in-app (see Context).

## Open questions

Items 1-5 are settled and PR 1 is implemented. These concern §6 only, and should be resolved before PR 2 starts:

1. **Default status for a decision captured at save time (6a).** `DecisionsView` defaults new records to `proposed`, but a decision recorded alongside a snapshot describes work already done, which argues for `accepted`. Defaulting wrong in either direction produces a log whose status field nobody trusts.
2. **What "covering that span" means for the Difference Report (6b).** Matching `createdAt` between the two version timestamps is the obvious rule, but it misses a decision written *later* about an earlier change. Does an explicit `versionId` link take precedence, and should a decision be able to reference more than one version?
3. **Does the interleaved stream (6c) replace the two lists, or sit alongside them as a third view?** Replacing is cleaner but removes the ability to scan decisions alone, which is how a filing reviewer would use it.
4. **Does 6a create the decision immediately, or on the next save?** Creating it inside the save flow means a half-written decision can be abandoned mid-dialog; deferring it means the trigger fires when the context is already gone.
5. **Agreement on what success looks like** — see "How this will be judged" above.
