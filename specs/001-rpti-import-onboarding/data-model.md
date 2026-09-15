# Phase 1 Data Model: OJK-First Onboarding and RPTI Return Import

**Date**: 2026-09-14 · **Feature**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

No new IndexedDB object store and no schema bump. Everything an import produces lands in stores
that already exist (schema v19). What follows is the mapping from a filed return to those stores,
and the rules that govern it.

## Parsed row (transient)

One per data row in a Format 3.1 return. Exists only between parse and derive; never persisted.

| Field | Source column | Notes |
|---|---|---|
| `rowNumber` | position in sheet | Carried so a skipped row can be reported by location (FR-021) |
| `name` | `Nama Aplikasi/Infrastruktur Bank` | Required; a row without it is unusable |
| `description` | `Deskripsi` | |
| `categoryCode` | `Kategori` | Required; must be one of RPTI's 18 codes, else unusable |
| `developmentType` | `Jenis Pengembangan` | Required; `new` or `upgrade` — drives both timing and matching |
| `developer` | `Pengembang` | `inhouse` or `PPJTI` |
| `ppjtiRelatedParty` | `PPJTI Pihak Terkait` | |
| `dcCity` / `dcCountry` | `Lokasi Data Center` | |
| `drCity` / `drCountry` | `Lokasi Disaster Recovery Center` | |
| `plannedQuarter` | `Waktu Rencana Implementasi` | A quarter with **no year** — see reporting year below |
| `capexAmount` / `opexAmount` | `Estimasi Biaya CapEx` / `OpEx` | Unreadable values make the row unusable |
| `remarks` | `Keterangan` | |

**Skipped row**: `{ rowNumber, reason }`. Never silently discarded (FR-021).

## Reporting year (supplied, not parsed)

Not present in either layout. Asked for per return, and the two may differ — an inventory *as at*
2026 beside a plan *for* 2027 is the normal pairing (FR-009). It is an input to derivation, not a
stored field: `RptiDetail` has no year, matching how `generateRptiDetails(input, reportYear)`
already treats the year as a parameter rather than data.

## What a row becomes

Each usable row produces a chain, mirroring how `deriveWorkspaceFromLkptiImport` already shapes an
LKPTI row:

```
AssetCategory        one per distinct category code, named from RPTI_CATEGORY_LABELS
  └─ Asset           one per row, named after the item
      └─ Deliverable type = application | infrastructure, from the category code   [FR-013]
          ├─ DeliverableSegment(s)   positioned from plannedQuarter + reporting year [FR-016/017]
          └─ RptiDetail              the filed values, preserved                     [FR-014]
Initiative           one per row, carrying its name, description, dates, CapEx, OpEx [FR-015]
```

### Deliverable type is decided by category, never guessed

| Category codes | `Deliverable.type` |
|---|---|
| `01`-`12`, `49` | `application` |
| `51`, `52`, `53`, `54`, `99` | `infrastructure` |
| anything else | row is unusable and reported |

This is the rule that makes the five infrastructure codes reachable at all (SC-002). Getting it
backwards would file infrastructure as applications, so it is unit-tested per code rather than as a
range.

### Segment placement

Let `Q` be the planned quarter and `Y` the reporting year for that return.

| `developmentType` | Segments produced |
|---|---|
| `new` | one **pre-launch** segment ending at the close of `Q Y`; one **live** segment beginning at that point |
| `upgrade` | the same pair, **plus** a preceding **live** segment — an upgrade targets something the bank already runs (FR-017) |

Every segment carries its row's `initiativeId`. Without it, `generateRptiDetails` would silently
omit the imported work when a return is regenerated (`rpti.ts:126`).

### RptiDetail mapping

`targetType` is always `deliverable` for imported rows. `targetId` is the derived Deliverable, or —
for a matched upgrade — the existing one. `deliverableSegmentId` points at the pre-launch segment,
matching how generation anchors the quarter it derives.

## Relating a plan row to the inventory

Applies only when an LKPTI was imported first.

| `developmentType` | Behaviour |
|---|---|
| `new` | Create a new Deliverable without consulting the inventory (FR-020) |
| `upgrade`, unambiguous match found | Attach to the existing Deliverable; create no duplicate (FR-018) |
| `upgrade`, no match or more than one | Import the row's planned work and its `RptiDetail`, but create **no** Deliverable. The `RptiDetail.targetId` is left unresolved (FR-019) |

**Unambiguous** means an exact correspondence on name *and* category code. Anything looser is
judgement, and judgement is surfaced rather than automated. This will under-match — the two returns
are known to disagree on naming — and that is the accepted failure direction: reporting a real item
for review beats silently duplicating it.

### How an unresolved reference surfaces

Through machinery that already exists. `computeDataHealth` already raises `rpti-target` for any
`RptiDetail` whose target does not resolve (`dataHealth.ts`):

> *An RPTI row for "…" points at a deliverable that no longer exists.*

An unmatched upgrade row produces exactly that shape, so it appears in the data-health review the
user lands on (FR-022) with **no new health rule and no import-results store**. Imported data is
ordinary workspace state; a dangling plan reference is an ordinary broken reference.

**Rejected alternative — create the Deliverable anyway and flag it.** Simpler to render, and avoids
a dangling row. Rejected because it silently manufactures an application the bank never filed as
new, which is the duplicate-creation failure FR-019 exists to prevent. A visible broken reference is
the safer artefact: it cannot be mistaken for real inventory.

**Rejected alternative — hold unresolved rows in a separate import-results store.** Would give
richer reporting at import time, but creates a second place where findings live, needs its own
lifecycle, and would not survive the reload that data health already survives.

### Failure part-way through

Each return commits on its own success; there is no transaction spanning both. A failed RPTI import
therefore leaves a successfully imported LKPTI in place — a valid end state, since the RPTI is
optional. Recovery from an unwanted result is the existing start-over mechanism, not a per-import
rollback.

## Validation rules

| Rule | Source |
|---|---|
| A file must match the layout its slot expects, or be refused by name | FR-010 |
| A refused or failed import leaves the workspace exactly as it was | FR-011 |
| Every unusable row is reported with position and reason | FR-021 |
| Every unresolved upgrade reference is reported | FR-019, SC-004 |
| Category code decides application vs infrastructure, never inferred from the name | FR-013 |
| The reporting year is never guessed | FR-009 |
| Rows naming the same item are not de-duplicated within one return | Assumptions |

## What this feature does not change

`RptiDetail`, `LkptiDetail`, `Deliverable`, `Initiative`, `DeliverableSegment`, `Asset` and
`AssetCategory` keep their current shape. No field is added, no store is created, `DB_VERSION` stays
at 19. Report generation, validation and period scoping are untouched — that is the next piece of
work.
