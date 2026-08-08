# RPTI Auto-Fill Improvements (Design Notes)

> **Status:** Draft — discussion in progress, not yet implemented. Some points decided, several still open (see "Open questions" below).
> **Context:** RPTI (Laporan Rencana Pengembangan Teknologi Informasi) reports new-or-upgrade development of an application or infrastructure item within the bank in a year period, triggered by an Initiative. `generateRptiDetails` (`src/lib/rpti.ts`, see `requirement-specs/rpti-auto-generation.md`) already auto-fills Target, Initiative, Dev Type, Quarter, and CapEx/OpEx. This doc covers closing the remaining gap: the fields that currently have **no source at all** and are always blank on a freshly generated row.

## Fields with no source today

| Field | Where it lives | Why it has no source |
|---|---|---|
| `categoryCode` (OJK's 18 codes) | `RptiDetail` | Nothing in the data model maps to OJK's business/infra domain codes |
| `developer` (in-house / PPJTI) | `RptiDetail` | No inhouse/vendor field exists anywhere upstream |
| `ppjtiRelatedParty` | `RptiDetail` | No source |
| `capexCurrency` / `opexCurrency` / `*IdrEquivalent` | `RptiDetail` | No source |
| `dcCity` / `dcCountry` / `drCity` / `drCountry` | `RptiDetail` | `Asset`/`Deliverable` have no location fields |

The common thread: none of these vary *per report row* — they're properties of **what's being built** (the Deliverable, or the AssetCategory it sits under) or of **the bank's reporting conventions** (currency), not properties of the specific development event. That's the leverage point for auto-fill: tag the source once, inherit it into every row generated from it.

## Decided

### Category — two-level default + override

- `AssetCategory` gains an optional `categoryCode: RptiCategoryCode`.
- `Deliverable` also gains an optional `categoryCode: RptiCategoryCode` that **overrides** the category's default when set.
- Resolution order at generation time: `Deliverable.categoryCode ?? AssetCategory.categoryCode` (via `Asset.categoryId`) — same override-wins pattern already used for CapEx/OpEx (`RptiDetail.capexAmount ?? Initiative.capex`, see `resolveCost`).
- **Why two-level, not category-only:** checked against the actual demo taxonomy — `AssetCategory` is organized by IT architecture/capability ("Core Banking", "Cloud Infrastructure", "Identity & Access Management"...), not by OJK's business-domain axis. A category like "Core Banking" plausibly contains a GL app (`04`), a payments engine (`05`), and a treasury system (`07`) all at once — a single code on the category alone would be wrong for most of its deliverables. The override lets a category serve as a *default* (full leverage for categories that do map 1:1) while individual deliverables in mixed categories get the exception they need.

### Developer / PPJTI Related Party — Deliverable-only, PPJTI computed

- `Deliverable` gains an optional `developer: RptiDeveloper` ('inhouse' | 'PPJTI'). No category-level default — in real banking practice, which specific vendor built which specific app varies too much within one architectural category to make a category default trustworthy.
- `ppjtiRelatedParty` does **not** need its own stored default field. It's `'n/a'` by definition whenever the resolved `developer !== 'PPJTI'` — only genuinely ambiguous (and needing a real, un-derivable answer) when `developer === 'PPJTI'`. So: auto-fill `'n/a'` automatically when developer resolves to in-house, and only leave it blank for manual entry in the PPJTI case.

## Open questions

### 1. DC/DR Location — two-level like Category, or Deliverable-only?

- **Two-level (leaning toward this):** `AssetCategory` gets a default `dcCity`/`dcCountry`/`drCity`/`drCountry`, `Deliverable` can override. Rationale: unlike Developer, physical hosting location plausibly *does* correlate with architectural category — everything in "Cloud Infrastructure" might genuinely share one DC/DR pair.
- **Deliverable-only:** simpler model, but re-enters the same DC/DR pair on every deliverable in a category that in practice all share one location.

### 2. Strategy/Programme generation filter — what should it actually check?

Original framing: initiatives should be "triggered by an Initiative that belongs to a Strategy or Programme." But `Initiative.programmeId` is already **mandatory** on every real Initiative — you can't create one without a Programme. So this is trivially already true except for `isPlaceholder` initiatives (empty markers, not real work), which generation doesn't currently exclude. Two different things this could mean:

- **(a) Exclude `isPlaceholder` initiatives from generation** — a straightforward correctness fix; every other initiative already has a Programme by construction.
- **(b) Additionally require `strategyId` to be set** (optional today) — a stricter filter: only initiatives explicitly aligned to a Strategy, not just any Programme-bucketed work, generate rows. Would exclude real initiatives that never got a Strategy tag.

### 3. Dev Type accuracy — fix the single-year-only "new vs. upgrade" check?

Separate from auto-fill, but related: today's classification (`requirement-specs/rpti-auto-generation.md`, rule 2/4) only looks *within the single report year* — a documented "deliberate simplification." Practically: if a deliverable went live in 2023, and this year it gets a `planned` segment for an enhancement with no `in-production` segment in the *same* report year, generation currently marks it `'new'` — wrong, it's an upgrade to something already live.

- **Fix now:** add a lightweight "has this deliverable ever had a live segment, in any year" lookup, used only for the new/upgrade signal — doesn't pull extra rows across years, just corrects the classification.
- **Defer:** keep today's documented simplification for now; revisit once the auto-fill changes above are in and tested on their own.

### 4. Currency — workspace-level default?

- **Yes:** add a default currency (and optionally an FX rate) to `TimelineSettings`, applied at generation time to auto-fill `capexCurrency`/`opexCurrency` and compute the IDR-equivalent columns — overridable per row for exceptions.
- **No, leave manual:** skip this part; Currency/IDR Equivalent stay blank on generated rows as they are today.

## Next step

Once the four open questions above are answered, turn this into an implementation plan: schema additions (`AssetCategory.categoryCode`, `Deliverable.categoryCode`/`developer`, optional `TimelineSettings` currency fields), Data Manager column additions for the new Deliverable/AssetCategory fields, and updates to `generateRptiDetails`'s resolution logic — following the same TDD process as `requirement-specs/rpti-auto-generation.md`'s original implementation.
