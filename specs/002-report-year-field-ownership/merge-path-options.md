# RPTI Projection and Reconciliation Options

**Status:** Design options only — no decision recorded here  
**Branch/commit inspected:** `002-report-year-field-ownership` at `f93b1f6`  
**Defect:** The Reports projection path supplies stored `rptiDetails` as
`existingDetails` to `generateRptiDetails`. `mergeWithExisting` then carries every
unmatched stored row into the selected-year return. A workspace containing only a
2027 plan can therefore emit a 2027 line in a return generated for 2026.

## The concepts the current merge conflates

No: **"a filed row that cannot be derived" is not the same concept as "a row
belonging to a different year."** They are two independent questions:

1. **Selected-year membership:** does the source plan say that this line belongs in
   the requested year?
2. **Reproducibility:** can the current source model reconstruct the filed line at
   all, with the values the filing supplied?

A valid 2027 line is absent from a 2026 projection because it fails the first test;
that says nothing bad about its reproducibility. An asset-target or dangling-target
row may fail the second test regardless of which year was requested. The axes can
also overlap: a row from another year can later become unreproducible after its
source is deleted.

`mergeWithExisting` reduces all of those states to one observation — "there is no
fresh row with this `(initiativeId, targetId)` key" — and responds by carrying the
stored row. That is the root of the defect. The pre-export gate then sees the carried
row and happens to diagnose some unreproducible cases, but it cannot distinguish
why the row was unmatched.

There is an information limit that every option must respect: `RptiDetail` has no
report year. Its quarter is not a year; imported IDs are not a year contract; and
`deliverableSegmentId` is absent in exactly the unresolved cases that matter most.
Consequently, no algorithm can precisely sort every existing stored row into 2026,
2027, or 2028 without either persisted provenance or a user decision. Inferring a
year from an ID, a quarter, or a possibly missing segment is not a safe fix.

## Requirements used to assess the options

- **FR-020 (revised 2026-09-19):** an imported row that cannot be regenerated
  survives, stays visible, and is named before a filing is produced. The earlier
  year-attribution clause was removed because the model has no safe provenance.
- **FR-024:** an unreproducible filed row is named before a return is produced; it
  is never silently absent.
- **FR-025:** following the named repair is sufficient to make regeneration faithful;
  the preparer does not re-key values already supplied by the return.
- **Contract 2:** the selected-year output is a reproducible projection of
  `(workspace, reportYear)`, not a union with historical report rows.
- **Contract 3:** projection from Reports does not mutate the workspace.

The phrase "workspace" in contract 2 is technically broad enough to include stored
`rptiDetails`, but that literal reading would make the contract useless against this
defect. The meaningful interpretation is that filing membership is derived from the
workspace's canonical planning entities for the requested year; stored filing rows
may be evidence for reconciliation, not extra members of the projection.

## Option 1 — Pure selected-year projection plus a separate compatibility gate

### Mechanism

Call `generateRptiDetails` without `existingDetails`; the displayed/exported rows are
therefore only the selected-year projection. Separately, run a reconciliation step
for the gate. It must return findings, not rows. A pragmatic version would combine:

- selected-year source diagnostics, such as a qualifying initiative with no
  resolvable target;
- structural checks over stored rows, such as asset targets and dangling initiative
  or target references; and
- optionally, an all-years derivability check: a stored row is not called
  unreproducible merely because it is absent in the selected year if the canonical
  plan can reproduce its semantic key in some other year.

The gate can show the stored row as evidence while never inserting it into the
return.

### Effect on the requirements and contracts

- **FR-020:** preserves the row in the read-only stored-row view and names it through
  the global compatibility gate. The gate deliberately does not display a year that
  the stored evidence does not contain.
- **FR-024:** satisfies the known structural cases if the gate explicitly scans
  stored rows rather than only projected rows. It cannot prove that every unmatched
  legacy row belongs to the selected year, so the policy must be explicit: report
  source-model incompatibility globally, not selected-year absence.
