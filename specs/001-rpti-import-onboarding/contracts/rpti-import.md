# Contract: RPTI Import Module

**Feature**: [spec.md](../spec.md) · **Data model**: [data-model.md](../data-model.md)

Selara exposes no network API. Its contracts are module boundaries, and the one that matters here
is `src/lib/rptiImport.ts` — because that is where the domain rules live and where they can be
tested without a browser.

Mirrors `src/lib/lkptiImport.ts` deliberately, so the two importers read the same way.

## Public surface

```ts
// A single usable row, parsed from a Format 3.1 return.
export interface RptiImportRow { /* see data-model.md § Parsed row */ }

// A row that could not be used, and why. Never discarded silently.
export interface RptiImportSkippedRow { rowNumber: number; reason: string; }

export interface ParseRptiImportResult {
  rows: RptiImportRow[];
  skipped: RptiImportSkippedRow[];
}

// Pure. The whole parsing contract, testable with no File and no DOM.
export function parseRptiImportWorkbook(workbook: XLSX.WorkBook): ParseRptiImportResult;

// Thin File -> workbook wrapper. Holds no logic.
export function parseRptiImportFile(file: File): Promise<ParseRptiImportResult>;

// A plan row whose upgrade target was not found in the inventory.
export interface UnresolvedRptiReference { rowNumber: number; name: string; categoryCode: string; }

export interface DerivedRptiWorkspace {
  assetCategories: AssetCategory[];
  assets: Asset[];
  deliverables: Deliverable[];
  deliverableSegments: DeliverableSegment[];
  deliverableStatuses: DeliverableStatus[];
  initiatives: Initiative[];
  rptiDetails: RptiDetail[];
  unresolved: UnresolvedRptiReference[];
}

// Pure. Rows + the year the user supplied + the inventory already imported
// (empty when no LKPTI was given) -> workspace entities.
export function deriveWorkspaceFromRptiImport(
  rows: RptiImportRow[],
  reportYear: number,
  existing: { deliverables: Deliverable[]; assets: Asset[]; assetCategories: AssetCategory[] },
): DerivedRptiWorkspace;
```

## Contract guarantees

These are the assertions the unit tests exist to hold:

1. **A non-Format-3.1 workbook is rejected**, with a message naming the expected layout. Header
   mismatch is a rejection of the file, not a per-row skip.
2. **Every input row appears in exactly one of `rows` or `skipped`.** No row vanishes. This is the
   countable form of FR-021 and SC-004.
3. **`parseRptiImportWorkbook` is total**: it throws only for a workbook that is not the format.
   Bad values inside a well-formed sheet produce skipped rows, never exceptions.
4. **Category code alone decides `Deliverable.type`.** `01`-`12`/`49` → `application`;
   `51`-`54`/`99` → `infrastructure`; anything else → skipped. Never inferred from the name.
5. **Every derived `DeliverableSegment` carries an `initiativeId`**, or a regenerated return would
   silently omit the imported work.
6. **`upgrade` rows produce a preceding live segment; `new` rows do not.**
7. **An `upgrade` row matching an existing Deliverable on name *and* category attaches to it** and
   adds no new Deliverable.
8. **An `upgrade` *application* row matching zero or more than one existing Deliverable creates
   nothing** and yields an `UnresolvedRptiReference`. It is never guessed at and never silently
   created as new.
8a. **An `upgrade` *infrastructure* row (`51`-`54`, `99`) matching nothing is created**, with its
   prior-live segment, and yields no `UnresolvedRptiReference`. LKPTI carries no infrastructure, so
   such a row can never match and holding it back stranded it permanently. More than one match is
   still ambiguous and still unresolved.
9. **Derivation is pure**: same inputs, same outputs; no clock, no randomness, no IndexedDB. Ids are
   derived from row position, not `Date.now()`, so results are reproducible and testable.
10. **Nothing is written on rejection.** Persistence happens only after derivation returns.

## Supporting contract — quarter to period

```ts
// In src/lib/rpti.ts, alongside the existing deriveQuarterFromDate().
export function periodForQuarter(quarter: RptiQuarter, year: number): { startDate: string; endDate: string };
```

Inverse of `deriveQuarterFromDate`. Required because the return states a quarter with no year.
Must round-trip: `deriveQuarterFromDate(periodForQuarter(q, y).startDate) === q`.

## UI contract change

`ReportsView` gains an optional prop to open on a given report:

```ts
initialReport?: ReportSlug;
```

Needed because `selectedReport` is local state with no way in (`ReportsView.tsx:97`), and FR-022
requires landing on `data-health` after onboarding. Optional, so every existing call site is
unaffected.
