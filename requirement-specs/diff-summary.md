# Version Diff Summary — Design Notes

> **Status:** All decided sections built — §5 (consolidation) and §4 (`EntityDiff` ids) 2026-09-02, §§2-3 and 6-8 (`summarizeDiff` and the Summary view) 2026-09-04. Tracked as [issue #18](https://github.com/nofanto/Selara/issues/18). Step 0 design discussions held 2026-09-02 (§§1-5) and 2026-09-04 (§§6-8, against a real diff as §§6-8 required). Supersedes the deterministic half of [`agent-version-diff-narrative.md`](agent-version-diff-narrative.md), which now retains only the deferred narration layer.
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

Group by `Asset`; nest initiatives, deliverables, segments, milestones and RPTI/LKPTI rows underneath. Entities with no asset path (programme/strategy records themselves) go in a "portfolio-level" bucket. (Decisions were originally listed here too; they are no longer diffed at all — see [ADR-0011](../docs/adr/0011-history-tab-decisions-as-audit-trail.md).)

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

#### Revision (2026-09-02): identity moves onto the entries, not alongside them

The decision above says *additive*, and that is no longer the right call. Two things changed:

- **`added` and `removed` are `string[]`.** There is nowhere on them to put an id. "Additive" could only mean parallel `addedIds`/`removedIds` arrays index-aligned with the name arrays — an invariant nothing in the type system enforces, which `summarizeDiff` would then have to zip back together.
- **The reason additive was valuable is gone.** §4 justified it as "both consumers ignore the new fields unchanged." After §5 there is *one* consumer, `src/components/DiffSection.tsx`, and it touches these arrays on four lines. `src/lib/diff.test.ts` asserts `modified` with exact `toEqual`, so its expectations have to change under any shape, additive included.

**Decision: one `DiffEntry` type carries identity across all three arrays.**

```ts
type DiffEntry = { id: string; name: string; assetId?: string };

export type EntityDiff = {
  added: DiffEntry[];
  removed: DiffEntry[];
  modified: (DiffEntry & { changes: string[] })[];
};
```

`summarizeDiff` then groups with one `assetId` read, uniform across adds, removes and modifications — no index-zipping, no shape that differs by which array an entity came from.

**`assetId` is resolved at diff time, not by the consumer.** `computeDiff` holds both the baseline and the current snapshot, so it can still resolve a segment or LKPTI row through a deliverable that has since been *deleted* — by looking it up in the base data. A consumer handed only the current workspace could not, and those are exactly the removals that matter most to a catch-up summary.

Where it comes from, by type: `initiatives`, `deliverables` and `milestones` carry `assetId` directly (all required). `deliverableSegments` and `lkptiDetails` resolve through their deliverable; `rptiDetails` resolves through its deliverable or, for `targetType: 'asset'`, uses `targetId` directly. An asset's own entry sets `assetId` to its own `id`, so grouping needs no special case for the asset itself. `dependencies` are left unset — a dependency joins two initiatives that may sit under different assets, so it has no single owner. `programmes`, `strategies`, `resources`, `assetCategories`, `deliverableStatuses` and `decisions` are portfolio-level and have none by nature; they land in the portfolio bucket of §2.

**Rejected — parallel `addedIds`/`removedIds` arrays.** Literally additive, and honours §4 as written. Rejected because index-alignment between two arrays is an invariant with no enforcement and no natural place to assert it, and it buys nothing now that the consumer count is one.

**Rejected — put ids on `modified` only.** Genuinely additive with no restructuring. Rejected because adds and removes are *tier 2* of the §3 significance ranking, so leaving them unattributable to an asset would make a whole rank of the summary ungroupable.

#### Revision (2026-09-04): identity carries names, and reaches the owning deliverable

Building §§2-3 found `assetId` alone insufficient in two ways, both discovered by trying to render a group rather than by inspection:

- **A group has no heading.** `summarizeDiff` receives `assetId` but no asset *name*. It has one only when that asset happens to appear in `diff.assets` — and in the Step 0 probe the "Core Ledger" group held an initiative row and a milestone row and nothing else, so the name was simply unavailable.
- **§6's clustering has no key.** Nothing in `DiffResult` links a segment, an LKPTI row or a deliverable-targeted RPTI row to its deliverable. The segment display name embeds it (`Okta (2025-01-01 → 2028-12-31)`), and recovering it by string-splitting that is precisely the fragility ids were introduced to remove.

**Decision: entries carry resolved `{ id, name }` for both owners.**

```ts
export type DiffEntry = {
  id: string;
  name: string;
  asset?: { id: string; name: string };
  deliverable?: { id: string; name: string };
};
```

Both are resolved inside `computeDiff` for the reason the first revision gave: current snapshot first, then baseline, so a group or cluster whose owner was *deleted* still has a heading. That is the case that matters most — a deleted deliverable is a tier 2 change and its removal is the whole story of its cluster.

**Rejected — four flat fields** (`assetId`, `assetName`, `deliverableId`, `deliverableName`). Literally additive over what §4 shipped. Rejected because id and name are never independently meaningful: an entry has both or neither, and two nullable pairs invite the same unenforced-invariant problem that sank the parallel-array shape above.

**Rejected — pass the asset and deliverable lists to `summarizeDiff` alongside the diff.** Avoids touching `DiffEntry` a second time. Rejected on the original §4 grounds: a consumer handed the current workspace cannot name a deleted owner, and handing it both snapshots re-creates the second traversal §4 rejected outright.

**Rejected — leave `assetId` and add only `deliverableId`, looking names up in the view.** Half the change, and the component does have the workspace. Rejected because it puts a resolution rule — check current, fall back to baseline — in a React component where it cannot be unit-tested, and duplicates it for two entity types.

### 5. Consolidate the two diff UIs first; the summary is a view on the merged one

Selara renders this diff in **two places, with two implementations.** `VersionManager.tsx` uses a reusable `DiffSection` (`:346`) called 14× for all 14 entity types. `ReportsView.tsx` hand-rolls ~175 lines of equivalent JSX inline (`:250-426`) covering only **6**.

The History Differences report therefore silently drops 8 entity types entirely — `deliverables`, `deliverableSegments`, `deliverableStatuses`, `resources`, `assetCategories`, `decisions`, **`rptiDetails`**, **`lkptiDetails`** — plus `dependencies.modified` and `milestones.modified`, which are named in the section guards (`:387`, `:407`) but never rendered. Change only a milestone date and the heading renders above an empty list; change only LKPTI fields and the report renders containing nothing. **The data it drops is the data that feeds the OJK filing.**

So the decision is not "add a third presentation." Lift `DiffSection` into a shared module, delete `ReportsView`'s inline JSX, and point both surfaces at it — two entry points, one presentation. All ten gaps close for free. `summarizeDiff` then becomes the *default view* of that single component, with the entity-type list behind a **Summary / All changes** toggle.

**Reasoning.** This is still "supplements, doesn't replace" — the audit trail stays intact — but landed in one place instead of three. It also retires a duplicate implementation and fixes a live defect on regulatory data as a side effect.

**Sequencing consequence.** The consolidation needs nothing from the id extension (§4) or `summarizeDiff`, and fixes a real defect, so it goes **first**: consolidate → extend `EntityDiff` → build `summarizeDiff`.

**Rejected — merge into either existing view.** Picking `ReportsView` or `VersionManager` as the winner and deleting the other loses a legitimate entry point; the two are reached from different places for the same content.

### 6. Within an asset group, cluster by deliverable; rank the clusters, not the rows

The §3 significance ranking orders the **groups** and, inside a group, the **clusters** — it does not order individual rows. Rows about the same deliverable stay adjacent.

**Reasoning — measured, not assumed.** Step 0 ran `computeDiff` over the demo RPTI workspace (42 assets, 17 deliverables, 35 segments, 7 RPTI and 13 LKPTI rows) for a realistic quarter of edits. One asset group came out as:

```
[removed]  deliverables:        Azure AD B2C
[removed]  deliverableSegments: Azure AD B2C ×3
[removed]  lkptiDetails:        Azure AD B2C
[modified] rptiDetails:         Passkey Rollout → Okta
[modified] lkptiDetails:        Okta — System owner, Go-live date
```

Sorting those rows by §3 puts the Azure AD B2C LKPTI removal at position 2 and its deliverable and segments at 4-7 — **one fact, "Azure AD B2C is gone", split across the group with an unrelated deliverable's rows interleaved.** Ranking is the right answer to "which asset do I read first"; it is the wrong answer to "what happened inside this asset", where the reader is following a system, not a field type. Clustering keeps the thread that §2 chose the asset axis to preserve, one level further down.

**Tiers, per §3:** tier 1 = any `rptiDetails` or `lkptiDetails` row; tier 2 = any other add or remove; tier 3 = everything else. A cluster takes the best tier among its rows; a group takes the best tier among its clusters. Ties break on change count (descending), then title. The portfolio bucket always sorts last — it is the leftovers, not a ranked peer.

**Rejected — apply §3's ranking directly as the within-group row sort.** The literal reading of §3 and the least code. Rejected on the evidence above: it is the option that produces the split.

**Rejected — flat rows in `computeDiff`'s entity-type order.** Cheapest, and cascades stay adjacent by accident because one type's rows are contiguous. Rejected because "by accident" is the operative word — a deliverable and its segments land near each other only while the section list happens to be ordered that way, and nothing would catch a reordering.

**Rejected — roll cascades up into counts** (`Azure AD B2C removed (3 segments, 1 LKPTI row)`). Genuinely tidier for the case that motivated clustering, and it remains available later. Not taken now because it discards which segments moved, and the summary should be readable on its own before it starts eliding. §8 applies exactly this treatment where the elision is unambiguous.

**Note on the third level.** §2 rejected asset → *initiative* as a nesting axis because the entity graph does not support it. Asset → *deliverable* is a different proposition and the graph does support it: segments, LKPTI rows and deliverable-targeted RPTI rows all reach a deliverable. It is still only a *partial* level — the asset's own row, initiatives, milestones and asset-targeted RPTI rows have no deliverable — so those sit in an unclustered slot at the top of the group rather than being forced into a fake parent.

### 7. Cosmetic changes are counted, not silently discarded

`summarizeDiff` returns the number of changes §3 dropped as cosmetic, and the view says so when the summary would otherwise be empty: *"No substantive changes. 4 cosmetic changes are hidden — see All changes."*

**Reasoning.** Step 0 found a case the §3 drop creates and the doc had not accounted for: a diff consisting only of programme/strategy/status colour edits and category reordering returns `hasChanges: true` from `computeDiff` and **zero groups** from `summarizeDiff`. Without this, the default tab renders blank while the other tab shows four changes — which reads as a bug, and worse, reads as "nothing changed" to someone checking whether a baseline moved.

Note that only the *portfolio bucket* can be emptied this way. All four cosmetic fields (`Programme.color`, `Strategy.color`, `DeliverableStatus.color`, `AssetCategory.order`) belong to portfolio-level types that carry no asset, and no asset-scoped comparison in `computeDiff` inspects a cosmetic field. **An asset group whose only change is cosmetic cannot occur** — so the "collapse a cosmetic-only asset" question this doc carried is not a case that exists, and no code should be written for it.

**Rejected — auto-switch to the All changes tab when the summary is empty.** No blank screen, but it moves the reader off the default view without saying why, and the next diff silently switches back.

**Rejected — demote cosmetic changes instead of dropping them.** Nothing ever disappears, so no hidden-count plumbing. Rejected because it reverses §3 for the sake of one edge case; the count preserves the honesty at a fraction of the noise.

**Rejected — a plain "No changes to summarise".** Simplest, and directly contradicted by the All changes tab sitting next to it showing four.

### 8. An added or removed asset collapses to that one fact

When the asset itself appears in `assets.added` or `assets.removed`, its group renders as the asset change plus counts of what came with it — *"Customer IAM (CIAM) removed — 2 initiatives, 3 deliverables, 6 segments, 2 RPTI and 2 LKPTI rows"* — instead of listing the children.

**Reasoning.** Step 0's worst constructible case, deleting the asset with the most children, produced **16 rows in one group, every one an `[removed]` implied by the first.** This is the one place where rolling up loses nothing: if the asset is gone, so is everything under it, and no reader learns anything from the fifteenth line restating it. The individual rows remain in the All changes view, which is what it is for.

**Rejected — treat it as an ordinary group.** Least code, and it is what the other options above amount to. Rejected because it makes the summary's worst case sixteen near-identical lines, in the view whose entire purpose is to be shorter than the audit trail.

**Rejected — collapse removals only, list an added asset's children.** Tempting, because "what did we just take on" is genuinely more interesting than "what did we just delete". Rejected as an asymmetry that has to be explained; a reader who wants the new asset's contents is one tab away, and §6's clustering already gives them a readable shape there.

**Sizing note, recorded so it is not re-litigated.** The same probes settle the "huge groups" question: a realistic quarter produced 17 rows across 5 groups with a largest group of 7, and the constructed worst case reached 16. **Pagination is not warranted** and none should be built.

## Open questions

- **Exposure mechanism for a future narration layer** — deliberately deferred (2026-09-02) until narration is actually prioritised. The options and their tradeoffs are recorded in [`agent-version-diff-narrative.md`](agent-version-diff-narrative.md); the decision is a regulatory judgment about a bank's portfolio data, not an engineering one, and there is no reason to make it before the deterministic work lands.
- **Magnitude ordering inside a tier.** §3 says tier 3 is "ordered by magnitude where a magnitude exists", and §6 does not implement it — within a tier, rows keep `computeDiff`'s stable entity-type order. Deferred because magnitude is only recoverable by parsing the pre-formatted change strings (`CapEx: IDR 5,000,000 → IDR 5,400,000`), and building the summary's ordering on display text is exactly the fragility §4 avoided for identity. If it turns out to matter, the fix is a structured `changes` entry in `computeDiff`, not a parser in `summarizeDiff`.

## Related

- [`agent-version-diff-narrative.md`](agent-version-diff-narrative.md) — the deferred narration layer this doc split off from.
- [`agent-filing-readiness-check.md`](agent-filing-readiness-check.md) — same pattern: the valuable part turned out not to be agent-shaped.
- [`data-completeness-report.md`](data-completeness-report.md) — precedent for a tested pure read model in `src/lib/` feeding a `ReportsView` card.

## Next step

Everything this doc decided is built (see **Built** below). What remains is not queued work:

- **Narration** stays deferred, on the terms in §1 and the first Open question. Nothing built here forecloses it — a narrator would consume `DiffSummary`, which is already the regrouped, ranked shape such a layer would otherwise have to derive for itself.
- **Magnitude ordering within a tier** (second Open question) is the one piece of §3 not implemented, and deliberately so. Revisit only with a real diff where tier-3 ordering actually misleads someone.
- **Rolling cascades up into counts** was rejected in §6 for the general case and taken in §8 where the elision is unambiguous. If asset groups prove noisy in use, that is the lever to pull, and §6 records why it was not pulled first.

[US-VH-06](../docs/user-stories/05-version-history.md) carries the acceptance criteria for what shipped.

## Built

### §5 — consolidation (2026-09-02)

`DiffSection` moved out of `VersionManager.tsx` into `src/components/DiffSection.tsx`, which exports a single `DiffSections` component. `ReportsView.tsx`'s ~175 lines of inline JSX are gone; both surfaces now render `<DiffSections diff={…} />`. All ten gaps closed.

Two notes on how it landed:

- **The section list is data, not JSX.** `VersionManager` previously spelled out 14 `<DiffSection>` calls by hand, which is exactly how `ReportsView` came to cover only 6 — nothing structurally connected the two lists to `DiffResult`. `DIFF_SECTIONS` in the shared module is now a typed array keyed by `Exclude<keyof DiffResult, 'hasChanges'>`, so a new entity type added to `computeDiff` is a compile-time-checked one-line addition that reaches both surfaces at once. The duplication this doc set out to remove could otherwise regrow.
- **One presentation, and it is `VersionManager`'s.** The two implementations differed cosmetically (the modal's larger cards and per-section icons vs. the report's compact uppercase headings). The modal's version won, because it was the one that was correct. The Reports card is narrower, but the layout is fluid and the e2e assertions are on text, not classes.

`EntityDiff` is now exported from `src/lib/diff.ts` so the shared component can type its prop — the only change to `diff.ts`, and not a behavioural one.

**Regression net.** `e2e/report-history-diff.spec.ts` grew a `full entity coverage` describe block with three tests, red before green, one per shape of gap: a milestone date change (`modified` array guarded but never rendered — the report showed the "Milestones" heading over an empty list), a deliverable rename (an entity type dropped entirely), and an added LKPTI row (the filing-data case, where `diff-result` rendered as an empty `<div>`). The pre-existing 15 tests across `report-history-diff`, `version-history` and `reports-versions-error` passed unchanged, as did the full 620-test suite.

### §4 — entity identity on `EntityDiff` (2026-09-02)

Built as revised above, not as originally written: one `DiffEntry` type (`id`, `name`, optional `assetId`) across `added`, `removed` and `modified`, rather than a literally-additive extension.

`compareEntities` grew an optional fifth parameter, `getAssetId`, and builds every entry through one `toEntry` helper — so identity cannot be present on one array and missing from another, which is the failure mode the parallel-array shape invited. Seven of the fourteen comparisons pass a resolver; the other seven pass none and their entries carry no `assetId`, which is the correct answer for a programme or a resource.

`getDeliverableAssetId` checks the current snapshot and then the baseline. That ordering is the whole reason `assetId` is resolved inside `computeDiff`: a deliverable deleted since the baseline is absent from the current workspace but still present in the base version, so its segments and LKPTI rows can still be placed under the asset that owned them. Those are removals, and removals are tier 2 of the §3 ranking — precisely what a catch-up summary must not drop on the floor.

**Regression net.** Six new tests in `src/lib/diff.test.ts` under `computeDiff — entity identity`, red before green: ids on all three arrays; direct `assetId` for initiatives, deliverables and milestones; resolution through the owning deliverable for segments and LKPTI rows; both RPTI target types; resolution from the *baseline* for a deleted deliverable; and `assetId` left unset for portfolio-level types and for dependencies.

The eleven pre-existing tests asserted `modified` with exact `toEqual`, so all ten that matched an entity had to gain their `id` — the churn that made "additive" a false economy in the first place. Full suite green: 168 unit, 623 e2e passed with 4 skipped.

The only consumer, `src/components/DiffSection.tsx`, changed on four lines (`name` → `entry.name`) and took a small improvement for free: React keys are now `${entry.id}-${idx}` rather than a bare array index.

### §§2-3, 6-8 — `summarizeDiff` (2026-09-04)

`src/lib/diffSummary.ts` exports `summarizeDiff(diff: DiffResult): DiffSummary` — a pure regrouping with no new dependency, no model call and no second traversal of the raw data, as §1 required. `DiffSection.tsx` gained a **Summary / All changes** toggle and opens on Summary; the entity-type breakdown behind the second tab is byte-for-byte the view §5 consolidated.

**Step 0 was run against real diffs, which is what the two open questions asked for.** Three throwaway probes over the demo RPTI workspace (42 assets, 17 deliverables, 35 segments, 7 RPTI and 13 LKPTI rows): a realistic quarter of edits, a cascade delete, and a broad rename sweep. They changed three answers this doc would otherwise have guessed at:

- The realistic quarter produced **17 rows across 5 groups, largest group 7**; the constructed worst case reached **16**. "Paginating a group with dozens of entries" was a problem that does not occur at this scale (§8).
- The largest group's rows showed §3's ranking splitting one deliverable's story in two, which is what produced §6.
- The cosmetic-only case returned `hasChanges: true` with **zero groups**, a blank default tab nobody had considered — §7.

One question dissolved rather than being answered: **an asset group whose only change is cosmetic cannot exist**, because all four cosmetic fields belong to portfolio-level types. That was worth finding before writing a collapse rule for it.

**Shape.** `DiffSummary` is `{ groups, cosmeticCount }`. A `SummaryGroup` carries its `asset` (unset for the portfolio bucket), a tier, a change count, an unclustered `changes` head, and `clusters` keyed by deliverable — or, when the asset itself moved, an `assetChange` with child counts and both lists empty (§8). Ordering is total and deterministic everywhere: tier, then change count descending, then title, with the portfolio bucket pinned last.

**One coupling, deliberately placed.** Cosmetic classification matches a prefix of the formatted change string, so `COSMETIC_CHANGE_PREFIXES` lives in `diff.ts` beside the `getChanges` callbacks that produce those strings rather than in the consumer — a reworded change and its classifier cannot drift across files, and each prefix is pinned by a test. This is narrower than the magnitude parsing deferred under Open questions: matching a known prefix is not the same as extracting a value from display text.

**Regression net.** 14 new tests in `src/lib/diffSummary.test.ts`, red before green, driven through real `computeDiff` output rather than hand-built `DiffResult` literals — so they also hold the two functions to the same entry contract. They cover grouping and the portfolio bucket, clustering and the unclustered head, group and cluster ranking, the tie-break, cosmetic dropping and the mixed cosmetic/substantive case, the zero-group empty state, collapsed asset adds and removes, the un-collapsed modified asset, and baseline naming for deleted owners.

Two Playwright tests cover what unit tests cannot: which view a reader lands on, and that the other is one click away. Five pre-existing e2e tests asserted on entity-type headings and now click **All changes** first — the honest change, since that is the view they are about. Full suite green: **188 unit**, and **629 e2e passing with 4 skipped** (626 clean plus 3 that passed on retry, all in unrelated specs), up from 627 by exactly the two tests added here.

**`DiffEntry` extension.** Shipped as the 2026-09-04 revision to §4 above: `assetId` became `asset: { id, name }` and `deliverable: { id, name }` joined it, both resolved current-snapshot-first-then-baseline inside `computeDiff`. `compareEntities`'s fifth parameter is now a single `getOwners` returning both, so an entry cannot carry one owner and silently miss the other. Seven of the fourteen comparisons pass a resolver; `deliverables` passes both owners, segments/LKPTI/deliverable-targeted RPTI resolve through `deliverableOwners`, and an asset-targeted RPTI row gets an asset and no deliverable — correctly, since it has none to cluster under. One new test pins the `'Unknown asset'` fallback for an id that resolves to no record: grouping still works, only the heading degrades.
