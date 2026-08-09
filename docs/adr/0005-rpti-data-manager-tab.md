# ADR-0005: Make RPTI rows first-class via a Data Manager tab

## Status

Accepted

## Context and Problem Statement

RPTI (`RptiDetail`) rows were introduced in [ADR-0003](0003-rpti-report-and-application-type.md) as a report-scoped feature: the only way to create, edit, or delete a row was a dedicated form panel inside **Reports → RPTI Report** (`RptiReportView.tsx`). Every other entity in Selara (Initiatives, Assets, Applications, Dependencies, etc.) is instead edited inline as a spreadsheet-style table in **Data Manager**, via the shared `EditableTable` component. This made RPTI rows a second-class citizen: not discoverable alongside the rest of the portfolio data, and requiring a bespoke form UI to maintain.

Promoting RPTI to a Data Manager tab surfaced two problems the original form's UI had absorbed for free:

1. `RptiDetail.location` is a nested object (`{ dataCenter: {city, country}, disasterRecoveryCenter: {city, country} }`). `EditableTable`'s `Column<T>` type only supports flat `keyof T` keys — every other entity's fields in Data Manager are flat, and the component has no concept of a nested-object column.
2. The form had two interactive "smart" behaviors with no `EditableTable` equivalent: auto-suggesting the planned quarter from a linked `ApplicationSegment`'s lifecycle status (with a "Use this" accept button), and a warning banner when an initiative's row-level budget overrides summed above its own total.
3. `RptiDetail.targetId` can point to either an `Application` or an `Asset`, disambiguated by a separate `targetType` field. The form set both together per a single "Target Type" radio-like selector; a generic table would need two independently-edited select columns kept in sync by the user, which is a real inconsistency risk — `EditableTable` has no cross-field validation anywhere in the app.

## Decision Drivers

- RPTI data should be manageable the same way as every other entity — inline, in Data Manager — not through a separate, bespoke form.
- Should not introduce nested-object columns into `EditableTable`, a generic component used by every other tab; special-casing it for one entity's shape would complicate a component nothing else needs complicated.
- Should not let `targetType`/`targetId` fall out of sync through ordinary inline editing, since nothing else in the app validates cross-field consistency this way.

## Considered Options

**`location` field:**
- Add nested-object column support to `EditableTable`.
- Flatten `RptiDetail.location` into four top-level fields.
- Leave `location` editable only via Excel import, omitted from the Data Manager tab.

**Smart form behaviors (quarter auto-suggestion, budget-allocation warning):**
- Re-implement both as inline hints in the new Data Manager tab.
- Drop both from interactive editing; keep the Reports screen as a read-only summary + export.
- Remove the Reports form-based screen but re-implement the smart behaviors as generic `EditableTable` features.

**`targetType` consistency:**
- Add a `targetType` select column alongside `targetId`, trusting the user to keep them in sync.
- Derive `targetType` automatically from `targetId` after every edit, and drop it as a directly-edited column.

## Decision Outcome

- **`location`:** flattened into `dcCity`, `dcCountry`, `drCity`, `drCountry` (schema v16 migration, see [`database-diagram.md`](../database-diagram.md)). `EditableTable` is unchanged — every other entity's fields already work this way, and a one-off nested-column feature for a single consumer wasn't worth the added complexity to a shared component.
- **Smart behaviors:** dropped from interactive editing entirely. **Reports → RPTI Report** (`RptiReportView.tsx`) is now a read-only summary of the same `rptiDetails` data plus the Excel export button — Data Manager is the only place rows are created, edited, or deleted. The quarter auto-suggestion logic (`suggestApplicationQuarter` in `src/lib/rpti.ts`) is kept as an **export-time fallback only**: if a row's `plannedImplementationQuarter` is empty, both the read-only report table and the Format 3.1 Excel export fill it in from a matching lifecycle segment, with no interactive "accept" step. `checkBudgetAllocation` (the budget-overage warning) had no equivalent use once the form was gone and was deleted.
- **`targetType`:** removed as a directly-edited column. Data Manager's RPTI tab wraps its `onUpdate` handler so that after every edit, each row's `targetType` is recomputed from whichever list — `applications` or `assets` — its current `targetId` is actually found in. `targetId` is the single source of truth; `targetType` is derived, not user-set, which removes the mismatched-pair failure mode entirely while keeping the field on the type (still read by `resolveCost`, the `rptiCascadeOn*` helpers, and the Format 3.1 export).

### Pros and Cons of the Options

#### Add nested-object column support to `EditableTable`

- Good, because it would keep `RptiDetail.location`'s original shape.
- Bad, because it's speculative generality added to a shared component for exactly one consumer, with no other entity in the app needing it.

#### Flatten `location` into four top-level fields

- Good, because it needs zero changes to `EditableTable` and matches how every other entity's fields already work.
- Bad, because it's a schema change requiring a migration — acceptable, since the migration is a small, mechanical read-rewrite of a leaf field on one store.

#### Drop the smart form behaviors; Reports becomes read-only

- Good, because it avoids building `EditableTable`-specific inline-hint UI that nothing else in the app has a precedent for.
- Good, because the quarter auto-suggestion's actual value (not making the user hunt down a segment's start date) is preserved via the export-time fallback — only the interactive "accept" step is gone.
- Bad, because the budget-overage warning is gone with no replacement; acceptable since it was a soft, non-blocking hint and CapEx/OpEx overrides remain fully visible and editable in the RPTI tab regardless.

#### Derive `targetType` from `targetId` automatically

- Good, because it removes an entire class of mismatched-pair bugs that a manually-edited second select column would risk, with no cross-field validation available anywhere else in the app to catch it.
- Good, because it needs no new UI — the existing single `targetId` select, now listing both Applications and Assets with disambiguating labels, is sufficient.
- Bad, because `targetType` becomes implicit rather than an explicit user choice — acceptable, since it was already fully determined by which list the target came from.

## Consequences

- `DB_VERSION` bumped to 16; existing `rptiDetails` records with a `location` value are migrated in place (see Migration Notes in `database-diagram.md`).
- `src/components/DataManager.tsx` gains an `RPTI` tab (`rptiColumns`, a combined `applications` + `assets` target-options list, and the `targetType`-deriving `onUpdate` wrapper), following the exact same pattern as every other tab in that file.
- `src/components/RptiReportView.tsx` loses its create/edit form entirely (no more `onAdd`/`onUpdate`/`onDelete` props); `src/components/ReportsView.tsx` and `src/App.tsx` drop the corresponding wiring (`handleAddRptiDetail`/`handleUpdateRptiDetail`/`handleDeleteRptiDetail`).
- `checkBudgetAllocation` was deleted from `src/lib/rpti.ts`; `suggestApplicationQuarter`, `resolveCost`, and `deriveQuarterFromDate` were kept, now used only by the read-only report table and the Format 3.1 export.
- Existing cascade-delete behavior (`rptiCascadeOnInitiativeDelete`/`OnApplicationDelete`/`OnAssetDelete` in `src/lib/rpti.ts`, wired from `DataManager.tsx`'s Initiative/Application/Asset delete handlers) is unchanged.
- Covered by `e2e/rpti-data-manager.spec.ts` (tab presence, inline add/edit/delete, `targetType` re-derivation verified via cascade-delete, the flattened location fields) and a trimmed `e2e/rpti-report.spec.ts` (read-only empty/populated state, Format 3.1 export — its previous form-driven create/edit/auto-suggestion tests were removed or moved).
