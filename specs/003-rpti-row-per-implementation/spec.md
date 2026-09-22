# Feature Specification: An RPTI row is one planned implementation, not one initiative

**Feature Branch**: `003-rpti-row-per-implementation`

**Created**: 2026-09-19

**Status**: Draft

**Input**: User description: "An RPTI row is one planned implementation, not one initiative." Raised as [#52](https://github.com/nofanto/Selara/issues/52); design context in `requirement-specs/report-rows-as-projections.md` Q15.

## Why this exists

An RPTI return is a bank's plan for developing its applications and infrastructure. Each line of
that plan carries **one** planned implementation time (`Waktu Rencana Implementasi`) and **one**
cost estimate (`Estimasi Biaya CapEx` / `OpEx`).

Selara generates one line per **initiative**. An application with two go-lives in the same filing
year therefore has one of them silently dropped. Measured on `7a75726`: two qualifying live
segments in 2027, one starting in Q2 and one in Q4, produce a single row stating Q4. Nothing about
the Q2 implementation reaches the filing, and the state is reached by ordinary timeline work rather
than by a damaged workspace.

The product owner's reading, which this feature adopts: *"RPTI is the plan, the plan segment should
generate the RPTI row."* A row's grain is the **implementation**. An initiative is the trigger
behind it and may trigger several.

This is a **format** argument rather than an internal-consistency one, which distinguishes it from
the other open model questions: the filed columns cannot express two implementation times on one
line, so two implementations must be two lines.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Both go-lives reach the filing (Priority: P1)

A preparer plans two releases of the mobile banking application in 2027: a payments release going
live in Q2, and a cards release going live in Q4. They draw both on the timeline under one
initiative, generate the RPTI for 2027, and see **two** plan lines — one stating Q2, one stating
Q4.

**Why this priority**: it is the defect. Without it the feature does not exist, and a bank files an
incomplete plan.

**Independent Test**: build a workspace with two live segments on one application in one year,
generate, and count the rows and their implementation times.

**Acceptance Scenarios**:

1. **Given** one initiative with live segments beginning in Q2 and Q4 of the report year, **When**
   the preparer generates the RPTI for that year, **Then** two rows are produced, one per
   implementation, each stating its own implementation time.
2. **Given** the same workspace, **When** the preparer exports, **Then** both rows appear in the
   workbook.
3. **Given** an initiative with a single implementation, **When** the preparer generates, **Then**
   exactly one row is produced — the change does not multiply ordinary work.

### User Story 2 - Each implementation carries its own filed values (Priority: P1)

The Q2 payments release and the Q4 cards release cost different amounts and warrant different
commentary. The preparer records each against the implementation it describes, and each filed line
carries its own.

**Why this priority**: two rows carrying identical costs and identical commentary would file the
same budget twice and say the same thing about two different releases. Splitting the rows without
splitting their values would replace a silent omission with a silent duplication, which is worse.

**Independent Test**: give two implementations different costs and different remarks; generate;
confirm each row carries its own.

**Acceptance Scenarios**:

1. **Given** two implementations with different cost estimates, **When** the preparer generates,
   **Then** each row states the estimate belonging to its own implementation.
2. **Given** two implementations with different commentary, **When** the preparer generates,
   **Then** each row carries the commentary for its own implementation.
3. **Given** an implementation with no cost of its own, **When** the preparer generates, **Then**
   the row falls back to the initiative's figure rather than filing zero or blank.

### User Story 3 - A filed return still reproduces after import (Priority: P2)

A preparer imports last year's filed RPTI and regenerates it. Every value the return supplied
survives, including for a plan that filed two implementations of one application.

**Why this priority**: round-trip fidelity is the property the previous feature was built to
establish, and a grain change is exactly the kind of change that breaks it quietly.

**Independent Test**: import a return containing two rows for the same application, regenerate,
compare field by field.

**Acceptance Scenarios**:

1. **Given** a filed return with two rows for one application in one year, **When** it is imported
   and regenerated for that year, **Then** both rows are reproduced with their own implementation
   times and values.
2. **Given** any filed return, **When** it is imported and regenerated, **Then** no filed value is
   lost — the existing zero-loss measurement continues to hold.

### User Story 4 - The preparer is told when a stored row no longer corresponds (Priority: P2)

A preparer whose workspace holds rows filed under the previous model regenerates. Rows that can be
matched to a current implementation are recognised; rows that cannot are named before any file is
produced.

**Why this priority**: existing workspaces hold rows keyed by the old grain. Reconciliation must
keep working across the change, or the guarantee that a filed row is never silently absent lapses
exactly when the model moves under it.

**Independent Test**: take a workspace whose stored rows predate the change, generate, and confirm
each stored row is either matched or named.

**Acceptance Scenarios**:

1. **Given** a stored row from the previous model matching exactly one current implementation,
   **When** the preparer generates, **Then** it is treated as corresponding and raises no finding.
2. **Given** a stored row matching no current implementation, **When** the preparer generates,
   **Then** it is named before export, with the repair it needs.
3. **Given** two stored rows matching one implementation, **When** the preparer generates, **Then**
   the ambiguity is reported rather than one row being dropped.

### Edge Cases

- **A new build with a run-up.** A planned phase followed by a live phase is **one** implementation,
  not two. Filing two rows for a single go-live would duplicate the application in the return.
- **An implementation whose time falls outside the report year.** Work beginning in the report year
  that goes live in the next one — see Clarification Q3.
- **An application already live with no new implementation this year.** Nothing is being
  implemented, so no row is generated and nothing is reported. Continuous operation is not a plan
  line.
- **Two implementations in the same quarter.** The filing cannot distinguish them by time. Whether
  they remain two rows or collapse to one is settled by Q2's answer.
- **An initiative whose implementations target different applications.** Already an error under the
  existing single-target rule; that rule is unchanged by this feature.
- **Scale.** Per-implementation rows increase the row count for a given workspace, so the existing
  300-application check becomes more load-bearing, not less.

## Requirements *(mandatory)*

### Functional Requirements

**The grain**

- **FR-001**: An RPTI row MUST correspond to one planned implementation, not to one initiative. An
  initiative with several implementations in a report year MUST produce one row per implementation.
- **FR-002**: Each row MUST state the implementation time of its own implementation. No
  implementation belonging to the report year may be absent from the generated return.
- **FR-003**: An initiative with exactly one implementation in the report year MUST continue to
  produce exactly one row, with the same values it produces today. The change MUST NOT alter
  ordinary single-implementation output.

**Values that belong to an implementation**

- **FR-004**: Each row's cost estimate MUST belong to the implementation it describes, and MUST be
  recorded against that implementation rather than against its initiative (Q1).
- **FR-005**: Two implementations of one initiative MUST NOT file the same cost estimate twice
  unless the preparer has stated that figure for each. Repeating an initiative-level figure across
  rows would double-count the plan's budget.
- **FR-006**: Each row's commentary (`Keterangan`) MUST be able to differ per implementation. A
  preparer MUST be able to say "phase 1" on one row and "phase 2" on another.
- **FR-007**: Values that describe the **application** — platform, providers, ownership, developer,
  related-party answer, category — MUST remain on the application and appear identically on every
  row targeting it. This feature moves only what belongs to an implementation.

**Decisions this feature revises — each stated, none silently contradicted**

- **FR-008** *(reverses FR-029 / Q10)*: The rule that an initiative has **at most one RPTI target**
  is **withdrawn**. A plan line names the application its own implementation targets, so one
  initiative may file for several applications — one row per implementation, each naming its own.
  A programme of work spanning three systems is ordinary planning and the filing can express it.
- **FR-008a**: The data-health error raised for an initiative whose work spans several applications
  MUST be removed. It forbids an arrangement that is now legal; leaving it would report a defect
  where none exists, which is how preparers learn to ignore findings.
- **FR-008b**: Target inference — deriving an initiative's filing target from its segments where
  none is declared — MUST be reconsidered. A segment names its own application, so the inference
  has no remaining purpose for the RPTI. Whether `Initiative.deliverableId` survives for other uses
  is a planning question, not a filing one.
- **FR-009** *(reverses FR-028 / Q7)*: The filed cost MUST belong to the implementation, not to the
  initiative. Q7's principle — *"if one piece of work needs two budgets, it is two pieces of
  work"* — is **preserved and its conclusion reversed**: the piece of work the filing asks about is
  the implementation, so that is where its budget belongs.
- **FR-009a** *(revised 2026-09-22)*: `Initiative.capex`/`opex` MUST remain **stored and
  editable**, and MUST NOT be derived. They are a different figure from the filed one, not a second
  copy of it: the initiative's budget is a portfolio number driving the timeline, the budget report
  and the mobile cards, while the implementation's figure is what the return states. Neither
  derives from the other, so no precedence rule is needed and the two-sources hazard does not
  arise.
- **FR-009b**: Importing a return MUST seed **both** figures from the filed row — the implementation
  because it is what the return states, the initiative because a newly created initiative needs a
  budget. They begin equal and may diverge.
- **FR-009c**: Divergence between an initiative's budget and the total of its implementations MUST
  be reported by data health as a **warning**, naming both figures. It MUST NOT be an error and MUST
  NOT block export: grouping several applications under one initiative and budgeting it separately
  is legitimate, and the filing is correct either way because it reads the implementation. The
  message MUST name both places a preparer could act, since either side may be the one that is
  wrong.
- **FR-010** *(revises Q11 / Q12)*: The canonical identity reconciliation matches against MUST
  become the implementation rather than the (initiative, target) pair. One-to-one accounting and
  the ambiguity report MUST continue to hold at the new grain.
- **FR-011** *(revises Q14)*: Commentary MUST move to the implementation. Q14 placed it on the
  initiative because a row was not one-to-one with a segment *under the previous grouping*; that
  reason no longer holds, and the product owner's original instinct was recorded there as correct.
- **FR-012**: Any decision above that this feature revises MUST be recorded as revised, with its
  reasoning and the date, in the design notes and the governing decision record. A reader MUST be
  able to see that the model moved rather than finding a requirement quietly rewritten.

**Not losing what the previous model recorded**

- **FR-013**: A stored row from the previous model MUST be matched to a current implementation
  where exactly one corresponds, and MUST be named before export where none does. The existing
  guarantee that a filed row is never silently absent MUST hold across the grain change.
- **FR-014**: Where two stored rows correspond to one implementation, or one stored row to several,
  the ambiguity MUST be reported. Neither dropping a row nor picking arbitrarily is acceptable.
- **FR-015**: The preparer MUST NOT be required to re-key any value the filed return already
  supplied in order to satisfy the new grain.

**Consequences elsewhere**

- **FR-016**: The existing warning that reports a dropped second implementation MUST be removed. It exists because the implementation is dropped; once it is filed, the warning is
  either false or means something different, and leaving it would train preparers to ignore
  findings.
- **FR-017**: Every newly relocated or added field MUST be named explicitly in the version
  difference report. A field nobody names changes with no history entry and no error
  ([#42](https://github.com/nofanto/Selara/issues/42)).
- **FR-018**: The round-trip verification fixture MUST contain a multi-implementation case. The
  published sample holds one implementation per initiative and therefore cannot exercise this
  feature at all; without a new case the change ships unverified.

### Key Entities *(include if feature involves data)*

- **Planned implementation** — a single instance of an application or infrastructure item being put
  into production, with its own time, cost and commentary. Newly the unit an RPTI row corresponds
  to. Already present in the model as a lifecycle segment; this feature gives it the values a filed
  line needs.
- **Initiative** — the piece of work that triggers implementations. Retains its single RPTI target,
  its description, and its role as the thing a preparer plans. Loses its status as the unit a row
  corresponds to.
- **Application (Deliverable)** — the thing being implemented. Unchanged: it holds what describes
  the application, which is identical across every row targeting it.
- **RPTI row** — one line of the filed plan. Now a projection of an implementation rather than of an
  initiative.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A workspace with two implementations of one application in one filing year produces
  two plan lines, each stating its own implementation time. Today it produces one and loses the
  other.
- **SC-002**: Importing a filed return and regenerating it for the same year loses **zero** filed
  values, including for a return containing two lines for one application. The existing zero-loss
  result is preserved, measured on a fixture that actually contains the new case.
- **SC-003**: A workspace whose every initiative has one implementation produces byte-identical
  output before and after the change. Ordinary work is unaffected.
- **SC-004**: Every stored row from the previous model is either matched to a current
  implementation or named to the preparer before a file is produced. No stored row is silently
  absent from a generated return.
- **SC-005**: Two implementations with different stated costs file different amounts. The plan's
  total does not change when a preparer splits one implementation into two.
- **SC-006**: Generating and reconciling a return for 300 applications stays within the
  responsiveness of generating one today, with implementations rather than initiatives as the row
  count.

## Assumptions

- **An implementation means a transition into production**, not any lifecycle phase. A planned
  run-up followed by a go-live is one implementation. Filing a row for the run-up and another for
  the go-live would duplicate the application within a single return, which the format does not
  contemplate. Confirmed indirectly by the present behaviour, which already derives the
  implementation time from a live phase where one exists.
- **The single-target rule survives.** Nothing in the format suggests an initiative may span
  applications, and the existing error for that case remains appropriate.
- **Stored rows remain read-only evidence.** This feature does not restore editing of report rows;
  it changes what generation produces and what reconciliation matches against.
- **Costs already recorded on initiatives remain meaningful** and continue to serve any
  implementation that states no figure of its own, so an existing workspace keeps filing the
  amounts it files today until a preparer says otherwise.
- **Migration is by correspondence, not rewriting.** Stored rows keyed under the previous grain are
  matched to current implementations rather than having their identities rewritten, consistent with
  the established position that stored rows are immutable evidence.

## Clarifications

### Q1 — Where does an implementation's cost estimate live?

**Context**: FR-004, FR-005, FR-009. The filed format carries one CapEx and one OpEx **per row**.
With rows at implementation grain, an initiative-level figure would be repeated across every row —
filing the same budget two or three times. Q7 previously decided cost belongs to the initiative,
with the reasoning *"if one piece of work needs two budgets, it is two pieces of work."*

**What we need to know**: whether cost moves to the implementation, and what happens to the
initiative's figure.

| Option | Answer | Implications |
|--------|--------|--------------|
| A | Cost moves to the implementation; the initiative's figure becomes the default for an implementation that states none | Matches the filed grain exactly. Existing workspaces keep filing today's amounts until a preparer overrides one. Two sources for one value, which is the shape that produced an earlier silent-overwrite defect — needs a clear precedence rule and a test for it. |
| B | Cost moves to the implementation outright; the initiative's figure is removed | One source of truth, no precedence rule. But every existing workspace must have its costs redistributed, and an initiative with no implementations loses its budget entirely — the timeline's budget visualisation reads `Initiative.capex`. |
| C | Cost stays on the initiative and is divided across its implementations by a stated rule | Preserves Q7 unchanged. The division rule is an invention the regulator did not ask for, and the same objection that rejected it before still applies. |
| Custom | Provide your own answer | e.g. cost on the implementation only when it differs, with the initiative holding the total and a consistency check between them. |

**Your choice**: **Cost belongs to the implementation**, decided 2026-09-22 — closest to option B,
with the initiative's figure **derived** rather than removed.

*The product owner's reasoning: "RPTI is only for development plan, then it should be on the
segment." The plan line lives on the implementation, so everything the line states — the
application, the time, the type, the cost, the commentary — belongs there. The initiative becomes
the trigger: why the work exists, who owns it, which programme it serves.*

*`Initiative.capex`/`opex` are kept as **derived** totals rather than deleted, because the timeline,
budget visualisation and validation read them in thirteen files. Derived, not stored, so there is
one source of truth — option A's "default when none is stated" was rejected for creating two
independently-editable figures for one value, which is exactly the shape of the silent-overwrite
defect found in the previous feature.*

### Q2 — What counts as one implementation?

**Context**: FR-001, and the "new build with a run-up" edge case. A new application typically has a
planned phase and then a live phase; an upgrade has a funded phase and then returns to live. If
every lifecycle phase generated a row, one go-live would file as two lines.

**What we need to know**: which lifecycle phases constitute a filed implementation.

| Option | Answer | Implications |
|--------|--------|--------------|
| A | Only a transition **into production** — the start of a live phase within the report year | One row per go-live, which matches what the column means. A build that is only in its run-up during the year files nothing that year. Closest to present behaviour, which prefers a live phase when deriving the time. |
| B | Every qualifying phase, live or pre-launch | Simple and literal — "the plan segment generates the row" — but a single go-live preceded by a planned phase would file two lines for the same application, which the format does not contemplate. |
| C | A transition into production, **or** a pre-launch phase where no go-live falls in the year | Every planned piece of work appears somewhere, at the cost of a rule with two branches, and a row whose stated time may be a start rather than a go-live. |
| Custom | Provide your own answer | |

**Your choice**: **Option A** — only a transition into production, decided 2026-09-22.

*Settled by Q16 of the design notes: a retirement leaves through the LKPTI, never through the RPTI.
The owner first proposed that an implementation meant any change of live state including sunset,
then corrected it. `Jenis Pengembangan` is `new | upgrade` only, so a decommission has no value it
could occupy in a filed row. This removes the branch option C existed to serve.*

### Q3 — May a row's implementation time fall outside the year being filed?

**Context**: FR-002, and the second edge case. Today a workspace whose work begins in the report
year but goes live the following year still produces a row for the report year. Under an
implementation grain that becomes a question rather than a side effect.

**What we need to know**: whether a plan line belongs to the year its work is done or the year it
goes live.

| Option | Answer | Implications |
|--------|--------|--------------|
| A | A row belongs to the year its implementation happens. Work going live next year is filed next year | The filing answers "what goes live this year", which is the plain reading of a planned implementation time. It is a **behaviour change**: a workspace filing such a row today would stop, and that must be stated rather than shipped quietly. |
| B | A row belongs to the year its work is active, and may state an implementation time in a later year | Preserves present behaviour. The plan shows everything under way, at the cost of lines whose stated time is outside the return's own period. |
| Custom | Provide your own answer | |

**Your choice**: **Option A** — a row belongs to the year its implementation happens, decided 2026-09-22.

*Consequences, all of which the plan must carry:*

- *This is a **behaviour change**. A workspace whose work is under way during the report year but
  goes live the next one files a row today and will stop. It must be stated in the release, not
  discovered — the same standard applied to the decommissioned-application change in ADR-0013.*
- *It replaces the segment-overlap membership rule (`rpti.ts:151`) with a start-within-year test,
  which also removes the second of the three symptoms recorded in Q16: one go-live re-filing every
  year until its open-ended live segment expires.*
- *Together with Q2 it makes membership answer the question the column asks — `Waktu Rencana
  Implementasi` is when the thing goes live, and a row appears in the year that date falls in,
  exactly once.*

## Out of Scope

- The year-bearing reconciliation ledger analysed as option 5 in
  `specs/002-report-year-field-ownership/merge-path-options.md`. This feature removes two of its
  four justifications but does not build it.
- One-click repair of an unresolved imported row ([#51](https://github.com/nofanto/Selara/issues/51)).
- Labelling the `Description` / `Remarks` pair on the Initiatives tab. If commentary moves to the
  implementation, part of that question dissolves; what remains is deferred.
- Emptying or removing the read-only report tabs.
- The LKPTI return, which is a point-in-time inventory and has no implementation grain.

## Dependencies

- Builds on `specs/002-report-year-field-ownership/`, merged as `5100509`.
- The detection shipped for [#52](https://github.com/nofanto/Selara/issues/52) —
  `initiative-rpti-multi-implementation` — is superseded by this feature (FR-016). It currently
  lives on the local branch `052-multi-implementation-detection`.
