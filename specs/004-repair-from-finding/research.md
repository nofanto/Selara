# Research: Repair an Unresolved Imported RPTI Row from Its Finding

All findings were read from the tree at `9c9a22d` (branch `051-unresolved-row-repair`, the base of this
feature). On 2026-09-25 both branches were rebased onto `origin/main` at `e30f718` (#57); the new base is `9e38187`. #57 touched none of the files cited here, so every line reference still holds. Each says what was decided, why, and what was turned down (Constitution IV).

## R1 — Where the repair starts, and how the UI knows a finding is repairable

**Measured.** An unresolved row's finding reaches the preparer in two places, both inside `ReportsView`:
- The **Data Health review** (`DataHealthReportView`) receives `HealthIssue`s. For this row the issue is
  `rpti-target:<rowId>`, and its message is the reconciliation message (`dataHealth.ts:335`). The only
  action a row offers today is `onNavigate`.
- The **RPTI pre-export gate** renders `rptiPreExportIssues`, which is a list of message **strings**
  (`ReportsView.tsx:181-203`). The finding objects (`rptiReconciliationFindings`) are computed there,
  then reduced to text.

**Decision.** A pure predicate, `isRepairableUnresolvedRow(row)`, decides repairability. It is true when
the row's target starts with `UNRESOLVED_IMPORT_TARGET_PREFIX` and the row has no segment anchor. The
reason must be `missing-target`, which is the only reason such a row can produce (see R9). Data Health
issues gain an optional, computed `action` field. The field is not stored, so #42 does not apply. The
gate renders its reconciliation findings as objects, so the button sits beside the message it repairs.
Both open one `UnresolvedRowRepairDialog`, hosted by `ReportsView`, which calls a new `onRepair...`
prop that `App` supplies.

**Rejected.**
- *Matching on message text.* Brittle, and the messages were rewritten twice this week.
- *A separate "Repairs" screen.* Q22 says the repair starts from the finding.
- *Adding the action to every `missing-target` finding.* A deleted Deliverable is out of scope (spec
  edge cases). Its repair is the existing advice, or restore or re-import.

## R2 — Applying the repair as one change (FR-014)

**Measured.** `App.handleUpdate(data)` sets every collection, pushes one undo snapshot, and persists the
whole workspace through `saveAppData` in one IndexedDB `readwrite` transaction over all stores
(`App.tsx:618`, `db.ts:324`). Per-entity handlers (`handleSaveDeliverableSegment`, `handleAddAssets`, …)
each call `handleUpdate` once, closing over the state from the last render.

**Decision.** A pure `applyUnresolvedRowRepair(state, request) → { ok: true, state } | { ok: false,
reason }` returns the next workspace. `App` passes it to a single `handleUpdate`. That gives all-or-nothing
(FR-014) and a single undo step, and it needs no new persistence code.

**Rejected.**
- *Chaining the existing per-entity handlers.* That means several transactions, several undo entries,
  and stale closures: each call rebuilds state from the previous render, so a later call can overwrite
  an earlier one.
- *A new "repairs" store.* `AppState` is enumerated at every call site (spec constraint), and nothing
  needs recording beyond the entities the repair creates.

## R3 — Where each pre-filled value comes from (FR-004 to FR-006)

**Measured.**
- The stored row (`RptiDetail`) carries `categoryCode`, `developer` (`inhouse` or `PPJTI`),
  `ppjtiRelatedParty`, DC/DR city and country, `plannedImplementationQuarter` and `remarks`. It holds
  no name, cost or year.
- The importer names the initiative `${row.name} — ${quarter} ${reportYear}` and sets its dates to the
  filed quarter (`rptiImport.ts`, Q21 rules 1-2).
- The importer sets `Initiative.capex`/`opex` from the filed row.

**Decision.** A pure `unresolvedRowRepairDraft(row, state)` returns the form's initial values, each
tagged with its source so the form can label it:
- **name** — the initiative name with `/ — Q[1-4] \d{4}$/` removed. If there is no suffix, the whole
  name, flagged "check".
- **filed year** — from the suffix; if there is none, the year of the initiative's `startDate`.
- **quarter** — from the row. Read-only (spec Assumptions).
- **developer** — `inhouse` stays `inhouse`. `PPJTI` gives an empty provider-name field that must be
  filled, and `PPJTI` itself is refused as a name (FR-006).
- **related party, DC/DR, category, Keterangan** — from the row, as filed.
- **CapEx/OpEx** — from the initiative, labelled as its current budget (FR-005).

**Rejected.**
- *Storing the filed name, cost or year on the row, or in a side store, at import.* FR-026 of spec 002
  deliberately keeps no copy of what was imported, and changing stored rows breaks Q12.
- *Asking the preparer to type the year.* It re-keys a value the import already recorded in two places.

## R4 — Which status the created segments use

**Measured.** Statuses are ordinary workspace data. Generation reads the `isLiveStatus` flag, never the
name (`deliverableStatusDefaults.ts`). The importers use `IN_PRODUCTION_STATUS` and merge it into the
workspace's statuses if it is missing.

**Decision.** Use the first status whose `isLiveStatus` is set. If the workspace has none, add
`IN_PRODUCTION_STATUS` exactly as the importers do. Either way the segments are live by the same rule
generation reads.

**Rejected.** *Always adding `IN_PRODUCTION_STATUS`.* It would duplicate a live status that a workspace
has renamed. That is the confusion `deliverableStatusDefaults.ts` was written to end.

## R5 — The prior live phase: one rule, one helper (FR-010, FR-011, FR-017)

**Measured.**
- The importer creates its synthetic prior phase, `${reportYear-1}-01-01` to `${reportYear-1}-12-31`,
  unlinked and live, in **two** places: for an entry it creates itself (FR-019a infrastructure,
  `rptiImport.ts:370-375`), and for a matched entry with no live history before the filed quarter,
  including history created earlier in the same import (FR-018b of spec 003, `rptiImport.ts:394-410`).
  Both must change, or FR-017 holds for one path only.
- LKPTI membership is "live on the as-at date" (`lkpti.ts:88-93`).
- Projection types a row `upgrade` when any live segment on the Deliverable starts before this one
  (`rpti.ts:172`). An unlinked segment files no RPTI row (`rpti.ts:180`, which requires `initiativeId`).

**Decision.** One exported helper, `continuousPriorLivePhase(deliverableId, filedYear, statusId, id)`,
returns a live, unlinked segment from `${filedYear-1}-01-01` to `openEndedDate(filedYear)`. Three
places use it: the importer (FR-017), option B (FR-010), and option A when needed (FR-011). One phase,
overlapping the filed quarter (spec Assumptions). It starts in the year before the filed year, so it
never files an RPTI row of its own in the filed year, and it is unlinked, so it files none at all.

**Rejected.**
- *Splitting the phase around the filed quarter.* It gives the same RPTI and LKPTI output, but makes
  two segments to keep consistent when the implementation moves.
- *Extending the upgrade's own segment to the horizon.* That reverses Q21 rule 3 (an upgrade is the
  filed quarter only).

