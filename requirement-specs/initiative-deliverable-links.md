# Showing which deliverables an initiative drives (Design Notes)

> **Status:** Open — design options for [#54](https://github.com/nofanto/Selara/issues/54). No code
> until one is chosen (CLAUDE.md step 0).
> **Context:** Since [#52](https://github.com/nofanto/Selara/issues/52) (PR #53), one initiative can
> drive several deliverables. The link is not stored on the initiative. Each **lifecycle segment**
> names both its application (`deliverableId`) and the initiative behind it (`initiativeId`), so an
> initiative's deliverables are exactly the deliverables of its segments.

## The problem

The Visualiser shows the relationship in one direction only, and only as text:

- A **segment bar** is labelled with its initiative's name, unless the segment has its own title
  (`Timeline.tsx`, `primaryLabel = seg.title || initiativeName || statusLabel`, ADR-0012).
- An **initiative bar** shows nothing about which deliverables it drives, how many, or where they
  are.

So "what does this initiative deliver?" can only be answered by reading every segment label under
every asset.

## Constraints found in the code

These decide which options are workable, so they come before the options.

1. **Only grouping by asset draws segments.** Grouping by programme or strategy renders initiative
   bars in group swimlanes but no deliverable swimlane. Nothing drawn means nothing to link to.
2. **Display has three modes** (`initiatives`, `deliverables`, `both`). `initiatives` hides segments
   and `deliverables` hides initiative bars. A drawn link has both ends only in `both`.
3. **Within one asset, the two ends are adjacent**: the initiatives row sits directly above the
   deliverables row.
4. **Across assets, they can be far apart.** `Initiative.assetId` and a segment's deliverable asset
   are independent, and since #52 one initiative may file for applications under several assets.
   Its segments can be many rows away or off screen.
5. **Either end can be hidden.** Asset categories collapse (`collapsedCategories`), and overlapping
   initiatives can merge into a single **group bar**.
6. **An SVG line layer already exists** for dependency arrows: solid for blocks/requires, dashed
   `4 2` for related, coloured by type, amber and thicker on the critical path. New lines on that
   layer would be cheap to add and easy to mistake for dependencies.
7. **The data already exists.** Every option below is derived from `DeliverableSegment.initiativeId`
   at render time. None needs a stored field, a migration, or an ADR.

## Options

### A — Highlight on select

Selecting an initiative emphasises its segment bars and dims every other bar. Selecting a segment
does the same for its initiative. It builds on the existing `selectedInitiativeId` and
`selectedSegmentId` state.

- **For:** nothing new on screen until asked, so it scales to hundreds of initiatives. Works at any
  distance: both ends light up however far apart they are. No geometry.
- **Against:** a segment that's off screen or inside a collapsed category lights up where nobody can
  see it. Nothing is visible until you select something. Only works when grouped by asset with
  display `both`.

### B — Connector lines

Lines from the initiative bar to each of its segment bars, drawn on the existing SVG layer, either
always or only for the selected initiative.

- **For:** the most literal answer to "visual link". Unambiguous for short, same-asset links.
- **Against:**
  - Always-on lines don't scale: 48 demo initiatives, and real portfolios in the hundreds.
  - Cross-asset lines span many rows and leave the viewport.
  - Every line has to be recomputed on scroll, zoom, collapse and row layout.
  - It shares a layer with dependency arrows, whose solid, dashed and coloured styles already use up
    the obvious ways to tell lines apart.
  - Showing lines only on select adds that geometry cost for little over A.

### C — Colour or marker tag on segments

Each segment bar carries a small marker in its initiative's colour.

- **For:** always on, low clutter, cheap.
- **Against:** colour can't identify one initiative among dozens. There aren't enough
  distinguishable hues, and a programme colour is shared by every initiative in that programme, so
  it says which programme, not which initiative. That fails the question being asked.

### D — Count badge and list on the initiative bar

The initiative bar shows how many deliverables it drives (e.g. `3 ▸`). Hovering or clicking lists
them, each with a jump to its segment.

- **For:** covers the missing direction, initiative → deliverables. It works in **every grouping
  and display mode**, including programme and strategy where segments aren't drawn at all, and for
  targets off screen or collapsed. Cheap. The bar already has a hover title to build on.
- **Against:** it's a list, not a spatial link. You still need a jump to see where the work sits.

## Recommendation

**A and D together.** Each covers the other's gap:

- **D** answers *which and how many* everywhere: in every grouping and display mode, and for
  targets you can't currently see.
- **A** gives the spatial link, but only when you ask for it, so the timeline stays readable at
  portfolio scale.
- D's jump-to-segment is what makes A work for off-screen targets: select, jump, and the segment is
  already highlighted.

**B deferred rather than rejected.** It's worth revisiting for the same-asset case alone, drawn
only on select and styled unlike any dependency, once A and D are in use and it's clear whether
the gap remains. **C rejected**: colour identifies a programme, not an initiative.

## Open questions

1. **Which option or options?** Recommendation above; the decision is the product owner's.
2. **Both directions?** Should selecting a segment highlight its initiative as well as the reverse?
   Recommended yes: "whose work is this?" is as common as "what does this deliver?".
3. **Hidden targets.** When a highlighted segment is inside a collapsed category, expand the
   category, show an indicator on its header, or leave it to D's list?
4. **Other groupings and display modes.** Accept that A is inert outside grouping by asset with
   display `both`, with D still working, or switch to that view when a highlight is requested?
5. **Group bars.** When the selected initiative is merged into a group bar, highlight the group, or
   expand it?

## Verification needs

This is UI behaviour, so it gets Playwright E2E (Principle III). **The fixture has to be able to
fail.** Measured on `demoData.ts`: of **48** initiatives, **7** link to any segment, **0** link to
more than one deliverable, and **0** cross assets. The demo contains none of the cases this feature
exists for, so an E2E run against it passes without testing anything. It's the same gap the RPTI
sample had before spec 003's Phase 5.

The work therefore needs, **before** its tests are written, an initiative driving several
deliverables across at least two assets. Caution: adding it to `demoData.ts` changes what the demo
files. `src/lib/rpti.test.ts` asserts the demo RPTI by year (`[1, 0, 1, 0]`), so a new live segment
either updates that assertion deliberately or goes in a separate test fixture instead.

## Related

- [#52](https://github.com/nofanto/Selara/issues/52), PR #53: the model this visualises.
- `requirement-specs/report-rows-as-projections.md` Q17, Q18: why the link lives on the segment.
- ADR-0012: segment labels, which already name the initiative.
