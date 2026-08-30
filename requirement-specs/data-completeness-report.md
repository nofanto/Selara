# Data Completeness Report — Design Notes

> **Status:** Implemented. See [User Story 21](../docs/user-stories/21-data-completeness-report.md) for the acceptance criteria and `src/lib/dataHealth.test.ts` (29 tests) + `e2e/data-health-report.spec.ts` (3 tests) for coverage. No ADR — no new dependency, no IndexedDB schema change, no infra change, and no prior decision reversed (this is a pure read model, same category as the Budget/Capacity reports), so it didn't meet `docs/adr/README.md`'s bar for one.
> **Context:** Raised as a companion to `lkpti-import-onboarding.md` — that import explicitly leaves gaps behind (no Programme/Strategy/Initiative, no lifecycle history before go-live, 9 of 15 LKPTI columns with no auto-fill source), and there was no way in the app to see what those gaps actually are. Broadened during discussion into a general workspace completeness check, not an LKPTI-import-specific one.

## Context and Problem Statement

Selara has no general-purpose view of "what's incomplete or broken in this workspace." Two partial precedents exist:

- `validateImportSchema` (`src/lib/importValidation.ts`) — checks required-field presence and basic value sanity, but only against an **import payload**, never the live workspace.
- `Timeline.tsx` (~line 1365) — computes dangling `Initiative.programmeId`/`strategyId` inline, surfaced as an amber "Unassigned" swimlane, but only when `groupBy` happens to be `'programme'`/`'strategy'`, and only for that one relationship.

Nothing surfaces the broader set of gaps: dangling references elsewhere in the schema, report-generation fields left blank because no cascade source resolved, or deliverables that never learn from generation that they were silently excluded.

Three questions needed resolving:

1. How broad should v1's scope be?
2. Where does it live, especially given the tie-in to LKPTI import?
3. What's the actual check list?

---

## Decided

### 1. Scope: hard integrity + soft report-completeness; structural "unused record" checks deferred

**Decision:** v1 covers two of the three tiers surfaced during research:
- **Hard** — dangling references (a field points at a record that no longer exists) and the one schema-level gap already known and documented in code (`DeliverableSegment.status` is a free string, never validated against real `DeliverableStatus` records — see `rpti.ts`'s own comment on this).
- **Soft** — fields with no resolved value that a report generator needs, where the app currently just produces a blank cell with no signal to the user.

**Deferred (not in v1):** "unused record" checks — an `AssetCategory` with no `Asset`s, an `Asset` with no `Deliverable`s, an unreferenced `Resource`, an unrated `Asset.maturity`. These are portfolio-hygiene signals, not correctness problems — nothing downstream (a report, a join, a generation rule) is wrong or degraded because of them, unlike the hard/soft tiers where the actual regulatory output is affected. Revisit if this report seems too narrow after use.

### 2. UI placement: new `ReportsView` card, live-computed, plus a post-import CTA

**Decision:** Add a new report card to `ReportsView.tsx`'s existing `cards` array (same pattern `RptiReportView`/`LkptiReportView`/`MaturityHeatmap`/Budget/Capacity already follow) — a **pure function computed live from `AppState` props on render**, no new IndexedDB store, mirroring how the Budget and Capacity reports already work (not how `RptiDetail`/`LkptiDetail` work, which are pre-generated and stored). This is a read model over existing data, not a new entity.

Separately, once `lkpti-import-onboarding.md` is implemented, its post-import flow should link straight into this report, pre-scoped to what that import just left incomplete — but that wiring is out of scope for *this* doc's implementation (the import feature doesn't exist yet); this doc only needs to make sure the report is generic enough to be filterable/linkable when that day comes.

**Rejected alternatives:**
- **Inline per-row Data Manager badges instead of a standalone page:** rejected for v1 — useful eventually, but it means building indicator UI in every Data Manager tab up front rather than one new report view; a standalone page ships the same information faster and can still deep-link into Data Manager rows.
- **Fold into an existing report (e.g. as a section of the RPTI or LKPTI view):** rejected — this report's scope spans entities neither of those reports touch (Resources, Dependencies, Decisions, Milestones), so it doesn't belong to either one specifically.

### 3. Check list

Grouped by entity. Every soft check is scoped to only the records actually eligible for the report it concerns — e.g. a `type: 'infrastructure'` `Deliverable` is never checked for LKPTI-column completeness, because `generateLkptiDetails` already excludes it from LKPTI generation entirely (mirrors `lkpti.ts`'s own eligibility rule, same for RPTI's rule that a segment needs an `initiativeId` to qualify). This avoids flagging gaps that can never actually affect a generated report.

**Hard (dangling reference — severity `error`):**

