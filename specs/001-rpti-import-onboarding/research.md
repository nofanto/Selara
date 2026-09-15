# Phase 0 Research: OJK-First Onboarding and RPTI Return Import

**Date**: 2026-09-14 · **Feature**: [spec.md](./spec.md)

This is a mature codebase, so "research" here means establishing what already exists and what the
feature must follow, rather than surveying external options. Every finding below was verified
against the source, not recalled.

## 1. The import precedent to mirror

**Decision**: Model `rptiImport` on `lkptiImport`'s two-stage split.

`src/lib/lkptiImport.ts` exposes a shape worth copying exactly:

| Export | Why it matters |
|---|---|
| `parseLkptiImportWorkbook(workbook)` | Pure. Takes a parsed workbook, returns rows + skipped rows. Unit-testable with no File, no DOM. |
| `parseLkptiImportFile(file)` | Thin `File` → workbook wrapper over the above. |
| `deriveWorkspaceFromLkptiImport(rows)` | Pure. Rows → workspace entities. Unit-testable. |

**Rationale**: it puts every decision that can be wrong into a pure function, satisfying
Constitution Principle III (*test at the altitude of the risk*) without needing a browser. The
`File`/`FileReader` boundary — the part that cannot be unit-tested — holds no logic.

**Alternatives considered**: a single `importRptiFile(file)`. Rejected: it would put parsing *and*
derivation behind a `FileReader`, which is precisely the seam problem that made the Excel
round-trip untestable until #22 split `buildWorkbook`/`parseWorkbook` out.

## 2. The format to invert

**Decision**: the importer inverts `exportRptiReportToExcel` (`src/lib/rpti.ts:242-255`), 13 columns:

`No.` · `Nama Aplikasi/Infrastruktur Bank` · `Deskripsi` · `Kategori` · `Jenis Pengembangan` ·
`Pengembang` · `PPJTI Pihak Terkait` · `Lokasi Data Center` · `Lokasi Disaster Recovery Center` ·
`Waktu Rencana Implementasi` · `Estimasi Biaya CapEx` · `Estimasi Biaya OpEx` · `Keterangan`

**Notable**: there is **no year column**. This is the source of FR-009 — the reporting year cannot
be recovered from the file and must be asked for. It also confirms `Waktu Rencana Implementasi`
carries a quarter, not a date.

## 3. Quarter → period conversion does not exist yet

**Decision**: a new helper is needed; the existing direction is the wrong way round.

`deriveQuarterFromDate(iso)` (`rpti.ts:28`) converts a date to a quarter. FR-016 needs the inverse:
a quarter plus a reporting year to a date range, so imported planned work can be positioned.

**Rationale**: keeping it a named pure function rather than inline arithmetic makes the
boundary rules (what dates does Q3 2027 mean?) testable, and it will be needed again if returns
are ever regenerated from imported data.

## 4. RptiDetail's non-optional fields constrain derivation

Verified at `src/types.ts:201-219`: `id`, `initiativeId`, `targetType`, `targetId` and
`developmentType` are all required. `initiativeId` being non-optional is what forces FR-015 — an
imported row cannot exist without a piece of planned work to belong to.

`generateRptiDetails` additionally only considers segments that *carry* an `initiativeId`
(`rpti.ts:126`), so imported segments must carry theirs or a regenerated return would silently omit
imported work.

## 5. Landing on data health needs a seam that does not exist

**Decision**: `ReportsView` must gain a way to be opened on a specific report.

`selectedReport` is local `useState` inside `ReportsView` (`ReportsView.tsx:97`) with no prop to
seed it. `data-health` is a valid slug (`ReportsView.tsx:33`), and `onNavigate` exists — but it
sends the user *away* to a health issue's location; nothing brings them *to* the report.

**Rationale**: FR-022 requires landing there after import. The minimal change is an optional
initial-report prop; lifting the state entirely would touch every report path for no benefit here.

**Alternatives considered**: navigating via `onNavigate`. Rejected — wrong direction, and its
`HealthIssueLocation` type describes Data Manager tabs and History, not report slugs.

## 6. Blast radius of the picker change is larger than it looks

**Nine** e2e specs reference onboarding elements (`template-card`, `template-start-blank`,
`template-select-*`, the LKPTI upload button, or the picker itself):

`workspace-templates` · `template-demo-toggle` · `template-picker-file-reset` ·
`lkpti-import-onboarding` · `confirm-modal` · `data-manager` · `initiative-create-edit` ·
`navigation` · `report-history-diff` · `versioned-import-export`

**Rationale for recording it**: several of these use the picker only as *setup* to reach a
workspace, so they break for reasons unrelated to what they test. The prior History-tab refactor
showed how a rename-heavy change silently drops guarantees when specs are repointed mechanically;
these need reading, not sed.

## 7. Demo data is reachable only through the card being removed

Verified at `TemplatePickerModal.tsx:95-110`: the `With demo data` / `Without demo data` buttons sit
in the `else` branch, which only the technology-catalogue template reaches. Removing that card
without rehoming demo data would make it unreachable and violate SC-006.

**Decision**: demo data moves to the "start empty" path (FR-003).

## 8. Scale constraint is measured, not assumed

Issue #36: at 300 rows the LKPTI Data Manager tab renders **78,566** `<option>` elements and the
RPTI tab **141,470**, taking 4.3s to open — because every row renders a `<select>` holding the
entire option list. Imports of several hundred rows land users directly in those tabs.

**Decision**: this feature MUST NOT add per-row full-list controls, and FR-023 forbids introducing
any new n² work. Fixing #36 is **not** in this feature's scope, but this feature must not deepen it.

## Unresolved

None. All three spec clarifications were resolved with the product owner before planning, per
Constitution Principle II.
