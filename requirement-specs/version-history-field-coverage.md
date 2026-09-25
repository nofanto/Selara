# Version history field coverage (issue #42)

## Decision

`computeDiff` compares thirteen entity types. Each gets a `Record<keyof Entity, FieldPolicy>` map. A policy is `diffed` or an exclusion with a written reason. TypeScript rejects a newly added field without a policy and a stale policy after a field is removed. A Vitest case driven by each map changes every `diffed` field in turn on a populated fixture and requires a modified entry. This closes the gap between a field's declared policy and its hand-written change message.

The alternative of diffing all fields by default was rejected. Generic messages would replace the more useful hand-written descriptions (for example, a move naming the former and new asset), while the exhaustive map and its test already fail loudly when coverage is missing.

## Current-main audit, before implementation

The lists below come from the current `src/types.ts` interfaces and `src/lib/diff.ts` callbacks, not the issue's 16 September table. `id` and the layout fields in the last column are the only approved exclusions. All other fields are to be diffed.

| Entity | Before: diffed fields | Added change messages | After: diffed count | Excluded |
|---|---|---|---:|---|
| Asset | name, categoryId, maturity | externalId | 4 | id |
| Programme | name, color | — | 2 | id |
| Strategy | name, color | — | 2 | id |
| Initiative | name, assetId, startDate, endDate, capex, opex, description | programmeId, strategyId, isPlaceholder, status, ragStatus, progress, owner, ownerId, resourceIds | 16 | id |
| Dependency | sourceId, targetId, type | sourceType, targetType | 5 | id, midXOffset |
| Milestone | name, date, type | assetId | 4 | id |
| Deliverable | name, type, assetId, platform, database, dcProvider, drcProvider, backupStrategy, systemOwner, ownership, developer, ppjtiRelatedParty | description, categoryCode, dcCity, dcCountry, drCity, drCountry | 18 | id |
| DeliverableSegment | title, startDate, endDate, status, deliverableId, initiativeId, capexAmount, opexAmount, rptiRemarks | — | 9 | id, row, rowSpan |
| DeliverableStatus | name, color, isLiveStatus, isPreLaunchStatus | — | 4 | id |
| Resource | name, role | — | 2 | id |
| AssetCategory | name, order | categoryCode, dcCity, dcCountry, drCity, drCountry | 7 | id |
| RptiDetail | categoryCode, developmentType, developer, ppjtiRelatedParty, plannedImplementationQuarter, remarks | initiativeId, targetType, targetId, dcCity, dcCountry, drCity, drCountry, deliverableSegmentId | 14 | id |
| LkptiDetail | categoryCode, developer, platform, database, backupStrategy, systemOwner, goLiveDate, ownership | targetId, targetName, dcCity, dcCountry, drCity, drCountry, dcProvider, drcProvider, functionDescription | 17 | id |

The after field set in each row is the union of its before fields and added change messages. Across the thirteen entities, coverage rises from 63 to 104 fields, with 13 identity exclusions and three layout exclusions.

`Decision` is not passed to `compareEntities`: ADR-0011 keeps the live decision log outside restorable workspace state. The difference report shows decisions in the comparison span separately. `TimelineSettings` is also not an entity passed to `compareEntities`; this issue's policy scope is the thirteen entity callbacks above.

## Exclusions

- Each entity's `id`: immutable identity used to match baseline and current records. Changing it is represented as a removal and an addition.
- `Dependency.midXOffset`: manual timeline arrow layout; dragging it should not fill history.
- `DeliverableSegment.row`: automatic timeline row placement; dragging or rearranging should not fill history.
- `DeliverableSegment.rowSpan`: manual timeline bar height; dragging it should not fill history.

No other fields are excluded. In particular, `Initiative.isPlaceholder`, `programmeId`, and `strategyId` are audited, as are all regulatory fields.

## Verification record

- Red first: `npx vitest run src/lib/diffFieldPolicy.test.ts` exited 1 with **41 failed, 63 passed**. Each missing field had its own failing case; for example, `deliverables.categoryCode: expected [] to have a length of 1 but got +0`. Full output: `/tmp/selara-42-red.log`.
- Message guard falsification: temporarily removed the `Asset.externalId` change line. The test exited 1 with exactly `assets.externalId` failing and 103 passing (`/tmp/selara-42-message-falsify.log`). Restored the file from its saved byte-for-byte copy; `cmp` exited 0, and `git diff -- src/lib/diff.ts` shows the intended added line.
- Type guard falsification: temporarily added `Asset.auditProbe?: string` without a policy. `npx tsc --noEmit` exited 2 with a new `TS1360` at `src/lib/diffFieldPolicy.ts:15` in addition to the known Excel error (`/tmp/selara-42-type-falsify.log`). Restored `src/types.ts` from its byte-for-byte copy; `cmp` exited 0 and `git diff -- src/types.ts` is empty.
- Focused diff tests: exit 0, 134 passed. Full unit suite: exit 0, 27 files and 569 tests passed.
- `npx eslint .`: exit 0, 0 errors and 8 existing warnings. `npx tsc --noEmit`: exit 2 with exactly one known error, `src/lib/excel.ts(295,11)` `TS2322` for empty `timelineSettings`.
- Full Playwright suite: exit 0, 687 passed, 4 skipped, 2 passed on retry (3.1 minutes). The two retried cases both passed in a follow-up run with `--retries=0` (exit 0). Logs: `/tmp/selara-42-e2e.log`, `/tmp/selara-42-e2e-recheck.log`.
- Playwright used `/tmp/selara-42-playwright.config.mjs`, importing the repository config and overriding `baseURL`, storage-state origin, web-server URL and command to port 3100, with `reuseExistingServer: false`. `/tmp/selara-42-e2e-server.log` records the working directory `/Users/nofantoibrahim/orca/workspaces/Selara/042-version-history-fields` and `VITE v6.4.2` serving `http://127.0.0.1:3100/`. Port 3000 was not used.
