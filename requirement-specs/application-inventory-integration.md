# Application Inventory Report Integration (LKPTI Format 3.2.6) — Design Notes

> **Status:** Decided, not yet implemented. This doc resolves the two open design questions raised in [issue #4](https://github.com/nofanto/Selara/issues/4) — see `requirement-specs/application-inventory-schema.md` for the underlying field spec (unchanged by this doc). No code has been written yet; see "Next Step."

## Context and Problem Statement

`requirement-specs/application-inventory-schema.md` specifies OJK's **LKPTI Format 3.2.6 — Daftar Aplikasi** (Application List), a second regulatory report distinct from RPTI (Format 3.1). Before any implementation, two design questions needed resolving:

1. A category-code label mismatch between that spec and the existing `rpti-schema.md`.
2. How the 15 LKPTI fields map onto Selara's existing `Deliverable`/`AssetCategory`/`RptiDetail` data model.

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

---

## Open Questions (deferred — not blocking, but need their own design pass before implementation)

- **Row generation rule.** Unlike RPTI's segment/initiative-driven generation, LKPTI 3.2.6 looks like a point-in-time inventory of applications — what triggers a row (every live `Deliverable` of type `'application'`? user-curated?), and does it regenerate per reporting period the way RPTI does per year?
- **Report UI placement.** Where does this live in the Reports view — a new tab alongside RPTI, or folded into an existing one?
- **Export wiring.** The schema's §8 mandates an exact 15-column order and Indonesian-language header row for CSV/XLSX export — how this integrates with the existing `src/lib/excel.ts` export path hasn't been scoped.
- **Scope/timing relative to other in-flight work** — issue #3 (RPTI Detail auto-fill logic review) and issue #5 (sharing backend) are both open; this feature doesn't obviously depend on either, but hasn't been sequenced against them.

---

## Next Step

Once the open questions above are resolved, proceed to Step 1 of the standard lifecycle. This is primarily **pure logic** (a new `src/lib/applicationInventory.ts`, generation rule with no DOM dependency) — the primary test is a **Vitest unit test**, written Red before implementation, following the same pattern as `src/lib/rpti.test.ts`. Any report-view UI work that follows would separately need a Playwright E2E test per the usual UI-facing rule.
