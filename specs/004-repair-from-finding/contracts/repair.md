# Contracts: Unresolved-Row Repair

Numbered, so tests and tasks can cite them. Every function here is pure, has no DOM, and lives in
`src/lib/`. Its tests are Vitest (Constitution III).

## Shared rules (extracted, so they cannot drift)

1. **`hasLiveHistoryBefore(deliverableId, date, segments, statuses)`** (`rpti.ts`) is true when any
   live segment on the Deliverable starts before `date`. `projectRptiReturn`'s development-type test,
   the importer's synthetic-prior test and option A's prior-phase test all call it. For every
   workspace in the existing projection tests, generation output is unchanged.
2. **`continuousPriorLivePhase(deliverableId, filedYear, statusId, id)`** (`rpti.ts`) returns
   `{ id, deliverableId, startDate: '<filedYear-1>-01-01', endDate: openEndedDate(filedYear), status }`
   with no `initiativeId`.
3. **`filedAttributesFor(deliverable, assets, categories)`** (`rpti.ts`) returns exactly the category
   code, developer classification, related party and DC/DR that `projectRptiReturn` would file for
   that Deliverable. The projection itself calls it.

## Recognising a repairable row

4. **`isRepairableUnresolvedRow(row)`** is true iff `row.targetId` starts with
   `UNRESOLVED_IMPORT_TARGET_PREFIX` and `row.deliverableSegmentId` is absent.
5. **`repairOptions(row)`** returns `['existing', 'create']` for an application category and
   `['existing']` for an infrastructure category (`51`-`54`, `99`).
6. **Data Health.** Only the `rpti-target:<rowId>` issue of a row satisfying (4) carries
   `action: { kind: 'repair-unresolved-rpti-row', rowId }`. A `missing-target` for a deleted
   Deliverable carries none.

## The draft (FR-004 to FR-006)

7. **`unresolvedRowRepairDraft(row, state)`**:
   - **name** — the initiative's name without a trailing ` — Q[1-4] YYYY`, source `initiative-name`. If
     the name has no suffix, the whole name, flagged `check: true`.
   - **filed year** — from the suffix; if there is none, from `initiative.startDate`
     (`initiative-start`).
   - **quarter, category, related party, DC/DR, Keterangan** — from the row (`stored-row`).
   - **CapEx/OpEx** — from the initiative (`initiative-budget`).
   - **developer** — `inhouse` for `inhouse`. For `PPJTI`: an empty provider name, `needs-input`.
8. The draft never reads today's date. Tested with a frozen clock set to another year: the output is
   identical.

## Candidates (FR-015, FR-016)

9. **`rankRepairCandidates(row, name, state)`**:
   - The pool is only the row's kind (application or infrastructure).
   - Tiers are `same-name` (normalised equal), then `similar` (at least half the words shared, same
     category), then `other`.
   - Order within a tier is deterministic: name, then id.
10. The result carries no selection. The API has no "best match" field, so there is nothing for a
    caller to auto-pick.
11. **Scale.** 300 applications rank within the existing scale-test budget (`scale.test.ts`).

## Differences (FR-012)

12. **`attributeDifferences(row, chosen, state)`** compares `filedAttributesFor(chosen)` with the row.
    - A Deliverable whose named provider files as `PPJTI`, against a filed `PPJTI`, is no difference.
    - An inherited category equal to the filed code is no difference.
    - An empty list means the form asks nothing.

## Applying (FR-007 to FR-014)

13. **`applyUnresolvedRowRepair(state, request)`** returns `{ ok: true, state }` or `{ ok: false,
    reason }` and never mutates its input. Tests pass it frozen state.
14. **Preconditions, re-checked on apply.** The row exists and satisfies (4). The initiative exists and
    has **no** live implementation. For A, the chosen Deliverable exists and is of the row's kind. For
    a `PPJTI` row, whenever the repair writes a developer (B always; A when a developer difference is set to "update"), the provider name is non-empty and not `PPJTI` (FR-006). Every choice in (12)
    is answered. Any failure returns `ok: false` and changes nothing.
15. **B** writes exactly the fields in data-model "option B". **A** writes exactly the fields in
    data-model "option A". Nothing else in the workspace changes: a deep-equality check over all other
    collections.
16. **The stored row is byte-identical** before and after (Q12).
17. **Post-condition.** `reconcileRptiReturn` on the result has no finding for the row, and
    `projectRptiReturn(result, Y)` contains exactly one row for the initiative. It is typed `upgrade`,
    in the filed quarter, and states the confirmed values. For B unedited, and for A with every
    difference set to "update", it **equals the filed row in every filed column**.
18. **Idempotence.** Applying the same request twice returns `ok: false` the second time: the
    initiative now has a live implementation (14). It never duplicates.

## Importer (FR-017)

19. Both synthetic prior phases in `deriveWorkspaceFromRptiImport` are built by (2). Every other import
    output is unchanged, which the existing importer and sample tests pin. The regenerated 2027 RPTI on
    the samples still has 13 rows in the same development-type order, with zero round-trip losses.

## Existing workspaces (FR-018, FR-018a)

20. **`priorPhaseGaps(state)`** returns an entry only for a segment with **all** of:
    - an id starting `rpti-import-seg-prior-`;
    - dates exactly `<Y>-01-01` to `<Y>-12-31`;
    - the importer's live status id;
    - no `initiativeId`;
    - an **application** Deliverable.

    Each entry lists the years in `Y+1 … Y+6` whose 31 December the Deliverable is not live on. It is
    omitted when that list is empty.
21. Changing any one of those properties removes the entry, which covers the preparer's edit. Tested
    once per property.
22. **Data Health** raises one **warning**, never an error, per entry:
    `rpti-import-prior-phase-gap:<segmentId>`, with
    `action: { kind: 'extend-import-prior-phase', segmentId }`. It does not block export.
23. **`extendImportPriorPhase(state, segmentId)`** sets that segment's `endDate` to
    `openEndedDate(Y+1)` and changes nothing else. After it runs, (20) returns no entry for the segment,
    and the LKPTI as at 31 December of each listed year includes the Deliverable.
