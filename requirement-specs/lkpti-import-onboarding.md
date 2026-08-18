# Import an Existing LKPTI Report as a Workspace Template — Design Notes

> **Status:** Decided, not yet implemented. No code has been written yet; see "Next Step."
> **Context:** Brainstormed from the observation that most banks adopting Selara will already have a filed LKPTI Format 3.2.6 report — starting them from a blank workspace or hand-typing that data in makes the existing report the obvious onboarding source instead.

## Context and Problem Statement

Selara's LKPTI feature (`src/lib/lkpti.ts`, `LkptiReportView.tsx`, see `lkpti-integration.md`/`lkpti-schema.md`) currently only *exports* the regulator-facing 15-column Format 3.2.6 sheet — nothing reads that shape back in. The three existing workspace templates (`src/lib/workspaceTemplates.ts`) don't help a new user either: `rpti` is demo data, `blank` is empty, and `viewer`'s upload only accepts Selara's own multi-sheet export format (`importFromExcel` in `src/lib/excel.ts` matches fixed sheet names — an OJK-format file has none of them and would silently import as empty).

Four design questions needed resolving before implementation:

1. How strict should the parser be about the input file's shape?
2. What entities can be derived from a bare LKPTI row, and what has to be invented?
3. Should a lifecycle segment be auto-created from `goLiveDate`?
4. Where does this live in the UI?

---

## Decided

### 1. Parser targets the strict OJK-standard layout only