## R6 — "Has live history before the filed quarter" must mean what generation means

**Measured.** Generation's test is the local `wasLiveBefore` closure in `projectRptiReturn`
(`rpti.ts:172`). The importer has a second copy of the same test (`rptiImport.ts:394-401`).

**Decision.** Export one predicate, `hasLiveHistoryBefore(deliverableId, date, segments, statuses)`,
from `rpti.ts`. Generation, the importer, and option A's "does this entry need prior history?" check
(FR-011) all call it. If the form's check and generation's check can differ, the form can promise
`upgrade` and the filing can say `new`.

**Rejected.** *A third copy in the repair code.* The comment at `rpti.ts:166-170` records that this test
was once made against the filing year's start rather than the implementation's own. Copies of a rule
like this drift, and a third copy is one more place to drift.

## R7 — Field differences for option A are what would be *filed*, not raw fields (FR-012)

**Measured.**
- Category, DC and DR resolve from the Deliverable's override and fall back to its Asset Category
  (`rpti.ts:236`, `resolveAssetCategory`).
- The RPTI developer is derived: anything not `inhouse` files `PPJTI` (`rpti.ts:221`).
- Related party files `n/a` unless the developer is `PPJTI` (`rpti.ts:235`).

**Decision.** Compare the filed row with what projection would file for the chosen Deliverable, using
the same derivation. Extract the attribute-derivation half of `projectRptiReturn` into an exported
`filedAttributesFor(deliverable, assets, categories)` and call it from both places. Consequences:
- A Deliverable whose developer is `Vendor X` against a filed `PPJTI` is **not** a difference. It files
  `PPJTI`.
- A category inherited from the Asset Category that already equals the filed code is not a difference.

"Update" writes the Deliverable's override field (`categoryCode`, `dcCity`, …), or `developer` /
`ppjtiRelatedParty`. "Keep" writes nothing.

**Rejected.** *Comparing raw Deliverable fields.* It would report a difference for every inherited
category and every named provider, so preparers would learn to click through it. That makes FR-012's
"nothing silent" meaningless.

## R8 — Suggesting candidates without choosing one (FR-015, FR-016, SC-005)

**Measured.** No fuzzy-matching helper exists in `src/`. The importer matches exactly on the trimmed,
lowercased name plus the category code. An infrastructure row is held back only when **several**
entries match that exactly.

**Decision.** A pure `rankRepairCandidates(row, draftName, deliverables, assets, categories)`:
- **Pool:** Deliverables of the same kind as the row, application or infrastructure, judged by the
  filed category code.
