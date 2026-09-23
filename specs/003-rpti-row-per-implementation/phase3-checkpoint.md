# Phase 3 checkpoint — implementation-grain RPTI rows

**Base:** `052-multi-implementation-detection` at `41a07ca`, which already contains `7a75726` above merged main (`5100509`). No new branch, commit or push was made. Scope is T001–T016; Phases 4–7 remain open.

## What changed

- `DeliverableSegment` can hold optional filed CapEx, OpEx and remarks for the later Phase 4 move. The Phase 3 projection still reads the initiative's cost and remarks, so existing filed values remain as they were.
- RPTI membership now uses the segment's start year. Each live segment produces a row; a pre-launch run-up is joined to its go-live, while a still-planned implementation retains the prior single-row behavior. Every row uses its segment's application and a segment-derived stable ID. Same-date rows sort by segment ID.
- The obsolete warning that a second implementation would be dropped is gone. Reports no longer passes *projected* rows to Data Health's stored-row reconciliation; it reconciles stored evidence separately, which prevents two valid generated rows from falsely blocking export under the old identity rule.
- Existing projection tests that asserted overlap or initiative-wide target selection were updated to the decided start-year and segment-target behavior.

## Baseline measurement and red evidence

Measured again on `41a07ca` before implementation. The focused red log is `/tmp/selara-003-phase3-red3.log`: Q2 and Q4 2027 go-lives produced **one Q4 row**; one Q2 2027 go-live continuing through 2031 produced **one row in each of 2027–2031**; a 2020 live segment on a 2027 retirement produced **one 2027 upgrade row stating Q1**. These confirm all three R1 symptoms on the current base.

Representative verbatim red output:

```text
T007 AssertionError: expected [ [ 'q4', 'Q4' ] ] to deeply equal [ [ 'q2', 'Q2' ], [ 'q4', 'Q4' ] ]
T008 AssertionError: expected [ 1, 1, 1, 1, 1 ] to deeply equal [ 1, +0, +0, +0, +0 ]
T008a AssertionError: expected [ { …(15) } ] to deeply equal []
T010 AssertionError: expected [ 'deliv-1' ] to deeply equal [ 'deliv-1', 'deliv-2' ]
T010a AssertionError: expected [ { …(15) } ] to have a length of 2 but got 1
T012 Locator: getByTestId('rpti-detail-table').locator('tbody tr'); Expected: 2; Received: 1
T015 AssertionError: expected [ 'z-segment', 'a-segment' ] to deeply equal [ 'a-segment', 'z-segment' ]
T016 AssertionError: expected { …(9) } to be undefined
```

| Test | Observed red | Observed green |
|---|---|---|
| T007 two go-lives | Q2 missing; only Q4 returned | Q2 and Q4 rows, distinct IDs |
| T008 one go-live once | `[1,1,1,1,1]` across 2027–2031 | `[1,0,0,0,0]` |
| T008a other-year absence | prior-year live phase still filed in 2027 | no 2027 row; stored prior-year row has no reconciliation finding |
| R1 retirement case | 2027 upgrade row stated Q1 from 2020 | no 2027 row |
| T009 run-up and later go-live | only the later go-live survived | run-up plus first go-live is one new Q2 row; second go-live is an upgrade Q4 row |
| T010 two applications | only declared application returned | one row for each application |
| T010a application values | only one row existed | both rows carry the same available application-level filing values |
| T011 ordinary workspace | Passed on baseline; changing the projection's category to `99` temporarily made the guard fail on both rows (`/tmp/selara-003-t011-mutation-red.log`) | representative two-initiative fixture preserves every filed value, row count and order; internal IDs are deliberately excluded per the T011 clarification |
| T012 browser and workbook | Reports showed one row, expected two (`/tmp/selara-003-phase3-e2e-red.log`) | Reports and exported workbook both show Q2 and Q4 (`/tmp/selara-003-phase3-e2e-green.log`) |
| T015 same-date order | temporarily removing the segment-ID tie break returned `z-segment` before `a-segment` (`/tmp/selara-003-t015-mutation-red.log`) | both input orders return the same `a`, `z` rows |
| T016 stale warning | Data Health still said only Q4 would be filed (`/tmp/selara-003-warning-red.log`) | no dropped-row warning |

The first T012 green attempt exposed an old-grain reconciliation of *generated* rows inside Data Health. Its report view had two correct rows, but export was blocked by a false identity conflict. Reports now uses Data Health for source diagnostics and reconciles stored rows separately; the subsequent focused browser test passed.

## Verification and checkpoint limits

- Final Vitest: **24 files, 402 tests passed**, exit 0 (`/tmp/selara-003-phase3-unit-final.log`).
- Final Playwright: **671 passed, 2 flaky (passed on retry), 4 skipped**, exit 0 (`/tmp/selara-003-phase3-playwright-full.log`). The two retries were timeouts in the Data Health report filter and Decision link integrity tests; neither touches RPTI generation.
- Changed-file ESLint and `git diff --check`: exit 0. `npx tsc --noEmit` reports only the known pre-existing `src/lib/excel.ts:289` `TimelineSettings` error.
- T010a's listed `platform` cannot be compared across RPTI rows: Format 3.1 has no platform column. The test verifies all application-level fields that RPTI actually files and that the platform remains on the Deliverable.
- Phase 4 will move costs and remarks to implementations. Phase 5 will extend import and round-trip fidelity. Phase 6 will move stored-row reconciliation identity and remove the remaining single-target diagnostics. The report-year behavior change and user-facing documentation are scheduled in Phase 7.
