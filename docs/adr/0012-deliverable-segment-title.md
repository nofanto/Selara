# ADR-0012: Give DeliverableSegment an optional title, over deriving every label

## Status

Accepted

## Context and Problem Statement

Every segment bar on the timeline was labelled with its **deliverable's** name, so a deliverable
carrying several lifecycle segments rendered as several copies of itself. In the demo workspace that
is 11 of 17 deliverables, up to four bars deep — Azure AD B2C drew three identical bars where it
actually runs In Production, then Sunset, then Out of Support. Filed as [issue #41](https://github.com/nofanto/Selara/issues/41),
found while reviewing the RPTI import in #38, where a correctly matched single deliverable looked
like three.

A derived label shipped first: initiative name when the segment has one, else the lifecycle status,
with the deliverable name prefixed only where its asset holds more than one deliverable. That fixed
the indistinguishability. It cannot express a phase whose name is neither of those — two rollout
waves under one initiative, or a phase a user simply wants to call something.

The question this ADR settles is whether that is worth a schema change.

## Decision Drivers

- `DeliverableSegment` is persisted in IndexedDB, so a new field is a schema change with export,
  import and version-diff surface, not a component-local concern.
- Nothing in either OJK return has a segment-title column, so there is **no regulatory surface**:
  this cannot change what is filed. That is what keeps it out of `CLAUDE.md`'s heavier process.
- A derived label is always right about *something* but can never be overridden; a stored one is
  whatever was typed, including nothing.
- Existing workspaces have no such field and must keep rendering unchanged.

## Considered Options

- **A — Derived label only.** Initiative name, else status. No schema change.
- **B — `DeliverableSegment.title?: string`, with A as its fallback.**
- **C — Reuse `Initiative.name` as the only label**, and require users who want distinct phase names
  to split the work into more initiatives.

## Decision Outcome

Chosen option: **B**, because the derived label answers "which bar is this" but not "what is this
phase called", and only the second survives a user having a name in mind. A is retained in full as
the fallback, so the field is genuinely optional rather than something every segment must now carry.

Lands as:

- `DeliverableSegment.title?: string` (`src/types.ts`).
- `Timeline.tsx` label resolution: `seg.title?.trim() || initiativeName || statusLabel`, with the
  deliverable name prefixed only when its asset holds more than one deliverable. The status pill is
  suppressed exactly when the resolved label already *is* the status, so a bar never prints it twice.
- A `Title` input on `DeliverableSegmentPanel`, placed above `Status`.
- The bar's tooltip carries title, deliverable, initiative, status and dates regardless of what fitted.

### Pros and Cons of the Options

#### A — Derived label only

- Good, because it needs no schema change, no migration, and no ADR.
- Good, because it is never stale: rename the initiative or the status and every bar follows.
- Bad, because two phases of one initiative remain indistinguishable — the case that motivated the
  field.
- Bad, because the user cannot correct a label they find unhelpful.

#### B — Optional title, derived fallback (chosen)

- Good, because it expresses what neither the initiative nor the status can.
- Good, because absent a title, behaviour is exactly A — no existing workspace changes.
- Bad, because a typed title goes stale when the work it describes changes, and nothing prompts a
  re-edit.
- Bad, because it is a schema change: it widens export/import and version-diff surface.

#### C — Reuse `Initiative.name`, split work into more initiatives

- Good, because it adds no field at all.
- Bad, because it forces the data model to carry a labelling concern — inventing initiatives to get
  captions distorts RPTI generation, which derives a report row per `(initiative, deliverable)` pair.
  A labelling need would silently become extra filed rows.

## Consequences

- `excel.ts` needs **no change**: `flatten()`/`json_to_sheet` carry whatever fields a record has, so
  the workspace export/import round-trip picks the field up automatically. Asserted in
  `src/lib/segmentTitle.test.ts` against `buildWorkbook`/`parseWorkbook`.
- `diff.ts` **does** need one line, contrary to the first draft of this ADR. `compareEntities` is
  generic over *entities*, not over their *fields*: it takes a `getChanges` callback that names each
  compared field explicitly, so a new field is silently invisible to version history until listed.
  Caught by writing the test that was supposed to confirm the opposite. Any future field on any
  entity has the same trap, which is worth knowing beyond this ADR.
- No migration and no IndexedDB version bump: the field is optional, and absent it the label
  resolution is identical to what shipped with the derived label.
- `docs/database-diagram.md` updated.
- **Deliberately not done:** neither importer sets a title. The derived label already reads correctly
  for imported segments ("In Production" for the LKPTI live phase, the initiative name for an RPTI
  plan phase), and inventing titles during import would put text on screen the filed return never
  contained. Revisit only if a concrete case wants it.
- The title is free text with no uniqueness or length constraint, matching how `Deliverable.description`
  and `Initiative.description` already behave.
