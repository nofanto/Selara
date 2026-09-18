# Quickstart: Validating Report Year and Field Ownership

Prerequisites: `npm install`, and a dev server for the browser levels (`npm run dev`).

## Level 1 — Round-trip fidelity (the feature's reason to exist)

The acceptance test. It already runs today and already fails.

```sh
npx vitest run src/lib/sampleReturns.test.ts
```

Import `docs/sample-data/sample-lkpti-2026.xlsx` and `sample-rpti-2027.xlsx`, discard the
imported report rows, regenerate from the workspace, and compare field by field.

**Before this feature** — 8 LKPTI fields lost on 13/13 rows, plus `developer` on 9/13; RPTI loses
`remarks` on 11/13 and `ppjtiRelatedParty` on 10/13.
**Target** — zero differences for reproducible rows.

Compare *exported values*, not raw detail fields: `resolveCost` falls back to the initiative's
figures, so `capexAmount`/`opexAmount` appear lost while the filed number is intact.

## Level 2 — The as-at year changes who is in the LKPTI

```sh
npx vitest run src/lib/lkpti.test.ts
```

Build an application live 2021-06 → 2025-06 with a Retired segment after it.

- Generated as at **31 December 2024** → present.
- Generated as at **31 December 2026** → **absent**.

Today it is present in both, which is the defect R2 records.

## Level 3 — Generation never guesses a year

```sh
npx vitest run src/lib/rpti.test.ts
npx playwright test e2e/report-year.spec.ts --project=chromium
```

Confirm no code path passes the current calendar year as a fallback, and that the Reports menu
asks before producing anything.

## Level 4 — The lift protects a pre-change workspace

Load a workspace whose attributes sit on stored LKPTI rows. Confirm the values appear on the
deliverables, that running the lift twice changes nothing, that a value already on a deliverable
is not overwritten, and that the orphaned properties remain on the stored rows.

Then press Generate and confirm nothing is lost — the failure mode this guards against.

## Level 5 — Nothing that is filed changes

```sh
npm run test:unit && npx playwright test
```

Export both returns from the same workspace before and after. Files must be identical, with the
single intended exception of a decommissioned application leaving the LKPTI.

## Level 6 — Version history sees the new fields

Change a deliverable's `platform` and an initiative's `rptiRemarks`, save a version, and run the
difference report. Both must be listed. An unlisted field changes silently — [#42](https://github.com/nofanto/Selara/issues/42).

## Level 7 — Scale

With 300 applications, generating a return for a stated year stays within the responsiveness of
generating one today. The Deliverables tab now carries 17 columns; confirm no content clips
(the measurement harness from #44).
