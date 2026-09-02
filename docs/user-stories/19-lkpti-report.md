# User Story 19: LKPTI Report (Format 3.2.6)

## Story

> **As** an Indonesian bank's IT portfolio manager,
> **I want** to generate and maintain an inventory of currently-live applications matching OJK's LKPTI Format 3.2.6 (Daftar Aplikasi),
> **So that** I can produce the Application List regulatory submission without re-entering data Selara already has.

---

## Background

LKPTI Format 3.2.6 is a second OJK regulatory report, distinct from RPTI (Format 3.1) — see `requirement-specs/lkpti-schema.md` for the field spec and `requirement-specs/lkpti-integration.md` for the design decisions behind this feature (issue #4). Unlike RPTI, which reports planned development *activity* within a report year, LKPTI 3.2.6 is a point-in-time *inventory* of applications the bank currently has live in production.

---

## Acceptance Criteria

### AC1 — Data Manager tab

- [x] Data Manager gets a new **LKPTI** tab, structurally identical to the existing RPTI tab (generate button + editable table).
- [x] Each row's **Deliverable** column selects the Deliverable this row is about — LKPTI 3.2.6 is application-scoped, so unlike RPTI there's no Asset-target option.
- [x] **Category** offers only the 13 LKPTI-eligible codes (`01`–`12`, `49`) — RPTI's infrastructure-only codes (`51`–`54`, `99`) are excluded, since they're not valid on this form.

### AC2 — Row generation

- [x] Clicking **Generate LKPTI Rows** builds one row per Deliverable that has at least one lifecycle segment classified as live (in-production) **and already started** (`startDate <= today`) — a Deliverable that's only ever been Planned or Funded, or whose live phase begins in the future, doesn't generate a row, since LKPTI requires a non-future go-live date.
- [x] A Deliverable that has gone live stays on the report even once its live segment has ended — the rule is "has gone live", not "is live right now", so a sunset or out-of-support application is still reported until its row is deleted.
- [x] Generation is **not** scoped to a report year, unlike RPTI — it always reflects current state.
- [x] **Category**, **Developer**, and the four DC/DR location fields cascade Deliverable → AssetCategory, reusing the same resolution logic RPTI generation already uses.
- [x] **Developer** only auto-fills to `'inhouse'`; when the Deliverable's developer is a third party, the row is left blank for the provider's actual name (LKPTI wants the name, not a generic marker).
- [x] **Function Description** auto-fills from the Deliverable's own `description` field, when set (see ADR-0008).
- [x] **Go-Live Date** is auto-suggested from the earliest live segment's start date, converted to `dd-mm-yyyy`.
- [x] Regenerating replaces all existing rows (same wipe-and-rebuild tradeoff as RPTI generation — no reconciliation with prior manual edits).

### AC3 — Cascading delete

- [x] Deleting a Deliverable removes any LKPTI row targeting it.
- [x] Clearing all Deliverables clears all LKPTI rows.

### AC4 — Reports view

- [x] Reports gets a new **LKPTI Report** card, opening a read-only summary table structurally identical to the RPTI Report screen.
- [x] **Export to Excel** downloads a spreadsheet matching the exact LKPTI 3.2.6 column order and Indonesian headers (`requirement-specs/lkpti-schema.md` §8).

### AC5 — Full workspace integration

- [x] LKPTI rows round-trip through the general Excel export/import, version snapshots, and version-diff reporting, the same as every other entity.
- [x] No regressions in the full Playwright + Vitest suite.

---

## Out of scope (for now)

- Partial/selective row generation (currently all-or-nothing, same as RPTI)
- A shared generation UI between RPTI and LKPTI (deliberately duplicated rather than abstracted prematurely — see `requirement-specs/lkpti-integration.md`)

---

## Files Touched

| File | Change |
|---|---|
| `src/types.ts` | `LkptiDetail`, `LkptiCategoryCode`, `LkptiBackupStrategy`, `LkptiOwnership`, `Deliverable.description` (ADR-0008) |
| `src/lib/rpti.ts` | Exported `isLiveStatusId` and `resolveAssetCategory` for reuse |
| `src/lib/lkpti.ts` | New: generation, `suggestGoLiveDate`, cascade helper, Excel export |
| `src/lib/db.ts` | New `lkptiDetails` store (`DB_VERSION` 18 → 19) |
| `src/lib/workspaceTemplates.ts`, `src/lib/excel.ts`, `src/lib/diff.ts` | Threaded through templates, general export/import round-trip, version-diff |
| `src/App.tsx`, `src/components/DataManager.tsx`, `src/components/DataControls.tsx`, `src/components/VersionManager.tsx` | State, cascading deletes, import/export, version save/diff |
| `src/components/ReportsView.tsx`, `src/components/LkptiReportView.tsx` | New report card + read-only view |
| `e2e/lkpti-report.spec.ts` | E2E tests covering AC1–AC4 |
| `docs/user-guide/15-lkpti-report/recording-lkpti-report-rows.md` | User-facing guide |