- **FR-025:** can satisfy it when each structural finding names a source-side repair
  and reconciliation stops reporting the finding after that repair. A generic
  "stored row did not match" error is insufficient.
- **Contract 2:** restored; stored rows do not become projection members.
- **Contract 3:** preserved; both projection and reconciliation are read-only.

### Build cost

Medium. The one-line call-site correction is small, but the real work is a pure
reconciler with explicit reason codes and gate wiring. Existing `computeDataHealth`
checks can be reused, but it should not be made to pretend that a list of projected
rows is the stored filing evidence.

### How this fails later

Someone may again compute the gate only over projected rows. Unsupported stored
rows then disappear from both output and diagnostics. A subtler failure is treating
every stored/projected non-match as an error, which makes a valid 2027 row block a
2026 return.

### Test that catches it

A table-driven pure test should cover four states: same-year reproducible,
other-year reproducible, unsupported asset target, and dangling target. Assert that
only the first state enters the selected-year projection; only the latter two create
reconciliation errors; and the stored inputs are unchanged. An E2E test should
generate 2026 from a workspace containing a valid 2027 plan plus an unsupported
stored row and prove the 2027 line is absent while the unsupported-row repair is
visible before export.

## Option 2 — Keep merge preservation, but carry only rows with explicit matching-year provenance

### Mechanism

Retain a preservation merge, but make carry-forward conditional on authoritative
year metadata. That metadata could be `reportYear` on the stored row or a reference
to a year-bearing import/filing record. For a 2026 projection, only stored rows
explicitly attributed to 2026 may be considered for carry-forward; rows with another
year are excluded. Rows with unknown year are quarantined for resolution rather than
guessed into a filing.

The tempting metadata-free version — infer the year from `deliverableSegmentId`, the
generated ID suffix, or initiative segments — is a **trap**. Imported and unresolved
rows do not reliably carry those anchors, and a quarter has no year. It would make
the cases needing FR-020 least classifiable.

### Effect on the requirements and contracts

- **FR-020:** can satisfy survival, visibility, and year attribution after provenance
  is added. Existing unknown-year rows require migration or a visible one-time
  classification flow.
- **FR-024:** same-year unreproducible rows remain visible to the gate. Unknown-year
  rows must themselves be a blocking diagnostic, or they can still disappear.
- **FR-025:** can be satisfied if repair converts the carried row into a faithful
  derivation without re-keying filed values. It also needs a rule for retiring or
  retaining the preserved copy once reproduced.
- **Contract 2:** not restored under the projection interpretation above: the return
  is still a union of derivation and stored filing artifacts. It is deterministic,
  but membership is not purely derived. Choosing this option therefore requires an
  explicit contract change, not a claim that contract 2 remains satisfied.
- **Contract 3:** preserved if merge is pure and generation never writes the result.

### Build cost

Medium to high. It needs schema/type changes, import changes, legacy migration or
classification UX, and tests for duplicate/matching provenance. It preserves more
of the existing merge code but pays for a new ownership concept.

### How this fails later

A caller can omit or mis-assign the year and either leak a foreign-year row or lose
an unreproducible same-year row. Another failure is allowing `unknown` to behave as
"current selected year," recreating the defect behind a different branch.

### Test that catches it

Persist one unreproducible row for 2027, one for 2028, and one unknown-year legacy
row. Generate 2026, 2027, and 2028 independently. Assert no row crosses years, the
matching-year row reaches the gate, the unknown row produces an explicit provenance
error, and no generation changes any stored record.

## Option 3 — Make projection and preservation different APIs and different types

### Mechanism

Create a projection-only entry point such as:

```ts
type ProjectRptiInput = Omit<GenerateRptiDetailsInput, 'existingDetails'>;

projectRptiReturn(input: ProjectRptiInput, reportYear: number): ProjectedRptiRow[];
reconcileRptiReturn(input: ReconcileRptiInput): RptiReconciliationFinding[];
```

