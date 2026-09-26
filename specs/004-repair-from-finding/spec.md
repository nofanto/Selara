# Feature Specification: Repair an Unresolved Imported RPTI Row from Its Finding

**Feature Branch**: `051-repair-from-finding`

**Created**: 2026-09-25

**Status**: Implemented (2026-09-26)

**Input**: User description: "Semi-automatic repair of an unresolved imported RPTI row, started from the finding (#51)." The full brief, with its context list, decisions and scope, is recorded in this feature's history. The decisions it carries are **Q22** in `requirement-specs/report-rows-as-projections.md`, and this spec implements them rather than reopening them.

## Background

When the RPTI import cannot attach a filed **upgrade** to exactly one entry in the inventory, it holds the row back instead of guessing (FR-019). The two returns often name the same application differently. The row is kept as read-only evidence, its initiative is parked under an unrelated asset, and export is blocked until the preparer repairs it.

Today the only repair is manual, across the Deliverables tab and the Visualiser's lifecycle segment panel. Measured on the published sample returns, the obvious manual repair clears the export gate while the return files values the bank never filed:

| Column | Filed | After the obvious manual repair |
|---|---|---|
| Development type | upgrade | new |
| CapEx / OpEx | 2,900,000,000 / 640,000,000 | 0 / 0 |
| Keterangan | "Not present in the 2026 LKPTI — needs a target." | empty |
| Category code | 12 | 01 |
| Developer, DC, DR | inhouse, Jakarta, Surabaya | blank |

Nothing warns about any of it. An interim change (commits `d951ff5`, `9e38187`, rebased from `5b97347`, `9c9a22d`) made the error message list every filed value so a careful preparer can re-key them. This feature removes the re-keying: the repair starts from the finding, arrives pre-filled with what the return filed, and needs only the preparer's judgement and confirmation. That is what spec 002's FR-025 requires: *"Nothing MUST require the preparer to re-key a value the return already supplied."*

**An unresolved row is always an upgrade.** A row filed as `new` always creates its application. An upgrade is held back when it matches **no** entry (applications only, since unmatched infrastructure is created automatically under FR-019a) or **several** entries (applications or infrastructure).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The bank runs it, but the inventory doesn't list it (Priority: P1)

A preparer imports the LKPTI and RPTI. One planned upgrade, "Legacy Teller Application", matches nothing in the inventory, because the inventory genuinely omits it. From the finding, the preparer chooses **"The bank runs it, but the inventory doesn't list it."** A form opens already filled in from the filed row. It shows the application name, category, developer, DC/DR locations, planned quarter and year, Keterangan, and CapEx/OpEx taken from the initiative's budget. It also shows the live history that will be created before the filed quarter. The preparer checks the values and confirms. The application, its live history and the filed implementation now exist, the initiative sits under the application's own asset, and the finding is gone. The regenerated return states exactly what was filed.

**Why this priority**: This is the published sample's case, and the one that silently misfiles today. On its own it removes the re-keying and the silent misfiling for the most common cause.

**Independent Test**: Import both sample returns, repair the Legacy Teller row with this option without editing any pre-filled value, and generate the 2027 RPTI. That row must match the filed row in every column, and the export gate must be clear.

**Acceptance Scenarios**:

1. **Given** an unresolved imported upgrade row for an application, **When** the preparer opens its finding, **Then** "The bank runs it, but the inventory doesn't list it" is offered, and choosing it shows a form pre-filled from the filed row, with no value blank that the return supplied.
2. **Given** the pre-filled form, **When** the preparer confirms without changes, **Then** a Deliverable with its own Asset exists. It carries the filed category, developer, related party and DC/DR, has continuous live history before the filed quarter, and has a live implementation starting in the filed quarter that is linked to the initiative and carries the filed CapEx, OpEx and Keterangan.
3. **Given** the repair is confirmed, **When** the RPTI for the filed year is generated, **Then** the row is typed `upgrade`, in the filed quarter, and every other column equals the filed row, and no finding remains for it.
4. **Given** the repair is confirmed, **When** the preparer looks at the Visualiser, **Then** the initiative sits under the new application's asset, not under the unrelated asset it was parked on.
5. **Given** the filed row states `PPJTI`, **When** the form opens, **Then** it asks for the provider's name, because the return states only that a provider was used, and shows the filed related party.
6. **Given** the initiative's budget was edited after import, **When** the form opens, **Then** CapEx and OpEx show the current budget, labelled as the initiative's current budget and not as the filed figures, for the preparer to check against the filed return.