| Entity.field | Missing target |
|---|---|
| `Deliverable.assetId` | `Asset` |
| `Asset.categoryId` | `AssetCategory` |
| `DeliverableSegment.deliverableId` | `Deliverable` |
| `DeliverableSegment.initiativeId` (if set) | `Initiative` |
| `DeliverableSegment.status` | no matching `DeliverableStatus.id` — the known, previously-silent gap noted in `rpti.ts` |
| `Initiative.programmeId` | `Programme` |
| `Initiative.strategyId` (if set) | `Strategy` |
| `Initiative.assetId` | `Asset` |
| `Initiative.deliverableId` (if set) | `Deliverable` |
| `Initiative.ownerId` (if set) | `Resource` |
| `Initiative.resourceIds[]` entries | `Resource` |
| `Milestone.assetId` | `Asset` |
| `Dependency.sourceId`/`targetId` | polymorphic (`initiative`/`milestone`/`segment`) |
| `Decision.linkedEntityId` (if set) | polymorphic (`initiative`/`programme`/`asset`) |
| `Decision.supersededBy` (if set) | `Decision` |
| `RptiDetail.initiativeId` | `Initiative` |
| `RptiDetail.targetId` | polymorphic (`deliverable`/`asset`) |
| `RptiDetail.deliverableSegmentId` (if set) | `DeliverableSegment` |
| `LkptiDetail.targetId` | `Deliverable` |

**Soft (report-completeness gap — severity `warning`):**

- `Deliverable` with zero `DeliverableSegment`s at all → invisible to both RPTI and LKPTI generation.
- `Deliverable` with segments, but none carrying an `initiativeId` → this is the "deliverable not linked with an initiative" case you named — can never generate an RPTI row (mirrors `rpti.ts`'s own qualifying-segment rule).
- `Deliverable` (`type: 'application'` or undefined) with no live-status segment → silently excluded from LKPTI generation today, no user-facing signal.
- `Deliverable` with no resolvable `categoryCode` (own field nor `AssetCategory.categoryCode` cascade) → blank regulatory category cell in whichever report(s) it's eligible for.
- `Deliverable` with no resolvable `developer` → blank developer cell.
- `Deliverable` with no resolvable `dcCity`/`dcCountry`/`drCity`/`drCountry` → blank DC/DRC location cell(s).
- `Deliverable` with no `description`, where it is LKPTI-eligible → blank `functionDescription` (ADR-0008 cascade never resolves).
- Generated `LkptiDetail` rows missing any of the 9 columns with no auto-fill source at all (`platform`, `database`, `dcProvider`, `drcProvider`, `backupStrategy`, `systemOwner`, `ownership`, `goLiveDate`, and `developer` for the non-`'inhouse'` case) — reported as "generated but needs manual completion," not a data-model gap per se.
- Generated `RptiDetail` rows missing `categoryCode`/`developer`/`ppjtiRelatedParty` (documented in `rpti-auto-generation.md` as always-manual fields) — same "needs manual completion" framing.
- `Initiative` with no `ownerId` and no legacy `owner` string set → no accountable owner.

### 4. Read-only for v1, with click-to-navigate

**Decision:** the report lists issues; clicking one navigates to the relevant record's row in the relevant Data Manager tab (the same pattern other report views already use to jump between screens), rather than offering inline quick-fix editing within the report itself.

**Reasoning:** building fix-in-place editing for ~20 different check types multiplies this feature's surface area for marginal gain over "click through to the tab you'd already use to fix it" — Data Manager is already the app's editing surface, this report's job is to point at what needs attention, not duplicate the editor. Worth reconsidering only if usage shows people bouncing back and forth enough that it's a real friction point.

---

## Related

- `requirement-specs/lkpti-import-onboarding.md` — the feature that prompted this; once implemented, its post-import flow should link into this report pre-scoped to the gaps it left (Programme/Strategy/Initiative, Resources, Dependencies, Milestones, pre-go-live lifecycle history — see that doc's "What this import does not attempt to derive" section, which maps directly onto several of the soft checks above).
- `src/lib/importValidation.ts` — closest existing precedent for the issue shape (`{entity, issue, severity}`); this feature is effectively that pattern generalized from "one import payload" to "the live workspace, all the time."

## Implemented

`computeDataHealth()` in `src/lib/dataHealth.ts` implements the full check list in "Decided" §3 exactly, with one navigation simplification worth recording: the "click-to-navigate" decision in §2/§4 said clicking an issue "navigates to the relevant record's row" — in practice this means landing on the correct Data Manager tab (or the Decisions view, for decision-linked issues) with the record's name pre-filled into the existing global search box, which the search-filterable tabs already use to narrow their table to that name. It does **not** scroll to or highlight the specific row — building that would mean threading a highlight/scroll prop through the shared `EditableTable` and every tab that renders it, for a v1 whose own reasoning (§4) already argues against building new UI surface area when an existing mechanism gets most of the way there. Worth reconsidering only if usage shows the search-box handoff isn't precise enough in practice.

Note also: `DataManagerTab` (the tab-id union) now lives in `src/lib/dataHealth.ts`, imported by `src/components/DataManager.tsx`, rather than the other way around — a pure-lib module shouldn't depend on a component file, so the type moved to be the shared source of truth.
