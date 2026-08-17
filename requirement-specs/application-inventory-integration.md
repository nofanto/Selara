# Application Inventory Report Integration (LKPTI Format 3.2.6) — Design Notes

> **Status:** Decided, not yet implemented. This doc resolves all open design questions raised in [issue #4](https://github.com/nofanto/Selara/issues/4) — see `requirement-specs/application-inventory-schema.md` for the underlying field spec (unchanged by this doc). No code has been written yet; see "Next Step."

## Context and Problem Statement

`requirement-specs/application-inventory-schema.md` specifies OJK's **LKPTI Format 3.2.6 — Daftar Aplikasi** (Application List), a second regulatory report distinct from RPTI (Format 3.1). Before any implementation, five design questions needed resolving:

1. A category-code label mismatch between that spec and the existing `rpti-schema.md`.
2. How the 15 LKPTI fields map onto Selara's existing `Deliverable`/`AssetCategory`/`RptiDetail` data model.
3. What triggers a generated row.
4. Where the report lives in the UI.
5. How export is wired.

---

## Decided

### 1. Category code `09` label — fixed in `rpti-schema.md`

**The mismatch:** `rpti-schema.md` glossed code `09` as *"AML-CFT and PPPSPM (payment system provider compliance)"*; `application-inventory-schema.md` glossed the same code as *"AML/CFT and CPF of WMD"* (Indonesian: *"APU-PPT dan PPPSPM"*).

**Resolution:** `application-inventory-schema.md` was correct. **PPPSPM** stands for **P**encegahan **P**endanaan **P**roliferasi **S**enjata **P**emusnah **M**assal — "Prevention of Proliferation Financing of Weapons of Mass Destruction" — confirmed by OJK's own regulation **POJK 8/2023**, *"Penerapan Program APU, PPT, dan PPPSPM di Sektor Jasa Keuangan"* (and its 2025 successor SEOJK 16/SEOJK.07/2025), both titled around exactly this expansion. `rpti-schema.md`'s "(payment system provider compliance)" was a mistranslation of the acronym — there is no OJK program literally named that.

**Change made:** `rpti-schema.md` code `09` now reads *"AML-CFT and PPPSPM (prevention of proliferation financing of weapons of mass destruction)"*, matching the confirmed meaning. `RPTI_CATEGORY_LABELS` in `src/lib/rpti.ts` already just says `'AML-CFT and PPPSPM'` with no expansion — no code change needed there.

Sources: [POJK 8/2023](https://www.ojk.go.id/id/regulasi/Documents/Pages/POJK-APU-PPT-dan-PPPSPM-di-SJK/POJK%208-2023%20-%20APU%20PPT%20dan%20PPPSPM%20di%20SJK.pdf), [FAQ — POJK 8/2023](https://www.ojk.go.id/id/regulasi/Documents/Pages/POJK-APU-PPT-dan-PPPSPM-di-SJK/FAQ%20POJK%208%20TAHUN%202023%20-%20PENERAPAN%20PROGRAM%20APU%20PPT%20DAN%20PPSPM%20DI%20SJK.pdf).

### 2. Data model shape — new `ApplicationInventoryDetail` entity, not an extended `Deliverable`

Of the 15 LKPTI fields, 4 already exist as cascading defaults on `Deliverable`/`AssetCategory` (added for RPTI): `categoryCode`, `developer`, `dcCity`/`dcCountry`, `drCity`/`drCountry`. The other 10 are net-new: `platform`, `database`, `dc_provider`, `drc_provider`, `backup_strategy`, `system_owner`, `go_live_date`, `ownership`, `function_description` (`row_number` is presentational only — a sequential export-time index, not a stored field).

**Decision:** model this the same way `RptiDetail` already models RPTI rows — a dedicated report-row entity, not new fields bolted onto `Deliverable`:

```ts
export type BackupStrategy = 'HA_ACTIVE_ACTIVE' | 'HA_ACTIVE_PASSIVE' | 'BACKUP_REALTIME' | 'BACKUP_PERIODIC';
export type Ownership = 'LEASE' | 'OUTRIGHT_PURCHASE';

export interface ApplicationInventoryDetail {
  id: string;
  targetId: string;                  // Deliverable.id — LKPTI 3.2.6 is scoped to applications, unlike RptiDetail which also targets bare Assets
  categoryCode?: RptiCategoryCode;    // Cascades: this row's value ?? Deliverable.categoryCode ?? AssetCategory.categoryCode
  developer?: RptiDeveloper;          // Cascades: this row's value ?? Deliverable.developer
  dcCity?: string; dcCountry?: string;  // Cascades: this row's value ?? Deliverable ?? AssetCategory, per field
  drCity?: string; drCountry?: string;  // Cascades: this row's value ?? Deliverable ?? AssetCategory, per field
  // No auto-fill source — always manual, same status as RptiDetail.remarks:
  platform: string;
  database: string;
  dcProvider: string;                 // company name, or 'self'
  drcProvider: string;                // company name, or 'self'
  backupStrategy: BackupStrategy;
  systemOwner: string;
  goLiveDate: string;                 // dd-mm-yyyy per the LKPTI form
  ownership: Ownership;
  functionDescription: string;
}
```

**Why:** `RptiDetail` already established this exact pattern for report rows — a dedicated entity with `targetId`, cascading defaults resolved through `Deliverable → AssetCategory` (the auto-fill chain in `generateRptiDetails()`/`resolveAssetCategory()`, `src/lib/rpti.ts`), and manual-only fields for anything with no sensible default. Reusing it here means:
- The existing cascade logic is reused as-is (`deliverable?.categoryCode ?? category?.categoryCode`, etc.) — no new resolution code for the 4 shared fields.
- `Deliverable` stays lean. The 10 new fields (platform, database, backup strategy, ownership, etc.) only matter for one specific regulatory report, not for every deliverable in the app — including non-application `DeliverableType`s (`infrastructure`, `document`, `procedure`) that will never have a "platform" or "database."
- Row generation can mirror `generateRptiDetails()`'s shape: likely one row per `Deliverable` of `type: 'application'` (or a user-curated subset), rather than RPTI's per-`(initiative, deliverable)` grouping — LKPTI 3.2.6 is an inventory snapshot, not an activity report, so its generation rule will need its own (simpler) design pass, not a copy of RPTI's segment-based collapsing logic. That rule is deferred — see "Open Questions."

**Rejected alternative — extend `Deliverable` directly.** Simpler (one entity, no new generation logic to design), but bloats every `Deliverable` record — including the ~majority that aren't `'application'` type — with 10 fields that only ever apply to this one report. Rejected in favor of keeping the precedent `RptiDetail` already set.

### 3. Row generation rule — live Deliverables only, no year-scoping

**Decision:** one row per `Deliverable` (`type: 'application'`, or `undefined` which is treated as `'application'`) that has at least one `DeliverableSegment` classified `'live'` (in-production) by `classifySegmentKind()` — mirroring the helper `rpti.ts` already uses for its own "has this deliverable gone live" check. Unlike RPTI generation, this is **not scoped to a report year**: LKPTI 3.2.6 is a point-in-time inventory of what's currently running, not a plan of activity within a year, so "Generate Application Inventory Rows" always wipes and rebuilds from current Deliverable/DeliverableSegment state (same wipe-and-rebuild semantics as RPTI generation, minus the year parameter).

**Why:** the schema's own validation rule 5.3 — *"`go_live_date` must ... not be in the future relative to the reporting period end date"* — only makes sense if every row already represents an application that has actually gone live. Including still-planned/funded-but-not-live deliverables would produce rows that fail the schema's own validation until they go live, requiring manual pruning later. Requiring a live segment upfront keeps every generated row valid by construction.

`goLiveDate` (required, no auto-fill source per the field table) is **auto-suggested** from the earliest `'live'`-classified segment's `startDate` — a new `suggestGoLiveDate()` helper mirroring `suggestDeliverableQuarter()` — but stays a plain editable field afterward, same override-wins pattern as everywhere else in this data model.

**Rejected alternative — every `'application'`-type Deliverable regardless of status.** Simpler generation rule, but produces regulatory-invalid rows (missing/future `go_live_date`) for anything not yet live, undermining the point of the schema's own validation.

### 4. Report UI placement — mirror the RPTI Data Manager tab + Reports card pattern

**Decision:** exactly the twin-surface pattern RPTI already established, not a new pattern:
- **Data Manager** gets a new `'applicationInventory'` tab (label "Application Inventory" or "LKPTI 3.2.6") with a "Generate Application Inventory Rows" button (→ the rule in §3) and an `EditableTable` for manual edits afterward — same shape as the existing `'rpti'` tab (`src/components/DataManager.tsx`).
- **Reports view** gets a new `'application-inventory'` `ReportSlug` and card, rendering a new `ApplicationInventoryReportView` component — a read-only summary table + "Export to Excel" button, structurally identical to `RptiReportView.tsx`.

**Why:** Selara already has exactly one precedent for "a regulatory report backed by a generated, editable entity" (RPTI), and it's a good fit — reusing it outright avoids inventing a second UI pattern for what's structurally the same kind of feature (generate → edit → export).

### 5. Export wiring — dedicated exporter in a new `src/lib/applicationInventory.ts`

**Decision:** a new `exportApplicationInventoryToExcel()` function, co-located with the generation logic in `src/lib/applicationInventory.ts` (mirroring `rpti.ts`, which houses both `generateRptiDetails()` and `exportRptiReportToExcel()` together). It builds a single-sheet workbook using `XLSX.utils.aoa_to_sheet()` with the exact Indonesian header row and 1–15 column order mandated by `application-inventory-schema.md` §8, downloaded as `application-inventory-<date>.xlsx` — the same shape as `exportRptiReportToExcel()`, not routed through the general multi-entity `src/lib/excel.ts` workbook exporter (RPTI's report export isn't either — it's a separate, self-contained single-report download, and this report should follow the same convention for consistency).

---

## Open Questions

- **Scope/timing relative to other in-flight work** — issue #3 (RPTI Detail auto-fill logic review) and issue #5 (sharing backend) are both open; this feature doesn't obviously depend on either, but hasn't been sequenced against them. Non-blocking.

---

## Next Step

All design questions are resolved — proceed to Step 1 of the standard lifecycle. This is primarily **pure logic** (`src/lib/applicationInventory.ts`: the entity type, `generateApplicationInventoryDetails()`, `suggestGoLiveDate()`, `exportApplicationInventoryToExcel()` — no DOM dependency) — the primary test is a **Vitest unit test**, written Red before implementation, following the same pattern as `src/lib/rpti.test.ts`. The Data Manager tab and Reports card/view that follow are UI-facing and separately need Playwright E2E tests per the usual rule.