---

### User Story 2 - It's this existing entry (Priority: P2)

The inventory does list the application, under a different name, or it lists several entries of that name. From the finding, the preparer chooses **"It's this existing entry"**. Likely candidates are suggested at the top, and nothing is chosen for them. The preparer picks one. The form shows the filed implementation that will be created on it. If the chosen entry has no live history before the filed quarter, the form also shows the prior live history that will be added. Where the entry's category, developer, related party or DC/DR differ from the filed row, the form lists each difference and the preparer decides, field by field, whether to update the entry or keep it. On confirm, the filed implementation exists on the chosen entry and the finding is gone.

**Why this priority**: This covers a naming mismatch between the two returns, the reason FR-019 holds rows back in the first place. It is also the only way to resolve ambiguous infrastructure. It ranks after P1 because the published sample has no near match, so P1 alone already fixes the sample.

**Independent Test**: In a workspace where the inventory lists the application under another name, repair the row by choosing that entry and confirm. The regenerated row must be typed `upgrade` in the filed quarter with the filed cost and Keterangan. Every per-field choice must be reflected: an updated field files the filed value, and a kept field files the entry's own value.

**Acceptance Scenarios**:

1. **Given** an unresolved row and an inventory entry with a similar name, **When** the preparer chooses "It's this existing entry", **Then** that entry is suggested among the candidates, and no candidate is pre-selected.
2. **Given** an unresolved infrastructure row (several same-named entries), **When** the preparer opens its finding, **Then** only "It's this existing entry" is offered, and the same-named entries are the suggested candidates.
3. **Given** a chosen entry with no live history before the filed quarter, **When** the form is shown, **Then** it states that prior live history will be added, and on confirm the row files as `upgrade`.
4. **Given** a chosen entry whose category differs from the filed row, **When** the form is shown, **Then** it shows the filed and current values side by side. Choosing "update" changes the entry, so both the RPTI and the LKPTI state the filed value. Choosing "keep" leaves it unchanged, and the RPTI files the entry's value.
5. **Given** a chosen entry whose attributes all match the filed row, **When** the form is shown, **Then** no field-difference choices are shown.

---

### User Story 3 - Imports close the upgrade inventory gap (Priority: P3)

An upgrade to an application with no live history of its own, such as an application created by this repair or one the import matched in a hand-built workspace, stays in the inventory for every year of the planning horizon. Previously it dropped out in its upgrade year unless it was filed for Q4 (Q21, consequence 2). Infrastructure is never in the LKPTI (Daftar Aplikasi lists applications only), so for infrastructure the continuous phase changes only the timeline. *(Corrected 2026-09-25 after `/speckit-analyze` I1: the first version cited infrastructure as an example of the inventory gap.)*

**Why this priority**: The repair's prior live history (P1, P2) and the importer's synthetic prior phase must follow one rule, or the same situation behaves two ways. The importer half matters to fewer workspaces, so it comes last.

**Independent Test**: Into a workspace holding an application with no live history, import an RPTI whose Q2 upgrade matches that application exactly, so the import adds a synthetic prior phase. Generate the LKPTI inventory for each year from the year before the filed year through the horizon. The entry must be present in every one.

**Acceptance Scenarios**:

