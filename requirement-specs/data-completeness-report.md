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

---

## Phase 2 — Validity checks (decided 2026-09-02, tracked as issue #16)

> Tracked as [issue #16](https://github.com/nofanto/Selara/issues/16). The shipped report above becomes **phase 1**; this section records the decision to add a **phase 2** on top of it.

### Context

Everything `computeDataHealth` checks today asks one of two questions: *does this reference resolve?* or *is this value present?* — the LKPTI field check is literally a `!l[f.key]` falsiness test. **Nothing asks whether a value that is present is actually legal.** A workspace can therefore report "the workspace is clean" while holding a `goLiveDate` of `31-02-2021`, a 900-character `functionDescription`, and two applications with identical names — all three of which OJK would reject at filing time.

This came out of refining a set of agent use-case placeholders, one of which proposed a separate agent-facing filing-readiness report. That brainstorm is tracked separately and is not part of this change; its rule-engine content is **superseded by this section**: the validation is deterministic and belongs in `src/lib/` with unit tests, not in an agent.

### Decided

#### 1. Phase is a *classification*, not a gate

**Decision:** `HealthIssue` gains `phase: 'completeness' | 'validity'` alongside the existing `severity`. Both phases always run; the phase is a filter axis in the UI, not control flow. Gating happens *per value* — "validate `goLiveDate` only if it's set" is a guard inside the individual check.

**Reasoning:** the alternative reading — don't run phase 2 until phase 1 is clean — makes phase 2 effectively unreachable. Real workspaces always carry some phase-1 warnings (an Initiative with no owner, a Deliverable with no description), so the validity errors that actually get a filing rejected would stay hidden behind gaps nobody treats as urgent. Severity and phase are genuinely independent axes and should stay that way.

#### 2. No reporting-period input; "not in the future" means relative to today

**Decision:** rule 5.3's "must not be in the future relative to the reporting period end date" is evaluated against the current date. No period parameter, no new `TimelineSettings` field.

**Reasoning:** a reporting period end is not a concept the data model has, and adding one is a schema change for a value that changes every filing cycle. Evaluating against today answers "is this ready to file *now*," which is the question being asked in practice.

**Known limitation, accepted:** preparing a filing for a period that has already closed (filing for the quarter ending 30 June, in July) will not flag an application that went live on 5 July, even though it is legitimately in the future relative to that period end. Revisit if filings are routinely prepared retrospectively.

#### 3. Absorbed into this report, not a separate one

**Decision:** phase 2 extends the existing report and its existing card, rather than shipping a second "filing readiness" report.

**Reasoning:** with the period parameter dropped (§2), nothing about phase 2 is filing-specific enough to need its own home — it is simply more checks over `AppState`. Reusing one `HealthIssue` shape, one navigation contract, and one card avoids duplicating plumbing and avoids the "which report do I open?" question. The concern that this merges "you haven't filled this in yet" with "this filing will be rejected" is answered by the phase axis in §1 rather than by a second report.

**Consequence:** the user-facing title changes from "Data Completeness" to **Data Health**, since phase 2 is not completeness. The code already uses that name (`dataHealth.ts`, `DataHealthReportView`, `report-view-data-health`), so only the display string and the card description change.

#### 4. A verdict line

**Decision:** the report gains a summary line above the list — e.g. *"Not ready to file — 2 validity errors, 5 completeness gaps."* This is where the phase split pays off for the user, and it delivers the filing-readiness answer without a second report.

#### 5. Workspace-level issues get a synthetic entity

**Decision:** the RPTI currency check (§6 below) is a property of `TimelineSettings`, not of any record, but `HealthIssue` requires `entityType`/`entityId`/`entityName` and the click-to-navigate contract assumes a record to search for. Such issues use a synthetic `entityType: 'Workspace'` entity, navigating to the RPTI tab where `defaultCurrency` is edited.

**Rejected:** making the entity fields nullable with a no-op navigate — keeps the list non-uniform and gives the user a dead click.

#### 6. The check list

**LKPTI — value validity (all guarded on the value being present):**

| Check | Source rule | Severity |
|---|---|---|
| `goLiveDate` matches `^\d{2}-\d{2}-\d{4}$` and is a real calendar date | lkpti-schema §5.3 | `error` |
| `goLiveDate` is not in the future relative to today | lkpti-schema §5.3 | `error` |
| Field length caps — `functionDescription` ≤ 500; `applicationName`, `platform`, `database`, `dcLocation`, `dcProvider`, `drcLocation`, `drcProvider`, `systemOwner`, `developer` ≤ 100 | lkpti-schema §6 | `error` |
| Free-text fields contain no line breaks and no untrimmed whitespace | lkpti-schema §5.9 | `warning` |
| `applicationName` (from `Deliverable.name`) is unique across the submission | lkpti-schema §5.8 | `warning` |

**RPTI — workspace validity:**

| Check | Source rule | Severity |
|---|---|---|
| `TimelineSettings.defaultCurrency` is set and is not `IDR` — the export cannot carry the IDR-equivalent the schema requires, because ADR-0006 removed those fields by design | rpti-schema §10 vs [ADR-0006](../docs/adr/0006-rpti-auto-fill-and-single-currency.md) | `warning` |

**Deliberately not checked, with reasons:**

- **`row_number` unique/sequential, no gaps (lkpti-schema §5.1)** — structurally guaranteed: `exportLkptiReportToExcel` emits `index + 1` over the array (`src/lib/lkpti.ts`), so it is always `1..n` contiguous.
- **Enum membership — `categoryCode`, `backupStrategy`, `ownership` (§5.2 and the §3/§4 enums)** — compile-time safe via `LkptiCategoryCode`/`LkptiBackupStrategy`/`LkptiOwnership`, and the one runtime entry path (LKPTI import) already validates with `isLkptiCategoryCode` (`src/lib/lkptiImport.ts`). Adding a runtime check would only defend against hand-edited IndexedDB.
- **`self` / `inhouse` semantics (§5.4, §5.5)** — "any other value must be a legal entity name" is not mechanically decidable.
- **PPJTI cross-reference (§5.6)** — requires the IT service provider list from a different LKPTI format, which this app does not model.

Note on the go-live date specifically: both *machine* paths already produce correct `dd-mm-yyyy` — import converts via `toDdMmYyyy` and `suggestGoLiveDate` does the same. The only unvalidated entry path is **manual typing**, since `DataManager.tsx` renders `goLiveDate` as a plain text input labelled "(dd-mm-yyyy)" with no validation. That is a narrower gap than "dates are unchecked," but a real one.

### No ADR

Same reasoning as the phase-1 feature: no new dependency, no IndexedDB schema change (`HealthIssue` is a computed read model, never persisted), no infra change, and no prior decision reversed. ADR-0006 in particular is **not** superseded — the currency check surfaces a consequence of that decision, which is a different thing from reversing it.

### Agent exposure — explicitly out of scope here

The rule engine is a deterministic pure function with unit tests; that is where the regulatory truth lives, and no schema rule should end up encoded only in a prompt. An agent narrating or triaging `computeDataHealth`'s output remains a separate, much smaller idea, tracked outside this document.
