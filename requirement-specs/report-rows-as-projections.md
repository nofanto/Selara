# Report Rows as Projections, Not Storage — Design Notes

> **Status:** Problem verified, diagnosis settled, **all six questions decided** (2026-09-18).
> Spec Kit to follow, raised jointly with [#40](https://github.com/nofanto/Selara/issues/40) —
> see "Why this cannot ship before #40". **Nothing is implemented.**
>
> **Read the title as the destination, not this instalment.** What was decided is the
> data-model half: the attributes move to the entities they describe (Q1-Q3). The Data Manager
> tabs are deliberately untouched (Q5/Q6), so importing will still fill them. Making the rows
> genuine projections is a later step that this one makes possible.

## The observation

Importing LKPTI and RPTI fills the Data Manager's RPTI and LKPTI tabs with rows. The
question raised: should those tabs not be **empty** after import, with rows produced by
pressing **Generate** from the data that was imported?

It is a good instinct. Step 2 of `it-planning-flow.md` — *Maintain, the year-round work* —
describes a workspace of assets, deliverables, segments and initiatives; step 3 *prepares
the filing* by generating rows from it. Import currently short-circuits that, writing the
step-3 output directly. So the model the diagram describes and the model the importer
produces disagree.

## Verified: it cannot work today, and this is why

Discarding the imported rows and regenerating from the same workspace loses, on the 13-row
sample:

| LKPTI field | rows losing it | | RPTI field | rows losing it |
|---|---|---|---|---|
| `platform` | 13/13 | | `capexAmount` | 13/13 |
| `database` | 13/13 | | `opexAmount` | 13/13 |
| `dcProvider` | 13/13 | | `remarks` | 11/13 |
| `drcProvider` | 13/13 | | `ppjtiRelatedParty` | 10/13 |
| `backupStrategy` | 13/13 | | | |
| `systemOwner` | 13/13 | | | |
| `ownership` | 13/13 | | | |
| `developer` (vendor name) | 9/13 | | | |

`generateLkptiDetails` derives seven cascaded fields (`lkpti.ts:100-108`). The rest have **no
source anywhere in the workspace**: the filed return is the only place they exist, and
`LkptiDetail` is the only record that can hold them. Generate-on-demand would produce 13 rows
with seven fields filled and eight blank.

The RPTI losses are milder and two are not real: `capexAmount`/`opexAmount` are *overrides*,
and `resolveCost` (`rpti.ts:296-301`) falls back to the linked Initiative's figures, which the
importer does set — so the exported value survives even though the detail field empties.

## Diagnosis: `LkptiDetail` is two things wearing one name

The reason the proposal fails is not that generation is weak. It is that the record conflates:

1. **Attributes of the application.** `platform`, `database`, `dcProvider`, `drcProvider`,
   `backupStrategy`, `systemOwner`, `ownership`, and the vendor name in `developer`. These are
   facts about the deliverable, true whether or not anyone files anything this year.
2. **A projection into a report row.** `categoryCode`, the four location fields,
   `functionDescription` — every one already derived by cascade from the Deliverable and its
   AssetCategory.

Group 1 has nowhere else to live, so it is stored on the report row by default rather than by
design. Move it onto `Deliverable` and `LkptiDetail` becomes purely derived — at which point
the proposal works exactly as described.

**There is already precedent in the codebase for exactly this move.** `goLiveDate` was once
manual-only; it is now derived by `suggestGoLiveDate()` from the deliverable's first live
segment (`lkpti.ts:117`, `lkpti.ts:46-54`). It is the one field in group 1's original list
that *survived* the discard-and-regenerate test, because it stopped being storage and became a
projection. The same argument applies to the other eight; they simply have no timeline concept
to derive from, so they need a home on the entity instead.

## Field inventory

The unit of the eventual decision. **D** = already derived, **A** = an attribute of the
application, **R** = genuinely about this report row.

### `LkptiDetail`

| Field | | Notes |
|---|---|---|
| `categoryCode` | D | cascades Deliverable → AssetCategory |
| `dcCity` `dcCountry` `drCity` `drCountry` | D | cascade, per field |
| `functionDescription` | D | `Deliverable.description` |
| `goLiveDate` | D | `suggestGoLiveDate()` from the first live segment |
| `platform` | A | what the application is built on |
| `database` | A | |
| `dcProvider` `drcProvider` | A | who runs the data centre — 'self' or a company |
| `backupStrategy` | A | |
| `systemOwner` | A | the person accountable for the application |
| `ownership` | A | lease or outright purchase |
| `developer` | A | 'inhouse' derives; the vendor **name** does not |

Every non-derived field is an **A**. `LkptiDetail` has no genuine **R** at all — which is the
strongest evidence that it should be a pure projection.

### `RptiDetail`

| Field | | Notes |
|---|---|---|
| `initiativeId` `targetType` `targetId` | D | the pair generation groups by |
| `categoryCode` `developer` | D | from the Deliverable |
| `developmentType` | D | prior-live history — see `rpti-auto-generation.md` |
| `dcCity` `dcCountry` `drCity` `drCountry` | D | cascade |
| `plannedImplementationQuarter` | D | anchor segment's start date |
| `deliverableSegmentId` | D | the anchor itself |
| `capexAmount` `opexAmount` | D\* | overrides; `resolveCost` falls back to the Initiative |
| `ppjtiRelatedParty` | A? | derived as `'n/a'` when the developer is not PPJTI, but **left blank when it is** — so the answer for a PPJTI row is a fact about the vendor relationship with no source |
| `remarks` | **R** | free commentary on this row of this year's plan |

RPTI is nearly a projection already. `remarks` is the one field that is genuinely about the
report row rather than the thing it describes.

## Why this cannot ship before #40

Not merely related — a prerequisite.

Today the stored `rptiDetails` **are** the 2027 plan. That is the only record anywhere that a
year was involved: `reportYear` appears in no type and no store (#40). Delete the rows in
favour of generating them and the year exists nowhere at all, so there is nothing to generate
*for*.

Worse, generation is year-scoped and merge-preserving over a single set. A purely-generated
model has no way to hold 2027 and 2028 rows at once — filing next year's plan would have to
destroy this year's record of what was filed. Doing this first would make #40 harder, not
easier.

## Decided

### Q1 — the eight attributes move onto `Deliverable` (2026-09-17)

`Deliverable` gains the seven fields it lacks — `platform`, `database`, `dcProvider`,
`drcProvider`, `backupStrategy`, `systemOwner`, `ownership` — taking it from 11 fields to 18.
`developer` already exists there and widens from the two-value `RptiDeveloper` enum to also
carry a service provider's name, as `LkptiDetail.developer` does today.

**Because the attributes belong to the thing, not to the filing.** A bank knows who runs its
data centre, whether a server is leased or bought, and who owns a system, regardless of which
return is due. RPTI simply has no column for any of it.

*A claim made and withdrawn during the discussion:* that these seven are meaningful only for
`type: 'application'` and would sit uselessly on the other four deliverable types. That is
wrong. `systemOwner`, `ownership`, `dcProvider`, `drcProvider` and `backupStrategy` describe
infrastructure at least as naturally as they describe applications — you lease servers, a data
centre has a provider. What is application-only is the **LKPTI report** that asks for them, not
the attributes. Recorded because the objection sounds right and is not.

**And because a new store is disproportionately expensive here.** `AppState` is enumerated at
every call site rather than spread, so `App.tsx` alone holds **73** references to
`lkptiDetails`. A child store would need a schema bump (19 → 20) and migration, a sheet in
`excel.ts`, a `compareEntities` block in `diff.ts`, dangling-reference checks in `dataHealth`,
a Data Manager tab, and those ~73 call sites. Extending `Deliverable` needs seven lines in
`types.ts`, seven columns, and seven lines in `diff.ts` — `excel.ts` is generic so the
round-trip is free, `db.ts` needs nothing because IndexedDB is schemaless within a store, and
`App.tsx` needs nothing because `Deliverable` already flows everywhere.

**Costs accepted:**

- The Deliverables tab goes from 10 to 17 columns, roughly 2,800px wide. It scrolls, and the
  widths work since [#44](https://github.com/nofanto/Selara/issues/44), but it is a lot of columns.
- Per [#42](https://github.com/nofanto/Selara/issues/42), each new field must be named
  explicitly in `diff.ts` or version history will not see it — silently.
- Migration would be required, and is deliberately deferred — see Q4.

**Left open by this decision:** `AssetCategory` already supplies category-level defaults for
`categoryCode` and the four locations. Several of the new fields — `dcProvider`, `drcProvider`,
`backupStrategy` — would plausibly want the same, since a bank tends to answer them identically
across a whole category. Not decided here; it is additive and can follow.

**Rejected — a new `applicationProfiles` child store.** Structurally identical to what
`LkptiDetail` already is: a 1:1 record keyed by deliverable holding exactly these fields. It
would be a rename with a migration attached, at the cost listed above.

**Rejected — reframing `LkptiDetail` as the application profile.** The cheapest option by far,
since it moves no data and needs no migration: declare the existing record to *be* the
application's regulatory profile and generate the LKPTI export from it. Turned down because it
leaves the attributes in a record named after one report, so every future reader has to learn
that `LkptiDetail` is not what it sounds like — and it entrenches the conflation this document
set out to remove. Worth revisiting only if the migration in Q3 proves more dangerous than
expected.

### Q2 — `remarks` moves onto `Initiative` (2026-09-17)

`RptiDetail.remarks` — the RPTI's `Keterangan` column — becomes a field on `Initiative`.
Confirmed with the product owner: *Keterangan is commentary on the item*, not on this year's
filing of it, so it belongs to the work rather than to the row.

**The precedent is two lines above it in the same export.** `exportRptiReportToExcel` already
takes `Deskripsi` from `initiative?.description` and `Keterangan` from `detail.remarks`
(`rpti.ts:364` and `:374`). The RPTI's two free-text columns were arbitrarily split between two
records; this makes them symmetric.

**It is also what makes the whole change land.** `RptiDetail` has exactly two fields with no
derivation source: `remarks`, and `ppjtiRelatedParty` for PPJTI rows (Q3). Resolve both
and `RptiDetail` is 100% derived, so the RPTI tab can genuinely be empty until generated. Keep
a thin `RptiDetail` alive to hold one optional string and the tab never empties, which defeats
the purpose.

**Accepted consequences:**

- Commentary is per-initiative, not per-year. An initiative spanning 2027 and 2028 carries the
  same `Keterangan` into both returns. Acceptable given the answer above — if it later turns
  out a bank needs to say "delayed from 2027", that is a different field, not this one.
- An initiative touching two deliverables generates two rows sharing one remark, since
  generation groups by `(initiative, deliverable)`.
- **Naming needs care.** `Initiative` already has `description`, which is general-purpose and
  shown on the timeline. A second free-text field must make the distinction obvious in its type
  comment, or the two will be filled interchangeably.

**Rejected — keep a thin `RptiDetail` for identity plus `remarks`.** Preserves per-row, per-year
commentary exactly, but keeps a whole record alive for one optional string and prevents the tab
from ever emptying.

**Rejected — accept that regeneration discards it.** That is precisely the data loss fixed in
`aabee9f`, reintroduced on purpose.

### Q3 — `ppjtiRelatedParty` moves onto `Deliverable` (2026-09-18)

`Deliverable` gains `ppjtiRelatedParty`, joining the Q1 fields. Confirmed with the product
owner: the bank holds this **per application**, not centrally per vendor.

The RPTI column is *PPJTI Pihak Terkait* — is the IT service provider a related party? — with
values `yes | no | n/a`. Generation already derives half of it: when the developer is not
PPJTI the answer is `n/a` by definition, because there is no third party to disclose a
relationship with (`rpti.ts:206`). The other half has no source, which is why ten of the
thirteen sample rows lost it when regenerated.

It sits well beside `developer` on the same record, and generation already reads `developer`
from the `Deliverable` to decide the `n/a` half, so both halves of the answer end up in one
place.

**Known simplification, recorded so it is not a later surprise.** *Related party* is really a
property of the bank's relationship with a supplier, not of one application — the same vendor
should answer the same way everywhere. Held per-deliverable, ten applications supplied by the
same company can be answered ten different ways and nothing will catch the inconsistency.
Accepted because it matches how the bank actually holds it, and because the alternative is a
supplier entity Selara does not have: `developer` is free text today, so modelling vendors is
its own piece of work and should be its own decision rather than smuggled in here.

**With this and Q2 settled, `RptiDetail` has no field left without a derivation source** — the
condition the whole change depends on.

### Q4 — migration is deferred, not designed (2026-09-18)

**Decided: do not solve migration as part of this work.** This is a major overhaul of how
report rows relate to the entities behind them; migration tooling will be provided if and when
there is demand for it. Selara is pre-1.0 and local-first, and the population of workspaces
carrying pre-change data is currently small and known.

Recorded so the consequences are a decision rather than an oversight.

**Four surfaces would have needed handling, and only the first is routine:**

1. **Live IndexedDB stores.** A solved pattern — `v18` already reads every `rptiDetail` inside
   `upgrade` and rewrites it (`db.ts:208-220`), and the upgrade transaction spans all stores,
   so reading `lkptiDetails` and writing `deliverables` atomically is available.
2. **Version snapshots.** `Version.data.lkptiDetails` holds a full copy of the old shape, and
   **no migration has ever touched the `versions` store** — it is only created and cleared.
   There is a precedent for the alternative: `Version.data.decisions` is marked
   `@deprecated — never read`, kept purely so old snapshots still parse, with
   `buildRestoredWorkspace` deciding what restore actually does (ADR-0011).
3. **Exported `.xlsx` files.** Cannot be migrated — they are on someone's disk. `parseWorkbook`
   is generic, so an old export re-imported later lands the eight values on `lkptiDetails`
   where nothing reads them.
4. **Shared files.** Surface (3) through a different door.

**The approach that was designed and not taken**, recorded because it stays cheap to add later:
one *lift* function applied at every boundary where old-shaped data enters — restore, `.xlsx`
import, shared file — moving the eight values onto their deliverable. It keeps snapshots
immutable, is testable in isolation, and is the only approach that reaches files already
distributed. Detecting old-shaped data has no clean signal today (`"this lkptiDetail has a
platform field"` is presence-based, not version-based), which argues for stamping a schema
version onto snapshots and exports whenever this is picked up.

**The specific failure mode of deferring, which is not "nothing happens":**

IndexedDB is schemaless within a store, so dropping the fields from the TypeScript type does
**not** delete them — existing `lkptiDetails` keep carrying `platform`, `systemOwner` and the
rest as orphaned properties that nothing reads. They survive a normal save, and today they even
survive a regenerate, because `generateLkptiDetails` spreads the existing row
(`{ ...existing, ...cascadedFields }`, `lkpti.ts:112`).

That changes the moment `LkptiDetail` becomes a pure projection. Generation would then build
fresh row objects from the `Deliverable` rather than spreading what was there, so **the first
press of Generate destroys the orphaned values permanently.** Until that press they are
recoverable, and a migration tool written later can still find them.

**Therefore, when this is implemented:** either the eight fields must be lifted before
generation is allowed to replace rows, or the release must be explicit that pressing Generate
on a pre-change workspace discards the imported return. The second is defensible for a pre-1.0
local-first tool; it is not defensible silently.

### Q5 and Q6 — the Data Manager tabs stay exactly as they are (2026-09-18)

**Decided: no change to either tab in this work.** Both keep their rows, stay editable, and
keep their Generate buttons. No read-only mode, no removal.

That answers Q5 (read-only?) with *no*, and defers Q6 (empty-until-generated, or merely
obviously-derived?) entirely.

**What this means for the change, stated plainly: the observation that opened this document is
not addressed by it.** Importing will still fill both tabs. What remains is the data-model
half — the eight attributes and `remarks` move to the entities they describe (Q1-Q3) — so the
tabs show rows whose remaining fields are genuinely derived, with fewer own-fields to edit.

That is worth doing on its own terms. It removes the conflation diagnosed above, and it is the
prerequisite for ever making the rows projections: nothing can be generated-on-demand while
`LkptiDetail` is the only home for eight fields. But it is a step toward the goal rather than
the goal, and the doc's title should be read as the destination, not this instalment.

**Also considered and set aside: deleting both tabs entirely**, generating the reports from the
Reports menu instead. `RptiReportView` and `LkptiReportView` already exist and already export,
so they would generate rather than receive rows. It would delete two tabs, roughly thirty
column definitions, two stores, two `excel.ts` sheets, two `diff.ts` blocks, and the whole
merge-preserving apparatus — which only exists because rows are stored. It would also give the
report year a natural home as a report parameter, resolving much of #40.

Two consequences stopped it being a small change, and both should be carried forward:

1. **Filed rows that do not match the workspace have nowhere to live.** The unresolved upgrade
   from #38 is stored as an `RptiDetail` with a deliberately unresolvable `targetId`. It cannot
   be generated, by definition — no segment, no initiative link, nothing to derive it from.
   Removing stored rows means either dropping that filed row or creating a deliverable for it,
   which FR-019 explicitly refuses.
2. **A past filing would be reproducible only under today's rules.** Generation is
   deterministic, so regenerating from a restored snapshot is safe — until a rule changes. One
   changed this session: `hasPriorLiveSegment` moved from `endDate` to `startDate`, flipping
   rows between `new` and `upgrade`. A pre-change snapshot would now regenerate differently from
   what was filed. For a History meant to be an audit trail, "what we filed" quietly becoming
   "what we would file today" is a real weakness.

   The resolution that fits rather than fights #40: **generated during preparation, snapshotted
   at filing.** Nothing stored while working, and the produced rows frozen into the filing
   record as what was actually submitted — which also makes the filing record the natural owner
   of the report year.

## Carried into the Spec Kit spec

No questions remain open. Three things were decided *not* to be solved here and must be
carried forward, since each is load-bearing for the destination:

1. **Migration (Q4)** — deferred. When the projection step is taken, the eight fields must be
   lifted before generation is allowed to replace rows, or the release must say plainly that
   pressing Generate on a pre-change workspace discards the imported return.
2. **Filed rows with no derivation source** — the unresolved upgrade from #38 cannot be
   generated, so a projection model needs a home for it.
3. **Snapshot at filing time** — generation rules change, so a past filing must be frozen
   rather than re-derived. This is where the report year naturally lives, and it is the piece
   that must land with [#40](https://github.com/nofanto/Selara/issues/40).

## Rejected

- **Empty the tabs now, accept the loss.** Silently discards eight fields of a filed return.
  Not a trade-off worth naming twice.
- **Teach generation to read the import.** Making generation consult the last imported file
  would preserve the values without a data-model change, but it makes a pure function depend on
  import history, and the values would be unrecoverable once the file is gone.
- **Do this before #40.** See above.

## Related

- [#40](https://github.com/nofanto/Selara/issues/40) — the report year is never stored
- `requirement-specs/rpti-auto-generation.md` — the generation rule and its merge-preserving behaviour
- `requirement-specs/lkpti-integration.md` §3 — why LKPTI generation is not year-scoped
- `requirement-specs/it-planning-flow.md` — step 2/3 of the cycle this document reconciles
- ADR-0010 — merge-preserving LKPTI generation, which exists precisely because these fields cannot be regenerated
