# Feature Specification: OJK-First Onboarding and RPTI Return Import

**Feature Branch**: `001-rpti-import-onboarding`

**Created**: 2026-09-13

**Status**: Draft

**Input**: User description: "Make OJK regulatory filing the front door of Selara: simplify the workspace onboarding picker, and add an RPTI Format 3.1 importer so a bank can seed a workspace from a filed return."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Get started from the returns you already filed (Priority: P1)

IT Planning opens Selara for the first time. They are asked for the returns they already file with
OJK: the LKPTI inventory (required) and, if they have it, the RPTI plan (optional). Each upload
asks which reporting year it covers — these are routinely different, because a bank filing in late
2026 files an LKPTI *as at* 2026 and an RPTI *for* 2027. The LKPTI is processed first to establish
what the bank runs; the RPTI is then read against it. The flow ends on the data-health review, so
the first thing they see is what needs their attention.

**Why this priority**: This is the feature's reason to exist. Today the only data-bearing way in
seeds live applications only — no infrastructure, no planned work — so the workspace produces an
empty RPTI and cannot reach five of RPTI's eighteen category codes at all, because the kind of
thing those codes describe never gets created.

**Independent Test**: Complete onboarding with a real LKPTI and RPTI pair and confirm the workspace
holds both the inventory and the plan, and that the data-health review lists what needs attention.

**Acceptance Scenarios**:

1. **Given** a first run, **When** IT Planning reaches the starting screen, **Then** the LKPTI upload is required and the RPTI upload is optional
2. **Given** both returns supplied, **When** the import runs, **Then** the LKPTI is processed before the RPTI
3. **Given** each upload, **When** a file is chosen, **Then** the reporting year for *that* return is asked for, and the two may differ
4. **Given** only an LKPTI is supplied, **When** the import runs, **Then** onboarding completes successfully with an inventory and no plan
5. **Given** a return containing infrastructure categories (51-54, 99), **When** the RPTI is imported, **Then** those entries are created as infrastructure rather than applications
6. **Given** an RPTI row filed as an upgrade whose application matches one from the LKPTI, **When** it is imported, **Then** the planned work is attached to that existing application rather than creating a duplicate
7. **Given** an RPTI row filed as an upgrade with no matching application, **When** it is imported, **Then** it is reported for review rather than silently linked or silently duplicated
8. **Given** a completed import, **When** onboarding finishes, **Then** IT Planning lands on the data-health review
9. **Given** a file that does not match the format its slot expects, **When** it is selected, **Then** it is refused with a message naming the expected format, and nothing is written

---

### User Story 2 - A starting screen that says what the product is for (Priority: P2)

A first-time visitor sees a screen whose choices are about OJK returns, not generic portfolio
templates: begin from your filed returns, or begin empty.

**Why this priority**: Valuable but not load-bearing. Separated from Story 1 so the framing can
ship independently of any parser, and so "does this communicate the purpose?" can be judged on its
own.

**Independent Test**: Open a fresh workspace and confirm the choices presented, without uploading
anything.

**Acceptance Scenarios**:

1. **Given** a first-time visitor, **When** the starting screen appears, **Then** the ways to begin are limited to starting from filed returns or starting empty
2. **Given** the starting screen, **When** the visitor reads it, **Then** the stated purpose is preparing OJK regulatory returns
3. **Given** a visitor who wants to look around first, **When** they choose to start empty, **Then** exploring with demo data is available there
4. **Given** a workspace started empty, **When** IT Planning later wants the standard OJK technology areas, **Then** they can still add them from within the product

---

### User Story 3 - Opening a colleague's shared file still works (Priority: P3)

Viewing a portfolio someone else exported is not a way of starting your own workspace — but it is
still something people do. After it stops being an onboarding choice, it remains reachable where
other file operations live.

**Why this priority**: A regression guard rather than new value. It exists as its own story so
that removing the choice from onboarding cannot quietly remove the capability.

**Independent Test**: With the onboarding screen showing only the two starting paths, open a
shared export from the product's file/sharing surface and confirm it displays.

**Acceptance Scenarios**:

1. **Given** the simplified starting screen, **When** IT Planning looks for a way to open a colleague's exported file, **Then** it is available from the product's import/sharing area
2. **Given** a colleague's exported file, **When** it is opened that way, **Then** its contents are viewable as before

---

### Edge Cases

