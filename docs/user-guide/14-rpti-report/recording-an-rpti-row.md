# Recording an RPTI Row

RPTI Format 3.1 records planned application and infrastructure work. Generate the filing from **Reports → RPTI Report** after choosing its year.

## Target and cost

Each live phase linked to an initiative contributes one generated row for its own Deliverable. An initiative can therefore file several implementations or several Deliverables. Enter the row's **Filed CapEx**, **Filed OpEx**, and **RPTI Remarks (Keterangan)** on that live lifecycle segment. Infrastructure is also a Deliverable under an Asset; a bare Asset is not a supported filing target.

The initiative's CapEx and OpEx remain separate, editable portfolio figures used by the timeline, mobile cards, and Budget report. They do not feed the RPTI filing. Data Health shows a warning when the initiative budget and the total of its implementations differ; this is a review prompt, not an export blocker, because the two figures may legitimately diverge.

The live segment supplies the row's target. There is no initiative-level filing target: choose the Deliverable on each implementation's lifecycle segment instead.

## Repairing an unresolved imported upgrade

When an imported upgrade could not be matched to exactly one inventory entry, select **Repair** beside its finding in **Reports → Data Health** or the RPTI pre-export gate.

- **The bank runs it, but the inventory doesn't list it (B).** For a missing application, review the pre-filled name, category, developer, related party, DC/DR locations and Keterangan. CapEx and OpEx are the **initiative's current budget**, which the import seeded from the filed row; check them against the filed return. The filed quarter and year are read-only. If the developer is PPJTI, enter the provider's actual name. Confirm creates the application under its own Asset, its prior live history and the filed implementation, and moves the initiative to that Asset. The prior history runs from 1 January of the year before the filing through the planning horizon. For the sample's 2027 Legacy Teller upgrade, this also adds the application to a regenerated **2026** inventory, raising it from 13 to 14 entries; the form states this before confirmation.
- **It's this existing entry (A).** Search the inventory and choose the application or infrastructure entry yourself. Likely matches are suggested, with nothing pre-selected. For each differing category, developer, related party or DC/DR value, choose **Update** to use the filed value or **Keep** to use the entry's current value. Updating also changes the LKPTI inventory. A developer update to PPJTI requires the provider's name. If the entry has no live history before the filed quarter, the form shows the continuous prior history it will add. Infrastructure rows offer only this option.

Confirm creates the live implementation in the filed quarter with the confirmed cost and Keterangan. The stored filed row remains unchanged, the finding clears, and **Undo** reverses the repair in one step. **Cancel** changes nothing.

### Manual fallback

To repair an unresolved row by hand, create or repair its Deliverable on **Data Manager → Deliverables**, then open the implementation's lifecycle segment panel on the **Visualiser timeline** and select that Deliverable together with its Initiative. Enter the filed category code, developer, related party and DC/DR locations on the Deliverable; enter **Filed CapEx**, **Filed OpEx** and **RPTI Remarks (Keterangan)** on the live segment in the filed quarter. For an upgrade without earlier live history, add an unlinked live phase from 1 January of the year before the filing through the planning horizon, or the implementation files as new. Move the initiative to the Deliverable's Asset if necessary.

The finding lists the filed values for this fallback. Its cost figures come from the initiative's current budget, so check them against your filed return if that budget has changed since import. Clearing the error alone does not verify those values. Creating a Deliverable in Data Manager does not create its lifecycle segments.

A row imported or generated from a specific lifecycle segment stays tied to that segment. If the segment, or the Deliverable it belonged to, has been deleted, recreating it does not clear the error: a new segment is a different implementation, and a filed row is never moved onto another one. Restore a saved version from before the deletion on the [History tab](../10-version-history/restoring-a-version.md), or re-import the filing.

## Generated values

Each live lifecycle segment linked to a real initiative files one row in the year its live phase starts. Planned and funded phases are run-up only: if go-live is next year, the current year files no row. The row's planned implementation quarter, cost, and remarks come from that live segment. It is **new** if the Deliverable had no live phase starting before that go-live, and an **upgrade** otherwise — so where one application goes live twice in a year, the first row is **new** and the second is an **upgrade** to it. Category and DC/DR locations come from the Deliverable, falling back to its Asset Category. Developer and related-party attributes come from the Deliverable. Imported rows seed both the segment's filed cost and the initiative's portfolio budget.

**Data Manager → RPTI** displays stored rows and their fields for reference, including unresolved imports. It has no row editing or generation controls. Generating a report does not overwrite those stored rows.

## Default Currency

Set the workspace currency in **Visualiser → More → Default Currency**. This labels amounts; it does not convert them.

- Next: [Exporting the RPTI Report](exporting-the-rpti-report.md)
