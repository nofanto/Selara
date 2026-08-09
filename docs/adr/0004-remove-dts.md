# ADR-0004: Remove the DTS (NZ Digital Target State) workspace feature

## Status

Accepted

## Context and Problem Statement

DTS was one of Selara's workspace templates, modelled on New Zealand government's GCDO (Government Chief Digital Officer) target reference architecture: a fixed set of 6 layers and 20 pre-built assets, plus DTS-specific fields threaded through most of the app (`Initiative.dtsPhase`, `Asset.dtsAdoptionStatus`, a dedicated `dtsPhases` IndexedDB store, DTS-only colour/group-by modes, a DTS Alignment report, a DTS Summary Excel sheet, and DTS-specific Mobile Card View options).

Unlike GEANZ (a general-purpose NZ government application taxonomy usable by any agency) or Viewer/Blank (fully generic), DTS is specific to one government's target architecture and doesn't generalize to Selara's broader user base. It also touched a disproportionate amount of code relative to its usage — DTS-specific branches existed in `App.tsx`, `Timeline.tsx`, `InitiativePanel.tsx`, `ReportsView.tsx`, `DataManager.tsx`, `MobileCardView.tsx`, `excel.ts`, and `workspaceTemplates.ts` — for a template narrower in applicability than any other.

Docs also referenced a "Mixed" template (DTS layers + GEANZ catalogue) as if it existed. It was never built — a pre-existing E2E test explicitly asserted its picker card was absent — so it was a documentation error, not a feature to preserve.

## Decision Drivers

- Remove a workspace-specific feature that doesn't serve Selara's general user base, without destabilizing the app for existing users who may already have DTS-tagged data.
- This app's IndexedDB migrations (`src/lib/db.ts`) have never called `deleteObjectStore` in their history — every migration from v1 to v15 is additive. Introducing a first-ever store deletion for this removal would be a new category of risk for no functional benefit.
- `Timeline.tsx`'s swimlane body is rendered by mutually exclusive `groupBy` branches with no catch-all `else` (confirmed by reading the render logic directly). Deleting the `'dts-phase'` branch without a corresponding safeguard would silently blank the timeline for any user or saved `Version` snapshot with `groupBy: 'dts-phase'` still persisted from before this removal.

## Considered Options

**Store handling:**
- Call `deleteObjectStore('dtsPhases')` in a new migration (bump `DB_VERSION`).
- Leave the `dtsPhases` store's schema/creation code and remove only the application code that reads or writes it.

**Stale `groupBy: 'dts-phase'` handling:**
- Do nothing — accept that pre-removal users hit a blank timeline until they manually reset their grouping mode.
- Add a settings-sanitization step that coerces the stale value back to a supported default wherever `TimelineSettings` enters live state.

## Decision Outcome

Chosen options: "leave the store in place" and "add a settings-sanitization step."

- **`dtsPhases` store:** left in the schema; only the application code that reads/writes it was deleted (the `ITMapDB` entry, `getAppData`/`saveAppDataImpl` wiring, and the store-creation/seeding logic that used to run for new databases). No `deleteObjectStore` call was added, and `DB_VERSION` was not bumped. Any database that already reached schema v13+ keeps its (now-inert) `dtsPhases` store forever — harmless, and consistent with this app's additive-only migration history. See [`docs/database-diagram.md`](../database-diagram.md) for the full note.
- **Stale `groupBy` fallback:** `sanitizeTimelineSettings()` was added to `src/App.tsx`, coercing `groupBy: 'dts-phase'` → `'asset'` (and clearing `colorBy`/`mobileBucketMode` if they were `'dts-phase'`) at every point `TimelineSettings` enters live state: the initial DB-load path (normal and share-import), `handleViewerImport`, `handleUpdate` (which also covers `handleRestoreVersion`), and template selection. Covered by `e2e/timeline-settings-sanitization.spec.ts`, which verifies both the normal-load path and a restored `Version` snapshot with a stale `groupBy` value no longer blank the timeline.

### Pros and Cons of the Options

#### Delete the `dtsPhases` store via a new migration

- Good, because it fully cleans up orphaned data for every user.
- Bad, because it would be the first `deleteObjectStore` call in this app's history, a new and unnecessary category of migration risk for a handful of small, inert records.

#### Leave the store, remove only the application code

- Good, because it carries zero migration risk and needs no `DB_VERSION` bump.
- Bad, because affected users keep an empty or small orphaned `dtsPhases` store indefinitely — acceptable, since it consumes negligible storage and is never read again.

#### Do nothing about stale `groupBy: 'dts-phase'`

- Good, because it's the simplest option.
- Bad, because it silently blanks the timeline for any affected user or Version snapshot, with no error message or recovery path short of a support request.

#### Add `sanitizeTimelineSettings()`

- Good, because it degrades gracefully to the same default (`'asset'` grouping) the app already uses for new workspaces, with no user-visible error.
- Bad, because it's a small amount of permanent compatibility code — acceptable, since the alternative is a data-loss-adjacent bug for real users.

## Consequences

- `DB_VERSION` remains unchanged at 15. No new migration was added.
- `src/lib/dtsCatalogue.ts` and `src/lib/dtsDemoData.ts` were deleted; `GEANZ_TO_DTS_MAP` was removed from `src/lib/geanzCatalogue.ts` (the rest of the GEANZ catalogue is untouched).
- `Initiative.dtsPhase`, `Asset.dtsAdoptionStatus`, `DtsAdoptionStatus`, `DtsPhase`, `DtsPhaseRecord`, and the `'dts-phase'` literal in `TimelineSettings.groupBy`/`colorBy`/`mobileBucketMode` were removed from `src/types.ts`. `TimelineSettings.clusterName` was kept — confirmed generic and used by the timeline header regardless of workspace type.
- The template picker now offers 3 templates (GEANZ, Viewer, Blank) instead of 4; the DTS Alignment report, DTS Summary Excel sheet, DTS colour/group-by modes, and DTS Mobile Card View options were all removed.
- 12 dedicated `e2e/dts-*.spec.ts` files were deleted; 8 other spec files that incidentally exercised DTS as a demo-data vehicle were edited to use GEANZ instead, or had their DTS-only test cases removed where no generic equivalent existed.
- Documentation was updated throughout `docs/user-guide/`, `docs/user-stories/`, and `docs/database-diagram.md` to remove DTS and the never-built "Mixed" template from user-facing descriptions.
