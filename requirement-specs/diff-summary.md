# Version Diff Summary — Design Notes

> **Status:** Decided, not yet built. Tracked as [issue #18](https://github.com/nofanto/Selara/issues/18). Step 0 design discussion held 2026-09-02; no code written. Supersedes the deterministic half of [`agent-version-diff-narrative.md`](agent-version-diff-narrative.md), which now retains only the deferred narration layer.
> **Context:** Came out of reviewing the four read-only AI agent placeholders. The review found that most of what the "narrative" idea was reaching for is a deterministic regrouping, not a language task — the same lesson [`agent-filing-readiness-check.md`](agent-filing-readiness-check.md) learned when its rule engine became Data Health phase 2 ([issue #16](https://github.com/nofanto/Selara/issues/16)).

## Context and Problem Statement

Selara already computes a structured diff between a saved `Version` and another data snapshot — `computeDiff` in `src/lib/diff.ts`, rendered by the History Diff Report (`src/components/ReportsView.tsx:132`) and the Version Comparison Report (`src/components/VersionManager.tsx:401`).

The computation is sound. The **presentation axis is wrong for one of its two jobs.** `DiffResult` is keyed by entity type — `assets`, `programmes`, `strategies`, `initiatives`, `deliverables`, `deliverableSegments`, … — and the UI renders it in that order. That is exactly right for an audit trail ("show me every field that moved"), and exactly wrong for "catch me up," where the reader wants a story per system: *"Core Banking slipped a quarter, its mobile app went live, and the LKPTI go-live date was filled in."* Today that single story is scattered across four separate entity-type sections, and the reader reassembles it by hand.

A second, smaller problem: the diff carries cosmetic churn (programme/strategy/status `color` changes, `assetCategory.order`) at the same visual weight as a changed go-live date.

## Decided

### 1. Build the deterministic regrouping first; defer narration entirely

The deliverable is `summarizeDiff`, a tested pure function in `src/lib/` that pivots an existing diff by asset, drops cosmetic noise, and ranks by significance. No agent, no model call, no new dependency, no new infrastructure.

**Reasoning.** The valuable part of the original "narrative" idea is the regrouping and the ranking, and neither needs a language model. Doing it deterministically means it is unit-testable at the altitude of its risk (`CLAUDE.md` philosophy 3), ships value into the report whether or not an agent layer ever exists, and forces no privacy decision about a bank's portfolio data.

**Rejected — go straight to narration.** Faster to a demo, but it would leave the report's entity-type axis unfixed, force the architecture and privacy questions immediately, and put a language model in front of data whose grouping problem is fully solvable without one.

**Rejected — design both together.** More coherent in principle, but it couples a safe, independently valuable refactor to an unsettled architectural decision (see Open questions). If the grouped shape turns out to need adjusting for a narrator later, that is a cheap change to a pure function.

### 2. Pivot axis: asset-primary, with a portfolio-level bucket

Group by `Asset`; nest initiatives, deliverables, segments, milestones and RPTI/LKPTI rows underneath. Entities with no asset path (decisions linked to a programme, programme/strategy records themselves) go in a "portfolio-level" bucket.

**Reasoning — this is forced by the entity graph, not a preference.** `Initiative.assetId`, `Deliverable.assetId` and `Milestone.assetId` are all **required**. Asset is the only axis on which every timeline entity has a guaranteed home.

**Rejected — initiative-primary.** The intuitive choice, and wrong. `DeliverableSegment.initiativeId` is *optional*; `Deliverable` has no initiative link at all; `LkptiDetail` reaches only a deliverable. Pivoting on initiative drops deliverables, milestones, LKPTI rows and every unattributed segment into an orphan bucket that could plausibly hold most of a real diff.

**Rejected — asset → initiative, two levels.** Most faithful to the model, but a materially more complex return shape to build and test for a readability gain that the flat asset grouping already delivers. Revisit if single-asset groups get unwieldy in practice.

**Rejected — group by kind of change** (schedule / budget / scope / filing). Closest to how someone phrases the question, but it dissolves the "which system" thread that a portfolio view exists to provide. Retained as a possible secondary sort within an asset.

### 3. Significance ranking: filing-relevant edits and scope changes first

Always rank to the top, regardless of magnitude:

1. **RPTI / LKPTI field changes** — anything on `rptiDetails` or `lkptiDetails`. These feed the OJK filing directly, so a one-character edit here outranks a large edit elsewhere. This is `CLAUDE.md` philosophy 1 applied to presentation: regulatory correctness is the expensive thing to get wrong.
2. **Adds and removes** — entities created or deleted since the baseline. Scope change, not drift.

Everything else — schedule slips, budget deltas, renames, status moves — is still reported, just not privileged. Ranked below the two tiers above, ordered by magnitude where a magnitude exists.

**Dropped as cosmetic noise:** `Programme.color`, `Strategy.color`, `DeliverableStatus.color`, `AssetCategory.order`. These are real diffs and belong in the audit-trail view; they carry no information for a catch-up summary.

**Note on go-live dates.** Explicitly considered as a third top tier and not taken as one — but largely redundant, because `LkptiDetail.goLiveDate` is an LKPTI field and is therefore already top-ranked by tier 1. The only case not covered is a `DeliverableSegment` moving into a status flagged `isLiveStatus`, which ranks normally. Worth revisiting if that transition proves to be the thing readers look for first.

### 4. `computeDiff` needs entity IDs before any of this is possible

**This is a prerequisite, not an implementation detail.** `EntityDiff` (`src/lib/diff.ts:22`) carries only display names and pre-formatted change strings:

```ts
type EntityDiff = {
  added: string[];
  removed: string[];
  modified: { name: string; changes: string[] }[];
};
```

There is no `id` anywhere in the result, so **`summarizeDiff(DiffResult)` cannot group by asset** — given `"Mobile App"` it has no way to find the asset that deliverable belongs to, and entity names are neither unique nor stable across a rename.

Resolution: extend `EntityDiff` **additively** with the entity `id` (and, where the parent is not derivable, the owning `assetId`), then have `summarizeDiff` consume the enriched `DiffResult`. Additive keeps a single diff computation, and both existing consumers ignore the new fields unchanged. `src/lib/diff.test.ts` (11 tests) is the regression net for that change.

**Rejected — have `summarizeDiff(baseVersion, currentData)` re-walk the raw data itself.** Avoids touching `computeDiff`, but duplicates the entire comparison, creating two implementations of "what changed" that can disagree. Precisely the failure mode the extracted-pure-function pattern exists to prevent.

### 5. Consolidate the two diff UIs first; the summary is a view on the merged one

Selara renders this diff in **two places, with two implementations.** `VersionManager.tsx` uses a reusable `DiffSection` (`:346`) called 14× for all 14 entity types. `ReportsView.tsx` hand-rolls ~175 lines of equivalent JSX inline (`:250-426`) covering only **6**.

The History Differences report therefore silently drops 8 entity types entirely — `deliverables`, `deliverableSegments`, `deliverableStatuses`, `resources`, `assetCategories`, `decisions`, **`rptiDetails`**, **`lkptiDetails`** — plus `dependencies.modified` and `milestones.modified`, which are named in the section guards (`:387`, `:407`) but never rendered. Change only a milestone date and the heading renders above an empty list; change only LKPTI fields and the report renders containing nothing. **The data it drops is the data that feeds the OJK filing.**

So the decision is not "add a third presentation." Lift `DiffSection` into a shared module, delete `ReportsView`'s inline JSX, and point both surfaces at it — two entry points, one presentation. All ten gaps close for free. `summarizeDiff` then becomes the *default view* of that single component, with the entity-type list behind a **Summary / All changes** toggle.

**Reasoning.** This is still "supplements, doesn't replace" — the audit trail stays intact — but landed in one place instead of three. It also retires a duplicate implementation and fixes a live defect on regulatory data as a side effect.

**Sequencing consequence.** The consolidation needs nothing from the id extension (§4) or `summarizeDiff`, and fixes a real defect, so it goes **first**: consolidate → extend `EntityDiff` → build `summarizeDiff`.

**Rejected — merge into either existing view.** Picking `ReportsView` or `VersionManager` as the winner and deleting the other loses a legitimate entry point; the two are reached from different places for the same content.

## Open questions

- **Exposure mechanism for a future narration layer** — deliberately deferred (2026-09-02) until narration is actually prioritised. The options and their tradeoffs are recorded in [`agent-version-diff-narrative.md`](agent-version-diff-narrative.md); the decision is a regulatory judgment about a bank's portfolio data, not an engineering one, and there is no reason to make it before the deterministic work lands.
- **Does the asset grouping need a secondary sort within a group?** Grouping by kind of change (schedule / budget / scope / filing) was rejected as the primary axis but may earn its place as the ordering *inside* one asset. Decide against a real diff rather than in the abstract.
- **Empty and huge groups.** No decision yet on collapsing assets with a single cosmetic-only change, or on paginating a group with dozens of entries.

## Related

- [`agent-version-diff-narrative.md`](agent-version-diff-narrative.md) — the deferred narration layer this doc split off from.
- [`agent-filing-readiness-check.md`](agent-filing-readiness-check.md) — same pattern: the valuable part turned out not to be agent-shaped.
- [`data-completeness-report.md`](data-completeness-report.md) — precedent for a tested pure read model in `src/lib/` feeding a `ReportsView` card.

## Next step

Per §5 the order is: **consolidate** (defect fix, no new tests needed beyond keeping `e2e/report-history-diff.spec.ts` (5), `e2e/version-history.spec.ts` (8) and `e2e/reports-versions-error.spec.ts` (2) green — they assert on the `report-history-diff` / `diff-result` / `version-select` test IDs, section titles and rendered change strings, all of which the shared component must preserve), then the **`EntityDiff` id extension** (§4) under the existing `diff.test.ts` coverage, then **`summarizeDiff`**.

Only the last needs Step 1 ceremony: a User Story in `docs/user-stories/` for the summary view, then Vitest unit tests (pure logic — `CLAUDE.md` step 2 puts this at unit-test altitude, not E2E), red before green.
