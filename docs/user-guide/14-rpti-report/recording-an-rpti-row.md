# Recording an RPTI Row

RPTI Format 3.1 records planned application and infrastructure work. Generate the filing from **Reports → RPTI Report** after choosing its year.

## Target and cost

Each initiative contributes at most one generated target and uses its own CapEx and OpEx. In **Data Manager → Initiatives**, use the **Deliverable** column to declare it. Infrastructure is also a Deliverable under an Asset; a bare Asset is not a supported filing target.

If the target is blank, Selara can infer it when all lifecycle segments linked to the initiative point at one existing Deliverable. This considers all years, so the same initiative cannot silently change targets between filings. A declared target takes precedence over other timeline history.

If an undeclared initiative spans several deliverables, Data Health asks you to select the intended target or split the work into separate initiatives. If a stored row's target is missing, create or repair the Deliverable on **Data Manager → Deliverables**, select it in the Initiative's **Deliverable** column on **Data Manager → Initiatives**, and add a qualifying segment linking the pair on the **Visualiser timeline**. These errors are shown before export, even when there is no stored RPTI row.

## Generated values

Only live or pre-launch lifecycle segments overlapping the selected year qualify. Category and DC/DR locations come from the Deliverable, falling back to its Asset Category. Developer and related-party attributes come from the Deliverable; remarks come from the Initiative. Imported attributes are retained on those entities.

**Data Manager → RPTI** displays stored rows and their fields for reference, including unresolved imports. It has no row editing or generation controls. Generating a report does not overwrite those stored rows.

## Default Currency

Set the workspace currency in **Visualiser → More → Default Currency**. This labels amounts; it does not convert them.

- Next: [Exporting the RPTI Report](exporting-the-rpti-report.md)
