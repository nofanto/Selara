/**
 * Generates the sample OJK returns in docs/sample-data/ for manual exercise of
 * the onboarding importer.
 *
 * Run: node scripts/generate-sample-returns.mjs
 *
 * These are written by hand rather than exported from a workspace on purpose:
 * an export only contains what a workspace happens to hold, and these samples
 * are shaped to exercise every branch of the importer (see the README they sit
 * beside). Both header rows must match the exporters byte-for-byte —
 * LKPTI_EXPORT_HEADERS in src/lib/lkpti.ts and the headers in
 * exportRptiReportToExcel (src/lib/rpti.ts) — which is why this is a script and
 * not a one-off.
 *
 * Bank Nusantara Sejahtera is fictional, and so is every figure here.
 */
import * as XLSX from 'xlsx';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(process.cwd(), 'docs', 'sample-data');

const LKPTI_HEADERS = [
  'No.', 'Kategori Aplikasi', 'Nama Aplikasi', 'Deskripsi Fungsi Aplikasi', 'Platform',
  'Pangkalan Data', 'Lokasi DC', 'Penyelenggara DC', 'Lokasi DRC', 'Penyelenggara DRC',
  'Strategi Backup', 'System Owner', 'Pengembang Aplikasi',
  'Tanggal Implementasi (Go Live)', 'Kepemilikan',
];

const RPTI_HEADERS = [
  'No.', 'Nama Aplikasi/Infrastruktur Bank', 'Deskripsi', 'Kategori', 'Jenis Pengembangan',
  'Pengembang', 'PPJTI Pihak Terkait', 'Lokasi Data Center', 'Lokasi Disaster Recovery Center',
  'Waktu Rencana Implementasi', 'Estimasi Biaya CapEx', 'Estimasi Biaya OpEx', 'Keterangan',
];

const JKT = 'Jakarta, Indonesia';
const SBY = 'Surabaya, Indonesia';
const HA_AA = 'High Availability Active - Active';
const HA_AP = 'High Availability Active - Passive';
const RT = 'Backup Realtime';
const PER = 'Backup Periodically';
const BELI = 'Beli Putus';
const SEWA = 'Sewa';

// The LKPTI category cell carries "<code> — <label>" (note the em dash), exactly
// as generateLkptiDetails writes it; the RPTI "Kategori" cell carries the bare label.
const lk = (code, label) => `${code} — ${label}`;