- **A file in the wrong slot** — an RPTI dropped into the LKPTI slot, or vice versa. Refused,
  naming the format that slot expects. Nothing is written.
- **The two returns cover different years.** Expected, not exceptional: an inventory *as at* 2026
  alongside a plan *for* 2027 is the normal case.
- **The RPTI covers an earlier year than the LKPTI.** Permitted — a bank may be importing history —
  but worth surfacing, since a plan predating the inventory is unusual.
- **Individual unusable rows** — missing name, unrecognised category, unreadable cost. Import
  proceeds with the rows it can use and reports each skipped row with its position and reason.
  Silently dropping regulatory data is not acceptable.
- **An upgrade row naming an application absent from the LKPTI.** Reported for review. Neither
  guessed at a near-match nor silently created as new — the two returns are known to disagree on
  naming, and resolving that is judgement.
- **Two rows naming the same item.** Both imported. Deciding whether they are one thing is
  judgement and belongs with the later reconciliation work.
- **A return of several hundred rows.** Must import and display without the product becoming
  unusable.
- **An empty return, or headers only.** Refused, distinguishing "not this format" from "this format
  with no rows".
- **Onboarding attempted again later.** It does not reappear once a workspace has data; bringing in
  more data afterwards is what the import/export feature is for.
- **The RPTI import fails after the LKPTI succeeded.** The LKPTI stays. The workspace is left
  usable with an inventory and no plan — the same state as supplying an LKPTI alone — and the
  failure is reported. Discarding a good import because an optional second one failed would be the
  worse outcome.
- **The result is not what the user wanted.** Recovery is the existing start-over mechanism, which
  clears the workspace and returns to this screen. Imports are not staged or reversible
  individually.

## Requirements *(mandatory)*

### Functional Requirements

**The starting screen**

- **FR-001**: The starting screen MUST offer exactly two ways to begin: start from filed OJK returns, or start empty.
- **FR-002**: The starting screen MUST state that the product's purpose is preparing OJK regulatory returns.
- **FR-003**: Exploring with demo data MUST remain available, offered as a way of starting empty.
- **FR-004**: The standard OJK technology-area catalogue MUST remain addable from inside the product after it ceases to be a starting choice.
- **FR-005**: Opening a colleague's exported file MUST remain available from the product's import/sharing area.
- **FR-006**: Onboarding MUST run only for a workspace with no data. It is a way to get started, not a route for ongoing import; bringing in further data later is the import/export feature's job.

**Supplying the returns**

- **FR-007**: The filed-returns path MUST require an LKPTI inventory and MUST treat an RPTI plan as optional.
- **FR-008**: When both are supplied, the LKPTI MUST be processed before the RPTI, so the plan is read against a known inventory.
- **FR-009**: Each return MUST be asked for its own reporting year, and the two MUST be allowed to differ. Neither year may be guessed: neither layout carries one, and an inventory *as at* one year alongside a plan *for* the next is the normal case.
- **FR-010**: Each upload MUST accept only the format its slot expects and MUST refuse any other, naming the expected format.
- **FR-011**: A refused or failed import MUST leave the workspace exactly as it was **at the point that import began**. Each return commits on its own success: a failed RPTI import leaves a successfully imported LKPTI in place, which is a valid end state because the RPTI is optional (FR-007). Imports write into the workspace itself — there is no separate staging area — so recovery from an unwanted result is the existing start-over mechanism, not a rollback.

**What an import produces**

- **FR-012**: The system MUST create one portfolio entry per usable row.
- **FR-013**: The system MUST classify each entry as an application or as infrastructure according to its category code, and MUST NOT create an application for an infrastructure category or vice versa.
- **FR-014**: The system MUST carry each row's filed values through to the imported report rows, so an imported return reads as what was filed.
- **FR-015**: Each imported RPTI row MUST become its own piece of planned work, carrying that row's name, description, planned timing, and its estimated capital and operating cost. Rows MUST NOT be merged into shared groupings, because a return's per-row costs and timing would be lost in the aggregation.
- **FR-016**: Imported planned work MUST be positioned in time from the row's planned implementation quarter within its reporting year, as a pre-launch period ending at the close of that quarter followed by a live period beginning at that point.
- **FR-017**: A row filed as an **upgrade** MUST additionally carry a live period *preceding* its planned work, because an upgrade by definition targets something the bank already runs. A row filed as **new** MUST NOT.

**Relating the plan to the inventory**