If legacy merge-preserving behavior still has a legitimate caller, expose it under
a deliberately different name such as `regenerateStoredRptiRows`; do not leave an
optional `existingDetails` switch on the projection API. Reports accepts only
`ProjectedRptiRow[]`, while the gate accepts projection plus stored evidence and
returns findings. A stronger variant brands stored and projected rows so neither can
be passed to the other's role accidentally.

This is the earlier `projectRptiReturn` proposal. The present defect is exactly the
compile-time mistake that proposal was intended to prevent.

### Effect on the requirements and contracts

- **FR-020/FR-024/FR-025:** the type split does not decide reconciliation semantics.
  Paired with option 1's compatibility gate, it has the same strengths and the same
  no-year limit; paired with option 4 or 5 provenance, it can enforce the stronger
  semantics. Presented alone, it does not satisfy these requirements.
- **Contract 2:** strongly enforced at the API boundary; a Reports caller cannot
  supply `existingDetails` even by convenience.
- **Contract 3:** easier to enforce and test because projection accepts plain inputs
  and returns fresh rows; it still needs a no-write integration test.

### Build cost

Low to medium for the API split and call-site migration; medium if row branding and
typed reconciliation results are added. It can be layered onto any chosen data
model.

### How this fails later

The main regression becomes an explicit bypass: a developer calls the legacy merge
API from Reports or weakens the types back to the shared input. The other failure is
mistaking the guardrail for the whole solution and dropping unreproducible-row
diagnostics after the projection becomes pure.

### Test that catches it

Add a compile-time assertion (`@ts-expect-error` or a dedicated type test) that
`projectRptiReturn({ ...workspace, existingDetails })` is rejected. Pair it with the
same E2E gate test as option 1, because TypeScript can prevent the year leak but
cannot prove FR-024 is surfaced to the preparer.

**Trap warning:** an `Omit` wrapper that internally calls the old generator while
spreading an object that still contains `existingDetails` is only cosmetic. The
projection implementation itself must have no preservation input.

## Option 4 — Persist year-bearing filing/import snapshots and reconcile against the selected snapshot

### Mechanism

Separate canonical planning state from filing evidence. Store an immutable RPTI
filing/import record containing its report year and original rows. Projection reads
only canonical entities and the requested year. The gate compares that projection
with the filing snapshot for the same year, reports unmatched or value-divergent
rows, and directs repairs to canonical entities. Stored historical rows no longer
double as both projection cache and reconciliation evidence.

The product needs rules for multiple filings/imports for one year: select a baseline,
keep versions, or mark one current. Those are product decisions, not implementation
details.

### Effect on the requirements and contracts

- **FR-020:** fully expressible: the original row survives in a snapshot that owns an
  explicit year and remains visible even when canonical derivation fails.
- **FR-024:** precise: only evidence for the selected filing year is compared, so a
  2027 row neither leaks into nor blocks a 2026 return.
- **FR-025:** precise if reconciliation compares all filed fields to canonical output
  and each reason points to the canonical owner. Repair changes the projection until
  it matches; it never asks the preparer to retype the snapshot.
- **Contract 2:** strongly restored; projection is independent of snapshot evidence.
- **Contract 3:** strongly preserved if snapshots and workspace remain unchanged
  during projection/reconciliation.

### Build cost

High. It introduces a persisted concept/store, import ownership rules, migration for
existing `rptiDetails`, snapshot selection/version UX, diff/reconciliation logic,
documentation, an ADR, and database-diagram changes. It also aligns with the design
note that a filing-time snapshot is eventually needed, so some of the cost may be
work the product must pay later anyway.

### How this fails later

Generation might overwrite the baseline snapshot, making a failed round trip appear
successful. The gate might compare against the latest snapshot regardless of year,
reintroducing cross-year confusion at the reconciliation layer. Ambiguous "current"
selection among two snapshots for one year is another failure mode.

