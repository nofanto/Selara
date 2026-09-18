# Feature Specification: Report Year and Report-Row Field Ownership

**Feature Branch**: `002-report-year-field-ownership`

**Created**: 2026-09-18

**Status**: Draft

**Input**: Store the OJK report year, and move report-row fields onto the entities they describe. Implements [#40](https://github.com/nofanto/Selara/issues/40) and the decisions recorded in `requirement-specs/report-rows-as-projections.md` (Q1–Q6, decided 2026-09-17/18).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Import a return, fix what is flagged, generate the same return back (Priority: P1)

IT Planning imports last year's filed returns, repairs whatever the data-health review flags, and generates the RPTI and LKPTI. What comes out matches what went in.

**Why this priority**: This is the product's central claim, and it does not hold today. Discarding the imported rows and regenerating from the same workspace loses eight LKPTI fields on every row and four RPTI ones, because the filed return is the only place those values exist. Until the round trip is faithful, "generate your return from your portfolio" is not something the tool can honestly offer.

**Independent Test**: Import the sample returns, change nothing, generate both, and compare field by field against the imported files. Then repeat after repairing each issue the data-health review raises, and confirm the remaining differences go to zero.

**Acceptance Scenarios**:

1. **Given** a freshly imported LKPTI, **When** the LKPTI is generated for the same as-at year with nothing repaired, **Then** every value the return supplied is present and unchanged.
2. **Given** a freshly imported RPTI, **When** the RPTI is generated for the same report year, **Then** every row the return supplied is reproduced with the same development type, quarter and figures.
3. **Given** an imported row the data-health review flags as unreproducible — an upgrade whose target was never found — **When** the preparer repairs it, **Then** it is reproduced on the next generation.
4. **Given** an imported row that has **not** been repaired, **When** the return is generated, **Then** the preparer is told it will be absent, before the file is produced.

---

### User Story 2 - Generate a return for a stated year, and only that year (Priority: P1)

IT Planning prepares the 2027 plan. Next cycle, the same workspace carries work for 2028. Generating the RPTI for 2027 asks which year, and produces that year's return and nothing else.

**Why this priority**: Today the export takes no year and does no filtering, so a workspace holding two plan years files them to OJK as a single return with no warning. This is the only consequence in the set that produces a materially wrong regulatory submission, and the user cannot see it happening because nothing on screen distinguishes one year's rows from another's.

**Independent Test**: Build a workspace with planned work spanning two report years, generate each in turn, and confirm each return contains only its own year and says which year it covers.

**Acceptance Scenarios**:

1. **Given** a workspace with planned work in both 2027 and 2028, **When** the preparer generates the RPTI for 2027, **Then** the return contains only 2027's work.
2. **Given** the same workspace, **When** the preparer generates for 2028 immediately afterwards, **Then** the 2027 return required no undoing and can be produced again unchanged.
3. **Given** any generated return, **When** the preparer looks at it or at the exported file, **Then** the year it covers is stated.
4. **Given** the preparer has never told the system a year, **When** they generate a return, **Then** they are asked — no year is taken from the system clock.

---

### User Story 3 - Application attributes are held on the application (Priority: P2)

The preparer records that an application runs on PostgreSQL, is operated by a named provider, and is owned by a named person. Those facts belong to the application and stay with it, regardless of which return is being prepared or how often rows are regenerated.

**Why this priority**: Eight fields carrying data that exists nowhere else — `platform`, `database`, `dcProvider`, `drcProvider`, `backupStrategy`, `systemOwner`, `ownership`, and the provider name in `developer` — currently live on the LKPTI report row because it is the only record that can hold them. That conflation is why report rows cannot be regenerated freely, and why an entire merge-preserving mechanism exists. Moving them is the prerequisite for everything in the destination described by the design notes.

**Independent Test**: Record the eight attributes against an application, regenerate the LKPTI rows, and confirm every value is still present and was never at risk.

**Acceptance Scenarios**:

1. **Given** an application with all eight attributes recorded, **When** the LKPTI rows are regenerated, **Then** no attribute is lost or altered.
2. **Given** an imported LKPTI return, **When** the import completes, **Then** the eight attributes from the filed return are recorded against the applications, not only against the report rows.
3. **Given** an application whose provider is a named company, **When** the LKPTI is exported, **Then** the provider name appears in the return exactly as before this change.
4. **Given** a preparer editing an application, **When** they look for where to record its platform or system owner, **Then** there is exactly one place to do so.
5. **Given** a saved version from before an attribute was changed, **When** the difference report is run, **Then** the change to that attribute is listed.

---

### User Story 4 - The reporting years given at onboarding are not wasted (Priority: P3)

At onboarding the preparer states which year each uploaded return covers — an inventory as at 2026 alongside a plan for 2027. Those answers are retained, so nothing later has to guess or ask again.

**Why this priority**: Onboarding already asks the right question and discards both answers — the RPTI year survives only as one line of a notification, and the LKPTI year never reaches the importer at all. With the year now asked at generation time, remembering what was imported is a convenience rather than a correctness fix, which is why it ranks below the others.

**Independent Test**: Import two returns with different years, then confirm that generation and export operate on the stated year without asking again.

**Acceptance Scenarios**:

1. **Given** an RPTI imported as the 2027 plan, **When** the preparer generates the RPTI, **Then** 2027 is what they are offered, rather than the current calendar year.
2. **Given** an LKPTI imported as the 2026 inventory, **When** the preparer generates the LKPTI, **Then** 2026 is what they are offered as the as-at year.
3. **Given** a workspace created empty rather than by import, **When** the preparer generates a return, **Then** they state the year themselves and nothing is assumed.

---

### Edge Cases

- **A workspace with no report year recorded at all** — every existing workspace is in this state. Preparing a return must remain possible, and whatever year is used must be visible rather than silently assumed from the system clock.
- **Rows that cannot be regenerated.** An imported upgrade whose target was never found in the inventory has no segment and no initiative link, so nothing can derive it. It must survive whatever the year model does, and must not become invisible by belonging to no year.
- **Pressing Generate on a workspace imported before this change.** The eight attributes exist on the old rows and nowhere else; a regenerate that rebuilds rows from applications would discard them. Either the values are lifted first, or the loss is stated plainly before it happens — it must not be silent.
- **An application whose provider answer differs across two of its rows.** Consolidating onto one record forces one answer; the preparer must be able to see which value was kept.
- **Two report years in one workspace where one has no rows yet.** Selecting an empty year must read as empty rather than as an error or as the other year's data.
- **A report year far from the current date** — a plan filed for a year already past, or prepared well ahead. Nothing should assume the report year is near today.

## Requirements *(mandatory)*

### Functional Requirements

**The report year**

- **FR-001**: The report year MUST be asked of the preparer when the RPTI return is generated from the Reports menu. It is a question at generation time, not a stored property of a row.
- **FR-001a**: Generating the RPTI MUST be the inverse of importing it: given a report year, the return is derived from the workspace, exactly as importing derived the workspace from a return for a stated year.
- **FR-001b**: Generating a return from the Reports menu MUST NOT alter the stored report rows. It produces the return for display and export, and leaves the workspace as it was.
- **FR-002**: A generated return MUST cover exactly one report year, and MUST contain only the work that falls in it.
- **FR-003**: A generated return MUST state the year it covers, both on screen and in whatever is exported from it.
- **FR-004**: The preparer MUST be able to generate a return for any year, without the workspace having been prepared for that year in advance.
- **FR-005**: A report year MUST never be inferred from the current date. It is stated by the preparer, or offered as a default they have seen and accepted.
- **FR-006**: Generating a return MUST NOT alter the workspace. Producing the 2027 return leaves everything exactly as it was, so producing it twice yields the same result.
- **FR-007**: Generating a return for a second year MUST be possible without undoing or redoing the work done for the first.
- **FR-008**: Where a report year was stated during onboarding, it MUST be what the preparer is offered when generating — rather than the current calendar year, and rather than nothing.
- **FR-009**: The LKPTI as-at year MUST be asked of the preparer when the LKPTI return is generated from the Reports menu, on the same footing as FR-001.
- **FR-009a**: LKPTI generation MUST list the applications that were live **as at 31 December of the stated year**, rather than as at today. This is what makes the year worth asking for, and it is the return's own definition.
- **FR-010**: A workspace that has never had a year stated MUST remain fully usable. There is nothing to recover or assume — the year is asked when a return is generated.

**Field ownership**

- **FR-011**: `platform`, `database`, `dcProvider`, `drcProvider`, `backupStrategy`, `systemOwner` and `ownership` MUST be recorded against the application they describe, not against a report row.
- **FR-012**: The application's developer field MUST be able to carry a named service provider, not only the two-value in-house/third-party classification it holds today.
- **FR-013**: The RPTI `Keterangan` commentary MUST be recorded against the initiative it describes. Its purpose MUST be distinguishable from the initiative's existing description, which supplies a different column of the same return.
- **FR-014**: The answer to whether a service provider is a related party MUST be recorded against the application, held per application.
- **FR-015**: Regenerating LKPTI or RPTI rows MUST NOT lose any value recorded under FR-011 to FR-014.
- **FR-016**: Every field introduced by FR-011 to FR-014 MUST appear in the version difference report when it changes. *(Version history compares only the fields it is told about; an unlisted field changes silently — see [#42](https://github.com/nofanto/Selara/issues/42).)*
- **FR-017**: Both returns MUST export exactly the values they export today, with one intended exception: an application whose live period ended before the as-at date correctly leaves the LKPTI (FR-009a). This change moves where data is held; apart from that correction it MUST NOT change what is filed.
- **FR-018**: The data-health checks that currently report these fields as missing MUST point the preparer at the place the value is now recorded.

**Round-trip fidelity**

- **FR-023**: Importing a return and generating it back for the same year MUST reproduce every value the return supplied, for rows that the workspace can reproduce at all.
- **FR-024**: Where a row cannot be reproduced, the preparer MUST be told before the return is produced, and told what to repair. A filed row MUST NOT be silently absent from a generated return. *(Revised 2026-09-18 per Q11: "told" means a reconciliation **finding** on the pre-export gate — stored rows are never carried into the return to make themselves visible, because that carry was #40's defect. A row reproducible only in another year is correctly absent and is not reported; a row the source model cannot reproduce in any year blocks every year's export until repaired, because no report year can be attributed to a stored row.)*
- **FR-025**: Repairing what the data-health review flags MUST be sufficient to make the round trip faithful. Nothing MUST require the preparer to re-key a value the return already supplied.
- **FR-026**: The system MUST NOT be required to hold a copy of what was imported. Confirming that a generated return matches the filed one is the preparer's own comparison, against the file they still have — they exported it from OJK's process and it does not stop existing when it is imported.
- **FR-027**: Because that comparison is manual, the system MUST make the differences it *can* detect loud rather than leaving all of them to the reader — FR-024 is what carries this, and it matters more than it would if the tool verified the round trip itself.

**Not losing what is already there**

- **FR-019**: A workspace created before this change MUST NOT silently lose the eight attributes. Either the values are carried onto the applications before any regeneration can replace the rows holding them, or the preparer is told plainly, before it happens, that regenerating will discard them.
- **FR-020**: An imported row that cannot be regenerated — because its target was never found in the inventory — MUST survive this change, and MUST remain visible and attributable to a report year.

**The Data Manager report tabs** *(section renamed 2026-09-18 — it read "Unchanged by this feature", which the read-only decision made false)*

- **FR-021**: Both Data Manager report tabs MUST become **read-only**. They remain present and populated — importing continues to fill them — but MUST NOT accept edits, because every field they show is derived from the Deliverable or Initiative that owns it. *(Unblocked 2026-09-18 by Q7, which removed the two fields — `capexAmount`/`opexAmount` — for which that justification was false.)* Generation moves to the Reports tab. *(Revised 2026-09-18, superseding the earlier decision to leave the tabs untouched: an editable screen whose edits cannot reach the filing is worse than one that says it is a projection.)*
- **FR-021a**: Every data-health finding that currently directs the preparer to one of those tabs MUST direct them instead to the entity that owns the value. A finding that points at a read-only screen tells the preparer where the problem is and not where to fix it.
- **FR-021b**: An imported row that cannot be reproduced MUST be repairable from the source side — by creating or correcting the application the filed plan refers to — and its data-health message MUST say so.
- **FR-028**: The cost of a plan line MUST be the initiative's own `capex`/`opex`. `RptiDetail.capexAmount` and `opexAmount` MUST be removed; there is no per-row override and no fallback chain (Q7).
- **FR-029**: An initiative MUST have at most one RPTI target. Generation MUST honour the initiative's own target rather than grouping by segment, so one initiative yields at most one row per report year.
- **FR-030**: An initiative without an explicit target whose lifecycle segments span more than one Deliverable MUST receive a data-health **error**, naming target selection or splitting into one initiative per target as the repair. Explicit targets take precedence over other timeline history. The error MUST block RPTI export, not timeline drawing. This supersedes the broad multiple-application rule (Q10); undeclared single-target initiatives infer their target across all years, including infrastructure.
- **FR-032**: An RPTI row MUST NOT target a bare Asset. Infrastructure is filed as OJK Format 3.1 requires, but an infrastructure item MUST be recorded as a Deliverable under its Asset, the same as an application (Q8).
- **FR-033**: An existing row targeting a bare Asset MUST raise a data-health **error** before export, naming the repair — record the item as a Deliverable under its Asset and point the initiative at it. Error, not warning: no generated return can reproduce such a row, so it otherwise leaves the filing in silence.
- **FR-031**: A hand-edited cost override that differs from its initiative's figure MUST be lifted onto the initiative before the fields are removed. Imported overrides already equal it and lift without change.
- **FR-022**: The LKPTI MUST remain a point-in-time inventory. Its as-at date selects which applications were live at a moment; it MUST NOT become a filter over a period the way the RPTI's report year is. *(FR-009a supplies that moment; this requirement constrains its meaning, not its existence.)*

### Key Entities *(include if feature involves data)*

- **Application (Deliverable)** — the thing a bank runs. Gains the attributes that describe it: what it is built on, who operates its data centres, who owns it, how it is backed up, how it was acquired, and whether its provider is a related party. Already carries name, type, category, and data-centre locations.
- **Initiative** — a piece of planned work. Gains the commentary that appears in the plan's remarks column, alongside the description it already supplies to that return.
- **RPTI row** — one line of the development plan for one report year. Gains a report year, or is grouped by one.
- **LKPTI row** — one line of the application inventory. Loses the eight attributes it was holding on the application's behalf; keeps what it derives.
- **Report year** — the period a plan covers. Newly persistent; the thing this feature exists to record.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Importing the sample returns and generating them straight back, with nothing repaired, reproduces **every** value the returns supplied for reproducible rows. Measured today the same way: this test currently loses eight LKPTI fields on all thirteen rows and four RPTI fields, so the number to reach is zero.
- **SC-001a**: After repairing everything the data-health review flags, the generated returns differ from the imported ones in **no** row and **no** field.
- **SC-002**: Every generated return states the year it covers, on screen and in the exported file.
- **SC-003**: Regenerating report rows loses none of the fourteen values a filed return supplies that generation cannot derive — measured by importing the sample returns, regenerating, and comparing field by field.
- **SC-004**: Each post-feature export states the preparer-selected year and preserves every
  pre-existing filed value required by FR-017. Byte identity with a pre-feature file is neither
  expected nor meaningful, because that file did not state its selected year.
- **SC-005**: A workspace imported before this change either retains its attributes through a regeneration, or shows the preparer a warning naming what will be lost before it happens. Silent loss occurs in no path.
- **SC-006**: Changing any newly relocated field appears in the version difference report.
- **SC-007**: Preparing a return never uses a report year the preparer has not seen and confirmed.
- **SC-008**: At 300 applications, generating a return for a stated year stays within the responsiveness of generating one today.
- **SC-009**: No row present in an imported return is absent from a generated one without the preparer having been told, in every path that produces a file.

## Assumptions

- **A workspace holds the portfolio, not a year's worth of it.** The report year is a question asked when a return is produced, so the same workspace can yield a 2027 and a 2028 return without either being stored or destroying the other.
- **The LKPTI's year is an as-at date, not a filter.** The return is a point-in-time inventory — applications live as at 31 December of the stated year — so asking the year changes which applications qualify, rather than selecting among stored rows.
- **The Data Manager report tabs are on their way out.** They stay in this spec (Q5/Q6), but the destination is that returns are produced from the Reports menu and the tabs are removed. Nothing here should make that harder.
- **Existing workspaces are few and known.** Migration tooling is deliberately out of scope (Q4 of the design notes); only the hazard of silent loss on regeneration is in scope here.
- **The report year is a calendar year**, matching how both returns are filed, rather than a fiscal year offset.
- **Exports remain unchanged in content.** This is a change to where data is held, not to what OJK receives; any difference in an exported file is a defect.
- **The eight attributes apply to any deliverable, not only applications.** A bank leases servers and its data centres have providers. The LKPTI report is applications-only; the attributes are not.

## Dependencies

- [#40](https://github.com/nofanto/Selara/issues/40) — this specification implements it.
- `requirement-specs/report-rows-as-projections.md` — Q1, Q2, Q3 fix where each field goes; Q4 defers migration; Q5/Q6 keep both tabs unchanged. Q11 (decided 2026-09-18) makes the RPTI path a pure projection with a separate reconciliation gate, closing #40's year-leak defect. These are settled and are not re-opened here.
- [#42](https://github.com/nofanto/Selara/issues/42) — version history compares only listed fields, so FR-016 is a real requirement rather than an assumption.
- [#38](https://github.com/nofanto/Selara/issues/38) — the unresolved imported row that FR-020 must keep alive.

## Out of Scope

- **Emptying** either Data Manager report tab, or **removing** them. Still deferred. *(Revised 2026-09-18: making them read-only and moving generation to Reports is now IN scope per FR-021 — what stays out is deleting the tabs and ceasing to store the rows.)*
- A supplier or vendor entity. The related-party answer is held per application, with the resulting duplication accepted and recorded.
- Migration tooling for existing workspaces, exported files, shared files or saved versions.
- A filing or revision record. Freezing what was actually submitted is the natural home for a report year and is recorded as the next step, but it is a separate piece of work.
- Whether a genuine filed RPTI can be read at all ([#47](https://github.com/nofanto/Selara/issues/47)).
