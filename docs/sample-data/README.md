# Sample OJK returns

Two spreadsheets for trying the onboarding importer by hand, without needing a real
filing from a real bank.

| File | Format | Rows |
|---|---|---|
| `sample-lkpti-2026.xlsx` | LKPTI Format 3.2.6 (*Daftar Aplikasi*) | 13 applications |
| `sample-rpti-2027.xlsx` | RPTI Format 3.1 (*Rencana*) | 14 planned implementations |

**Bank Nusantara Sejahtera is fictional**, as is every application name, vendor,
owner and rupiah figure in these files. They are not derived from any real bank's
return.

## How to use them

1. Open Selara with an empty workspace (first run, or **Data Manager → Clear data and
   start again**).
2. On the onboarding screen, choose **Start from your filed returns**.
3. LKPTI slot → `sample-lkpti-2026.xlsx`, reporting year **2026**.
4. RPTI slot → `sample-rpti-2027.xlsx`, reporting year **2027**.
5. **Import**.

The years differ on purpose. A bank filing in late 2026 files an inventory *as at*
2026 beside a plan *for* 2027; neither spreadsheet layout carries a year, so Selara
asks for each one rather than guessing.

Imported applications use one five-year live horizon. The 2026 LKPTI inventory is evidence they
are live as at 2026-12-31, so those entries run through 2031-12-31. A new build in the 2027 RPTI
goes live in 2027, so it runs through 2032-12-31. Upgrades remain live for their filed quarter only.

## What you should see

> **Import complete** — LKPTI 2026: 13 row(s) · RPTI 2027: 14 row(s). No rows were
> skipped. 1 planned upgrade(s) reference an application not in your inventory.

Then the data-health review, with **exactly one error** — the unmatched *Legacy Teller
Application* row, described below — alongside warnings of two kinds: applications with
no planned 2027 work, and imported initiatives with no owner yet.

*The warning total is deliberately not quoted here. It is a function of the fixture and
nothing asserts it, so it rotted twice: this line said 25 and the one further down said
21, while a measurement in September 2026 gave 23. The error count is the number that
matters, and it is pinned by tests.*

## Why these rows

The plan is shaped to exercise every branch of the importer, so each group shows you
something different:

- **4 upgrades that match the inventory exactly** — Mobile Banking Nusantara, Payment
  Gateway, Core Banking General Ledger, AML Transaction Monitoring. Matching is exact
  on name *and* category code, so these attach to the 2026 application rather than
  creating a second copy of it.
- **3 applications first introduced by the plan** — Open API Banking Platform,
  Digital Onboarding (eKYC), Syariah Financing Module. No 2026 counterpart, so
  they are created fresh.
- **1 second implementation of an application already introduced in this return** —
  Open API Banking Platform has a new Q1 build and a Q3 upgrade, with different
  CapEx, OpEx and commentary. The pair exercises same-file matching and proves
  that round-trip verification operates at implementation grain rather than name grain.
  It imports as **one application and two initiatives** — *Open API Banking Platform — Q1
  2027* and *— Q3 2027* — each spanning only its own quarter. Two initiatives rather than
  one is deliberate: Deskripsi is filed from the initiative, and the two rows describe
  different work, so merging them would lose one description.
- **4 new infrastructure items** — DRC relocation, server refresh, SD-WAN,
  firewall/SIEM. These carry RPTI codes `51`–`54`, which LKPTI does not have at all.
  An LKPTI-only workspace structurally cannot reach them, and that is the reason the
  RPTI import exists.
- **1 infrastructure *upgrade*** — *Primary Data Center Jakarta*. Filed as an
  upgrade, but no LKPTI can contain it, because LKPTI is applications only. It is
  **created** rather than flagged: unlike a mismatched application name, this is not
  a disagreement between the two returns for someone to resolve — it is a certainty.
  It keeps its `upgrade` classification when the return is regenerated.
- **1 *application* upgrade that matches nothing** — *Legacy Teller Application*. It
  is imported and flagged, not dropped and not guessed at. Both returns list
  applications, so a non-match here really is a naming disagreement to resolve. The
  Data Health and RPTI pre-export findings offer **Repair**. Choose **The bank runs it,
  but the inventory doesn’t list it**, check the pre-filled values against the return,
  and confirm. The repair creates the application, its prior live history, and the
  filed implementation together; the stored row remains unchanged.

Three things that look odd but are intended:

- Each of the three new *applications* warns *"has no live-status segment — silently
  excluded from LKPTI generation"*. That is correct: a 2027 build is not live, so it
  does not belong in an LKPTI yet. Mark its segment **In Production** once it really
  ships and it joins the inventory.

- Most warnings read *"has lifecycle segments, but none linked to an Initiative — it
  can never generate an RPTI row."* That is correct: 9 of the 13 applications have no
  planned work in 2027, so they belong in the LKPTI and not in the RPTI. The rest note
  that imported initiatives have no owner yet.
- The unmatched *Legacy Teller Application* initiative is parked on an arbitrary
  existing asset. Its report row is deliberately left unresolvable — that is the
  finding — but the initiative itself is given a real asset so it does not dangle
  as a second, duplicate error for the same problem.

## Trying the failure paths

- Put the RPTI file in the LKPTI slot: the import is refused and the workspace is
  left untouched.
- In the **LKPTI** file, clear a row's **Kategori Aplikasi** cell, or its **Pengembang
  Aplikasi** cell: the row is still imported and the missing value shows up in the
  review as a completeness gap. A blank cell states nothing, and dropping the row
  would lose the whole application while saying nothing about why.
- In the **LKPTI** file, change a **Kategori Aplikasi** cell to something invalid like
  `77 — Nonsense`: *that* row is rejected and reported by its position, because a
  wrong code cannot be guessed at.
- In the **RPTI** file, clear a **Kategori** cell and the row *is* rejected — unlike
  LKPTI. The two differ on purpose: LKPTI is applications only, so a blank category
  costs just the regulatory code, whereas in RPTI the category is what decides whether
  a row becomes an application or infrastructure (codes `51`–`54`, `99`). With it
  blank there is no way to know which kind of thing to create.

## Regenerating

```sh
node scripts/generate-sample-returns.mjs
```

The header rows must match the exporters byte-for-byte
(`LKPTI_EXPORT_HEADERS` in `src/lib/lkpti.ts`, and the headers in
`exportRptiReportToExcel` in `src/lib/rpti.ts`). `src/lib/sampleReturns.test.ts`
fails if these files stop parsing, so drift is caught by the suite.
