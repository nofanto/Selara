# LKPTI Report Schema (Format 3.2.6)

Source: OJK LKPTI reporting template, **Format 3.2.6 — Daftar Aplikasi** ("Application List").
This document is the English-language specification for a single row of the application inventory.

- **Entity name:** `Application`
- **Collection:** `applications[]`
- **Reporting party:** Bank / financial institution
- **Field count:** 15 (columns 1–15 of the original form)

---

## 1. Field Table

| # | Field key | Original (ID) | Type | Required | Description |
|---|-----------|---------------|------|----------|-------------|
| 1 | `row_number` | No. | integer | yes | Sequential row number, starting at 1. |
| 2 | `category_code` | Kategori Aplikasi | enum (string) | yes | Two-digit application category code. See §2. |
| 3 | `application_name` | Nama Aplikasi | string | yes | Name of the application. |
| 4 | `function_description` | Deskripsi Fungsi Aplikasi | string | yes | Brief description of what the application does. |
| 5 | `platform` | Platform | string | yes | Operating system platform (e.g. `Linux RHEL 9`, `Windows Server 2022`, `AIX 7.2`). |
| 6 | `database` | Pangkalan Data | string | yes | Database engine required (e.g. `Oracle 19c`, `PostgreSQL 16`, `MS SQL Server 2019`). |
| 7 | `dc_location` | Lokasi DC | string | yes | City and/or country of the Data Center. |
| 8 | `dc_provider` | Penyelenggara DC | string | yes | Company operating the DC, or `self` if operated by the Bank. |
| 9 | `drc_location` | Lokasi DRC | string | yes | City and/or country of the Disaster Recovery Center for this application. |
| 10 | `drc_provider` | Penyelenggara DRC | string | yes | Company operating the DRC, or `self` if operated by the Bank. |
| 11 | `backup_strategy` | Strategi Backup | enum (string) | yes | Availability/backup arrangement. See §3. |
| 12 | `system_owner` | System Owner | string | yes | Business unit that owns/manages the application. |
| 13 | `developer` | Pengembang Aplikasi | string | yes | `inhouse` if built by the Bank, otherwise the name of the IT service provider (PPJTI). |
| 14 | `go_live_date` | Tanggal Implementasi | date string | yes | Implementation date, format `dd-mm-yyyy`. |
| 15 | `ownership` | Kepemilikan | enum (string) | yes | Licensing/acquisition model. See §4. |

---

## 2. Enum — `category_code`

| Code | English label | Original (ID) |
|------|---------------|---------------|
| `01` | Customer management | Pengelolaan nasabah |
| `02` | Third-party funds (current accounts, savings, time deposits) | Dana pihak ketiga (giro, tabungan, deposito) |
| `03` | Credit / financing | Perkreditan/pembiayaan |
| `04` | General Ledger (GL) | Buku Besar |
| `05` | Payments | Pembayaran |
| `06` | Digital services | Layanan Digital |
| `07` | Treasury | Tresuri |
| `08` | Trade finance | Pembiayaan Perdagangan |
| `09` | AML/CFT and CPF of WMD | APU-PPT dan PPPSPM |
| `10` | Reporting information system management | Manajemen sistem informasi pelaporan |
| `11` | Risk management | Manajemen risiko |
| `12` | Internal management | Manajemen intern |
| `49` | Other applications | Aplikasi lain |

> Codes are **not** contiguous: `13`–`48` are invalid. Store as a zero-padded string, never as an integer.

---

## 3. Enum — `backup_strategy`

| Value | Meaning |
|-------|---------|
| `HA_ACTIVE_ACTIVE` | High Availability Active–Active |
| `HA_ACTIVE_PASSIVE` | High Availability Active–Passive |
| `BACKUP_REALTIME` | Real-time backup |
| `BACKUP_PERIODIC` | Periodic backup |

---

## 4. Enum — `ownership`

| Value | Original (ID) | Meaning |
|-------|---------------|---------|
| `LEASE` | Sewa | Subscription / rented / licensed per period |
| `OUTRIGHT_PURCHASE` | Beli Putus | Purchased outright, perpetual ownership |

---

## 5. Validation Rules

1. `row_number` is unique and sequential within a submission (1..n, no gaps).
2. `category_code` must be one of the 13 codes in §2.
3. `go_live_date` must match `^\d{2}-\d{2}-\d{4}$` and be a real calendar date; it must not be in the future relative to the reporting period end date.
4. `dc_provider` / `drc_provider`: the literal `self` (rendered as `sendiri` on the submitted form) means the Bank runs it; any other value must be a legal entity name.
5. `developer`: the literal `inhouse` means Bank-developed; any other value must name the IT service provider.
6. If `developer != "inhouse"`, treat the application as third-party sourced — this normally cross-references the IT service provider list in the related LKPTI format.
7. `drc_location` and `drc_provider` are mandatory even when the DRC is the Bank's own site; do not leave blank.
8. `application_name` should be unique per submission; if the same product runs in multiple environments, report it once and note the distinction in `function_description`.
9. All free-text fields: trim whitespace, no line breaks (the target output is a flat table cell).
10. Text is submitted in Indonesian on the official form — this schema's English enum values are internal keys and must be mapped back on export (see §8).