### Test that catches it

Import snapshots for 2027 and 2028, keep only canonical 2027 segments, and generate
2026/2027/2028. Assert each projection contains only its year's canonical work, each
gate compares only the same-year snapshot, an unresolved 2027 row blocks only 2027,
repair clears the finding without altering snapshot bytes, and repeated generation
does not write any store.

## Option 5 — Persist a year-bearing reconciliation ledger only for rows that import cannot map

### Mechanism

Keep Reports projection pure, but introduce a smaller persisted concept than a full
filing snapshot: an `UnreconciledRptiImportRow` (or import issue) containing the import
year, original row values, reason, and resolution linkage. Import must place every
row in exactly one of two states: represented by canonical source entities, or held
in this ledger. The gate checks open ledger entries for the selected year plus
current source-model diagnostics. Once repaired, the row becomes derivable and the
ledger entry is marked resolved or linked to the canonical identity; the original
evidence remains available for audit.

### Effect on the requirements and contracts

- **FR-020:** satisfied for the important unreproducible case: the row survives with
  its year and values even though it is not a projection member.
- **FR-024:** selected-year open entries are explicit blockers, while other-year
  entries stay visible without contaminating the current return.
- **FR-025:** satisfiable if resolution is driven by a semantic comparison against the
  original values, and the repair instructions name canonical entities. The ledger
  must not be cleared merely because a target ID now exists.
- **Contract 2:** restored; ledger entries are gate evidence, never output rows.
- **Contract 3:** preserved if projection and reconciliation do not mutate the ledger.
  Resolution should be an explicit import-repair action, not a side effect of Generate.

### Build cost

Medium to high. It adds a store/type and importer invariant, but avoids snapshotting
every successfully mapped filing row and avoids baseline-selection UX. Its cost is
concentrated in import and repair lifecycle logic.

### How this fails later

The importer may learn a new skip/unmapped path without creating a ledger entry,
silently losing a filed row. A second failure is auto-resolving an entry on a weak
key match while filed values still differ, violating FR-025.

### Test that catches it

Use a property/table-driven import test asserting that each source row produces
either a canonical derivation witness or one ledger entry, never neither and never
both. E2E, import an unresolved 2027 row and a valid 2028 row, generate 2026/2027/
2028, prove only 2027 is blocked, repair the source, and assert the generated 2027
row matches every original supplied value before the blocker clears.

## Comparison

| Option | Year leakage stopped | Unreproducible row surfaced | Exact year attribution | Contract 2 | Relative cost |
|---|---|---|---|---|---|
| 1. Pure projection + compatibility gate | Yes | Yes for explicitly modelled/global incompatibilities | No, not for anchorless legacy rows | Restored | Medium |
| 2. Year-scoped preservation merge | Yes, only with authoritative provenance | Yes | Yes after migration/classification | Requires revision | Medium–high |
| 3. Type-level split | Yes at the Reports API boundary | Only when paired with a gate | Depends on paired model | Enforced | Low–medium plus paired model |
| 4. Filing/import snapshots | Yes | Yes, selected-year exact | Yes | Restored | High |
| 5. Unreconciled-row ledger | Yes | Yes for import failures | Yes for ledger rows | Restored | Medium–high |

## Decision points for the product owner

No winner is selected here. The choice turns on three product decisions:

1. Must the product reconcile against an entire prior filing, or only guarantee that
   import failures never disappear? Option 4 answers the former; option 5 the latter.
2. May a problem from an unknown/other year block the selected year's export? Option
   1 needs an explicit global-gate policy; options 4 and 5 can scope precisely.
3. Is preserving stored rows inside the generated return still a product requirement?
   If yes, contract 2 must be revised and option 2 needs real provenance. If no, the
   merge belongs outside the projection path.

Whatever reconciliation model is chosen, the type-level split in option 3 is a
compatible guardrail. It is not, by itself, a replacement for the FR-020/FR-024/
FR-025 design decision.
