# User Story 26: Initiative–Deliverable Links on the Visualiser

## Story

> **As** a preparer planning work that spans several applications,
> **I want** to see which deliverables an initiative drives, and which initiative drives a lifecycle segment,
> **So that** I can answer "what does this deliver?" and "whose work is this?" from the timeline itself.

## Background and decisions

Since #52, one initiative can drive several deliverables: each lifecycle segment names both
its application and its initiative. The Visualiser showed that only as the initiative's name on
a segment bar, and not at all from the initiative's side. The design, its constraints and the
rejected alternatives are in `requirement-specs/initiative-deliverable-links.md`; the product
owner chose a **count badge and list** (option D) together with **highlight on select** (option A).

- **The link is derived, never stored.** Everything here reads `DeliverableSegment.initiativeId`
  at render time. No field, migration or ADR.
- **One highlight set, whichever end is clicked** — the initiative plus all of its segments.
- **Expansion is temporary.** Anything opened to reveal a highlight returns to its saved state
  when the highlight ends; saved collapse settings are never changed.
- **The highlight only works when grouped by asset with display `both`**, the only view where both
  ends are drawn. The badge works everywhere.

## Acceptance Criteria

### AC1 — Count badge

- [x] An initiative bar linked to at least one lifecycle segment shows the number of **distinct
  deliverables** those segments name. Three implementations on one application show **1**.
- [x] An initiative with no linked segments shows no badge.
- [x] The badge appears in every grouping (asset, programme, strategy) and every display mode that
  draws initiative bars, provided the bar is wide enough to show its name. A sliver-width bar has no
  room for either.

### AC2 — Deliverable list and jump

- [x] Activating the badge lists the deliverables by name, each with the asset it sits under.
- [x] Choosing one focuses the initiative (AC3) and scrolls that deliverable's earliest linked segment
  into view.
- [x] The badge is a keyboard-reachable button, and Escape closes the list.

### AC3 — Highlight from an initiative

- [x] Grouped by asset with display `both`, selecting an initiative that has linked segments marks
  that initiative and every one of its segments as highlighted, and dims every other initiative and
  segment bar.
- [x] Selecting an initiative with **no** linked segments dims nothing — the timeline behaves as it
  does today.

### AC4 — Highlight from a segment

- [x] Selecting a segment attributed to an initiative produces the **same** highlight as selecting
  that initiative: the initiative and all of its segments. The clicked segment keeps its normal
  selection outline.
- [x] Selecting a segment with no initiative dims nothing.
- [x] Whichever of an initiative or a segment was selected most recently decides the highlight.

### AC5 — Revealing hidden ends, temporarily

- [x] If a highlighted bar — the initiative or any of its segments — is inside a collapsed category,
  that category is shown expanded while the highlight lasts, and its header is marked as opened for
  a highlight.
- [x] If the focused initiative is inside a collapsed group bar, the group is shown expanded while the
  highlight lasts.
- [x] When the highlight ends, the category and group return to collapsed. The saved collapse
  settings are unchanged throughout.

### AC6 — Clearing

- [x] Escape, or a click on the empty timeline, ends the highlight, exactly as either already clears
  selection.

### AC7 — Other views

- [x] Grouped by programme or strategy, or with display `initiatives` or `deliverables`, selection
  dims nothing and expands nothing. The badge (AC1, AC2) still works.

## Out of scope

- **Connector lines** (option B): deferred until A and D are in use and it's clear whether a gap
  remains.
- **Highlight outside asset grouping with display `both`**: accepted as a limitation (AC7).
- **Adding a multi-deliverable initiative to the demo workspace.** Of the demo's 48 initiatives none
  links to more than one deliverable, so the demo can't show this feature. The tests use a seeded
  fixture instead, because a new live segment in the demo would change the demo's RPTI output, which
  `src/lib/rpti.test.ts` pins. Making the demo show the feature is a separate decision.
