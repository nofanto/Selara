# RPTI Row Auto-Generation (Design Notes)

> **Status:** Implemented — see `generateRptiDetails` in `src/lib/rpti.ts`, wired to the **Generate `<year>` RPTI Rows** button in Data Manager → RPTI (`src/components/DataManager.tsx`). Rows remain user-editable after generation; nothing here is enforced beyond generation time.
> **Context:** `RptiDetail` rows in Data Manager → RPTI are generated from `Initiative`/`DeliverableSegment` data one report-year at a time (see `docs/adr/0003-rpti-report-and-application-type.md` for the underlying data model). This doc captures the agreed generation rule, plus what's still open.

## Column summary & auto-fill source

| Column | Field | Auto-fill source | Editable after generation? |
|---|---|---|---|
| No. | *(display only)* | Sequential index — not stored | — |
| Target | `targetId` / `targetType` | The qualifying segment's `deliverableId`; `targetType` fixed to `'deliverable'` | Yes |
| Initiative | `initiativeId` | The qualifying segment's `initiativeId` | Yes* |
| Category | `categoryCode` | `Deliverable.categoryCode ?? AssetCategory.categoryCode` (via `Asset.categoryId`) — see `requirement-specs/rpti-auto-fill-improvements.md` / [ADR-0006](../docs/adr/0006-rpti-auto-fill-and-single-currency.md) | Yes |
| Dev Type | `developmentType` | Derived per the collapsing rule below (not a plain per-segment lookup) | Yes |
| Developer | `developer` | `Deliverable.developer` — no category-level default | Yes |
| PPJTI Related Party | `ppjtiRelatedParty` | `'n/a'` whenever the resolved `developer !== 'PPJTI'` (including unset); left blank for manual entry only when `developer === 'PPJTI'` | Yes |
| Quarter | `plannedImplementationQuarter` | The anchor segment's `startDate` (see anchoring rule below) — extends the existing `suggestDeliverableQuarter` logic | Yes — manual value wins if set, else the suggestion is used |
| CapEx / OpEx | `capexAmount` / `opexAmount` | *(pre-existing)* `resolveCost` — defaults to the linked Initiative's `capex`/`opex`. Always in `TimelineSettings.defaultCurrency` — a single workspace-wide currency, not tracked per row | Yes — same override-wins pattern |
| DC / DR Location | `dcCity`, `dcCountry`, `drCity`, `drCountry` | `Deliverable.dcCity ?? AssetCategory.dcCity` etc., resolved independently per field | Yes |
| Remarks | `remarks` | **No source — always manual, free text** | Yes |
| *(provenance, not a report column)* | `deliverableSegmentId` | Set to the qualifying segment's `id` — becomes the row's generation anchor, not just quarter-derivation metadata like it is today | — |

\* Initiative is implied by the segment, but nothing stops editing it after generation if that ever makes sense — worth deciding later whether it should be locked.

## Row generation rule

1. **Rows are never manually added or removed.** Existence is entirely derived from `DeliverableSegment` data — auto-generated and auto-filled, with fields remaining user-editable afterward.

2. **RPTI rows are generated one report-year at a time — but `developmentType` also checks a deliverable's full history.** Generating the report for year Y produces rows only from `DeliverableSegment`s whose `[startDate, endDate]` range **overlaps** Y — i.e. `startDate <= Y-12-31 AND endDate >= Y-01-01` — regardless of which year they started or end in; a segment with no overlap into Y never generates a row of its own. The one exception is the new/upgrade signal itself (see step 4): before classifying a pair `'new'`, generation checks whether the deliverable has **any** live segment, in any year, that ended before Y started — if so, the deliverable already exists and this year's activity is an `'upgrade'`, not a first-ever build. This is a narrow, deliberate exception to "no lookback": it only ever answers "has this deliverable gone live before," never pulls in an extra row from another year.