---

## 6. JSON Schema (Draft 2020-12)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.org/schemas/lkpti-report.json",
  "title": "LKPTI Format 3.2.6 Report",
  "type": "object",
  "required": ["applications"],
  "properties": {
    "applications": {
      "type": "array",
      "items": { "$ref": "#/$defs/application" }
    }
  },
  "$defs": {
    "application": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "row_number", "category_code", "application_name", "function_description",
        "platform", "database", "dc_location", "dc_provider", "drc_location",
        "drc_provider", "backup_strategy", "system_owner", "developer",
        "go_live_date", "ownership"
      ],
      "properties": {
        "row_number":          { "type": "integer", "minimum": 1 },
        "category_code":       { "enum": ["01","02","03","04","05","06","07","08","09","10","11","12","49"] },
        "application_name":    { "type": "string", "minLength": 1, "maxLength": 100 },
        "function_description":{ "type": "string", "minLength": 1, "maxLength": 500 },
        "platform":            { "type": "string", "minLength": 1, "maxLength": 100 },
        "database":            { "type": "string", "minLength": 1, "maxLength": 100 },
        "dc_location":         { "type": "string", "minLength": 1, "maxLength": 100 },
        "dc_provider":         { "type": "string", "minLength": 1, "maxLength": 100 },
        "drc_location":        { "type": "string", "minLength": 1, "maxLength": 100 },
        "drc_provider":        { "type": "string", "minLength": 1, "maxLength": 100 },
        "backup_strategy":     { "enum": ["HA_ACTIVE_ACTIVE","HA_ACTIVE_PASSIVE","BACKUP_REALTIME","BACKUP_PERIODIC"] },
        "system_owner":        { "type": "string", "minLength": 1, "maxLength": 100 },
        "developer":           { "type": "string", "minLength": 1, "maxLength": 100 },
        "go_live_date":        { "type": "string", "pattern": "^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])-\\d{4}$" },
        "ownership":           { "enum": ["LEASE","OUTRIGHT_PURCHASE"] }
      }
    }
  }
}
```

---

## 7. TypeScript Type

```ts
export type CategoryCode =
  | "01" | "02" | "03" | "04" | "05" | "06" | "07"
  | "08" | "09" | "10" | "11" | "12" | "49";

export type BackupStrategy =
  | "HA_ACTIVE_ACTIVE"
  | "HA_ACTIVE_PASSIVE"
  | "BACKUP_REALTIME"
  | "BACKUP_PERIODIC";

export type Ownership = "LEASE" | "OUTRIGHT_PURCHASE";

export interface Application {
  rowNumber: number;
  categoryCode: CategoryCode;
  applicationName: string;
  functionDescription: string;
  platform: string;
  database: string;
  dcLocation: string;
  dcProvider: string;          // company name, or "self"
  drcLocation: string;
  drcProvider: string;         // company name, or "self"
  backupStrategy: BackupStrategy;
  systemOwner: string;
  developer: string;           // "inhouse", or IT service provider name
  goLiveDate: string;          // dd-mm-yyyy
  ownership: Ownership;
}
```

---

## 8. Export Mapping (internal key → submitted form value)

| Field | Internal | On the submitted form |
|-------|----------|----------------------|
| `backup_strategy` | `HA_ACTIVE_ACTIVE` | `High Availability Active - Active` |
| `backup_strategy` | `HA_ACTIVE_PASSIVE` | `High Availability Active - Passive` |
| `backup_strategy` | `BACKUP_REALTIME` | `Backup Realtime` |
| `backup_strategy` | `BACKUP_PERIODIC` | `Backup Periodically` |
| `ownership` | `LEASE` | `Sewa` |
| `ownership` | `OUTRIGHT_PURCHASE` | `Beli Putus` |
| `dc_provider` / `drc_provider` | `self` | `sendiri` |
| `developer` | `inhouse` | `inhouse` |

Column order for CSV/XLSX export must follow the original 1–15 sequence:

```
No.,Kategori Aplikasi,Nama Aplikasi,Deskripsi Fungsi Aplikasi,Platform,Pangkalan Data,Lokasi DC,Penyelenggara DC,Lokasi DRC,Penyelenggara DRC,Strategi Backup,System Owner,Pengembang Aplikasi,Tanggal Implementasi (Go Live),Kepemilikan
```

---

## 9. Example Record

```json
{
  "row_number": 1,
  "category_code": "03",
  "application_name": "Loan Origination System",
  "function_description": "End-to-end credit application intake, scoring, approval workflow, and disbursement instruction.",
  "platform": "Red Hat Enterprise Linux 9",
  "database": "Oracle Database 19c",
  "dc_location": "Jakarta, Indonesia",
  "dc_provider": "self",
  "drc_location": "Surabaya, Indonesia",
  "drc_provider": "PT Contoh Data Center",
  "backup_strategy": "HA_ACTIVE_PASSIVE",
  "system_owner": "Credit Operations Division",
  "developer": "PT Contoh Teknologi Indonesia",
  "go_live_date": "15-03-2021",
  "ownership": "OUTRIGHT_PURCHASE"
}
```