- **Normalise** names: lowercase, strip punctuation, collapse whitespace.
- **Tier 1:** the normalised name is equal.
- **Tier 2:** at least half the words are shared, and the category is the same.
- **Tier 3:** everything else, alphabetical.
- Ties break by name, then id, so the order is deterministic.

The component shows tier 1-2 as "Suggested", lets the preparer search all tiers, and pre-selects
nothing. At 300 applications this is a few thousand string comparisons per keystroke, which is well
within SC-005. `scale.test.ts` gets a bound.

**Rejected.**
- *Edit-distance ranking.* It is harder to explain than shared words, and for bank application names,
  which differ by added words far more than by typos, it gains nothing.
- *Auto-selecting a single tier-1 candidate.* That is the automatic cross-return match FR-019 forbids.

## R9 — The finding cannot co-exist with a live implementation; confirm re-checks anyway

**Measured.** For a row with no anchor, reconciliation tries (initiative, target), then the initiative
alone: exactly one live implementation of the initiative matches it, and several are an identity
conflict (`rpti.ts:388-420`). An unresolved row's target never exists. So a `missing-target` finding
on it means the initiative has **no** live implementation.

**Decision.** `applyUnresolvedRowRepair` re-runs the precondition against the state it is given: the
row still exists, is still repairable, and the initiative still has no live implementation. It returns
`{ ok: false }` if anything changed while the dialog was open, for example through another tab's sync.

**Consequence for FR-013.** No reconciliation change is needed. Once the one implementation exists, the
existing initiative fallback accounts for the row, and the finding clears.

## R10 — Existing workspaces: detect the old shape and offer the extension (FR-018, FR-018a)

**Measured.**
- The importer's prior phase has id `rpti-import-seg-prior-<n>`, dates `${Y}-01-01` to `${Y}-12-31`,
  status `IN_PRODUCTION_STATUS.id`, and no `initiativeId`.
- Only applications appear in the LKPTI (`lkpti.ts:83`).
- Segment ids survive export/import and version restore; they are ordinary fields.

**Decision.** A pure `priorPhaseGaps(state)` returns, for each segment that matches **exactly** the
importer's original shape (id prefix, both dates, status, unlinked) on an **application**, the years in
`Y+1 … Y+6` whose 31 December the Deliverable is not live on. `Y+6` is the horizon of the filed year
`Y+1`. A segment with any of those properties changed is not the importer's shape, so it is skipped;
an edited phase is the preparer's decision. A non-empty result raises a **warning**-severity issue,
`rpti-import-prior-phase-gap:<segmentId>`, whose `action` extends that one segment's `endDate` to
`openEndedDate(Y+1)`. The extension also goes through `handleUpdate`, so it too is one undoable change.

**Rejected.** Both are recorded as Q22 decisions:
- *Migrating on open.* A silent change to stored data.
- *No signal.* A known inventory gap left invisible.

## R11 — What B creates, and the ids it uses

**Decision.**
- **Asset** — the confirmed name, and the Asset Category whose `categoryCode` equals the filed code. If
  there is none, create one exactly as the importer does (`rptiImport.ts:268-275`), so category
  resolution stays shared.
- **Deliverable** — `type: 'application'` (B is offered only for applications). It gets the confirmed
  developer (the provider's name when `PPJTI`), related party, and DC/DR. `categoryCode` is set only if
  it differs from the Asset Category's default.
- **Ids** are derived from the stored row's id: `rpti-repair-asset-<rowId>`,
  `rpti-repair-deliv-<rowId>`, `rpti-repair-seg-<rowId>`, `rpti-repair-seg-prior-<rowId>`. The same
  row always repairs to the same ids, which makes tests exact and a double confirm detectable.
- **Initiative** — its `assetId` moves to the resolved Asset (FR-009). Nothing else on it changes.

**Rejected.** *`Date.now()` ids*, as `handleSaveDeliverableSegment` uses. They are not reproducible, so a
second confirm would duplicate silently.

## R12 — Nothing stored gains a field (FR-019, #42)

**Measured.** The repair writes existing fields of `Asset`, `Deliverable`, `DeliverableSegment` and
`Initiative`. `HealthIssue.action` is computed on every render and never persisted.

**Decision.** No change to `types.ts` entities, the IndexedDB schema, or `diffFieldPolicy.ts`. The
field-policy test already walks every entity's keys, so it would fail if a stored field were added by
mistake.

## R13 — SC-004 is measured, not predicted

**Decision.** A Vitest case records LKPTI row counts as at 31 December for 2026-2032 on the samples
in three states:
1. The import after this feature, which exercises FR-017's importer change.
2. After the Legacy Teller B repair.
3. The Q21 baseline, 13, 16, 16, 16, 16, 16, 3, restated as the comparison.

The numbers go into Q22 with an explanation of each difference. Expect state 2 to add one application
from 2026, since B's prior phase starts in the year before the filed year, and every count after that
to be explained. The test pins the measured values, not this expectation.
