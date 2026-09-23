# Data Manager Overview

![Data Manager](../../public/tutorial/5-data-manager.png)

The Data Manager is the spreadsheet-style view of all portfolio data. Click **Data Manager** in the navigation to open it.

It has twelve tabs:

| Tab | What it contains |
|-----|-----------------|
| Initiatives | All initiatives — name, dates, status, budget, owner, progress, etc. |
| Dependencies | All dependency relationships between initiatives and milestones |
| Assets | IT assets (e.g. CIAM Platform, Mobile App) |
| Deliverables | The applications, infrastructure, documents, and procedures belonging to assets — and everything the OJK returns say *about* an application |
| Categories | The categories that group assets (e.g. Customer Identity, Mobile) |
| Programmes | Programme definitions used for grouping and colouring |
| Strategies | Strategic themes |
| Milestones | Key dates and events |
| Resources | People and roles (used for Owner and resource assignment) |
| Deliverable Statuses | The lifecycle statuses and colours used by segments on the timeline |
| RPTI | Rows for the Indonesian OJK IT Development Plan Report (Format 3.1) |
| LKPTI | Rows for the Indonesian OJK Application List Report (Format 3.2.6) |

**Where the OJK return fields live.** Everything that describes an application — Platform,
Database, DC/DRC Provider, Backup Strategy, System Owner, Ownership, Developer and the PPJTI
related-party answer — is recorded on the **Deliverables** tab, on the application itself. The RPTI
filed CapEx, OpEx, and `Keterangan` belong to the implementation and are edited in its lifecycle
segment panel on the timeline. Initiative CapEx and OpEx remain separate portfolio figures; the
initiative Description still supplies RPTI `Deskripsi`.

That is the only place to change them, and it is deliberate: a generated filing is built from your
applications, initiatives, and lifecycle segments, so a value recorded there cannot be lost when a report is regenerated.

The RPTI and LKPTI tabs are read-only views of stored report rows. They show target names and all stored report fields, including unresolved imports. Generate a filing for a selected year from **Reports**. Choose an initiative’s **Deliverable** on the Initiatives tab; leaving it blank allows inference only when all its lifecycle segments name one existing Deliverable.

Each tab shows a row count badge. All tabs are reachable without horizontal scrolling on tablet and narrow viewports.

Use the Data Manager for bulk edits, importing data, and data cleanup. The timeline updates in real time as you make changes.

## Resetting your workspace

At the bottom of every tab there is a **Clear data and start again** button. Clicking it opens the template picker, where you can choose a new starting template — with or without demo data. This permanently replaces all current data.

See [First Launch](../01-getting-started/first-launch.md#resetting-or-switching-templates) for full details.

---

- Previous: [Legend](../06-display-settings/legend.md)
- Next: [Inline Editing](inline-editing.md)
