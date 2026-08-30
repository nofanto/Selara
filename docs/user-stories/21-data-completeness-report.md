# User Story 21: Data Completeness Report

## Story

> **As** an IT portfolio manager,
> **I want** a single view of dangling references and report-generation gaps across my whole workspace,
> **So that** I can find and fix data problems before they show up as blank cells or missing rows in a regulatory submission.

---

## Background

Prompted as a companion to Issue #9 (LKPTI import onboarding, [User Story 20](20-lkpti-import-onboarding.md)) — that import explicitly leaves gaps behind (no Programme/Strategy/Initiative, no lifecycle history before go-live, 9 of 15 LKPTI columns with no auto-fill source), and there was no way in the app to see what those gaps actually are. Broadened during design discussion (issue #10) into a general workspace completeness check, not an LKPTI-import-specific one. Full design record in `requirement-specs/data-completeness-report.md`.

---

## Acceptance Criteria

### AC1 — Reports card

- [x] Reports gets a new **Data Completeness** card, opening a read-only issue list — same "pure function computed live from `AppState` on render" pattern as the Budget and Capacity reports, not a new IndexedDB store.

### AC2 — Hard checks (dangling references, severity "error")

- [x] Every field in the schema that references another entity by id is checked for a dangling reference, including polymorphic references (`Dependency.sourceId`/`targetId`, `Decision.linkedEntityId`) and the one previously-silent schema gap (`DeliverableSegment.status` not matching any real `DeliverableStatus.id`).

### AC3 — Soft checks (report-generation gaps, severity "warning")

- [x] A Deliverable with no lifecycle segments, or none carrying an `initiativeId`, is flagged as unable to generate an RPTI row.
- [x] An application Deliverable with no live-status segment is flagged as excluded from LKPTI generation.
- [x] A Deliverable eligible for RPTI and/or LKPTI generation, but with no resolvable `categoryCode`, `developer`, or DC/DR location, is flagged — scoped to only the Deliverables actually eligible for the report each check concerns, so a gap that could never affect a generated report is never flagged.
- [x] An LKPTI-eligible Deliverable with no `description` is flagged (blank `functionDescription` on generation).
- [x] A generated `LkptiDetail`/`RptiDetail` row missing any of its always-manual fields is flagged as needing manual completion.
- [x] An Initiative with no owner (`ownerId` and no legacy `owner` string) is flagged.

### AC4 — Read-only, click-to-navigate

- [x] Clicking an issue navigates to the relevant record: Data Manager, on the tab that owns the record, with the record's name pre-filled into the global search box so it's immediately visible in the (already-filtered) table; a Decision-linked issue navigates to the Decisions view instead, since decisions aren't managed in Data Manager.
- [x] A severity filter (All / Errors / Warnings) narrows the list.
- [x] No inline quick-fix editing in the report itself — Data Manager remains the one editing surface, this report's job is only to point at what needs attention.

---

## Out of scope (for now)

- "Unused record" hygiene checks (an `AssetCategory` with no `Asset`s, an unreferenced `Resource`, an unrated `Asset.maturity`) — deferred, see the design doc's "Scope" section.
- Scroll-to-row / highlight within the destination table — navigation lands on the correct tab with the record's name in the search box, not a precise scroll+highlight.

---

## Files Touched

| File | Change |
|---|---|
| `src/lib/dataHealth.ts` | New: `computeDataHealth()`, `HealthIssue`, `DataManagerTab` (the Data Manager tab union, now the single source of truth) |
| `src/lib/dataHealth.test.ts` | 29 Vitest cases covering every hard and soft check |
| `src/components/DataHealthReportView.tsx` | New: issue list + severity filter, read-only |
| `src/components/ReportsView.tsx` | New `data-health` card + view |
| `src/components/DataManager.tsx` | `initialTab` prop (read once on mount) so a navigated-to tab opens correctly |
| `src/App.tsx` | `handleNavigateFromHealthIssue`, `dataManagerInitialTab` state, wiring `onNavigate` through to `ReportsView` |
| `e2e/data-health-report.spec.ts` | 3 Playwright cases: card visible, dangling-reference issue jumps to the right tab, severity filter narrows the list |
| `docs/user-guide/09-reports/data-completeness-report.md` | User-facing guide |
