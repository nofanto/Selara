# RPTI Auto-Fill Improvements (Design Notes)

> **Status:** Implemented — see `generateRptiDetails` in `src/lib/rpti.ts` and [ADR-0006](../docs/adr/0006-rpti-auto-fill-and-single-currency.md).
> **Context:** RPTI (Laporan Rencana Pengembangan Teknologi Informasi) reports new-or-upgrade development of an application or infrastructure item within the bank in a year period, triggered by an Initiative. `generateRptiDetails` (`src/lib/rpti.ts`, see `requirement-specs/rpti-auto-generation.md`) already auto-fills Target, Initiative, Dev Type, Quarter, and CapEx/OpEx. This doc covers closing the remaining gap: the fields that currently have **no source at all** and are always blank on a freshly generated row.

## Fields with no source today

| Field | Where it lives | Why it has no source |
|---|---|---|
| `categoryCode` (OJK's 18 codes) | `RptiDetail` | Nothing in the data model maps to OJK's business/infra domain codes |
| `developer` (in-house / PPJTI) | `RptiDetail` | No inhouse/vendor field exists anywhere upstream |
| `ppjtiRelatedParty` | `RptiDetail` | No source |
| Currency of `capexAmount` / `opexAmount` | *(workspace-wide, not per-row)* | No workspace-level currency setting exists |
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

### DC/DR Location — two-level default + override, same pattern as Category

- `AssetCategory` gains optional `dcCity`/`dcCountry`/`drCity`/`drCountry` defaults.
- `Deliverable` also gains optional `dcCity`/`dcCountry`/`drCity`/`drCountry`, each independently overriding the category's default when set.
- Resolution order at generation time, per field: `Deliverable.dcCity ?? AssetCategory.dcCity` (and so on for the other three) — identical override-wins pattern to Category and CapEx/OpEx.
- Rationale: unlike Developer, physical hosting location plausibly *does* correlate with architectural category — everything in "Cloud Infrastructure" might genuinely share one DC/DR pair, so a category-level default carries real leverage here.

### Currency — single global currency, no per-row currency or IDR-equivalent fields

- `TimelineSettings` gains `defaultCurrency?: string` (e.g. `'USD'`, `'IDR'`) — one workspace-wide setting, shown once (e.g. on the RPTI Report screen/export), not stored per row.
- `capexAmount`/`opexAmount` (existing `RptiDetail` fields, unrenamed) are simply *treated as already being* in `defaultCurrency` — no conversion, no FX rate, no per-row exception path. Every row in a workspace reports in the same currency.
- **Removed from `RptiDetail` entirely:** `capexCurrency`, `opexCurrency`, `capexIdrEquivalent`, `opexIdrEquivalent`. These four fields (shipped in ADR-0003 / schema v15) become redundant once currency is a single workspace-wide fact with no separate IDR-conversion step — keeping them around as always-unused or always-identical manual columns would just be clutter. Requires a `DB_VERSION` migration to strip them from existing `rptiDetails` records (matching the strip-and-rewrite pattern already used for the v16 `location` flatten), plus removing their Data Manager columns, and updating ADR-0003 / `docs/database-diagram.md` to match.
- `exportRptiReportToExcel`'s Format 3.1 output already only ever wrote `capexAmount`/`opexAmount` directly (never the currency or IDR-equivalent columns), so the export logic itself needs no change here beyond reflecting `defaultCurrency` somewhere in the report if desired later.

## Next step

All auto-fill points above are now decided. Implementation plan: schema additions (`AssetCategory.categoryCode`/`dcCity`/`dcCountry`/`drCity`/`drCountry`, `Deliverable.categoryCode`/`developer`/`dcCity`/`dcCountry`/`drCity`/`drCountry`, `TimelineSettings.defaultCurrency`), a migration removing `RptiDetail.capexCurrency`/`opexCurrency`/`capexIdrEquivalent`/`opexIdrEquivalent`, Data Manager column changes for all of the above, and updates to `generateRptiDetails`'s resolution logic — following the same TDD process as `requirement-specs/rpti-auto-generation.md`'s original implementation.
