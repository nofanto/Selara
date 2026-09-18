# Phase 1 Data Model: Report Year and Report-Row Field Ownership

## Changed entities

### `Deliverable` — gains eight fields (11 → 19)

Seven new, plus a widened `developer`, plus `ppjtiRelatedParty`.

| Field | Type | Source today | Notes |
|---|---|---|---|
| `platform` | `string?` | `LkptiDetail.platform` | What the deliverable is built on |
| `database` | `string?` | `LkptiDetail.database` | |
| `dcProvider` | `string?` | `LkptiDetail.dcProvider` | Company name, or `'self'` |
| `drcProvider` | `string?` | `LkptiDetail.drcProvider` | |
| `backupStrategy` | `LkptiBackupStrategy?` | `LkptiDetail.backupStrategy` | Existing enum, unchanged |
| `systemOwner` | `string?` | `LkptiDetail.systemOwner` | Person accountable |
| `ownership` | `LkptiOwnership?` | `LkptiDetail.ownership` | Lease / outright purchase |
| `ppjtiRelatedParty` | `RptiRelatedParty?` | `RptiDetail.ppjtiRelatedParty` | Held per application (Q3) |
| `developer` | **widened** | already on `Deliverable` | From `RptiDeveloper` (`'inhouse' \| 'PPJTI'`) to also carry a provider's name, as `LkptiDetail.developer` does |

**Validation**: all optional. No field is required for a deliverable to exist — a workspace built
by hand starts empty and fills in over time, exactly as the existing `dcCity`/`drCity` do.

**The `developer` widening needs care.** `RptiDetail.developer` remains the two-value
classification the RPTI column wants; `LkptiDetail.developer` is free text carrying a provider
name. After the move, `Deliverable.developer` must serve both: the RPTI derives `'PPJTI'` from
"a name that is not `'inhouse'`", while the LKPTI emits the name itself. This is how
`generateLkptiDetails` already behaves in one direction (`lkpti.ts:102`).

**Not cascaded from `AssetCategory`.** `AssetCategory` supplies defaults for `categoryCode` and
the four locations only. Several new fields would plausibly want the same — a bank tends to
answer `dcProvider` identically across a category — but that is additive and deliberately left
out (design notes, Q1).

### `Initiative` — gains one field (18 → 19)

| Field | Type | Source today | Notes |
|---|---|---|---|
| `rptiRemarks` | `string?` | `RptiDetail.remarks` | The RPTI `Keterangan` column |

**Named `rptiRemarks`, not `remarks`.** `Initiative.description` already supplies the RPTI's
other free-text column (`Deskripsi`, `rpti.ts:364`). Two bare free-text fields on one entity
would be filled interchangeably; the name and its type comment must make the distinction
obvious (FR-013).

### `LkptiDetail` — keeps its fields, loses authorship

**Revised during implementation.** The original plan was to remove the eight moved fields. That
is not possible: `exportLkptiReportToExcel` reads its columns straight off the detail row
(`lkpti.ts:209-219`), so the record *is* the exported line of the return. Removing them would
break the export entirely.

What changes is the **source of truth**, not the shape. The `Deliverable` owns the values;
`generateLkptiDetails` fills the row from it. The type now says so, and warns that a value
written directly onto a row is overwritten by the next generation.

The same applies to `RptiDetail.remarks` and `RptiDetail.ppjtiRelatedParty` (`rpti.ts:382,388`).

### `RptiDetail` — keeps its fields, loses authorship

As above. With `remarks` now derived from `Initiative.rptiRemarks` and `ppjtiRelatedParty` from
`Deliverable`, the record has **no field the workspace cannot reproduce** — the condition the
destination depends on. Recorded, not acted on here.

## New concept, not persisted

### Report year

A value supplied when a return is generated. **Not stored on any entity** (R1).

- RPTI: the plan year. Selects which segments and initiatives contribute.
- LKPTI: an as-at date, `31 December <year>`. Selects applications whose live segment spans it.

**Default offered**: the year given at onboarding, where one was given; otherwise the preparer
states it. Never taken from the system clock (FR-005).

## Behaviour changes

| | Today | After |
|---|---|---|
| LKPTI membership | live segment `startDate <= today` | live segment spans the as-at date |
| Decommissioned application | still listed (measured) | correctly excluded |
| RPTI report year | `new Date().getFullYear()` | asked, never inferred |
| Report export | whatever rows are stored | derived for the stated year |

## Relationships

No new relationships. Every field added attaches to an entity that already exists, keyed as it
already is. No store is created, so no dangling-reference check is added.
