# RPTI Report Schema (Laporan Rencana Pengembangan Teknologi Informasi)

> **Source:** Format 3.1 — IT Development Plan Report (Indonesian banking regulatory format).
> Each row represents one planned application or infrastructure development item.
> Column numbers below match the footnote references (1)–(11) in the original form.

## Table structure

| # | Column (Indonesian) | Column (English) | Type | Notes |
|---|---|---|---|---|
| 1 | No. | Row Number | `integer` | Sequential row number. |
| 2 | Nama Aplikasi/Infrastruktur Bank | Application/Infrastructure Name | `string` | e.g. "Application X", "Data Center Relocation", "Network Bandwidth Capacity Addition". |
| 3 | Deskripsi | Description | `string` (long text) | Detailed explanation of the application/infrastructure being developed. |
| 4 | Kategori | Category | `enum` | See **Category codes** below. Single select. |
| 5 | Jenis Pengembangan | Development Type | `enum` | `new` \| `upgrade` |
| 6 | Pengembang | Developer | `enum` | `inhouse` \| `PPJTI` (third-party IT service provider) |
| 7 | PPJTI Pihak Terkait | PPJTI Related-Party Status | `enum` | `yes` \| `no` \| `n/a` |
| 8 | Lokasi | Location | `object` | Sub-fields: `data_center`, `disaster_recovery_center` |
| 9 | Waktu Rencana Implementasi | Planned Implementation Time | `enum` | `Q1` \| `Q2` \| `Q3` \| `Q4` |
| 10 | Estimasi Biaya | Cost Estimate | `object` | Sub-fields: `capex`, `opex` |
| 11 | Keterangan | Remarks | `string` (long text) | Free-text notes (see **Remarks guidance** below). |

---

## Field details

### 4. Category (`kategori`) — pick one code

| Code | English meaning |
|---|---|
| 01 | Customer management |
| 02 | Third-party funds (current accounts, savings, deposits) |
| 03 | Credit / financing |
| 04 | General Ledger (GL) |
| 05 | Payments |
| 06 | Digital services |
| 07 | Treasury |
| 08 | Trade finance |
| 09 | AML-CFT and PPPSPM (payment system provider compliance) |
| 10 | Management information/reporting systems |
| 11 | Risk management |
| 12 | Internal management |
| 49 | Other applications |
| 51 | Data Center / Disaster Recovery Center |
| 52 | Servers and/or platforms |
| 53 | Data communication network |
| 54 | Security systems |
| 99 | Other infrastructure |

### 5. Development Type (`jenis_pengembangan`)
- `new` — a new application/infrastructure, or a full replacement of an existing one.
- `upgrade` — addition/enhancement to an existing application/infrastructure.

### 6. Developer (`pengembang`)
- `inhouse` — developed by internal bank staff.
- `PPJTI` — developed by an external party (Penyedia Jasa Teknologi Informasi / IT service provider).

### 7. PPJTI Related-Party Status (`ppjti_pihak_terkait`)
- `yes` — the PPJTI is a related party to the bank.
- `no` — the PPJTI is not a related party.
- `n/a` — development is inhouse, or the PPJTI has not yet been determined.

### 8. Location (`lokasi`) — object
```json
{
  "data_center": { "city": "string", "country": "string" },
  "disaster_recovery_center": { "city": "string", "country": "string" }
}
```

### 9. Planned Implementation Time (`waktu_implementasi`)
Reported by fiscal quarter: `Q1`, `Q2`, `Q3`, or `Q4`.

### 10. Cost Estimate (`estimasi_biaya`) — object
```json
{
  "capex": { "amount": "number", "currency": "string", "idr_equivalent": "number" },
  "opex":  { "amount": "number", "currency": "string", "idr_equivalent": "number" }
}
```
- Estimate covers the 1-year period following implementation.
- Excludes capex depreciation.
- If the original currency is not IDR, an IDR-equivalent value must also be recorded.

### 11. Remarks guidance (`keterangan`)
Free text should cover, where applicable:
- Impacts of the development (e.g. additional headcount needed).
- How this development relates to the bank's overall IT Strategic Plan (RSTI).
- Linkage to any planned new bank product (RPPB) per relevant OJK regulation on bank product launches.

---

## JSON Schema (for programmatic validation)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "RPTIReportRow",
  "type": "object",
  "required": [
    "row_number", "name", "description", "category",
    "development_type", "developer", "ppjti_related_party",
    "location", "implementation_quarter", "cost_estimate"
  ],
  "properties": {
    "row_number": { "type": "integer", "minimum": 1 },
    "name": { "type": "string" },
    "description": { "type": "string" },
    "category": {
      "type": "string",
      "enum": ["01","02","03","04","05","06","07","08","09","10","11","12","49","51","52","53","54","99"]
    },
    "development_type": { "type": "string", "enum": ["new", "upgrade"] },
    "developer": { "type": "string", "enum": ["inhouse", "PPJTI"] },
    "ppjti_related_party": { "type": "string", "enum": ["yes", "no", "n/a"] },
    "location": {
      "type": "object",
      "properties": {
        "data_center": {
          "type": "object",
          "properties": {
            "city": { "type": "string" },
            "country": { "type": "string" }
          }
        },
        "disaster_recovery_center": {
          "type": "object",
          "properties": {
            "city": { "type": "string" },
            "country": { "type": "string" }
          }
        }
      }
    },
    "implementation_quarter": { "type": "string", "enum": ["Q1", "Q2", "Q3", "Q4"] },
    "cost_estimate": {
      "type": "object",
      "properties": {
        "capex": {
          "type": "object",
          "properties": {
            "amount": { "type": "number" },
            "currency": { "type": "string" },
            "idr_equivalent": { "type": "number" }
          }
        },
        "opex": {
          "type": "object",
          "properties": {
            "amount": { "type": "number" },
            "currency": { "type": "string" },
            "idr_equivalent": { "type": "number" }
          }
        }
      }
    },
    "remarks": { "type": "string" }
  }
}
```
