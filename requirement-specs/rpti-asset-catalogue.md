# Design Notes: Replace GEANZ Catalogue with an RPTI-Aligned Asset Catalogue

## Context and Problem Statement

Selara currently bundles the **GEANZ (Government Enterprise Architecture NZ) Technologies model** as a built-in reference catalogue: 17 "TAP" application areas (`TAP.01`–`TAP.17`), each with canonical child asset types, sourced from `data.govt.nz` under Crown copyright / CC BY 4.0. It renders as collapsible swimlane rows in the visualiser (asset-grouped view only), with "+ Add all N assets" / "Remove all" controls, and a subset of it is baked into the bundled demo data.

This is New Zealand government-specific and has no connection to Selara's actual purpose: helping Indonesian banks prepare **OJK's RPTI (Laporan Rencana Pengembangan Teknologi Informasi)** regulatory filing. A new user loading sample data sees NZ public-sector application names ("FMIS", "Case Management") with a Crown copyright notice, which is confusing and off-brand for the product's actual audience.

**Decision:** Remove GEANZ entirely and replace it with an equivalent bundled catalogue built around OJK's own RPTI category codes, which already exist in Selara's data model (`RptiCategoryCode` in `src/types.ts`) but currently have no bundled example content.

---

## Decided

### 1. Taxonomy source: OJK's RPTI category codes

The catalogue's 18 areas are the existing `RptiCategoryCode` values (`requirement-specs/rpti-schema.md`), not an invented taxonomy:

| Code | Area name |
|---|---|
| 01 | Customer management |
| 02 | Third-party funds (current accounts, savings, deposits) |
| 03 | Credit / financing |
| 04 | General Ledger (GL) |
| 05 | Payments |
| 06 | Digital services |
| 07 | Treasury |
| 08 | Trade finance |
| 09 | AML-CFT and PPPSPM |
| 10 | Management information / reporting systems |
| 11 | Risk management |
| 12 | Internal management |
| 49 | Other applications |
| 51 | Data Center / Disaster Recovery Center |
| 52 | Servers and/or platforms |
| 53 | Data communication network |
| 54 | Security systems |
| 99 | Other infrastructure |

**Why:** it's already authoritative (OJK regulation, not a copyrighted external dataset — no attribution/license notice needed), already exists in the type system, and — unlike GEANZ — an asset added from this catalogue can have its `categoryCode` pre-filled, so it flows straight into RPTI report generation instead of being a purely cosmetic grouping.

### 2. Replacement scope: 1:1 swap

Same shape as GEANZ today — each area lists a handful of canonical Indonesian-bank asset examples, addable/removable per area via the same "+ Add all" / "Remove all" swimlane UX. Not attempting a richer scenario (example Initiatives / generated RptiDetail rows) in this pass.

### 3. Technical shape — simplify, don't just re-skin

GEANZ's `Asset.alias` used a two-level dotted scheme (`TAP.02.03`) that `Timeline.tsx` parsed with a regex (`/^(TAP\.\d+)/`) to recover the parent area for swimlane grouping. RPTI codes are flat (one level: code → asset), and — importantly — `Asset` already has a purpose-built `categoryCode?: RptiCategoryCode` field (`types.ts:151`) for exactly this classification. So:

