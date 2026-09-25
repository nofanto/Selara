# Recording an RPTI Row

RPTI Format 3.1 records planned application and infrastructure work. Generate the filing from **Reports → RPTI Report** after choosing its year.

## Target and cost

Each live phase linked to an initiative contributes one generated row for its own Deliverable. An initiative can therefore file several implementations or several Deliverables. Enter the row's **Filed CapEx**, **Filed OpEx**, and **RPTI Remarks (Keterangan)** on that live lifecycle segment. Infrastructure is also a Deliverable under an Asset; a bare Asset is not a supported filing target.

The initiative's CapEx and OpEx remain separate, editable portfolio figures used by the timeline, mobile cards, and Budget report. They do not feed the RPTI filing. Data Health shows a warning when the initiative budget and the total of its implementations differ; this is a review prompt, not an export blocker, because the two figures may legitimately diverge.

The live segment supplies the row's target. There is no initiative-level filing target: choose the Deliverable on each implementation's lifecycle segment instead.

If a stored row's target is missing, create or repair the Deliverable on **Data Manager → Deliverables**, then open the implementation's lifecycle segment panel on the **Visualiser timeline** and select that Deliverable together with its Initiative. These errors are shown before export, even when there is no stored RPTI row.

This repair does not carry over what the return filed, and clearing the error does not mean the row is right. Enter the filed values yourself: the category code, developer and DC/DR locations on the Deliverable; on a new segment, **Filed CapEx**, **Filed OpEx** and **RPTI Remarks (Keterangan)** in the lifecycle segment panel; and, for an upgrade, an earlier live segment on the Deliverable, or it files as new. The error message lists what the filed row stated so you can copy it. The most common case is a planned upgrade the import could not match to exactly one entry in your inventory (the two returns often name things differently). For that case, the message quotes the Initiative's current budget: the import set it from the filed row, but check it against your filed return if it has been edited since.

A row imported or generated from a specific lifecycle segment stays tied to that segment. If the segment, or the Deliverable it belonged to, has been deleted, recreating it does not clear the error: a new segment is a different implementation, and a filed row is never moved onto another one. Restore a saved version from before the deletion on the [History tab](../10-version-history/restoring-a-version.md), or re-import the filing.

## Generated values

Each live lifecycle segment linked to a real initiative files one row in the year its live phase starts. Planned and funded phases are run-up only: if go-live is next year, the current year files no row. The row's planned implementation quarter, cost, and remarks come from that live segment. It is **new** if the Deliverable had no live phase starting before that go-live, and an **upgrade** otherwise — so where one application goes live twice in a year, the first row is **new** and the second is an **upgrade** to it. Category and DC/DR locations come from the Deliverable, falling back to its Asset Category. Developer and related-party attributes come from the Deliverable. Imported rows seed both the segment's filed cost and the initiative's portfolio budget.

**Data Manager → RPTI** displays stored rows and their fields for reference, including unresolved imports. It has no row editing or generation controls. Generating a report does not overwrite those stored rows.

## Default Currency

Set the workspace currency in **Visualiser → More → Default Currency**. This labels amounts; it does not convert them.

- Next: [Exporting the RPTI Report](exporting-the-rpti-report.md)
