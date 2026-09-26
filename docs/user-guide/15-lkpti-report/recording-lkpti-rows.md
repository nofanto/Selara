# Recording LKPTI Report Rows

LKPTI Format 3.2.6 is the application inventory as at the end of a filing year. Open **Reports → LKPTI - Application List Report**, enter the year, and click **Generate LKPTI**.

A Deliverable qualifies when its live lifecycle segment spans **31 December** of the selected year. Planned applications, applications not yet live, and applications whose live segment has already ended are excluded.

The generated row reads platform, database, providers, backup strategy, system owner, developer and ownership from the Deliverable, including values retained during import. Category and DC/DR location use Deliverable values with Asset Category defaults. Function description comes from the Deliverable description; the go-live date comes from its live lifecycle segment.

**Data Manager → LKPTI** is a read-only view of stored rows. It displays the stored fields and offers no row editing or generation controls. Generating from Reports leaves these stored records unchanged.

Click **Export to Excel** in the generated report to download `lkpti-report-<year>.xlsx`. The exact Format 3.2.6 columns remain on the **LKPTI Format 3.2.6** worksheet, while **Report Metadata** states the selected 31 December as-at year. The general workspace export separately backs up stored records.

- Previous: [Exporting the RPTI Report](../14-rpti-report/exporting-the-rpti-report.md)
- Next: [Importing an Existing LKPTI Report](importing-an-lkpti-report.md)