- **FR-018**: An RPTI row filed as an **upgrade** MUST be attached to an existing application from the LKPTI when one matches unambiguously, rather than creating a duplicate.
- **FR-019**: An upgrade row with no unambiguous match MUST still be imported — its planned work and its report row are kept — but MUST NOT have a new entry created for it, and MUST NOT be attached to a near-match. Its unresolved target then appears in the data-health review as a broken reference, through the same check that already reports a report row pointing at something absent. The two returns are known to disagree on naming, and resolving that is a judgement for a person.
- **FR-020**: An RPTI row filed as **new** MUST create a new entry without consulting the inventory.
- **FR-021**: The system MUST report every row it could not import, with the row's position in the file and the reason, and MUST NOT discard such rows silently.

**Finishing**

- **FR-022**: On completing an import, the system MUST take IT Planning to the data-health review, so the first thing they see is what needs attention.

**Scale**

- **FR-023**: Importing returns of several hundred rows MUST complete without the product becoming unresponsive, and MUST NOT introduce new work proportional to the square of the number of rows.

### Key Entities *(include if feature involves data)*

- **Filed LKPTI inventory**: the applications a bank runs, as submitted — required to get started, and processed first so the plan has something to be read against.
- **Filed RPTI plan**: the applications *and infrastructure* a bank plans to build or upgrade, as submitted — optional at this stage.
- **Reporting year**: which year a given return covers. Held per return, because an inventory *as at* one year and a plan *for* the next is the normal pairing.
- **Portfolio entry**: what an imported row becomes — an application or an infrastructure item, grouped under a technology area matching its category.
- **Planned work**: the activity an imported plan row represents, positioned in time so it appears on the timeline and can be regenerated into a future return.
- **Unresolved reference**: a plan row describing an upgrade to something the inventory does not contain, surfaced for a person to resolve rather than guessed at.
- **Skipped row report**: what an import could not use, why, and where it was in the file.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A bank holding its filed returns reaches a populated workspace without typing any of it.
- **SC-002**: A workspace created this way can produce a return covering all eighteen RPTI category codes where the imported data covers them — including the five infrastructure codes unreachable today.
- **SC-003**: Onboarding with returns of 300 rows each completes in under 60 seconds and leaves every screen usable afterwards.
- **SC-004**: 100% of rows that cannot be imported, and 100% of plan rows referencing something absent from the inventory, are reported to the user; none are dropped or guessed at silently.
- **SC-005**: A first-time visitor is presented with at most two ways to begin.
- **SC-006**: No capability available before this change becomes unreachable after it.
- **SC-007**: IT Planning can complete onboarding with an LKPTI alone, and the result is a usable workspace.
- **SC-008**: After onboarding, the first screen presented is the data-health review.

## Assumptions

- The returns available to IT Planning are in the same layouts the product already produces when
  exporting. A return that comes back from OJK in some other form is a different input, out of
  scope here.
- Onboarding targets an empty workspace and runs once. Merging further data into a populated
  workspace is the import/export feature's job, not onboarding's — which is what keeps
  judgement-based reconciliation out of the first-run experience.
- Imported data lands in the workspace itself, not in a separate import area. Everything the data-
  health review reports on is ordinary workspace state, which is why an unresolved plan reference
  needs no special reporting channel — it is simply a broken reference like any other. The cost is
  that an import cannot be undone in isolation; start over is the remedy, and it already exists.
- One portfolio entry per row, grouped under a technology area derived from the row's category —
  mirroring how the existing LKPTI import behaves, so both produce consistent shapes.
- "Unambiguous match" means an exact correspondence on the values both returns carry. Anything
  looser is judgement, and judgement is surfaced rather than automated. Expect this to under-match:
  the two returns are known to disagree on naming, so some rows that *are* the same thing will be
  reported as unresolved. Reporting a real item for review is a better failure than silently
  creating a duplicate of it.
- The data-health review is the place unresolved references surface. It is already a dense screen
  on a sparse workspace, and a freshly imported workspace is sparse — so onboarding will deliver a
  long list. Making that list workable is a known, separate concern.
- Rows naming the same item are not de-duplicated within a single return.
- Removing the technology-area catalogue from the starting screen loses nothing, because those
  areas can already be added from inside the product.
- No change is made to how returns are generated, validated, or scoped to a period; that is the
  next piece of work.
- "Upgrade" and "new" are values the return itself carries, so distinguishing them reflects filed
  data rather than an invented distinction.
