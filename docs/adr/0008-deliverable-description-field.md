# ADR-0008: Elevate LKPTI's function description to `Deliverable.description`

## Status

Accepted

## Context and Problem Statement

ADR-0007 added `LkptiDetail.functionDescription` as one of nine LKPTI-only fields with no auto-fill source — always manual. That grouping treated it the same as genuinely report-specific technical facts like `platform`, `database`, and `backupStrategy`. On review, it isn't: `functionDescription` — "what does this application do" — is a fact about the Deliverable itself, true regardless of which regulatory report is being filed, not something that only matters for LKPTI's Format 3.2.6 submission.

## Decision Drivers

- Should reuse the existing cascading-defaults pattern (`Deliverable` → report row, already used for `categoryCode`/`developer`/`dcCity`/`drCity`) rather than leaving a field manual-only once a sensible source exists.
- Should not conflate "report-specific technical detail" (platform, database, backup strategy — genuinely LKPTI-only concerns with no meaning outside that report) with "core entity metadata" (what does this application do — useful in tooltips, an application catalog, search, or any future report).
- Applies equally to non-`'application'` Deliverable types — a document or procedure can be described too — so it belongs on `Deliverable` itself, not gated behind the LKPTI feature.

## Considered Options

- Leave `functionDescription` manual-only on `LkptiDetail` (status quo from ADR-0007).
- Add `Deliverable.description` and cascade `LkptiDetail.functionDescription` from it, mirroring `categoryCode`/`dcCity`/etc.

## Decision Outcome

Chosen option: add `Deliverable.description?: string`. Concretely:

- `generateLkptiDetails` (`src/lib/lkpti.ts`) sets `functionDescription: deliverable.description` at generation time — same wipe-and-rebuild, override-wins-after-generation semantics as every other cascaded LKPTI field.
- No `AssetCategory`-level fallback: description is specific to one Deliverable, not a property shared by everything in an architectural category — same reasoning ADR-0006 used for `developer`.
- Data Manager's Applications (Deliverable) tab gains a **Description** column, editable independent of LKPTI.

### Pros and Cons of the Options

#### Leave `functionDescription` manual-only

- Good, because no data-model change.
- Bad, because it requires re-entering, in the LKPTI tab, a description of the application that Selara has nowhere else — the exact duplicate-entry problem the cascading-defaults pattern exists to avoid.

#### Add `Deliverable.description`, cascade into `functionDescription`

- Good, because it reuses the established cascade pattern as-is — no new resolution logic, just one more field copied at generation time.
- Good, because the field becomes available wherever `Deliverable` is used, not just LKPTI — useful for any future report, list view, or tooltip.
- Bad, because it's one more optional field on every `Deliverable`, though a generic text description is meaningful for every `DeliverableType` (unlike LKPTI's other nine fields, which are meaningless outside `'application'`).

## Consequences

- `Deliverable` gains `description?: string` (`src/types.ts`) — additive, no `DB_VERSION` bump needed (existing `deliverables` store, no schema/index change).
- `generateLkptiDetails` cascades `functionDescription` from it; covered by a new case in `src/lib/lkpti.test.ts`.
- `DataManager.tsx`'s Applications (Deliverable) tab gains a Description column; covered by `e2e/deliverables.spec.ts`.
- `docs/database-diagram.md` and the LKPTI/Applications user-guide pages updated to reflect the new field and cascade.
