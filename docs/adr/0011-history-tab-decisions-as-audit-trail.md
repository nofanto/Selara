# ADR-0011: The decision log is an audit trail, not workspace state

## Status

Accepted

Amends [ADR-0002](0002-in-app-decision-log.md) (UI placement only — its core outcome stands).

## Context and Problem Statement

Selara presents two surfaces that both appear to answer "what happened to this portfolio": the Version History modal (`src/components/VersionManager.tsx`) and the in-app decision log added by [ADR-0002](0002-in-app-decision-log.md) (`src/components/DecisionsView.tsx`). Reviewing whether to merge them — see [`requirement-specs/decision-version-history-merge.md`](../../requirement-specs/decision-version-history-merge.md) — surfaced a defect underneath the UI question.

`Version.data` snapshots the `decisions` array (`src/types.ts:304`), and `handleRestoreVersion` (`src/App.tsx:669`) writes it back wholesale. Restoring a March snapshot therefore deletes every decision recorded since March, including the one explaining the restore. No E2E test covers that path.

It is not an isolated slip so much as a missing rule. Five paths in the app replace the decision log wholesale, and only some of them are wrong to:

| Path | Site | Replaces the log? | Correct? |
|---|---|---|---|
| Version restore | `src/App.tsx:669` | with the snapshot's copy | **No — this is the bug** |
| Export → Overwrite All Data | `src/components/DataControls.tsx:177` | with `[]` | **No** — separately filed as [issue #22](https://github.com/nofanto/Selara/issues/22) |
| Template selection | `src/App.tsx:366` | with `[]` | Yes |
| Viewer import | `src/App.tsx:427` | with `[]` | Yes |
| LKPTI import | `src/App.tsx:475` | with `[]` | Yes |

The discriminator is **entity identity**. Version restore re-loads *the same workspace* — the initiatives, programmes and assets a decision references still exist, with the same IDs, so the log stays meaningful and must survive. The three template-shaped paths establish a *new* workspace from a file: each bases its state on `getTemplateData(...)`, which seeds `decisions: []` (`src/lib/workspaceTemplates.ts:99`), and each resets `versions` as well. Carrying a decision log across one of those would strand every record against `linkedEntityId`s that no longer resolve (`DecisionsView.tsx:104-106` silently drops the association).

Issue #22 named the underlying reason for its own vector: the decision log *"is the one entity in the model that holds reasoning rather than state."* It is also the entity a user is least likely to notice losing — an empty log looks identical to a workspace where nobody recorded anything. What the model lacks is a stated rule saying which operations may reset it, before more are written against it.

## Decision Drivers

- `CLAUDE.md` philosophy 4 — recorded rationale is the reason this entity exists at all; silently destroying it defeats the feature.
- Whatever rule is chosen must say which operations may reset the log and which may not, so the next such path is correct by default rather than audited after the fact.
- It must not strand decisions against entity IDs that no longer resolve.
- Previously saved versions must keep parsing; a user's existing snapshots cannot be invalidated.
- A decision must be able to reference a snapshot without making `Version` mutable.
- Loading a workspace template legitimately *does* start a fresh log — the rule must not break that.

## Considered Options

- Leave the log as snapshot state, and fix each clobbering vector individually.
- Treat the log as an audit trail excluded from all state-replacing operations.
- Version the log alongside the data, giving decisions their own per-snapshot history.

## Decision Outcome

Chosen option: **"Treat the log as an audit trail excluded from operations that reload the same workspace"**, because it is the only option that states a rule rather than patching the vector that happened to be found.

**The rule: an operation that preserves entity identity must preserve the decision log; an operation that establishes a new workspace resets it.**

Concretely:

- `Version.data.decisions` is retained in `src/types.ts` as a **deprecated optional** field so existing saved snapshots still parse. Nothing reads it.
- `handleRestoreVersion` (`src/App.tsx:669`) stops passing `decisions` from the snapshot and preserves the live log. This is the only App.tsx change.
- `handleSelectTemplate` (`:366`), `handleViewerImport` (`:427`) and `handleLkptiImport` (`:475`) keep resetting the log, and gain a comment naming the rule so the behaviour reads as deliberate rather than as three more instances of the same bug.
- `Decision` gains an optional `versionId?: string` referencing the `Version` that enacted it. The link lives on `Decision`, not as `Version.decisionIds[]`, because decisions are linked after a snapshot is taken and `Version` must stay immutable.
- No `DB_VERSION` bump: the `decisions` store exists since version 14 (`src/lib/db.ts:165`) and `versionId` is unindexed.
- Version History moves out of its modal into the decision log's tab, renamed **History** (`src/App.tsx:923`).

### Pros and Cons of the Options

#### Leave it as snapshot state; fix each vector

- Good, because each fix is small and local, and needs no type change.
- Bad, because it states no rule — the fifth bulk-state path written next quarter reintroduces the bug, and there is nothing in the model to point at during review.
- Bad, because it leaves the contradiction standing: an immutable snapshot containing a record whose status is expected to keep evolving after the snapshot is taken.

#### Treat it as an audit trail (chosen)

- Good, because one rule classifies all five known paths — and the next one — without case-by-case review.
- Good, because it matches how the data actually behaves — a `supersededBy` chain is meaningless if rolling back the portfolio rewinds it.
- Good, because it lets `Version` stay genuinely immutable, which the `Decision.versionId` link depends on.
- Bad, because `Version.data.decisions` lingers as a dead field, needing a comment to stop someone reviving it.
- Bad, because restore no longer round-trips a workspace exactly: a user restoring an old snapshot keeps newer decisions. This is intended — losing them is worse — but it is a behaviour change worth documenting in the guide.

#### Version the log alongside the data

- Good, because it would let a user see the log as it stood at any past point.
- Bad, because it is a much larger build (per-decision history, not just per-workspace) for a use case nobody has asked for.
- Bad, because it does not by itself stop the clobbering — it re-frames the same problem as a merge question at every restore.

## Consequences

- Version restore stops destroying the decision log; Vitest covers the rule directly and a Playwright test covers the restore path end to end.
- The three template-shaped paths are unchanged in behaviour but now documented as intentional, which is the point of writing the rule down.
- The guide gains a note that restoring a version does not roll back the decision log — a deliberate asymmetry users should not have to discover.
- [Issue #22](https://github.com/nofanto/Selara/issues/22) keeps its own fix (a `Decisions` sheet in `src/lib/excel.ts`) and cites this ADR for the principle. The two need not land together.
- ADR-0002's rejection of a modal for long-form decision content now applies to diffs too, which is what justifies dissolving the Version History modal. ADR-0002's outcome — that the log deserves a full-page tab — is amended in placement only, not reversed, so it is not superseded.
- Follow-up committed to: `HelpView` `SECTIONS` nav, `docs/user-guide/10-version-history/` and `13-decisions/`, `e2e/decisions.spec.ts` and `e2e/version-history.spec.ts` all change when the tab is renamed in PR 2.
- `computeDiff` stops diffing the decision log entirely, and `decisions` is removed from `DiffResult`, `DiffSection`'s section list and `diffSummary`'s labels. This consequence was **missed when this ADR was first written** and only surfaced when the difference report gained a decisions section and the same record appeared twice — once as intended, once as an "ADDED" portfolio-level change. A diff row reporting a decision describes a change that Restore does not undo, which is the same inconsistency this ADR exists to remove. The difference report surfaces decisions via `decisionsForSpan()` instead, which shows the decisions covering the period rather than only those edited between two snapshots.
- Cost of that removal: a decision *edited* between two snapshots (status flipped to superseded, outcome rewritten) no longer shows as a change anywhere in the report. Accepted deliberately — the span list shows the decision's current state, and a misleading row is worse than an absent one.
- Left deliberately undone: no backfill of `versionId` on existing decisions, and no migration of decisions that exist only inside an old snapshot.
