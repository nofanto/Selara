# Recording an RPTI Row

RPTI (Laporan Rencana Pengembangan Teknologi Informasi) is Indonesia's OJK-regulated IT Development Plan Report — Format 3.1. Each row records a planned development activity on one application or infrastructure item, backed by one of your initiatives.

RPTI rows are managed in **Data Manager → RPTI**, the same spreadsheet-style editor used for every other entity in Selara (Initiatives, Assets, Applications, and so on). The **RPTI Report** screen under Reports is a read-only summary of the same data, plus the Excel export — see [Exporting the RPTI Report](exporting-the-rpti-report.md).

## Opening the RPTI tab

Go to **Data Manager** in the top navigation bar and select the **RPTI** tab.

## Creating a Row

1. Click **Add Row**.
2. Set the **Initiative** column — this supplies the description and the default CapEx/OpEx figures.
3. Set the **Target** column to the specific application or asset/infrastructure item this row is about. Applications and assets both appear in the same dropdown, labelled `App:` or `Asset:` so you can tell them apart.
4. Set the **Category** — one of RPTI's 18 regulatory codes (customer management, payments, digital services, data center, etc.).
5. Set **Dev Type** (New or Upgrade), **Developer** (In-house or PPJTI), and **PPJTI Related Party** status.
6. Optionally fill in the **DC City** / **DC Country** / **DR City** / **DR Country** columns for the item's Data Center and Disaster Recovery Center location, a **Quarter**, and **Remarks**.

## Auto-Generating Rows

Instead of adding rows by hand, click **Generate `<year>` RPTI Rows** at the top of the RPTI tab to build rows automatically from this year's deliverable lifecycle segments — see [RPTI Row Auto-Generation](../../../requirement-specs/rpti-auto-generation.md) for the full rule. This replaces all existing rows for the current year, so any manual edits made since the last generation are lost.

Generated rows auto-fill as much as they can from the Deliverable being reported on:

- **Category** comes from the Deliverable's own category code if it has one, otherwise from its Asset Category's default.
- **Developer** comes from the Deliverable's own setting (there's no category-level default for this one — it varies too much deliverable to deliverable). **PPJTI Related Party** auto-fills to `N/A` unless the developer is PPJTI, in which case it's left for you to fill in.
- **DC City / DC Country / DR City / DR Country** follow the same Deliverable-first, Asset-Category-fallback pattern as Category, resolved independently per field.

Set these defaults once on a Deliverable or its Asset Category (in Data Manager → Deliverables / Categories) and every row generated from that deliverable inherits them — no need to re-enter the same values every report year.

Only a lifecycle segment whose status is recognized as **live** or **pre-launch** (planned/funded) work counts toward generation — a status like "Cancelled" or "On Hold" is excluded by default, so it never produces a false report row. Selara recognizes the built-in Planned/Funded/In Production statuses automatically; if you add a custom status of your own, mark it explicitly using the **Live?** / **Pre-Launch?** checkboxes in Data Manager → App Statuses so generation knows how to treat it.

## Default Currency

All CapEx/OpEx figures in this report are assumed to be in a single currency for the whole workspace. Set it once via the **Default Currency** field at the top of the RPTI tab (e.g. `IDR`, `USD`) — it's a label, not a converter, so if your CapEx/OpEx values aren't already in that currency, convert them yourself before entering them.

## One Initiative, Multiple Rows

An initiative often affects more than one application or asset — a migration might touch both an application and the data center it runs in, for example. Rather than changing what an initiative can target, add **one RPTI row per affected item**, all pointing at the same initiative. Each row can independently override the CapEx/OpEx amount via the **CapEx Override** / **OpEx Override** columns, if the initiative's total budget needs to be split across its targets (left blank, they default to the initiative's own CapEx/OpEx).

## Editing and Deleting

Edit any cell inline, the same as any other Data Manager table. Click the trash icon on a row to delete it. Deleting the initiative a row belongs to, or the application/asset it targets, removes that RPTI row automatically.

---

- Previous: [Linking Decisions to Portfolio Items](../13-decisions/linking-decisions.md)
- Next: [Exporting the RPTI Report](exporting-the-rpti-report.md)
