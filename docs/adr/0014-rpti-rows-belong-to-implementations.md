# ADR-0014: RPTI rows belong to implementations

## Status

Accepted

## Context and Problem Statement

ADR-0013 made an RPTI return a year-scoped projection, but its projection grain was still the
initiative. That loses valid filing lines when one application has two go-lives in the same year,
and it cannot represent one initiative implementing several applications without either dropping
work or repeating an initiative-level cost.

The filing describes a development event: the application or infrastructure item entering
production, when that happens, what that implementation costs, and its commentary. In Selara that
event is a live `DeliverableSegment`, not the initiative that triggered it.

## Decision Drivers

- Every reportable implementation must reach the filing exactly once, in the year it starts.
- A row must state the target, cost, quarter, and commentary of the implementation it describes.
- Existing filing evidence must remain readable and must block with a named repair when it cannot
  be matched uniquely; it must never be merged silently into another year's projection.
- Initiative budgets must remain useful portfolio figures without becoming fallback filing values.
- The change must preserve existing workspaces without an IndexedDB rewrite.

## Considered Options

- Keep one row per initiative and choose or collapse one implementation.
- Project one row per live implementation and put filed values on that implementation.
- Add a separate initiative-target or filing-line entity.
- Derive initiative CapEx and OpEx as totals of implementation figures.
- Use the initiative budget as a default when an implementation has no filed cost.

## Decision Outcome

Chosen option: **one RPTI row per live implementation**. A live `DeliverableSegment` owns the
row's `deliverableId`, `initiativeId`, implementation date, `capexAmount`, `opexAmount`, and
`rptiRemarks`. The row belongs to the calendar year in which that live phase starts. Planned and
funded run-up phases do not file on their own.

Q7 and Q10 in `requirement-specs/report-rows-as-projections.md` are reversed. The principle behind
Q7 survives: **one piece of work has one filed budget**. What changed is the identity of the piece
of work—from the initiative to the implementation. Once the implementation names its own target,
Q10's single-target initiative and `Initiative.deliverableId` are unnecessary; one initiative may
legitimately file several implementations across several applications.

`Initiative.capex` and `Initiative.opex` remain stored and editable portfolio figures used by the
timeline, mobile cards, and budget reporting. They are not derived from implementations and the
RPTI filing never reads them. Data Health warns when they differ from the total filed figures on
the initiative's implementations, but the warning never blocks export because both values are
legal and may intentionally differ.

Reconciliation uses `RptiDetail.deliverableSegmentId` as the canonical implementation identity.
Legacy rows without an anchor are accepted only when they correspond to exactly one current
implementation; missing or ambiguous correspondence is named before export.

### Why no IndexedDB version bump is needed

The three implementation fields are optional properties on records in the existing
`deliverableSegments` object store. IndexedDB stores are schemaless within a store, and no store,
key path, or index changes. Removing `Initiative.deliverableId` from the TypeScript model likewise
does not require rewriting records; a legacy orphan property is ignored. Existing initiative
budgets are deliberately not migrated or recalculated.

### Rejected alternatives

- **Keep initiative-grained rows.** It silently drops a second go-live and cannot express several
  application targets without choosing one on the preparer's behalf.
- **Add a join or filing-line entity.** It can express the grain, but the lifecycle segment already
  is the implementation and already owns the target and date. A new store would duplicate that
  identity and require a schema migration with no additional domain meaning.
- **Derive initiative budgets from implementation figures.** An initiative with no implementation
  figures would collapse to zero, blanking a valid portfolio budget, and every existing workspace
  would need migration. The portfolio and filing figures are different facts, not two copies.
- **Fall back to the initiative budget when implementation cost is absent.** That creates two
  editable values competing to be the same fact and can silently overwrite or repeat a budget.
  Missing implementation figures remain zero in the filing and are announced by Data Health.
- **Copy initiative commentary to every implementation.** One comment may describe only one
  release; copying it can put the wrong statement in a regulatory row. Legacy commentary is lifted
  only when its destination is unambiguous.

## Consequences

### Release note

- An application with two go-lives in one filing year now produces two lines, one per go-live.
- Work going live next year no longer appears in this year's RPTI. This is an intentional behaviour
  change: a row belongs to the year its implementation starts.
- Filed CapEx, OpEx, and commentary move to the implementation's lifecycle segment. Initiative
  CapEx and OpEx remain stored, editable portfolio figures that the filing never reads; Data Health
  warns when the two views diverge.
- One initiative may file implementations for several applications. The obsolete
  `Initiative.deliverableId` field and its UI controls are removed.

The full user-facing note is also recorded in
`specs/003-rpti-row-per-implementation/release-note.md`.

