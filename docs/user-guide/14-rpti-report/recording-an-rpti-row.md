# Recording an RPTI Row

RPTI Format 3.1 records planned application and infrastructure work. Generate the filing from **Reports → RPTI Report** after choosing its year.

## Target and cost

Each live phase linked to an initiative contributes one generated row for its own Deliverable. An initiative can therefore file several implementations or several Deliverables. Generated rows currently use the initiative's CapEx and OpEx. Infrastructure is also a Deliverable under an Asset; a bare Asset is not a supported filing target.

The live segment supplies the row's target. The **Deliverable** column in **Data Manager → Initiatives** remains available for declaring the initiative's target where one is known.

If a stored row's target is missing, create or repair the Deliverable on **Data Manager → Deliverables**, select it in the Initiative's **Deliverable** column on **Data Manager → Initiatives**, and add a live segment linking the pair on the **Visualiser timeline**. These errors are shown before export, even when there is no stored RPTI row.

## Generated values

Each live lifecycle segment linked to a real initiative files one row in the year its live phase starts. Planned and funded phases are run-up only: if go-live is next year, the current year files no row. The row's planned implementation quarter comes from the live start date. It is **new** if the Deliverable had no live phase starting before that go-live, and an **upgrade** otherwise — so where one application goes live twice in a year, the first row is **new** and the second is an **upgrade** to it. Category and DC/DR locations come from the Deliverable, falling back to its Asset Category. Developer and related-party attributes come from the Deliverable; remarks come from the Initiative. Imported attributes are retained on those entities.

**Data Manager → RPTI** displays stored rows and their fields for reference, including unresolved imports. It has no row editing or generation controls. Generating a report does not overwrite those stored rows.

## Default Currency

Set the workspace currency in **Visualiser → More → Default Currency**. This labels amounts; it does not convert them.

- Next: [Exporting the RPTI Report](exporting-the-rpti-report.md)
