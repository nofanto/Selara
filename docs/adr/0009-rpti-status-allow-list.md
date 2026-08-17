# ADR-0009: RPTI status classification becomes an allow-list, not a deny-list

## Status

Accepted

## Context and Problem Statement

`requirement-specs/rpti-auto-generation.md` rule 3 says a `DeliverableSegment` only qualifies for RPTI generation if its status is `planned`, `funded`, or `in-production` — an allow-list. The shipped implementation (`classifySegmentKind` in `src/lib/rpti.ts`) didn't actually implement that: it excluded only statuses matching a `sunset|out-of-support|retired|decommission` name pattern, and classified *everything else* as `'new'` by default. `Deliverable Statuses` is a fully user-editable Data Manager tab, so any custom status a workspace adds later — `"Cancelled"`, `"On Hold"`, `"Blocked"`, `"UAT"` — silently generated a false RPTI row, misclassified as `'new'` development. Found during the review requested in issue #3.

Separately, the same review confirmed a previously-documented-but-unimplemented gap: `isPlaceholder` Initiatives were never actually excluded from generation, despite being marked "decided" in the spec.

## Decision Drivers

- A false row in a bank's OJK regulatory filing is a correctness risk, not a cosmetic one — per `CLAUDE.md`'s own philosophy, this is exactly the class of bug that gets process rigor.
- The fix should be safe by default for status values Selara has never seen before, not just for the specific names shipped in demo data.
- Should reuse the existing `isLiveStatus`/`isLiveStatusId` explicit-flag-with-pattern-fallback shape rather than inventing a new mechanism — `isLiveStatus` already solves exactly this "explicit signal, safe legacy fallback" problem for the live/in-production case.
- Existing workspaces (including the shipped demo data) must keep generating the same rows they do today without a data migration.

## Considered Options

- Add an opt-out flag (`excludeFromRpti?: boolean`) to `DeliverableStatus`, keeping today's permissive default.
- Keep the current deny-list regex, documented as intentional.
- Flip to an allow-list: a new `isPreLaunchStatus?: boolean` flag, defaulting unflagged/unrecognized statuses to excluded.

## Decision Outcome

Chosen option: the allow-list, with a legacy-compatible fallback. Concretely:

- `DeliverableStatus.isPreLaunchStatus?: boolean` — parallel to the existing `isLiveStatus?: boolean`.
- `isPreLaunchStatusId()` mirrors `isLiveStatusId()`'s exact shape: an explicit flag always wins; only when **no** status in the workspace has the flag explicitly set does it fall back to recognizing the default `appstatus-planned`/`appstatus-funded` ids or a name containing "planned"/"funded".
- `classifySegmentKind()` becomes: `isLiveStatusId` → `'live'`; else `isPreLaunchStatusId` → `'new'`; else `'excluded'`. The old deny-list regex is deleted — under an allow-list, "not live and not planned/funded" is the correct default for `'excluded'`, not a case needing its own pattern.
- Data Manager's Deliverable Statuses tab gains **Live?** and **Pre-Launch?** boolean columns — neither flag had any UI before this change, which was itself part of why the fallback pattern-matching was doing more work than intended.
- `generateRptiDetails`'s existence-check `Set` (originally just guarding against dangling `initiativeId` references) now also excludes `isPlaceholder: true` Initiatives, closing the second review finding.

### Pros and Cons of the Options

#### Opt-out flag, keep permissive default

- Good, because it's the smallest change and preserves today's behavior for anyone not using the flag.
- Bad, because the failure mode stays silent-by-default: a brand-new custom status still generates a row unless someone remembers to flag it, which is the exact bug being fixed.

#### Keep the deny-list, document as intentional

- Bad, because it doesn't fix the actual problem — a bank filing RPTI could still get a false "new development" row for e.g. a "Cancelled" status.

#### Allow-list with legacy fallback

- Good, because unrecognized statuses are excluded by default — safe for a regulatory report, matches the spec's original rule 3 intent.
- Good, because the fallback (id/name pattern, active only when no status in the workspace has explicitly opted in) means the shipped demo data and any existing workspace need no migration.
- Bad, because it's a slightly larger change (`types.ts`, `rpti.ts`, `demoData.ts`, `DataManager.tsx`) than the opt-out flag.

## Consequences

- `DeliverableStatus` gains `isPreLaunchStatus?: boolean` — additive, no `DB_VERSION` bump.
- `demoData.ts`'s `demoDeliverableStatuses` sets `isPreLaunchStatus: true` on `appstatus-planned` and `appstatus-funded`, mirroring `appstatus-in-production`'s existing `isLiveStatus: true`.
- `diff.ts` version-history reporting should surface the new flag the same way it already does for `isLiveStatus`.
- Covered by new cases in `src/lib/rpti.test.ts`: an unrecognized custom status generates no row; a placeholder-linked segment generates no row; an explicit `isPreLaunchStatus` flag is trusted over the id/name fallback.
