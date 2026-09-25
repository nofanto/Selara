# Quickstart: validating the unresolved-row repair

Commands exit with the suite's real status. Never pipe a suite to `tail`: redirect to a file and check
`$?`. Playwright's config hard-codes port 3000 with `reuseExistingServer`, so confirm nothing else is
serving 3000 first, or use a temporary config on another port.

## Level 1 — pure rules (Vitest)

```bash
npx vitest run src/lib/unresolvedRowRepair.test.ts src/lib/rpti.test.ts src/lib/rptiImport.test.ts \
  src/lib/dataHealth.test.ts > /tmp/selara-004-unit.log 2>&1; echo exit=$?
```

Expect contracts 1-23 green. Each new test was seen red first, and its falsification (reverting the
implementation) is logged in `tasks.md`.

## Level 2 — the published samples (SC-001, SC-004)

```bash
npx vitest run src/lib/sampleReturns.test.ts src/lib/roundTrip.test.ts > /tmp/selara-004-samples.log 2>&1; echo exit=$?
```

Expect:
- **SC-001.** After the B repair of "Legacy Teller Application" with no edits, the 2027 projection
  contains a row equal to the filed row in every column, and the reconciliation has zero findings.
- **Contract 19.** The import alone still regenerates 13 rows, development types in the same order,
  zero round-trip losses.
- **SC-004.** LKPTI counts as at 31 December 2026-2032, for import-only and after repair, are printed
  by the test, pinned, and copied into Q22 with an explanation of each difference from 13, 16, 16, 16,
  16, 16, 3.

## Level 3 — the workflow (Playwright)

```bash
npx playwright test e2e/unresolved-row-repair.spec.ts > /tmp/selara-004-e2e.log 2>&1; echo exit=$?
```

1. Onboard both samples. You land on the Data Health review. The Legacy Teller finding shows
   **Repair**.
2. Choose "The bank runs it, but the inventory doesn't list it". Every filed value is pre-filled, CapEx
   and OpEx are labelled as the initiative's current budget, and the quarter shows Q3 2027 as
   read-only.
3. Confirm. The finding disappears. The RPTI report for 2027 generates, and the gate is clear.
4. **Undo** restores the workspace to before the repair in one step, and the finding returns.
5. **Option A** (a fixture with a renamed inventory entry): the suggested candidate is listed and not
   selected. A differing category shows filed against current. "Update" and "keep" each file as chosen.
6. **Gate entry point.** From the RPTI pre-export gate, the same **Repair** opens the same dialog.
7. **FR-018a** (a fixture in the old one-year shape): a non-blocking warning names the missing years.
   **Extend** clears it, and the export is not blocked before or after.

## Level 4 — full suites before any commit

```bash
npm run test:unit > /tmp/selara-004-unit-full.log 2>&1; echo unit=$?
npx playwright test > /tmp/selara-004-e2e-full.log 2>&1; echo e2e=$?
npx eslint . > /tmp/selara-004-eslint.log 2>&1; echo eslint=$?
npx tsc --noEmit > /tmp/selara-004-tsc.log 2>&1; grep -c "error TS" /tmp/selara-004-tsc.log   # baseline: 1 (excel.ts:295)
```

## Manual check (product owner)

Import `docs/sample-data/sample-lkpti-2026.xlsx` and `sample-rpti-2027.xlsx`, then repair Legacy
Teller from Data Health. **SC-006:** time it. From opening the finding to the finding disappearing
should take under one minute for B. For A, on a renamed-entry workspace with one field difference,
it should take under two minutes. On the Visualiser, "Legacy Teller Application" sits under its own asset, with
a live bar from 2026 to 2032 and the Q3 2027 implementation bar linked to its initiative.
