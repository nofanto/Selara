# Report Rows as Projections, Not Storage — Design Notes

> **Status:** Problem verified, diagnosis settled, **the decisions are open**. Written to
> settle the open questions below before any Spec Kit spec, which will be raised jointly
> with [#40](https://github.com/nofanto/Selara/issues/40) — see "Why this cannot ship
> before #40".
> **Nothing is implemented.**

## The observation

Importing LKPTI and RPTI fills the Data Manager's RPTI and LKPTI tabs with rows. The
question raised: should those tabs not be **empty** after import, with rows produced by
pressing **Generate** from the data that was imported?

It is a good instinct. Step 2 of `it-planning-flow.md` — *Maintain, the year-round work* —
describes a workspace of assets, deliverables, segments and initiatives; step 3 *prepares
the filing* by generating rows from it. Import currently short-circuits that, writing the
step-3 output directly. So the model the diagram describes and the model the importer
produces disagree.

## Verified: it cannot work today, and this is why

Discarding the imported rows and regenerating from the same workspace loses, on the 13-row
sample:

| LKPTI field | rows losing it | | RPTI field | rows losing it |
|---|---|---|---|---|
| `platform` | 13/13 | | `capexAmount` | 13/13 |
| `database` | 13/13 | | `opexAmount` | 13/13 |
| `dcProvider` | 13/13 | | `remarks` | 11/13 |
| `drcProvider` | 13/13 | | `ppjtiRelatedParty` | 10/13 |
| `backupStrategy` | 13/13 | | | |
| `systemOwner` | 13/13 | | | |
| `ownership` | 13/13 | | | |
| `developer` (vendor name) | 9/13 | | | |

`generateLkptiDetails` derives seven cascaded fields (`lkpti.ts:100-108`). The rest have **no
source anywhere in the workspace**: the filed return is the only place they exist, and
`LkptiDetail` is the only record that can hold them. Generate-on-demand would produce 13 rows
with seven fields filled and eight blank.

The RPTI losses are milder and two are not real: `capexAmount`/`opexAmount` are *overrides*,
and `resolveCost` (`rpti.ts:296-301`) falls back to the linked Initiative's figures, which the
importer does set — so the exported value survives even though the detail field empties.

## Diagnosis: `LkptiDetail` is two things wearing one name

The reason the proposal fails is not that generation is weak. It is that the record conflates:

1. **Attributes of the application.** `platform`, `database`, `dcProvider`, `drcProvider`,
   `backupStrategy`, `systemOwner`, `ownership`, and the vendor name in `developer`. These are
   facts about the deliverable, true whether or not anyone files anything this year.
2. **A projection into a report row.** `categoryCode`, the four location fields,
   `functionDescription` — every one already derived by cascade from the Deliverable and its
   AssetCategory.

Group 1 has nowhere else to live, so it is stored on the report row by default rather than by
design. Move it onto `Deliverable` and `LkptiDetail` becomes purely derived — at which point
the proposal works exactly as described.

**There is already precedent in the codebase for exactly this move.** `goLiveDate` was once
manual-only; it is now derived by `suggestGoLiveDate()` from the deliverable's first live
segment (`lkpti.ts:117`, `lkpti.ts:46-54`). It is the one field in group 1's original list
that *survived* the discard-and-regenerate test, because it stopped being storage and became a
projection. The same argument applies to the other eight; they simply have no timeline concept
to derive from, so they need a home on the entity instead.

## Field inventory

The unit of the eventual decision. **D** = already derived, **A** = an attribute of the
application, **R** = genuinely about this report row.

### `LkptiDetail`

| Field | | Notes |
|---|---|---|
| `categoryCode` | D | cascades Deliverable → AssetCategory |
| `dcCity` `dcCountry` `drCity` `drCountry` | D | cascade, per field |
| `functionDescription` | D | `Deliverable.description` |
| `goLiveDate` | D | `suggestGoLiveDate()` from the first live segment |
| `platform` | A | what the application is built on |
| `database` | A | |
| `dcProvider` `drcProvider` | A | who runs the data centre — 'self' or a company |
| `backupStrategy` | A | |
| `systemOwner` | A | the person accountable for the application |
| `ownership` | A | lease or outright purchase |
| `developer` | A | 'inhouse' derives; the vendor **name** does not |

Every non-derived field is an **A**. `LkptiDetail` has no genuine **R** at all — which is the
strongest evidence that it should be a pure projection.

### `RptiDetail`

| Field | | Notes |
|---|---|---|
| `initiativeId` `targetType` `targetId` | D | the pair generation groups by |
| `categoryCode` `developer` | D | from the Deliverable |
| `developmentType` | D | prior-live history — see `rpti-auto-generation.md` |
| `dcCity` `dcCountry` `drCity` `drCountry` | D | cascade |
| `plannedImplementationQuarter` | D | anchor segment's start date |
| `deliverableSegmentId` | D | the anchor itself |
| `capexAmount` `opexAmount` | D\* | overrides; `resolveCost` falls back to the Initiative |
| `ppjtiRelatedParty` | A? | derived as `'n/a'` when the developer is not PPJTI, but **left blank when it is** — so the answer for a PPJTI row is a fact about the vendor relationship with no source |
| `remarks` | **R** | free commentary on this row of this year's plan |

RPTI is nearly a projection already. `remarks` is the one field that is genuinely about the
report row rather than the thing it describes.

## Why this cannot ship before #40

Not merely related — a prerequisite.

Today the stored `rptiDetails` **are** the 2027 plan. That is the only record anywhere that a
year was involved: `reportYear` appears in no type and no store (#40). Delete the rows in
favour of generating them and the year exists nowhere at all, so there is nothing to generate
*for*.

Worse, generation is year-scoped and merge-preserving over a single set. A purely-generated
model has no way to hold 2027 and 2028 rows at once — filing next year's plan would have to
destroy this year's record of what was filed. Doing this first would make #40 harder, not
easier.

## Open questions

1. **Where do the eight LKPTI attributes live?** On `Deliverable` directly, which is simplest
   and matches how `categoryCode`/`developer`/locations already work there — or on a new
   record. `Deliverable` has 11 fields today; seven of the eight are new (`developer` already
   exists and would widen from the two-value `RptiDeveloper` enum to hold a vendor name), so
   the direct route takes it to 18. Note `AssetCategory` already
   provides category-level defaults for locations; would `dcProvider` want the same?
2. **Does `remarks` survive, and where?** It is the only genuinely row-scoped field. Options:
   keep `RptiDetail` as a thin record holding only `remarks` plus identity; move remarks to the
   Initiative (losing per-year commentary); or accept that regeneration discards it.
3. **`ppjtiRelatedParty` for PPJTI rows** — an attribute of the deliverable's vendor
   relationship, or a per-filing answer? If the former it joins group A; if the latter it joins
   `remarks`.
4. **What happens to workspaces that already have rows?** A migration must move group-A values
   off existing `LkptiDetail`s and onto their deliverables before the tabs are emptied, or the
   change silently destroys exactly the data this document exists to protect. This is the
   riskiest part of the work and deserves its own tests.
5. **Do the tabs become read-only?** If rows are pure projections, editing one is either
   meaningless or an edit to the underlying entity wearing a disguise. Today both tabs are
   fully editable, and `dataHealth` reports gaps *in the rows*.
6. **Is "empty until generated" actually the goal, or is it "obviously derived"?** A tab that
   is empty after a successful import may read as data loss. Auto-generating on import — so the
   rows are present but reproducible — achieves the same model with a friendlier first
   impression. This may make the whole change invisible to the user, which is arguably the
   point.

## Rejected

- **Empty the tabs now, accept the loss.** Silently discards eight fields of a filed return.
  Not a trade-off worth naming twice.
- **Teach generation to read the import.** Making generation consult the last imported file
  would preserve the values without a data-model change, but it makes a pure function depend on
  import history, and the values would be unrecoverable once the file is gone.
- **Do this before #40.** See above.

## Related

- [#40](https://github.com/nofanto/Selara/issues/40) — the report year is never stored
- `requirement-specs/rpti-auto-generation.md` — the generation rule and its merge-preserving behaviour
- `requirement-specs/lkpti-integration.md` §3 — why LKPTI generation is not year-scoped
- `requirement-specs/it-planning-flow.md` — step 2/3 of the cycle this document reconciles
- ADR-0010 — merge-preserving LKPTI generation, which exists precisely because these fields cannot be regenerated