3. **Within a report-year's window, a segment "qualifies" only if:**
   - its `status` is `planned`, `funded`, or `in-production`, **and**
   - it has an `initiativeId` set (unlinked segments can't be attributed to an initiative, so can't generate a row), **and**
   - that initiative is **not** a placeholder (`isPlaceholder !== true`) — ⚠️ **decided, not yet implemented**: placeholder initiatives are empty markers, not real work, and shouldn't drive report rows even if a segment happens to reference one.
   - `sunset` / `out-of-support` / `retired` are explicitly **out of scope for now** — no row.

4. **Rows are grouped and collapsed by `(initiativeId, deliverableId)`, within the report-year's window:**
   - If the pair has one or more qualifying `planned`/`funded` segments **and no qualifying `in-production` segment** in that window → **one row**, anchored on the **latest** of those segments (`funded` over `planned`) for `deliverableSegmentId` and quarter derivation. `developmentType` is `'new'` — **unless** the deliverable already has a live segment (anywhere, any initiative) that ended before this report year started, in which case it's `'upgrade'` instead (see rule 2's history check).
   - If the pair has one or more qualifying `planned`/`funded` segments **and** a qualifying `in-production` segment, all in the same report-year → these **collapse into one row**, `developmentType: 'new'` (it's still the deliverable's first go-live — the same prior-history check applies here too, though in practice it's expected never to trigger given the "at most one `in-production` segment ever" assumption below), and `plannedImplementationQuarter` is derived from the **`in-production` segment's** `startDate`, not the planning segment's — that's the more meaningful "when did it actually land" answer.
   - If the pair has **only** a qualifying `in-production` segment in that window (no planned/funded segment this year) → **one row**, `developmentType: 'upgrade'`, unconditionally — still a documented simplification: it doesn't distinguish "this is genuinely a subsequent upgrade" from "this is actually the first-ever go-live, tracked without a formal planning segment." Fixing that direction (flipping to `'new'` when there's no prior live history at all) was considered but deferred — see "Related, discussed separately."
   - Distinct `(initiativeId, deliverableId)` pairs always produce separate rows — no merging across different initiatives or different deliverables.

5. **`targetType` is always `'deliverable'` — bare Asset targets are out of scope for generation, by decision.** `Asset` has no lifecycle/segment concept to anchor a rule to, and infrastructure work already has a first-class home: a `Deliverable` with `type: 'infrastructure'` (added in ADR-0003 for exactly this), complete with its own segments. Reportable infrastructure changes — data center relocation, network capacity additions, etc. — should be modeled as an infrastructure-type `Deliverable` going forward, not as a direct `targetType: 'asset'` row, so they generate under the same rule as everything else with no special-casing. Existing manually-created asset-target rows remain readable/editable, but this generation path does not create or extend them.

## Decided, not yet implemented

- **Strategy/Programme generation filter (rule 3):** original framing was that initiatives should be "triggered by an Initiative that belongs to a Strategy or Programme." `Initiative.programmeId` is already **mandatory** on every real Initiative, so that's trivially true already except for `isPlaceholder` initiatives (empty markers, not real work) — resolved as: **exclude `isPlaceholder` initiatives from generation** (folded into rule 3 above; implemented — see "Review findings" below). A stricter reading — additionally requiring `strategyId` to be set — was considered and rejected for now: it would exclude real initiatives that never got a Strategy tag, and `strategyId` is optional by design elsewhere in the app.

## Review findings (issue #3) — allow-list status classification, placeholder exclusion

