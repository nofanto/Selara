# Recording an RPTI Row

RPTI (Laporan Rencana Pengembangan Teknologi Informasi) is Indonesia's OJK-regulated IT Development Plan Report — Format 3.1. The RPTI Report in Scenia lets you build this report from your existing portfolio data: each row records a planned development activity on one application or infrastructure item, backed by one of your initiatives.

## Opening the RPTI Report

Go to **Reports** in the top navigation bar and select the **RPTI Report** card.

## Creating a Row

1. Click **Add Row**.
2. Select the **Initiative** the row belongs to — this supplies the description and the default CapEx/OpEx figures.
3. Choose a **Target Type**:
   - **Application** — for a software application row. Pick the specific application from the dropdown.
   - **Asset / Infrastructure** — for a pure infrastructure item (data center, network, security system) with no software application involved. Pick the asset directly.
4. Choose the **Category** — one of RPTI's 18 regulatory codes (customer management, payments, digital services, data center, etc.).
5. Set **Development Type** (New or Upgrade), **Developer** (In-house or PPJTI), and **PPJTI Related Party** status.
6. Optionally fill in Data Center / Disaster Recovery Center location, remarks, and the planned implementation quarter (see [Auto-Suggested Quarters and Exporting](exporting-the-rpti-report.md)).
7. Click **Save**.

## One Initiative, Multiple Rows

An initiative often affects more than one application or asset — a migration might touch both an application and the data center it runs in, for example. Rather than changing what an initiative can target, add **one RPTI row per affected item**, all pointing at the same initiative. Each row can independently override the CapEx/OpEx amount if the initiative's total budget needs to be split across its targets — see the **CapEx Override** / **OpEx Override** fields on the row form (left blank, they default to the initiative's own CapEx/OpEx).

If the overrides you enter across an initiative's rows add up to more than the initiative's own total, a warning banner appears on the form so you can catch a mis-allocation before saving.

## Editing and Deleting

Click the pencil icon on any row to edit it, or the trash icon to delete it (with confirmation). Deleting the initiative or application/asset a row targets removes that RPTI row automatically.

---

- Previous: [Linking Decisions to Portfolio Items](../13-decisions/linking-decisions.md)
- Next: [Auto-Suggested Quarters and Exporting](exporting-the-rpti-report.md)
