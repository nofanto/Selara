# ADR-0010: Import an existing LKPTI report as a workspace template, and make LKPTI generation merge-preserving

## Status

Accepted

## Context and Problem Statement

Most banks adopting Selara already have a filed LKPTI Format 3.2.6 report. Before this change, the only first-load options were the `rpti` demo template, an empty `blank` workspace, or the `viewer` template — whose upload only accepts Selara's own multi-sheet export format, not a bare OJK-standard LKPTI file. A new user with a real, already-filed report had no way to start from it; they'd have to hand-type application data Selara could already read directly. See issue #9 and `requirement-specs/lkpti-import-onboarding.md` for the full design exploration this ADR summarizes.

Adding this import surfaced a second, previously-latent problem: `generateLkptiDetails()` (shipped under [ADR-0007](0007-lkpti-report.md)) wipes and rebuilds every `LkptiDetail` row from scratch on every "Generate LKPTI Rows" click. That was harmless before this feature — generation was the *only* way a row's manual fields (`platform`, `database`, `dcProvider`, `drcProvider`, `backupStrategy`, `systemOwner`, `ownership`) ever got populated, so there was nothing to lose that the user hadn't already re-entered by hand since the last generate. Import changes that: it writes real, non-reconstructable data into those same fields the moment a workspace exists, so the first post-import regenerate would silently destroy exactly the data this feature exists to preserve.

## Decision Drivers

- The value proposition is "upload the report you already filed" — a standardized regulatory form, not an arbitrary spreadsheet — so a strict parser targeting the canonical layout is targeting what a real filed report should already look like.
- A wrong guess about which column is which in a regulatory-data importer is a worse failure mode than rejecting a file that doesn't match, per `CLAUDE.md`'s "rules before pixels" philosophy.
- `Deliverable.assetId` is a required field, so a `Deliverable` cannot exist without *some* `Asset` — any derivation strategy has to produce a full, if provisional, asset hierarchy, not a partial one.
- Once import can write real manual-only data, "regenerate" can no longer mean "discard and start over" — the fix has to be general (protect any manual field regardless of provenance), not a special case for imported rows specifically.

## Considered Options

**Parser strictness:**
- Strict layout match (sheet name, 15 headers, exact order) vs. a tolerant/fuzzy-header parser.

**Asset hierarchy derivation:**
- Auto-create both `AssetCategory` and `Asset` per row.
- Auto-create `AssetCategory` only, leave `Asset` manual.
- Derive neither, flag rows for manual review.

**UI entry point:**
- A 4th `TemplatePickerModal` card (first-load only).
- Extend the existing `viewer` upload to detect LKPTI-shaped files.
- A Data Manager action, importing into an already-existing workspace.

**Regeneration safety:**
- Import creates rows; `generateLkptiDetails()` skips deliverables that already have an imported row, via a provenance flag.
- Import doesn't touch `LkptiDetail` at all; the user re-enters the 7 manual fields after clicking Generate.
- `generateLkptiDetails()` becomes merge-preserving: create-if-missing, refresh cascade fields only, never touch manual fields on an existing row — regardless of how that row was created.

## Decision Outcome

Chosen: a strict-layout parser, full auto-derivation of the asset hierarchy, a 4th template-picker card, and merge-preserving regeneration. Concretely:

- **Parsing** (`src/lib/lkptiImport.ts`): `parseLkptiImportWorkbook()` matches sheet name `'LKPTI Format 3.2.6'` and all 15 headers exactly (case-sensitive, in order) — a mismatch throws and fails the whole import before any row is processed. Individual rows with bad cell data (unrecognized category code, backup-strategy/ownership label, unparseable date, blank name/developer) are skipped and reported back as `{rowNumber, reason}`, not fatal to the rest of the file. The go-live-date column accepts both `dd-mm-yyyy` text and a real Excel date cell — a cell-*type* tolerance, not a layout tolerance.
- **Derivation** (`deriveWorkspaceFromLkptiImport()`): one `AssetCategory` per distinct `categoryCode` (named via `RPTI_CATEGORY_LABELS`, deduped by code), one placeholder `Asset` per row (1:1 with the `Deliverable`, `maturity: 1` — the low end of the existing 1–5 scale, explicitly provisional pending the user's own re-rating), one open-ended `DeliverableSegment` per row (`startDate` = go-live date, `endDate` = `currentYear + 5, Dec-31`, matching `demoData.ts`'s convention for representing an ongoing live segment since `endDate` is a required field with no null concept), and a single shared `DeliverableStatus` (`isLiveStatus: true`) created once per import and reused by every row.
- **Developer field:** raw column-13 text `'inhouse'` (case-insensitive) maps `Deliverable.developer` to `'inhouse'`; anything else maps to `'PPJTI'` (the only two values `Deliverable.developer` allows). The raw text — e.g. a real third-party company name — is preserved verbatim on `LkptiDetail.developer`, which is free text, rather than lost to the 2-value enum.
- **UI entry point:** a 4th `TemplateId` (`'lkpti-import'`) alongside `rpti`/`viewer`/`blank`, its own card in `TemplatePickerModal`'s existing 2×2 grid, with a dedicated upload control (no "with/without demo data" option) wired through `onLkptiImport: (file: File) => void`.
- **Regeneration:** `generateLkptiDetails()` (`src/lib/lkpti.ts`) takes an `existingDetails?: LkptiDetail[]` input. For each eligible `Deliverable`: if an `LkptiDetail` already exists for that `targetId` (from import, a prior generation, or manual entry), only the cascade-derived fields (`categoryCode`, `developer`, `dcCity`/`dcCountry`, `drCity`/`drCountry`, `functionDescription`) are refreshed on it — the 7 manual-only fields and `goLiveDate` are never touched. If none exists, a fresh row is created and fully cascade-filled, same as before.

