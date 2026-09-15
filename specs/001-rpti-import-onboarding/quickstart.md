# Quickstart: Validating OJK-First Onboarding and RPTI Import

**Feature**: [spec.md](./spec.md) · **Contract**: [contracts/rpti-import.md](./contracts/rpti-import.md)

How to prove this feature works end to end. Validation scenarios and commands only — implementation
belongs in `tasks.md`.

## Prerequisites

```bash
npm ci
```

No backend, no accounts, no fixtures to provision. Selara is local-first; a workspace lives in the
browser's IndexedDB.

## Producing test returns

The importer inverts Selara's own exports, so the app generates its own fixtures:

1. Start a workspace with demo data
2. **Reports → RPTI Report → export** for a Format 3.1 file
3. **Reports → LKPTI Report → export** for a Format 3.2.6 file

These round-trip through the importer, which is the cheapest correctness check available: what the
app writes, it must be able to read back.

For scale testing, seed a synthetic workspace of several hundred deliverables directly into
IndexedDB and export from that — the approach used to measure issue #36.

## Level 1 — domain rules (fast, no browser)

```bash
npx vitest run src/lib/rptiImport.test.ts
npx vitest run src/lib/rpti.test.ts        # includes periodForQuarter round-trip
```

Should cover, per the contract's guarantees:

- a workbook that is not Format 3.1 is rejected, naming the expected layout
- every input row lands in exactly one of `rows` or `skipped` — no row vanishes
- each of the 18 category codes maps to the correct `Deliverable.type`, asserted per code rather than per range
- `upgrade` produces a preceding live segment; `new` does not
- an `upgrade` matching an existing deliverable on name **and** category attaches to it
- an `upgrade` matching zero or several yields an unresolved reference and creates nothing
- every derived segment carries an `initiativeId`
- derivation is pure — same inputs, same outputs, no clock

## Level 2 — the onboarding workflow

```bash
npx playwright test e2e/rpti-import-onboarding.spec.ts
```

Walks the user story:

1. Fresh workspace → starting screen offers exactly two ways to begin
2. LKPTI slot is required, RPTI slot optional
3. Each upload asks its own year; supply **2026** for LKPTI and **2027** for RPTI
4. Import runs LKPTI before RPTI
5. Workspace holds applications *and* infrastructure
6. An upgrade row matching the inventory attached rather than duplicated
7. An upgrade row matching nothing is reported, not invented
8. The screen presented at the end is the data-health review
9. LKPTI alone also completes successfully

## Level 3 — regression

```bash
npm run test:unit
npx playwright test
```

**Nine existing e2e specs touch onboarding** (see [research.md](./research.md) §6). Several use the
picker only as *setup* to reach a workspace, so they will fail for reasons unrelated to what they
assert.

Read each one and decide what it was protecting before changing its selectors. Repointing
mechanically is how a rename-heavy change silently drops a guarantee — which is exactly what
happened during the History-tab work, and was caught only because a missing marker was noticed by
hand.

## Level 4 — scale

Import returns of ~300 rows each and confirm:

- onboarding completes in under 60 seconds (SC-003)
- every screen remains usable afterwards
- **no new n² work**: count `document.querySelectorAll('table option').length` on the RPTI and LKPTI
  tabs and compare against the figures in issue #36 (78,566 and 141,470 at 300 rows). This feature
  must not increase them. Fixing them is *not* in scope; deepening them is a regression.

## Definition of done

- [ ] All four levels pass
- [ ] `npx eslint .` reports 0 errors
- [ ] `npx tsc --noEmit` reports no more than the 1 known baseline error — CI ratchets on this
- [ ] Every capability available before the change is still reachable (SC-006): demo data, the
      technology-area catalogue, and opening a colleague's shared file