1. **Given** an imported upgrade row that gets a synthetic prior live phase, **When** the inventory is generated as at 31 December of the filed year, **Then** the entry is present, whatever the filed quarter.
2. **Given** the same import, **When** the RPTI for the filed year is generated, **Then** the row is still typed `upgrade`, and the prior live phase files no row of its own in the filed year.
3. **Given** a workspace imported before this feature, with an importer-created prior phase in its original one-year shape that leaves an entry out of an inventory year, **When** the preparer opens Data Health, **Then** a non-blocking warning names the entry and the missing years. The phase is unchanged until the preparer confirms the offered extension. After confirming, the entry is present in those years and the warning is gone.
4. **Given** the preparer edited that prior phase, **When** Data Health runs, **Then** no warning is shown for it.

---

### Edge Cases

- **Finding for a deleted Deliverable, not an unresolved import.** This repair is offered only for rows the import held back. A row whose Deliverable was deleted keeps the existing repair advice. If the row is also tied to a deleted implementation, the advice is to restore or re-import (already shipped).
- **The preparer changes a pre-filled value.** Name, provider name, CapEx, OpEx and Keterangan are editable before confirming. The filed quarter and year are not; see Assumptions.
- **The preparer cancels.** Nothing is created or changed, and the finding remains.
- **The initiative was renamed after import, so the name has no ` — Qn YYYY` suffix.** The name field is pre-filled with the initiative's current name. The year comes from the initiative's start date instead (see Assumptions). The preparer confirms both.
- **The initiative already has a live implementation.** This finding cannot then exist. An unresolved row has no anchor, so reconciliation matches it to the initiative's only live implementation, and with several it raises an identity conflict instead. The repair therefore always starts from an initiative with no live implementation. If one appears while the form is open, confirming MUST re-check and refuse rather than create a second one.
- **Two unresolved rows name the same missing application** (two filed upgrades of one application in different quarters). Repairing the first with B creates the application. The second must then be repairable with A against it, and must be suggested first.
- **An empty inventory.** "It's this existing entry" has no candidates and says so. For an application, B is still offered.
- **Very large inventories (hundreds of applications, #36).** Suggestions must stay immediate, and the candidate list must be searchable instead of one unbounded list.

## Requirements *(mandatory)*

### Functional Requirements

**Starting point**

- **FR-001**: The repair MUST be started from the unresolved row's finding, wherever that finding is shown: the Data Health review and the RPTI pre-export gate. It MUST NOT be offered for any other finding.
- **FR-002**: For a row whose filed category is an application category, the finding MUST offer both resolutions: "It's this existing entry" (A) and "The bank runs it, but the inventory doesn't list it" (B). For an infrastructure category it MUST offer only A, because entries of that name exist and B would duplicate one.
- **FR-003**: Creating a Deliverable anywhere else, such as the Data Manager or the timeline, MUST behave exactly as it does today. In particular it creates no lifecycle segment by default.

**Pre-filled values**

- **FR-004**: The form MUST pre-fill each value from its source, and MUST NOT leave blank any value the return supplied:
  - **From the stored row:** category code, developer, related party, DC city and country, DR city and country, planned quarter, Keterangan.
  - **From the imported initiative's name**, minus its ` — Qn YYYY` suffix: the application name.
  - **From the initiative's current budget:** CapEx and OpEx.
  - **From the initiative's name suffix, or else its start date:** the filed year.
- **FR-005**: CapEx and OpEx MUST be labelled as the initiative's current budget, which the import set from the filed row, and the form MUST prompt a check against the filed return. The system keeps no copy of the filed figures (FR-026 of spec 002), so it MUST NOT present the budget as the filed values.
- **FR-006**: Where the filed developer is `PPJTI` and the repair will write a developer, the form MUST ask for the provider's name and MUST NOT accept `PPJTI` as the name. That covers B always, and A when the preparer chooses "update" for a developer difference (for example, a filed `PPJTI` against an entry whose developer is `inhouse`). The return states only that a provider was used, so the name exists nowhere else. *(A case added 2026-09-25 after `/speckit-analyze` U1.)*
- **FR-007**: The stored row MUST NOT be modified by any part of the repair (Q12).

**What confirming creates**

- **FR-008**: Confirming MUST create one live implementation on the resolved Deliverable. It starts on the first day of the filed quarter of the filed year, ends as an upgrade's live implementation does on import (the filed quarter only, Q21), is linked to the row's initiative, and carries the confirmed CapEx, OpEx and Keterangan.
- **FR-009**: Confirming MUST move the initiative to the resolved Deliverable's asset.
- **FR-010**: With B, confirming MUST create the Deliverable together with its own Asset, carrying the confirmed name, category, developer, related party and DC/DR. It MUST also create a continuous prior live phase: live from 1 January of the year before the filed year through the shared planning horizon for the filed year, the same horizon both importers use.
- **FR-010a**: Before confirming B, the form MUST state the first inventory year the prior phase adds the application to: the year before the filed year, for example 2026 for a 2027 filing. A regenerated return for that year will then list an application the filed one omitted (confirmed by the product owner, 2026-09-25; plan, Complexity Tracking). *(Added after `/speckit-analyze` I2.)*
- **FR-011**: With A, if the chosen entry has no live phase starting before the filed quarter, confirming MUST add the same continuous prior live phase as FR-010, and the form MUST show it before confirmation. If the entry already has such history, nothing is added.
- **FR-012**: With A, for each of category, developer, related party and DC/DR where the chosen entry differs from the filed row, the form MUST show both values and require an explicit choice: update the entry to the filed value, or keep the entry's value. A field with no difference MUST NOT ask. No value changes without that choice.
- **FR-013**: After confirming, the stored row MUST reconcile with the new implementation, and its finding MUST disappear, without the preparer taking any further step.
- **FR-014**: A repair MUST be applied as one change: either everything in FR-008 to FR-012 happens, or nothing does.

**Choosing an existing entry (A)**

- **FR-015**: Candidates MUST be the inventory's entries of the same kind: applications for an application row, infrastructure for an infrastructure row. Likely matches MUST be suggested first: the same name ignoring case and spacing, then similar names in the same category. No candidate may be pre-selected, and the preparer MUST make the choice (FR-019 of spec 001).
- **FR-016**: The candidate list MUST be searchable by name.

**Importer consistency**

- **FR-017**: The RPTI importer's synthetic prior live phase MUST follow the same rule as FR-010: continuous from 1 January of the year before the filed year through the planning horizon. It MUST still be added only when the target has no live history before the filed quarter.
- **FR-018**: Synthetic prior phases already in existing workspaces, created under the one-year rule, MUST NOT be changed automatically *(product owner, 2026-09-25)*.
- **FR-018a**: Where such a phase still has exactly the importer's original one-year shape, and that shape actually leaves its entry out of an inventory year it would be in under FR-017, Data Health MUST show a **non-blocking** warning. The warning names the entry and the years it is missing from, and offers to extend the phase to the new rule. The extension happens only when the preparer confirms it from the warning. A phase the preparer has edited is not the importer's shape, so it raises no warning. **Amended 2026-09-26 (product owner, Q22 option B):** for a prior phase covering year Y, only missing year-ends Y+1 through Y+6 before the earliest later post-live segment on that Deliverable count; post-live means neither live nor pre-launch, starting after Y-12-31. If no missing year remains, show no warning. Extend stops at the earlier of the shared horizon and the day before that post-live segment; with no such segment, behaviour is unchanged.

**Records**

- **FR-019**: Any new stored field this feature adds MUST be declared in the version-history field policy, so version comparisons see it (#42).

### Key Entities

- **Unresolved RPTI row**: a stored, read-only filed row whose target the import could not resolve. It supplies category, developer, related party, DC/DR, planned quarter and Keterangan. It holds no name, cost or year.
- **Initiative (imported)**: the filed plan item behind the row. Its name carries the application name and filed quarter and year as imported, and its budget carries the imported CapEx and OpEx, possibly edited since.
- **Deliverable and its Asset**: the application or infrastructure entry the row resolves to. It is created by B, or chosen and possibly updated by A. It owns the category, developer, related party and DC/DR, which feed both returns.
- **Live implementation (lifecycle segment)**: the filed implementation, which carries the quarter, cost and Keterangan and links the Deliverable to the initiative.
- **Prior live phase**: the history that makes the implementation an upgrade and keeps the entry in the inventory through the horizon.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the published sample returns, repairing the Legacy Teller row with B, without editing any pre-filled value, regenerates a 2027 RPTI row equal to the filed row in **every** column, and the export gate has **zero** findings. This is measured by a round-trip test, not asserted.
- **SC-002**: A repair re-keys **zero** values the return supplied. Every filed value appears in the form before any typing, and the only required inputs are the preparer's judgements: which option, which entry, which per-field choice, and a PPJTI provider's name.
- **SC-003**: For each resolution path (B; A with matching attributes; A with differing attributes, each field choice; A on an entry without prior history), the regenerated row is typed `upgrade` and in the filed quarter, and **no** field changes without the preparer's explicit choice.
- **SC-004**: The LKPTI inventory counts on the sample, as at 31 December for each year 2026 to 2032, are **re-measured** after this feature both before and after the Legacy Teller repair, and recorded against Q21's baseline of 13, 16, 16, 16, 16, 16, 3. Every difference is explained.
- **SC-005**: With an inventory of 300 applications, ranking the candidates for one row finishes in under 2 seconds. That is the budget the existing 300-application scale check (`src/lib/scale.test.ts`) applies to generating both returns plus reconciliation, and ranking must fit inside it with room to spare. Repairing one row is a single workspace save, the same cost as any other edit. *(Made measurable 2026-09-25 after `/speckit-analyze` A1.)*
- **SC-006**: A preparer can complete a B repair of the sample row from the finding in under one minute, and an A repair with one field difference in under two. This is a **manual** check by the product owner, recorded in `quickstart.md`, and is not automated: a timed E2E would measure the test runner, not a preparer.

## Assumptions

- **The filed quarter and year are shown but not editable in the form.** They identify which return and which implementation the row is. Rescheduling the work is ordinary timeline editing after the repair, where its effect on the filing is already visible.
- **The filed year is pre-filled from the initiative name's ` — Qn YYYY` suffix when present, else from the initiative's start date.** The stored row carries no year (a known limit of the current model), and the importer sets both from the filed year.
- **The prior live phase is one continuous phase that overlaps the filed implementation's quarter.** It is not split around that quarter. This matches how an LKPTI-imported application looks: its inventory phase runs to the horizon while upgrades are separate implementations. It changes neither the RPTI nor the LKPTI output compared with a split phase.
- **"Similar names" for suggestions** means a case- and spacing-insensitive comparison that also ranks names sharing most of their words. The exact ranking is a planning decision. What is fixed is that nothing is chosen automatically.
- **The feature adds no new stored entity or data store.** It creates and updates existing records: Deliverable, Asset, lifecycle segment and Initiative. FR-019 applies only if planning finds a new field necessary.
- **The user-facing documentation** is a new user story in `docs/user-stories/` and an update to the RPTI user-guide page that today describes the manual repair.
- **Out of scope:** rows tied to a deleted implementation (decided: restore or re-import, already shipped); duplicate issues for one row in Data Health; the year-bearing report ledger ("option 5"); any change to FR-019's refusal to match automatically across returns.
- **Rejected, and not to be reintroduced (Q22):** a default live segment whenever a Deliverable is created; a "this is a new application" option, which contradicts the filed `upgrade`; editing the stored row's identity (Q12).