**Decision:** Match the exact Format 3.2.6 column layout/headers as documented in `lkpti-schema.md` §8 (the regulator's own template) — not a tolerant/fuzzy header-matching parser.

**Reasoning:** The value proposition is "upload the report you already filed" — that report is a standardized regulatory form, not an arbitrary spreadsheet, so targeting the canonical layout is targeting what a bank's real file should already look like. A tolerant parser (fuzzy header matching, arbitrary column order, tolerance for extra/missing columns) was considered and rejected for now: it adds real parsing complexity and, worse, silent-misread risk — guessing wrong about which column is which in a regulatory-data importer is a worse failure mode than rejecting a file with a clear "this doesn't look like a Format 3.2.6 export" error. If real-world filed reports turn out to deviate from the canonical layout in practice (e.g. banks maintain it in whatever tool they used to file, not a byte-identical template), that's a follow-up to revisit once we have an actual sample file to test against — not something to design tolerance for speculatively.

**Consequence:** the importer is effectively the inverse of `exportLkptiReportToExcel` — same sheet name (`'LKPTI Format 3.2.6'`), same 15 columns in the same order:

| # | Header | Target field |
|---|---|---|
| 1 | `No.` | *(ignored — sequential, not stored)* |
| 2 | `Kategori Aplikasi` | `LkptiDetail.categoryCode` — parsed back out of the `"<code> — <label>"` cell format `exportLkptiReportToExcel` writes; the code must be one of the 13 LKPTI-eligible codes (see `lkpti-schema.md` §2) or the row is rejected |
| 3 | `Nama Aplikasi` | `Deliverable.name` |
| 4 | `Deskripsi Fungsi Aplikasi` | `Deliverable.description` (per ADR-0008, not `LkptiDetail.functionDescription` directly — generation still cascades it in) |
| 5 | `Platform` | `LkptiDetail.platform` |
| 6 | `Pangkalan Data` | `LkptiDetail.database` |
| 7 | `Lokasi DC` | `LkptiDetail.dcCity`/`dcCountry` — split on `", "` |
| 8 | `Penyelenggara DC` | `LkptiDetail.dcProvider` |
| 9 | `Lokasi DRC` | `LkptiDetail.drCity`/`drCountry` — split on `", "` |
| 10 | `Penyelenggara DRC` | `LkptiDetail.drcProvider` |
| 11 | `Strategi Backup` | `LkptiDetail.backupStrategy` — reverse lookup through the same label table `exportLkptiReportToExcel` uses; unrecognized label → row rejected |
| 12 | `System Owner` | `LkptiDetail.systemOwner` |
| 13 | `Pengembang Aplikasi` | `Deliverable.developer` (per ADR-0006, cascades into `LkptiDetail.developer` at generation time — mirrors export, which reads `detail.developer` post-cascade) |
| 14 | `Tanggal Implementasi (Go Live)` | `LkptiDetail.goLiveDate` **and** the seed date for the auto-created lifecycle segment (see §3) |
| 15 | `Kepemilikan` | `LkptiDetail.ownership` — reverse lookup, same pattern as column 11 |

Column 14 parsing accepts both a literal `dd-mm-yyyy` text cell (what `exportLkptiReportToExcel` itself writes) and a real Excel date-typed cell (what a bank's own filing tool may have produced) — this is a cell-*type* tolerance, not a header/layout tolerance, so it doesn't conflict with the "strict layout" decision above. A row with neither is rejected.

A header row that doesn't match all 15 expected headers exactly (case-sensitive, in order) fails the whole import up front with a clear error, before any row is processed — same "fail loud, not silent" principle as the RPTI-generation allow-list fix (ADR-0009).

### 2. Auto-create `AssetCategory` and `Asset`, one each derived from every row

**Decision:** For each imported row: ensure an `AssetCategory` exists for that row's `categoryCode` (create one, keyed by code, if this is the first row seen with that code); create one placeholder `Asset` per `Deliverable`, 1:1, in that category.

**Reasoning:** A bare LKPTI row gives exactly `categoryCode` and `application_name` toward Selara's asset hierarchy — nothing about how a bank actually wants to group applications under an `Asset`. Three options were considered:
- **Auto-create both** (chosen): gets the workspace immediately usable — reports, Data Manager, RPTI generation all function right after import — at the cost of an Asset structure that's almost certainly not how the bank actually thinks about their portfolio (13 categories → 13 placeholder "asset" buckets, one deliverable each, no real grouping). Accepted as a starting point the user reorganizes from Data Manager afterward (merge/re-parent is already a normal Data Manager operation), not a final structure.
- **Auto-create `AssetCategory` only, leave `Asset` manual:** rejected — `Deliverable.assetId` is a required field (see `src/types.ts`), so a `Deliverable` cannot exist at all without *some* `Asset`; "leave it manual" would mean the import can't actually create working `Deliverable` records, defeating the point.
- **Neither, flag rows for manual review:** rejected as the least useful outcome for the stated goal (fast onboarding from an existing report) — it converts "upload your report" into "upload your report, then manually type in categories/assets for every row anyway," which isn't meaningfully faster than not having this feature.

**Category naming:** reuses `RPTI_CATEGORY_LABELS` (`src/lib/rpti.ts`) rather than introducing a second, Indonesian-language label table from `lkpti-schema.md` §2 — keeps imported category names consistent with every other category label already shown elsewhere in the app (RPTI catalogue, RPTI Data Manager tab), which are all English.

**Asset naming/fields:** `Asset.name` = `Deliverable.name` (the placeholder asset is named after the one thing it hosts); `Asset.maturity` defaults to a fixed placeholder value (exact default is an implementation detail, not a design fork — pick something clearly provisional, e.g. the low end of the existing maturity scale, and document it in a code comment). `Asset.externalId` is left unset — nothing in an LKPTI row maps to it.

### 3. Auto-create one open-ended "live" lifecycle segment per row

**Decision:** For each imported row, create one `DeliverableSegment`: `startDate = goLiveDate`, no `endDate` (open-ended), `status` referencing a `Live` `DeliverableStatus`. If the target workspace has no status with `isLiveStatus: true` yet (true for a fresh import — there's no `blank`-template seeding today, confirmed during research), create one (`isLiveStatus: true`, a sensible id/name/color) as part of the same import.

**Reasoning:** Every row in a filed LKPTI report is, by definition, an application already in production — that's what the report is *for*. Not creating a segment would leave every imported `Deliverable` with no lifecycle data at all, which breaks RPTI generation immediately post-import (`classifySegmentKind` needs a segment to classify) and contradicts what the source data actually asserts. The alternative (leave segments empty, let the user backfill manually) was rejected as pure extra manual work for a fact the import already knows with certainty.

This mirrors `isLiveStatusId`/`isPreLaunchStatusId`'s existing explicit-flag-first pattern (ADR-0009) — the auto-created status uses the flag, not a name/id pattern match, so it behaves identically to any other live status the user later adds or renames.

### 4. New 4th template card in `TemplatePickerModal`

**Decision:** Add `'lkpti-import'` (naming TBD at implementation time) as a 4th `TemplateId`, alongside `rpti`/`viewer`/`blank`, with its own card in `TemplatePickerModal.tsx`'s existing `grid-cols-2` grid (a 4th card completes a clean 2×2 — no layout rework needed) and its own file-upload control mirroring the `viewer` card's existing pattern (hidden `<input type="file" accept=".xlsx,.xls">` + button), wired through a new `onLkptiImport: (file: File) => void` prop parallel to the existing `onViewerImport`.

**Reasoning:** Two alternatives were considered:
- **Extend the `viewer` upload to detect LKPTI-shaped files:** rejected — conflates two importers with genuinely different formats (multi-sheet JSON-column vs. single-sheet AOA) and different semantics (round-trip restore vs. one-way bootstrap-and-derive) behind one button; a wrong-format error would be confusing when the user doesn't know which importer is even trying to run.
- **A Data Manager action, for importing into an already-existing workspace:** rejected for v1, not because it's a bad idea, but because it answers a different question (merging LKPTI data into a workspace that already has structure) than the one this design is scoped to (the very first choice a new user makes). Worth revisiting later as a *separate* feature once the core import/derivation logic exists — the parsing and entity-derivation logic this doc specifies would be reusable there with a different "what do I merge into" step in front of it.

The new template card is the natural fit because it matches the actual moment being designed for: `TemplatePickerModal` is shown exactly once, at first launch, before any workspace exists — the same moment a new bank user is deciding how to start.

---

## What this import does *not* attempt to derive

Explicitly out of scope, because nothing in an LKPTI row provides a basis for it — these remain empty after import, same as the `blank` template:

- `Programme` / `Strategy` / `Initiative` — no budget, timeline, ownership, or RAG data exists in the file; these are planning entities, and LKPTI is a point-in-time inventory, not a plan.
- `Resource` assignments, `Dependency` links, `Milestone`s, `Decision`s — none of these have any representation in the 15 LKPTI columns.
- Any lifecycle history *before* go-live (planned/funded segments) — the report only knows the current, already-live state; import creates exactly one live segment, not a fabricated history.

## Open Questions

None blocking — the four questions raised in Context are all resolved above. Smaller field-level defaults (exact `Asset.maturity` placeholder value, generated-id prefixes/format for the new `AssetCategory`/`Asset`/`DeliverableStatus`/`DeliverableSegment` records, the final `TemplateId` string and card copy) are implementation details to settle during Step 1/2, not architectural forks requiring sign-off here.

## Next Step

Per `CLAUDE.md` Step 1: this needs a User Story (`docs/user-stories/`) for the onboarding-facing behavior (template picker → upload → populated workspace), since it's a UI-facing feature — the parsing/derivation logic underneath it is complex enough to also warrant unit tests in `src/lib/` (a new `lkptiImport.ts` alongside `lkpti.ts`) ahead of the E2E test, but the E2E test is what proves the actual user-facing acceptance criteria per this doc's decisions. No code has been written yet.
