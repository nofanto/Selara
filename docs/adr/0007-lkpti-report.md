# ADR-0007: Add the LKPTI Report as its own entity, not an extended Deliverable

## Status

Accepted

## Context and Problem Statement

`requirement-specs/lkpti-schema.md` defines LKPTI Format 3.2.6 (Daftar Aplikasi) — OJK's Application List, a second, distinct regulatory report from RPTI (Format 3.1). It's a 15-column table per application: row #, category, name, function description, platform, database, DC/DRC location + provider, backup strategy, system owner, developer, go-live date, and ownership.

Four of those 15 fields already exist as `Deliverable`/`AssetCategory` auto-fill fields (`categoryCode`, `developer`, `dcCity`/`dcCountry`, `drCity`/`drCountry`), added for RPTI (ADR-0003, ADR-0006). The other ten — `platform`, `database`, `dcProvider`, `drcProvider`, `backupStrategy`, `systemOwner`, `goLiveDate`, `ownership`, `functionDescription` (`rowNumber` is presentational only) — are net-new, and only ever matter for this one report.

## Decision Drivers

- Should reuse the cascading-defaults resolution `rpti.ts` already implements (`Deliverable.field ?? AssetCategory.field`) rather than inventing a parallel one.
- Should not bloat `Deliverable` with fields that only apply to one report and only to `type: 'application'` deliverables — the majority of the ten new fields (platform, database, backup strategy, ownership, etc.) are meaningless for `infrastructure`/`document`/`procedure` deliverables.
- LKPTI 3.2.6's own `category_code` enum (13 values, `01`–`12`/`49`) is a strict subset of RPTI's `RptiCategoryCode` (18 values, adds `51`–`54`/`99` for infrastructure) — the type system should make an infrastructure-only code impossible to select here, not just informally disallow it.
- LKPTI's `developer` field wants either the literal `'inhouse'` or the actual IT service provider's *name*; RPTI's `RptiDeveloper` (`'inhouse' | 'PPJTI'`) only marks *that* it's third-party, not *who* — reusing that enum verbatim would lose information the form requires.

## Considered Options

- Extend `Deliverable` directly with the ten new optional fields.
- A new `LkptiDetail` entity, mirroring the `RptiDetail` join-store precedent from ADR-0003.

## Decision Outcome

Chosen option: "A new `LkptiDetail` entity." Concretely:

- A new `lkptiDetails` IndexedDB store (schema v19) holds `LkptiDetail` records: `{ id, targetId, categoryCode?, developer?, dcCity?, dcCountry?, drCity?, drCountry?, platform?, database?, dcProvider?, drcProvider?, backupStrategy?, systemOwner?, goLiveDate?, ownership?, functionDescription? }`. Unlike `RptiDetail`, `targetId` is deliverable-only (no polymorphic `targetType`) — LKPTI 3.2.6 is application-scoped, so there's no bare-Asset case to support.
- `categoryCode` is typed `LkptiCategoryCode = Exclude<RptiCategoryCode, '51'|'52'|'53'|'54'|'99'>` — a compile-time-narrowed subset, not just a runtime check — and the generation function additionally guards against an infrastructure-only code leaking in via cascade from a `Deliverable`/`AssetCategory` whose `categoryCode` happens to be one of the excluded five.
- `developer` is typed as a free-text `string`, not `RptiDeveloper` — auto-suggested to `'inhouse'` when the source `Deliverable.developer === 'inhouse'`, left blank for manual entry (the actual provider name) otherwise.
- Row generation (`generateLkptiDetails` in `src/lib/lkpti.ts`) mirrors `generateRptiDetails`'s shape but not its rule: one row per `Deliverable` (`type: 'application'` or undefined) that has at least one lifecycle segment classified live — not scoped to a report year, since LKPTI 3.2.6 is a point-in-time inventory of what's currently running, not a plan of activity within a year. `goLiveDate` is auto-suggested from the earliest live segment's start date (`suggestGoLiveDate`), converted to the `dd-mm-yyyy` the form expects.
- The report itself follows the exact RPTI twin-surface pattern: a Data Manager tab (generate + edit) and a Reports card (`LkptiReportView.tsx`, read-only summary + Excel export via `exportLkptiReportToExcel`), plus a raw backup sheet in the general workspace export/import round-trip — same as `RptiDetail`.

See `requirement-specs/lkpti-integration.md` for the full design-notes trail, including the category-09 label correction that came up during this same design pass (unrelated to this ADR's data-model question).

### Pros and Cons of the Options

#### Extend `Deliverable` directly

- Good, because it's one entity — no new store, no new generation function, no new report-row resolution logic.
- Bad, because it adds ten fields to every `Deliverable` in the app, most of which are meaningless outside `type: 'application'` and outside this one report — the same "generic entity picks up report-specific baggage" problem ADR-0003 deliberately avoided by keeping RPTI's own fields in a join store rather than on `Application`/`Deliverable` itself.
- Bad, because `Deliverable.developer` is already typed `RptiDeveloper`, a two-value enum — reusing it for LKPTI's field (which wants a provider name, not a marker) would require either a breaking type change to `Deliverable.developer` or a separate field anyway.

#### New `LkptiDetail` entity

- Good, because it reuses `resolveAssetCategory()` and `isLiveStatusId()` (exported from `rpti.ts` for this purpose) as-is — the cascading-defaults logic isn't duplicated, just called from a second generation function.
- Good, because `Deliverable` stays exactly as lean as it was before this report existed.
- Good, because `categoryCode` and `developer` can be typed correctly for LKPTI's actual requirements (narrowed enum, free-text name) without touching `RptiDetail`'s or `Deliverable`'s existing types.
- Bad, because it duplicates some structure with `RptiDetail` (two report-row entities with a similar generate/cascade/export shape) rather than sharing a common base — acceptable for now (YAGNI on abstracting until a third report appears), same tradeoff ADR-0003 made for `RptiDetail` itself.

## Consequences

- IndexedDB schema bumped to version 19 (`lkptiDetails` store, `keyPath: 'id'`, no seeding).
- `AppState`, `TemplateAppData`, and `Version.data` (optional field) all carry `lkptiDetails`; every `handleUpdate`-style call site in `src/App.tsx` threads it through, following the exact pattern used when `rptiDetails` was added at schema version 15 (ADR-0003).
- `DataManager.tsx` gains an LKPTI tab; its Deliverable cascade-delete/clear-all handlers now also cascade-delete affected `LkptiDetail` rows.
- `diff.ts` and `VersionManager.tsx` gain an `lkptiDetails` diff section, matching every other entity's version-history coverage.
- Covered by `e2e/lkpti-report.spec.ts` (row creation, edit/delete, cascade-delete, generation trigger rule including the not-yet-live exclusion case, go-live-date auto-suggestion, Excel export) and `src/lib/lkpti.test.ts` (generation logic unit tests, including the infrastructure-only-category-code exclusion case).