A review of this generation logic (issue #3) found two gaps between this spec and `generateRptiDetails`'s actual behavior:

1. **Rule 3's status qualification was implemented as a deny-list, not the allow-list the rule describes.** `classifySegmentKind` excluded only statuses matching a `sunset|out-of-support|retired|decommission` name pattern and treated *everything else* — including any custom `DeliverableStatus` a workspace adds later (`"Cancelled"`, `"On Hold"`, `"Blocked"`, ...) — as `'new'` by default. Since `Deliverable Statuses` is a fully user-editable Data Manager tab, this silently produced false regulatory-report rows for any status that wasn't literally "live" and didn't happen to match the exclusion pattern.
2. **Placeholder-initiative exclusion** (the item directly above) was never actually implemented, despite being marked decided.

**Decision:** flip status classification to a genuine allow-list, mirroring the explicit-flag-first / pattern-fallback-second design `isLiveStatusId` already uses:

- `DeliverableStatus` gains a new optional `isPreLaunchStatus?: boolean` flag (parallel to the existing `isLiveStatus?: boolean`), marking a status as representing planned/funded pre-launch work.
- `isPreLaunchStatusId(statusId, deliverableStatuses)`: an explicit `isPreLaunchStatus: true` always wins. If **no** status in the workspace has the flag explicitly set (legacy/demo data predating this flag), fall back to recognizing the default `appstatus-planned`/`appstatus-funded` ids or a name containing "planned"/"funded" — same escape-hatch shape as `isLiveStatusId`'s existing fallback, so pre-existing workspaces keep working without a migration.
- `classifySegmentKind` becomes a strict 3-way allow-list: `isLiveStatusId` → `'live'`; else `isPreLaunchStatusId` → `'new'`; else `'excluded'` — the deny-list regex is removed entirely, since "not live and not planned/funded" is now the correct default for `'excluded'` rather than a special case to detect.
- The Deliverable Statuses tab in Data Manager gains **Live?** and **Pre-Launch?** checkbox columns, so a workspace can classify a custom status explicitly instead of relying on name-pattern guessing — closing the gap where neither flag had any UI before this change.
- `qualifying` in `generateRptiDetails` now excludes segments whose `initiativeId` resolves to an `isPlaceholder: true` Initiative — folded into the same existence-check `Set` already used to guard against dangling `initiativeId` references, so a placeholder-linked segment is treated exactly like an orphaned one (correctly excluded).

See [ADR-0009](../docs/adr/0009-rpti-status-allow-list.md) for the full record.

## Considered and rejected

- **Using `Milestone` as the quarter-source instead of `DeliverableSegment`.** `Milestone` has only a point-in-time `date` and a `type: 'info' | 'warning' | 'critical'` — a severity flag, not a lifecycle-stage flag, so nothing distinguishes an implementation/go-live milestone from any other kind (e.g. "Contract Signed," "Budget Approved") without inventing a new signal from scratch. `DeliverableSegment` already has exactly that signal via `DeliverableStatus.isLiveStatus`, which is also what `developmentType` (new/upgrade) is derived from — splitting the quarter off to a differently-shaped record would create two independently-editable sources of truth for what should be the same real-world event, with nothing keeping them in sync. RPTI generation stays fully segment-based; `Milestone` is not extended with `deliverableId`/`initiativeId` for this purpose.

## Shared domain assumptions

- Every deliverable is expected to pass through at least a `planned` segment and an `in-production` segment at some point in its life (not enforced in code today, just a shared mental model).
- **A deliverable is assumed to have at most one `in-production` segment, ever.** This is what keeps the collapsing rule in step 4 simple — there's no need to handle "which of several in-production events does this row represent," since repeat upgrades to something already live aren't expected to be modeled as additional `in-production` segments on the same deliverable.

## Regeneration behavior (v1)

Pressing "Generate" wipes all existing generated rows for the current report-year and rebuilds them from scratch — no reconciliation with prior manual edits. Simplest possible behavior to ship first; revisit if losing edits on regenerate turns out to be painful in practice.

## Related, discussed separately

- **Version History** as the mechanism for archiving/auditing RPTI data year over year (see conversation; not yet written up as a spec). Key finding: restoring a version never touches the saved-versions list itself — it's a flat, independent store, so archival snapshots are safe to keep alongside live data. Gaps: no scheduled/automatic snapshotting, and no read-only view of a past version's RPTI table without a full workspace restore.
- **Excel import/export** interaction with `versions` — flagged to revisit once the RPTI generation design is further along.
- **Rule 4's third bullet (in-production-only this year → always `'upgrade'`)** could use the same prior-live-history check, in the opposite direction: if there's no prior live segment at all, an in-production-only segment this year is genuinely a first-ever go-live and should be `'new'`, not a default-guessed `'upgrade'`. Deferred for now — the fix implemented here only addresses the bullet-1 case (planned/funded this year, deliverable already live before).
