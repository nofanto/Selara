# ADR-0006: Auto-fill RPTI category/developer/location from Deliverable and AssetCategory defaults; move CapEx/OpEx to a single workspace currency

## Status

Accepted

## Context and Problem Statement

`requirement-specs/rpti-auto-generation.md` documented that `generateRptiDetails` (`src/lib/rpti.ts`) already auto-fills Target, Initiative, Dev Type, Quarter, and CapEx/OpEx on a freshly generated `RptiDetail` row, but `categoryCode`, `developer`, `ppjtiRelatedParty`, and the DC/DR location fields had **no source at all** — always blank, requiring fully manual entry on every single row, for every report year, for the whole life of the workspace.

`requirement-specs/rpti-auto-fill-improvements.md` (design notes, decided in discussion before this change) identified the common thread: none of these vary *per report row* — they're properties of **what's being built** (the `Deliverable`, or the `AssetCategory` it sits under), not properties of the specific development event. That's the leverage point: tag the source once on the `Deliverable`/`AssetCategory`, inherit it into every row generated from it.

Separately, `RptiDetail` (schema v15, [ADR-0003](0003-rpti-report-and-application-type.md)) had shipped with `capexCurrency`/`opexCurrency` (free-text, per row) and `capexIdrEquivalent`/`opexIdrEquivalent` (manually-entered, per row) — all four always blank in practice, with no auto-fill path and no per-row FX-rate concept to compute the IDR-equivalent from. Reviewing this alongside the auto-fill work exposed that these fields don't reflect how the bank actually reports: a single institution reports its whole RPTI submission in one currency, not a per-row mix.

## Decision Drivers

- Should not require re-entering the same categoryCode/developer/location values on every deliverable in a mixed-taxonomy category, but also should not force a single category-wide value onto deliverables that genuinely differ (checked against the demo taxonomy: `AssetCategory` is organized by IT architecture, e.g. "Core Banking" can contain a GL app, a payments engine, and a treasury system with different OJK category codes).
- Should not invent per-row currency-conversion machinery (FX rates, live rate lookups) this app has no source for and no real use case to justify.
- Should follow the same override-wins resolution pattern already established for CapEx/OpEx (`RptiDetail.capexAmount ?? Initiative.capex`, see `resolveCost`), for consistency.

## Considered Options

**Category / DC-DR location:**
- Category-only default (`AssetCategory.categoryCode`/location, no per-deliverable override).
- Deliverable-only (no category-level default at all).
- Two-level: `AssetCategory` default + `Deliverable` override, resolved per field.

**Developer:**
- Two-level, same as Category.
- Deliverable-only, no category default.

**Currency:**
- Per-row `capexCurrency`/`opexCurrency` + a per-row FX rate field, auto-computing `*IdrEquivalent`.
- Workspace-level default currency + FX rate on `TimelineSettings`, auto-computing `*IdrEquivalent`, with per-row override.
- Single workspace-level `TimelineSettings.defaultCurrency`; `capexAmount`/`opexAmount` are simply treated as already being in that currency; drop `capexCurrency`/`opexCurrency`/`capexIdrEquivalent`/`opexIdrEquivalent` entirely.

## Decision Outcome