- **Area grouping uses `asset.categoryCode` directly** instead of parsing a hierarchical alias. This removes the regex-parsing hack and means a catalogue-added asset's classification is immediately usable by RPTI reporting, not a separate cosmetic label.
- `Asset.alias` is no longer populated by the catalogue (drop the GEANZ-specific dotted-alias concept; nothing else in the codebase depends on `alias` except GEANZ's own logic — confirmed by search).
- `Asset.externalId` is kept — it's a generic dedup field also used by Excel import (`App.tsx:589-591`), not GEANZ-specific. Catalogue-added assets keep populating it with a stable synthetic id (e.g. `rpti-catalogue-05-payment-gateway`) so "+ Add all" stays idempotent.
- `GEANZ_CATEGORY_ID` (`'cat-geanz-app-tech'`) → new constant, e.g. `RPTI_CATALOGUE_CATEGORY_ID` (`'cat-rpti-catalogue'`).

### 4. Renames (proposed — adjust freely during implementation)

| Current | Proposed |
|---|---|
| `src/lib/geanzCatalogue.ts` | `src/lib/rptiCatalogue.ts` |
| `GeanzArea`, `GeanzAssetEntry` | `RptiCatalogueArea`, `RptiCatalogueAssetEntry` |
| `geanzAreas` | `rptiCatalogueAreas` |
| `GEANZ_CATEGORY_ID` | `RPTI_CATALOGUE_CATEGORY_ID` |
| `TemplateId = 'geanz' \| 'viewer' \| 'blank'` | `'rpti' \| 'viewer' \| 'blank'` |
| Template name "GEANZ Technology Catalogue" | "RPTI Application Catalogue" |
| `TimelineSettings.showGeanzCatalogue` | `showRptiCatalogue` |
| `data-testid="geanz-*"` | `data-testid="rpti-catalogue-*"` |

### 5. Draft catalogue content

Illustrative examples per area (to refine during implementation — not exhaustive, mirrors GEANZ's "a few canonical entries per area" density; `49` and `99` are catch-alls left empty, same as GEANZ's `TAP.17`):

| Code | Area | Example assets |
|---|---|---|
| 01 | Customer management | Customer Relationship Management (CRM), Know Your Customer (KYC) Platform, Customer Onboarding System |
| 02 | Third-party funds | Savings Account System, Current Account System, Time Deposit (Deposito) System |
| 03 | Credit / financing | Loan Origination System (LOS), Loan Management System (LMS), Credit Scoring Engine |
| 04 | General Ledger | Core Banking General Ledger, Financial Accounting System |
| 05 | Payments | Payment Gateway, RTGS Interface, SKNBI Clearing Interface, Card Switching System |
| 06 | Digital services | Mobile Banking Application, Internet Banking Platform, QRIS Payment Service |
| 07 | Treasury | Treasury Management System, FX Dealing System |
| 08 | Trade finance | Trade Finance / Letter of Credit (LC) System, Bank Guarantee System |
| 09 | AML-CFT and PPPSPM | AML Transaction Monitoring System, Sanctions & Watchlist Screening |
| 10 | Management information / reporting | Management Information System (MIS), Regulatory Reporting Platform |
| 11 | Risk management | Enterprise Risk Management (ERM) System, Credit Risk Rating Engine |
| 12 | Internal management | Human Resource Information System (HRIS), Procurement & Vendor Management System |
| 49 | Other applications | *(empty — catch-all)* |
| 51 | Data Center / DR | Primary Data Center Infrastructure, Disaster Recovery Center |
| 52 | Servers and/or platforms | Core Banking Server Platform, Virtualization Platform |
| 53 | Data communication network | Wide Area Network (WAN), Branch Connectivity Network |
| 54 | Security systems | Firewall / Intrusion Prevention System, SIEM, Public Key Infrastructure (PKI) |
| 99 | Other infrastructure | *(empty — catch-all)* |

### 6. No migration needed

Confirmed with the user: no real (non-demo) workspace data exists yet — everything referencing `TemplateId: 'geanz'` or `categoryId: 'cat-geanz-app-tech'` is demo/sample data. The `geanz*` → `rpti*` renames (§4) can proceed directly, no migration step in `src/lib/db.ts` needed.

### 8. Demo data

Replace `demoData.ts`'s GEANZ block with a subset of the above (mirroring GEANZ demo's "~13 of the areas pre-populated with initiatives/segments" pattern), scenario context switched from "NZ government agency" to an Indonesian bank.

### 9. Files affected

Same footprint as the original GEANZ feature (`docs/user-stories/13`, `14`): `src/types.ts`, `src/lib/geanzCatalogue.ts` → `rptiCatalogue.ts`, `src/demoData.ts`, `src/lib/workspaceTemplates.ts`, `src/components/Timeline.tsx`, `src/App.tsx` (E2E auto-load reference), plus e2e specs (`e2e/geanz.spec.ts` and the ~8 other specs with incidental GEANZ references — selectors/fixtures, not necessarily behavior), and docs (`docs/user-guide/11-import-export/geanz-catalogue.md`, `docs/user-stories/13-geanz-asset-catalogue.md`, `docs/user-stories/14-geanz-demo-data.md`, `docs/database-diagram.md`, `TODO.md`).

---

## Rejected Alternatives

- **Custom Indonesian-bank taxonomy (not tied to RPTI codes).** More natural-sounding group labels, but duplicates a classification the app already has, and loses the "catalogue asset → auto-classified for RPTI reporting" benefit. Rejected in favor of reusing `RptiCategoryCode`.
- **Drop the bundled catalogue feature entirely.** Simpler, but throws away a genuinely useful onboarding aid (progressive swimlane population) for no reason other than GEANZ's content being wrong — the UX pattern itself isn't the problem.
- **Richer bank scenario (catalogue + example Initiatives + generated RptiDetail rows) in this pass.** Valuable eventually, but bigger surface area than a like-for-like content swap; deferred rather than bundled into this change.
- **Keep GEANZ as an optional secondary template alongside a new OJK one.** Rejected — GEANZ has no relevance to Selara's actual users; keeping it as dead weight isn't worth the maintenance cost of two catalogues.

---

## Open Questions

- **Exact final wording** for the catalogue's 18 areas' example asset lists (the table above is a first draft) — refine collaboratively during implementation rather than treating it as final.
- **Template naming** ("RPTI Application Catalogue" vs. "OJK Application Catalogue" vs. something else) — not yet bikeshed.

---

## Next Step

Once the open questions above are resolved (or explicitly deferred), proceed to Step 1 of the standard lifecycle: this is UI-facing behavior (visualiser swimlanes), so the primary test is a Playwright E2E test replacing `e2e/geanz.spec.ts`, written Red before implementation.