### Pros and Cons of the Options

#### Strict-layout parser

- Good, because it matches what a real filed report should already look like, and a rejected file is a clear, honest failure rather than a silent misread.
- Bad, because a bank whose maintained copy has drifted from the canonical template (extra columns, reordered fields) gets no import at all. Accepted as a v1 tradeoff — revisit with tolerance if real filed reports turn out to deviate in practice.

#### Auto-create both AssetCategory and Asset

- Good, because the workspace is immediately usable — reports, Data Manager, RPTI generation all function right after import.
- Bad, because the resulting Asset structure (one placeholder bucket per category, one deliverable each) is almost certainly not how the bank actually groups its portfolio. Accepted as a reorganizable starting point, not a final structure — merge/re-parent is already a normal Data Manager operation.
- The "leave Asset manual" and "flag for manual review" alternatives were rejected outright: the former is impossible (`assetId` is required), the latter converts "upload your report" into "upload your report, then manually type in categories/assets anyway," which isn't meaningfully faster than not having the feature.

#### 4th template-picker card

- Good, because it matches the actual moment being designed for — first load, before any workspace exists, the same moment a new bank user is deciding how to start.
- Rejected alternatives: extending `viewer`'s upload would conflate two importers with different formats and semantics behind one button; a Data Manager import-into-existing-workspace action answers a different question (merging into a workspace that already has structure) and is deferred as a possible separate feature, reusing this same parsing/derivation logic with a different "what do I merge into" step in front of it.

#### Merge-preserving regeneration

- Good, because the invariant is simple and general — never discard a field generation can't re-derive, regardless of the row's origin — rather than special-casing "imported" data over "manually edited" data.
- Rejected alternatives: a provenance flag that makes Generate skip imported rows entirely (adds a special case for something the general rule already covers, and would also block cascade-field refreshes on imported rows); import not writing `LkptiDetail` at all (defeats the feature's purpose — the user re-types the report they just uploaded).
- Bad, because it changes the behavior of an already-shipped, tested function ([ADR-0007](0007-lkpti-report.md)) — existing coverage in `src/lib/lkpti.test.ts` had to be extended, not just added to.

## Consequences

- `generateLkptiDetails()`'s regeneration rule changes from wipe-and-rebuild to merge-preserving — `requirement-specs/lkpti-integration.md` §3 and `docs/user-stories/19-lkpti-report.md`'s "Regenerating replaces all existing rows" acceptance criterion are both superseded by this ADR's behavior.
- No `DB_VERSION` bump — no new store, no new field on an existing store. `lkptiImport.ts` is a new pure-logic module; `TemplateId` gains a 4th variant, additive on an existing type.
- New export surface on `src/lib/lkpti.ts`: `LKPTI_SHEET_NAME`, `LKPTI_EXPORT_HEADERS`, `LKPTI_BACKUP_STRATEGY_LABELS`, `LKPTI_OWNERSHIP_LABELS`, `isLkptiCategoryCode`, `toDdMmYyyy` — previously private, now shared between export and import so the two stay in lockstep by construction rather than by convention.
- Covered by `src/lib/lkptiImport.test.ts` (18 cases: header/sheet validation, per-row rejection reasons, entity derivation, category dedup, developer classification, date-cell tolerance), 4 new cases in `src/lib/lkpti.test.ts` for the merge-preserving rule, and `e2e/lkpti-import-onboarding.spec.ts` (4 cases: template card, happy-path import, generate-preserves-manual-fields, unrecognized-file rejection).
- See [User Story 20](../user-stories/20-lkpti-import-onboarding.md) for the full acceptance criteria and `requirement-specs/lkpti-import-onboarding.md` for the complete design exploration.