- **Category — two-level default + override.** `AssetCategory` gains `categoryCode?: RptiCategoryCode`; `Deliverable` also gains `categoryCode?: RptiCategoryCode` that overrides the category default when set. Resolution at generation time: `Deliverable.categoryCode ?? AssetCategory.categoryCode` (via `Asset.categoryId`).
- **Developer / PPJTI Related Party — Deliverable-only, PPJTI computed.** `Deliverable` gains `developer?: RptiDeveloper`, no category-level default (which specific vendor built which specific app varies too much within one architectural category for a category default to be trustworthy). `ppjtiRelatedParty` is not stored as its own default: it auto-fills `'n/a'` whenever the resolved `developer !== 'PPJTI'` (including when `developer` is unset entirely, since there's no other source for it), and is left blank for manual entry only when `developer === 'PPJTI'`.
- **DC/DR Location — two-level default + override, same pattern as Category.** `AssetCategory` gains `dcCity?`/`dcCountry?`/`drCity?`/`drCountry?`; `Deliverable` gains the same four fields, each independently overriding the category default per field (physical hosting plausibly does correlate with architectural category, unlike Developer).
- **Currency — single workspace-wide currency, no per-row currency or IDR-equivalent fields.** `TimelineSettings` gains `defaultCurrency?: string`, edited once in Data Manager's RPTI tab. `RptiDetail.capexAmount`/`opexAmount` (unrenamed) are simply understood to already be in `defaultCurrency` — no conversion, no FX rate, no per-row exception field. `capexCurrency`, `opexCurrency`, `capexIdrEquivalent`, and `opexIdrEquivalent` are **removed** from `RptiDetail` entirely; a `DB_VERSION` 18 migration strips them from existing records. A genuine per-row currency exception (rare) is handled by the user overriding that row's `capexAmount`/`opexAmount` directly with the converted figure — no dedicated field for it.

### Pros and Cons of the Options

#### Category-only / Deliverable-only default (rejected)

- Category-only is good because it needs no per-deliverable data entry at all, but bad because it's wrong for any category that legitimately spans multiple OJK codes — the common case in the demo taxonomy, not an edge case.
- Deliverable-only is good because it's the simplest possible model, but bad because it re-enters the same value on every deliverable in a category that in practice all share one code/location, discarding the entire leverage a category-level default would provide.

#### Two-level default + override (chosen, for Category and Location)

- Good, because it gives full leverage for categories that map 1:1 to one code/location while still letting individual deliverables in mixed categories override the exception.
- Bad, because it's two schema fields instead of one and a slightly more involved resolution rule — acceptable, since the resolution mirrors a pattern (`??` override-wins) already used elsewhere in this codebase.

#### Two-level default for Developer (rejected)

- Good, because it would match Category/Location's leverage.
- Bad, because in real banking practice which specific vendor built which specific app varies too much within one architectural category to make a category-level default trustworthy — unlike physical hosting location, there's no real correlation to lean on.

#### Per-row FX rate + auto-computed IDR-equivalent (rejected)

- Good, because it would preserve the original `capexIdrEquivalent`/`opexIdrEquivalent` fields' apparent purpose.
- Bad, because it requires either a live FX source (this app has none) or a manually-maintained rate that's essentially never going to be kept current across every row, for a feature (per-row currency mixing) that doesn't reflect how a single institution actually reports.

#### Single workspace-wide currency, drop per-row currency/equivalent fields (chosen)

- Good, because it matches reality — one bank reports RPTI in one currency — and removes four fields that were always blank in practice with no real auto-fill path.
- Good, because it needs no FX-rate concept anywhere in the schema.
- Bad, because a genuinely mixed-currency workspace (rare) has no structured way to record it beyond overriding the raw `capexAmount`/`opexAmount` number directly — accepted as simple enough for a case this uncommon.

## Consequences

- `DB_VERSION` bumped to 18; existing `rptiDetails` records with `capexCurrency`/`opexCurrency`/`capexIdrEquivalent`/`opexIdrEquivalent` set have those fields stripped in place (see Migration Notes in `database-diagram.md`).
- `AssetCategory` and `Deliverable` both gain new optional fields (`categoryCode`, plus `dcCity`/`dcCountry`/`drCity`/`drCountry`; `Deliverable` additionally gains `developer`), editable via new Data Manager columns on the Categories and Deliverables tabs (`src/components/DataManager.tsx`).
- `TimelineSettings` gains `defaultCurrency?: string`, editable via a new input in the Data Manager RPTI tab's toolbar.
- `generateRptiDetails` (`src/lib/rpti.ts`) signature changed from four positional arguments to a single `GenerateRptiDetailsInput` context object, now also taking `deliverables`, `assets`, and `assetCategories` to resolve the two-level defaults; `resolveAssetCategory` is a new internal helper.
- `resolveCost` and `exportRptiReportToExcel` are unchanged — they never referenced the removed currency/IDR-equivalent fields.
- Covered by unit tests in `src/lib/rpti.test.ts` (categoryCode/developer/ppjtiRelatedParty/location resolution, all four combinations of default-only, override-only, both, neither) and e2e coverage in `e2e/rpti-data-manager.spec.ts`.
