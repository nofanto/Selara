# User Story 20: Import an Existing LKPTI Report as a Workspace Template

## Story

> **As** a new Selara user at a bank that has already filed an LKPTI Format 3.2.6 report,
> **I want** to upload that report and have Selara build my starting workspace from it,
> **So that** I don't have to hand-type application data Selara can already read from a report I've filed.

---

## Background

Most banks adopting Selara already have a filed LKPTI Format 3.2.6 report. Today the only first-load options are the `rpti` demo template, a `blank` workspace, or the `viewer` template — whose upload only accepts Selara's own multi-sheet export format, not a bare OJK-standard LKPTI file. See `requirement-specs/lkpti-import-onboarding.md` for the full design decisions behind this feature (issue #9), and `requirement-specs/lkpti-integration.md`/`lkpti-schema.md` for the underlying LKPTI report feature this builds on.

---

## Acceptance Criteria

### AC1 — Template picker card

- [x] `TemplatePickerModal` shows a 4th card ("Import LKPTI Report" or similar, `template-card-lkpti-import`) alongside `rpti`/`viewer`/`blank`, in the existing `grid-cols-2` grid.
- [x] The card has its own "Upload file" control (`.xlsx`/`.xls`), mirroring the `viewer` card's existing upload pattern — no "with/without demo data" option.
- [x] Selecting a file triggers the import and closes the template picker once it succeeds.

### AC2 — Strict-format parsing

- [x] The parser matches the exact Format 3.2.6 layout: sheet name `'LKPTI Format 3.2.6'`, 15 columns, exact headers in order, per `lkpti-schema.md` §8 — the inverse of `exportLkptiReportToExcel`.
- [x] A header row that doesn't match all 15 expected headers exactly fails the whole import up front with a clear error, before any row is processed. No rows are partially imported.
- [x] Column 14 (`Tanggal Implementasi (Go Live)`) accepts both a `dd-mm-yyyy` text cell and a real Excel date cell; any other cell type/format rejects that row.
- [x] A `Kategori Aplikasi` cell that doesn't parse back to one of the 13 LKPTI-eligible category codes rejects that row. A `Strategi Backup` or `Kepemilikan` cell that doesn't match a known label rejects that row.

### AC3 — Asset hierarchy derivation

- [x] One `AssetCategory` is created per distinct `categoryCode` seen across imported rows, named via `RPTI_CATEGORY_LABELS`.
- [x] One placeholder `Asset` is created per imported row (1:1 with the resulting `Deliverable`), named after the deliverable, in the row's category.
- [x] The resulting `Deliverable` has `name`, `description` (from `Deskripsi Fungsi Aplikasi`), and `developer` (from `Pengembang Aplikasi`) set directly from the row.

### AC4 — Lifecycle segment derivation

- [x] One open-ended `DeliverableSegment` is created per imported row: `startDate` = the row's go-live date, no `endDate`.
- [x] If the workspace has no `DeliverableStatus` with `isLiveStatus: true`, one is auto-created as part of the same import and used for every row's segment.

### AC5 — LkptiDetail creation and safe regeneration

- [x] Import writes one `LkptiDetail` row per imported row, populating all 15 columns — including the 7 fields with no cascade source from `Deliverable` (`platform`, `database`, `dcProvider`, `drcProvider`, `backupStrategy`, `systemOwner`, `ownership`).
- [x] After import, clicking **Generate LKPTI Rows** in Data Manager does **not** clear the 7 manual-only fields (or `goLiveDate`) on the imported rows — `generateLkptiDetails()` only creates a new row when a Deliverable has none, and only refreshes cascade-derived fields (`categoryCode`, `developer`, `dcCity`/`dcCountry`, `drCity`/`drCountry`, `functionDescription`) on a row that already exists.
- [x] Generation still behaves as before for deliverables with no existing `LkptiDetail` row (e.g. added after import, or from the `rpti` template) — a fresh row is created and fully cascade-filled as today.

### AC6 — Import failure handling

- [x] An unrecognized file (wrong sheet name, wrong headers, non-Excel file) shows a clear error and leaves the template picker open — no partial workspace is created.

---

## Out of scope (for now)

- `Programme` / `Strategy` / `Initiative` derivation — nothing in an LKPTI row supports it.
- `Resource` assignments, `Dependency` links, `Milestone`s, `Decision`s.
- Any lifecycle history before go-live (planned/funded segments) — only the current live segment is created.
- Importing LKPTI data into an *existing* workspace from Data Manager (this story is scoped to first-load onboarding only — see `requirement-specs/lkpti-import-onboarding.md` §4's rejected alternatives).

---

## Files Touched

| File | Change |
|---|---|
| `src/lib/lkptiImport.ts` | New — strict-format parser, header/row validation, entity derivation |
| `src/lib/lkptiImport.test.ts` | New — Vitest coverage for parsing, validation failures, and entity derivation |
| `src/lib/lkpti.ts` | `generateLkptiDetails()` changes from wipe-and-rebuild to merge-preserving |
| `src/lib/lkpti.test.ts` | New/updated cases for merge-preserving generation (AC5) |
| `src/lib/workspaceTemplates.ts` | New `TemplateId` (`'lkpti-import'`) |
| `src/components/TemplatePickerModal.tsx` | 4th template card, `onLkptiImport: (file: File) => void` prop |
| `src/App.tsx` | Wires `onLkptiImport` — parses file, builds workspace, handles failure |
| `e2e/lkpti-import-onboarding.spec.ts` | New — covers AC1, AC6, and a happy-path import → generate check |
| `docs/user-guide/15-lkpti-report/importing-an-lkpti-report.md` | New — following the existing LKPTI report guide's pattern |

---

## Status

Implemented. See [ADR-0010](../adr/0010-lkpti-import-onboarding.md) for the final data-model record, and `src/lib/lkptiImport.test.ts` (18 tests) + `e2e/lkpti-import-onboarding.spec.ts` (4 tests) for coverage. Full unit + Playwright suite green.