/** Applications live as at 31 December 2026. LKPTI is applications only. */
const LKPTI_ROWS = [
  [lk('01', 'Customer management'), 'Customer Information File (CIF)', 'Single customer view across all products and channels.', 'Java / Spring Boot', 'Oracle 19c', JKT, 'Self', SBY, 'Self', HA_AA, 'Head of Customer Data', 'inhouse', '12-04-2018', BELI],
  [lk('02', 'Third-party funds (current accounts, savings, deposits)'), 'Savings & Deposits Module', 'Current accounts, savings and time deposits administration.', 'COBOL / Mainframe', 'DB2', JKT, 'Self', SBY, 'Self', HA_AA, 'Head of Retail Operations', 'PT Sigma Cipta Caraka', '03-09-2015', BELI],
  [lk('03', 'Credit / financing'), 'Loan Origination System', 'End-to-end consumer and SME loan origination and approval.', '.NET Core', 'SQL Server 2019', JKT, 'Self', SBY, 'Self', HA_AP, 'Head of Credit Operations', 'PT Anabatic Technologies', '21-06-2019', BELI],
  [lk('04', 'General Ledger (GL)'), 'Core Banking General Ledger', 'Statutory general ledger and daily balance sheet close.', 'COBOL / Mainframe', 'DB2', JKT, 'Self', SBY, 'Self', HA_AA, 'Head of Finance Systems', 'PT Sigma Cipta Caraka', '03-09-2015', BELI],
  [lk('05', 'Payments'), 'Payment Gateway', 'BI-FAST, RTGS and SKNBI payment routing and settlement.', 'Java / Spring Boot', 'PostgreSQL 14', JKT, 'Self', SBY, 'Self', HA_AA, 'Head of Payment Services', 'inhouse', '17-08-2021', BELI],
  [lk('06', 'Digital services'), 'Mobile Banking Nusantara', 'Retail mobile banking for iOS and Android.', 'React Native', 'MongoDB', JKT, 'Self', SBY, 'PT Telkomsigma', HA_AA, 'Head of Digital Channels', 'inhouse', '05-02-2020', BELI],
  [lk('07', 'Treasury'), 'Treasury Management System', 'FX, money market and fixed income position keeping.', 'Murex / Java', 'Oracle 19c', JKT, 'Self', SBY, 'Self', HA_AP, 'Head of Treasury Operations', 'Murex SAS', '11-11-2017', SEWA],
  [lk('08', 'Trade finance'), 'Trade Finance Portal', 'Letters of credit, bank guarantees and trade documentation.', 'Java / Spring Boot', 'Oracle 19c', JKT, 'Self', SBY, 'Self', HA_AP, 'Head of Wholesale Operations', 'PT Anabatic Technologies', '28-03-2019', BELI],
  [lk('09', 'AML-CFT and PPPSPM'), 'AML Transaction Monitoring', 'Transaction screening, watchlist matching and SIPESAT reporting.', 'Python / Spark', 'PostgreSQL 14', JKT, 'Self', SBY, 'Self', RT, 'Head of Compliance', 'NICE Actimize', '14-07-2020', SEWA],
  [lk('10', 'Management information/reporting systems'), 'Management Information System (MIS)', 'Regulatory and management reporting, including OJK submissions.', 'SAP BusinessObjects', 'Teradata', JKT, 'Self', SBY, 'Self', PER, 'Head of Management Reporting', 'PT Metrodata Electronics', '09-01-2016', BELI],
  [lk('11', 'Risk management'), 'Credit Risk Scoring Engine', 'PD/LGD scoring and IFRS 9 expected credit loss calculation.', 'Python / scikit-learn', 'PostgreSQL 14', JKT, 'Self', SBY, 'Self', HA_AP, 'Head of Risk Analytics', 'inhouse', '30-05-2022', BELI],
  [lk('12', 'Internal management'), 'HR & Payroll System', 'Employee records, payroll and leave administration.', 'SAP SuccessFactors', 'HANA', JKT, 'PT Telkomsigma', SBY, 'PT Telkomsigma', PER, 'Head of Human Capital', 'SAP SE', '01-10-2018', SEWA],
  [lk('49', 'Other deliverables'), 'Enterprise Document Management', 'Centralised document archive and retention management.', 'OpenText / Java', 'SQL Server 2019', JKT, 'Self', SBY, 'Self', PER, 'Head of Corporate Services', 'OpenText Corp', '19-02-2021', SEWA],
];

/**
 * The 2027 plan. Deliberately mixed so the import exercises every path:
 * upgrades that match the inventory exactly, wholly new applications, the four
 * infrastructure codes an LKPTI structurally cannot carry, and one upgrade that
 * matches nothing and must surface in the data-health review rather than be guessed at.
 */
