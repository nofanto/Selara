# User Story 14: Enriched Demo Data with RPTI Catalogue Assets

## Story

As a new user loading Selara for the first time,
I want to see a realistic Indonesian-bank portfolio pre-populated with RPTI catalogue assets, initiatives, and lifecycle segments,
So that I can immediately understand the value of the RPTI catalogue feature and the visualiser without having to configure anything.

## Acceptance Criteria

**AC1:** On first load, RPTI catalogue asset swimlanes from at least 10 of the 18 areas are immediately visible without any user interaction (no pre-populate clicks required).

**AC2:** Each pre-populated RPTI area shows a "Remove all" button (`rpti-catalogue-remove-btn-{code}`) in the area header, and the area row (`rpti-catalogue-area-row-{code}`) is hidden.

**AC3:** Areas not included in the demo data (`02`, `03`, `07`, `08`, `49`, `53`, `99`) still render their collapsed area rows with pre-populate buttons.

**AC4:** At least one visible RPTI catalogue asset has an initiative in the timeline (e.g. Multi-Factor Authentication Platform → MFA Modernisation).

**AC5:** At least one visible RPTI catalogue asset has application lifecycle segments displayed.

## Scope

- Adds RPTI catalogue assets to `demoAssets` using `externalId` and `categoryId` pointing at one of the 18 `cat-rpti-*` categories from `rptiCatalogueAssetCategories`
- Adds `demoInitiatives` for each pre-populated catalogue asset (minimum one per asset)
- Adds `demoDeliverableSegments` for a representative subset of assets
- Adds `demoMilestones` for key catalogue assets
- No changes to the existing banking demo assets (`a-*`) or the RPTI catalogue itself (`src/lib/rptiCatalogue.ts`)
- Context is an Indonesian bank preparing its OJK RPTI filing (consistent with the catalogue's purpose)

## RPTI Areas Pre-populated

| Code | Area | Assets included |
|------|------|----------------|
| 01 | Customer management | Customer Onboarding System, CRM |
| 04 | General Ledger | Core Banking General Ledger |
| 05 | Payments | Payment Gateway, RTGS Interface |
| 06 | Digital services | Agent Banking Application, QRIS Payment Service, Video Banking Service |
| 09 | AML-CFT and PPPSPM | AML Transaction Monitoring System, Sanctions & Watchlist Screening |
| 10 | Management information / reporting | Regulatory Reporting Platform, MIS, Data Warehouse for Regulatory Reporting, BI & Analytics Platform |
| 11 | Risk management | Enterprise Risk Management (ERM) System |
| 12 | Internal management | HRIS, Procurement & Vendor Management System, Email & Collaboration Platform |
| 51 | Data Center / DR | Primary Data Center Infrastructure, Disaster Recovery Center |
| 52 | Servers and/or platforms | Core Banking Server Platform, IT Infrastructure Monitoring System, Application Performance Monitoring System |
| 54 | Security systems | Multi-Factor Authentication Platform, Firewall / Intrusion Prevention System, SIEM Platform |

Areas `02`, `03`, `07`, `08`, `49`, `53`, and `99` remain as unpopulated area rows in the demo.

## Files to Touch

- `src/demoData.ts` — RPTI catalogue assets, initiatives, segments, milestones
- `e2e/rpti-catalogue.spec.ts` — E2E test file covering the demo-data ACs above
