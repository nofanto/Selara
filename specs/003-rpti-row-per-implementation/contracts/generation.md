# Contracts: generation, reconciliation and cost at implementation grain

**Feature**: 003-rpti-row-per-implementation · **Date**: 2026-09-22

Each numbered item is a property a test can hold. Numbering continues from the previous feature's
contracts so references stay unambiguous; contracts 1–25 there remain in force except where an item
below supersedes one explicitly.

## `projectRptiReturn(input, reportYear)` — the projection

1. **A row corresponds to one implementation.** An initiative with *n* implementations in the filed
   year produces *n* rows. **Supersedes contract 2's grouping**, not its purity: output remains a
   function of the canonical entities and the year alone.
2. **An implementation is a transition into production**: a segment with a status flagged
   `isLiveStatus` whose `startDate` falls within the filed year, attributed to a real
   non-placeholder initiative. **Supersedes the overlap test**; a segment merely in progress during
   the year is not an implementation. *(Corrected 2026-09-22 — this contract previously admitted
   pre-launch statuses, contradicting the spec's Q2 answer. A pre-launch phase is the run-up to an
   implementation, not one itself.)*
2a. **A build only in its run-up files nothing that year.** Work whose go-live falls in a later year
   belongs to that later year's return (spec Q2 and Q3, both option A). Filing it in both would put
   one go-live on two returns, and the earlier row would state a planned implementation time outside
   its own filing period.
2b. **`new` versus `upgrade` is decided by the deliverable's history before *this implementation*,
   not by the presence of a pre-launch phase and not by the filed year's boundary.** A row is `new`
   when the deliverable has no live phase beginning before that row's own go-live, and `upgrade`
   otherwise. Two implementations sharing a start date are both `new` — neither precedes the other,
   and they state the same quarter.

   The first rule keyed off pre-launch segments among the qualifying set; with only live starts
   qualifying that set is always empty, which would type every row — including a genuine first build
   — as `upgrade`. The second keyed off the start of the filed year, which typed both go-lives of a
   brand-new application as `new`, stating in one return that the same application was built from
   nothing twice. *(Corrected 2026-09-23.)*

2c. **An imported filed row anchors on an open-ended live phase** starting at its filed quarter, for
   `new` and `upgrade` alike. A quarter-bounded anchor made the application live for three months
   and then absent from the timeline, and made its presence in the year-end LKPTI depend on which
   quarter was filed: measured on the published sample, a Q4 build joined the 2027 inventory and the
   Q1–Q3 builds did not. Both importers now use one horizon — an LKPTI entry and a filed go-live are
   the same claim, *this is live from that date*.
3. **One go-live files exactly once, in one year.** A segment starting in 2027 and running to 2031
   produces a row in 2027 and in no other year. Today it produces one every year until the segment
   ends — the second of the three symptoms in research.md R1.
4. **Two implementations in one year produce two rows**, each stating its own quarter. The
   originating defect.
5. **A run-up is not an implementation.** A pre-launch phase followed by a live phase is one
   implementation, so one row. Two rows for one go-live would duplicate the application in a single
   return.
6. **One initiative may target several applications.** Each row names the application its own
   implementation targets. **Supersedes contract on single-target generation**; the arrangement is
   no longer an error.
7. **An initiative whose implementations all fall outside the filed year produces no rows**, and
   this is not a defect. Absence from a year is not unreproducibility — the companion rule from
   Q11 continues to hold.
8. **Output is stable under reordering.** Two implementations starting on the same date produce a
   deterministic row order, so a regenerated return does not reshuffle.

## Cost

9. **A row's cost is its implementation's own.** Never the initiative's, and never a share of it.
10. **An implementation with no stated cost files zero**, and is reported by data health rather than
    throwing. Generation does not block on missing values; the export gate is where a preparer is
    stopped.
11. **`Initiative.capex` / `opex` stay stored and editable**, and are never read as a filing
    source. They are a portfolio figure, not a copy of the filed one; the return reads the
    implementation. *(Revised 2026-09-22 — this contract previously required derivation.)*
12. **Import seeds both figures** from the filed row, and they may then diverge without either
    being wrong.
13. **Two implementations with different stated costs file different amounts**, and the plan's total
    is unchanged by splitting one implementation into two.
13a. **Divergence between an initiative's budget and its implementations' total is reported as a
    warning**, never an error, and never blocking. It compares two *legal* states, so the message
    must name both figures and both places a preparer could act, rather than implying something is
    broken. Comparison is across all of an initiative's implementations, not year-scoped: an
    initiative's budget covers its whole life.

## `reconcileRptiReturn(input)` — evidence, not output

14. **Canonical identity is the implementation.** Matching moves from `(initiative, target)` to the
    implementation. `RptiDetail.deliverableSegmentId` is the natural anchor where present.
15. **Identity, never contents.** Field drift between a stored row and its regeneration remains
    unreported (Q12, 002's FR-027 as narrowed). Unchanged by this feature, and restated because a grain
    change is where it would be tempting to start comparing values.
16. **One-to-one accounting holds at the new grain.** Two stored rows matching one implementation,
    or one stored row matching several, is an `identity-conflict`. **Supersedes contract 23's**
    pairing without weakening it.
17. **A stored row from the previous model matching exactly one current implementation raises no
    finding.** The grain change must not turn correctly-filed history into noise — the failure
    that would make the export gate untrustworthy.
18. **It returns findings, never rows**, and never mutates its inputs. Unchanged.

## Data health

19. **The multi-target error is removed.** It forbids an arrangement that is now legal; leaving it
    would report a defect where none exists.
20. **The `initiative-rpti-multi-implementation` warning is removed** with the change that makes it
    false, in the same commit. It warns that a second implementation will be dropped; once filed,
    it is untrue.
21. **A finding still names a repair that clears it**, and the screen the repair happens on. The
    002's FR-025 standard is unchanged, and cost entry moving to the segment panel means messages naming
    the Initiatives tab for a cost must be found and corrected.

## Import and round trip

22. **An imported row's cost and remarks land on the implementation** it created or matched, not on
    the initiative.
23. **A filed return containing two rows for one application in one year reproduces both**, with
    their own times and values.
24. **Zero losses continue to hold**, measured on a fixture that actually contains a
    multi-implementation case. **Supersedes SC-001's fixture assumption**: the published sample has
    one implementation per initiative and cannot exercise this feature at all.

## Version history and scale

25. **`capexAmount`, `opexAmount`, `rptiRemarks` and `initiativeId` are compared explicitly** on
    `DeliverableSegment`. The first three are new; `initiativeId` is a pre-existing gap, and
    re-attributing a segment changes the filing today with no history entry
    ([#42](https://github.com/nofanto/Selara/issues/42)).
26. **300 applications with several implementations each** generate and reconcile within the
    existing bound. The current fixture builds one segment per deliverable and will not exercise the
    increased row count.