const RPTI_ROWS = [
  // Upgrades — name AND category match a 2026 LKPTI row exactly, so these attach
  // to the existing application instead of creating a duplicate.
  ['Mobile Banking Nusantara', 'Add QRIS Tap and cardless withdrawal to the retail app.', 'Digital services', 'upgrade', 'inhouse', 'n/a', JKT, SBY, 'Q2', 4200000000, 850000000, 'Phase 2 of the digital channel roadmap.'],
  ['Payment Gateway', 'BI-FAST phase 3 and ISO 20022 message migration.', 'Payments', 'upgrade', 'inhouse', 'n/a', JKT, SBY, 'Q1', 6500000000, 1200000000, 'Regulatory deadline driven.'],
  ['Core Banking General Ledger', 'Multi-currency GL and faster daily close.', 'General Ledger (GL)', 'upgrade', 'PPJTI', 'yes', JKT, SBY, 'Q3', 12000000000, 2400000000, 'Vendor-led; related party under common ownership.'],
  ['AML Transaction Monitoring', 'Behavioural analytics model refresh and PPPSPM rule pack.', 'AML-CFT and PPPSPM', 'upgrade', 'PPJTI', 'no', JKT, SBY, 'Q2', 3100000000, 1800000000, 'Vendor model update.'],

  // New applications — no 2026 counterpart, so these are created fresh.
  ['Open API Banking Platform', 'Developer portal and partner API gateway for embedded finance.', 'Digital services', 'new', 'inhouse', 'n/a', JKT, SBY, 'Q1', 8800000000, 1500000000, 'SNAP-compliant open banking initiative.'],
  ['Open API Banking Platform', 'Scale partner API capacity and add consent-management controls.', 'Digital services', 'upgrade', 'inhouse', 'n/a', JKT, SBY, 'Q3', 3600000000, 720000000, 'Partner API phase 2 capacity upgrade.'],
  ['Digital Onboarding (eKYC)', 'Remote account opening with liveness and Dukcapil verification.', 'Customer management', 'new', 'PPJTI', 'no', JKT, SBY, 'Q2', 5400000000, 980000000, ''],
  ['Syariah Financing Module', 'Murabahah and musyarakah financing administration.', 'Credit / financing', 'new', 'PPJTI', 'no', JKT, SBY, 'Q4', 9700000000, 1100000000, 'Supports the planned syariah business unit.'],

  // Infrastructure — codes 51-54. An LKPTI-only workspace cannot reach these at
  // all, which is the whole reason the RPTI import exists.
  ['DRC Site Relocation — Surabaya', 'Move the disaster recovery site to a Tier III facility.', 'Data Center / Disaster Recovery Center', 'new', 'PPJTI', 'no', JKT, SBY, 'Q2', 24000000000, 3600000000, 'Improves RTO from 8 hours to 2 hours.'],
  ['Core Banking Server Refresh', 'Replace end-of-life core banking compute and storage.', 'Servers and/or platforms', 'new', 'PPJTI', 'no', JKT, SBY, 'Q3', 18500000000, 2100000000, 'Hardware reaches end of support in 2027.'],
  ['SD-WAN Branch Network', 'Replace MPLS branch links with SD-WAN across 214 branches.', 'Data communication network', 'new', 'PPJTI', 'yes', JKT, SBY, 'Q1', 15200000000, 4800000000, 'Related party: network services subsidiary.'],
  ['Next-Gen Firewall & SIEM Upgrade', 'Perimeter firewall replacement and SIEM correlation rebuild.', 'Security systems', 'new', 'PPJTI', 'no', JKT, SBY, 'Q4', 11300000000, 2700000000, ''],

  // An upgrade to infrastructure the bank already runs. LKPTI is Daftar Aplikasi
  // and carries no infrastructure, so this can never match the inventory — it is
  // created rather than stranded, and stays an 'upgrade' when regenerated.
  ['Primary Data Center Jakarta', 'Add two floors of rack capacity to the existing facility.', 'Data Center / Disaster Recovery Center', 'upgrade', 'PPJTI', 'no', JKT, SBY, 'Q3', 7400000000, 1900000000, 'Existing DC; not an LKPTI item.'],

  // Upgrade to an *application* the 2026 inventory does not contain. Imported and
  // flagged in the data-health review, not silently dropped or duplicated.
  ['Legacy Teller Application', 'Branch teller front-end modernisation.', 'Internal management', 'upgrade', 'inhouse', 'n/a', JKT, SBY, 'Q3', 2900000000, 640000000, 'Not present in the 2026 LKPTI — needs a target.'],
];

function build(headers, rows, sheetName, file) {
  const aoa = [headers, ...rows.map((r, i) => [i + 1, ...r])];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map((h, i) => ({ wch: i === 0 ? 5 : Math.min(38, Math.max(14, h.length + 4)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  // XLSX.writeFile is unavailable in the ESM build (no fs bound), so write the buffer.
  writeFileSync(join(OUT, file), XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  console.log(`${file}: ${rows.length} rows`);
}

mkdirSync(OUT, { recursive: true });
build(LKPTI_HEADERS, LKPTI_ROWS, 'LKPTI Format 3.2.6', 'sample-lkpti-2026.xlsx');
build(RPTI_HEADERS, RPTI_ROWS, 'RPTI Format 3.1', 'sample-rpti-2027.xlsx');
