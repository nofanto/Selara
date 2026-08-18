# User Story 13: RPTI Asset Catalogue Integration

## Story

> **As** an Indonesian bank's IT portfolio manager,
> **I want** to see OJK RPTI application areas collapsed in the visualiser and selectively populate them with assets,
> **So that** I can build my asset catalogue progressively without being overwhelmed by hundreds of empty swimlanes.

---

## Background

Selara originally bundled the GEANZ (NZ Government Enterprise Architecture) catalogue for this purpose. It was replaced with a catalogue built around OJK's own `RptiCategoryCode` values — see `requirement-specs/rpti-asset-catalogue.md` for the full design rationale. The 18 RPTI categories (`01`–`12`, `49`, `51`–`54`, `99`) already exist in Selara's data model; this feature embeds them directly into the visualiser as collapsed area rows, letting users "Pre-populate" individual areas on demand and delete assets they no longer need.

---

## Acceptance Criteria

### AC1 — Area rows appear in the visualiser

- [x] The 18 RPTI application areas (`01`–`12`, `49`, `51`–`54`, `99`) appear as collapsed rows in the visualiser below any existing user-defined assets.
- [x] Each area row displays the full RPTI area name (e.g. "Payments").
- [x] Area rows have a visually distinct treatment from asset swimlanes — muted background, clear section-header styling — so users understand they are structural groupings, not empty assets awaiting work.
- [x] Area rows are hidden/absent if all their child assets have been pre-populated (the area is fully expanded into individual asset swimlanes).

### AC2 — Pre-populate button

- [x] Each area row label contains an "+ Add all assets" button.
- [x] Clicking the button adds all child assets for that area as individual Selara `Asset` records, each with `categoryId` set to the area's own `AssetCategory` (`cat-rpti-05`, etc.) so any Deliverable added under them auto-classifies for RPTI reporting.
- [x] Each created asset has a stable synthetic `externalId` (e.g. `rpti-catalogue-05-payment-gateway`) and `name` stored.
- [x] After pre-populating, the area row collapses/disappears and the newly created asset swimlanes appear in its place.
- [x] The button displays the count of assets that will be added, e.g. "+ Add all 3 assets".

### AC3 — Remove all assets

- [x] Once an area has been pre-populated, a "Remove all assets" option is available on the area group (accessible via a context menu or secondary button on the area header if re-collapsed).
- [x] Clicking "Remove all assets" shows a confirmation dialog: _"Remove [n] assets from [area name]? Initiatives and segments linked to these assets will also be deleted."_
- [x] On confirmation, all assets in the area and their linked initiatives, segments, and milestones are deleted.
- [x] On cancellation, nothing changes.

### AC4 — Trashcan delete on individual asset swimlanes

- [x] Every asset swimlane label row shows a trashcan icon on hover.
- [x] Clicking the trashcan on an asset that has **no** linked initiatives or segments deletes it immediately with no confirmation prompt.
- [x] Clicking the trashcan on an asset that **has** linked initiatives or segments shows a confirmation dialog: _"Delete [asset name]? [n] initiative(s) and [n] segment(s) linked to this asset will also be deleted."_
- [x] On confirmation, the asset and all its linked data are deleted and the swimlane is removed from the visualiser.
- [x] On cancellation, nothing changes.

### AC5 — Persistence

- [x] Pre-populated assets persist across page reloads (stored in IndexedDB).
- [x] Deleted assets are removed from IndexedDB and do not reappear on reload.
- [x] RPTI area rows that have not been pre-populated re-appear correctly on reload.

### AC6 — No regressions

- [x] The full Playwright test suite passes with no failures after implementation.

---

## Scope

**In scope:**
- All 18 RPTI category codes (`01`–`12`, `49`, `51`–`54`, `99`)
- Pre-populate and remove-all at the area level
- Trashcan delete at the individual asset swimlane level

**Out of scope (future):**
- Partial pre-populate (selecting individual assets from a picker)
- Editing catalogue asset names
- Selara's own zero-knowledge sharing backend (tracked separately, issue #5)

---

## Schema

`Asset` (`src/types.ts`) carries no catalogue-specific field beyond what already exists — see `requirement-specs/rpti-asset-catalogue.md` §3 for why an earlier draft of this design assumed (incorrectly) that `Asset` needed its own `categoryCode`, and why classification instead flows through a real `AssetCategory` per area:

```typescript
export interface Asset {
  id: string;
  name: string;
  categoryId: string;   // Points at one of the 18 cat-rpti-* AssetCategory records for catalogue assets
  maturity?: number;
  externalId?: string;  // Stable synthetic id — catalogue-membership signal and idempotent re-add key
}
```

`src/lib/rptiCatalogue.ts` exports `rptiCatalogueAreas` (the 18 areas + their example assets) and `rptiCatalogueAssetCategories` (one real `AssetCategory` per area, `categoryCode` set to match).

---

## Files Touched

| File | Change |
|---|---|
| `src/lib/rptiCatalogue.ts` | New: static catalogue of 18 areas + child assets + backing AssetCategory records |
| `src/demoData.ts` | Seeds `rptiCatalogueAssetCategories` into `demoAssetCategories`; demo assets/initiatives/segments/milestones for 11 of the 18 areas |
| `src/lib/workspaceTemplates.ts` | `TemplateId` `'rpti'`, template name "Indonesian Bank Technology Catalogue" |
| `src/components/Timeline.tsx` | Area row rendering, "+ Add all assets" / "Remove all" buttons, trashcan delete |
| `e2e/rpti-catalogue.spec.ts` | E2E tests covering AC1–AC5 |
| `docs/user-guide/11-import-export/rpti-catalogue.md` | User-facing guide |

---

## E2E Test Plan (`e2e/rpti-catalogue.spec.ts`)

| Test | Scenario |
|---|---|
| Area rows visible | 18 RPTI area rows appear in the visualiser on load |
| Area row styling | Area rows are visually distinct from asset swimlanes |
| Pre-populate | Clicking "+ Add all assets" on an area creates the correct assets |
| Pre-populate count badge | Button shows correct asset count before clicking |
| Area row hides after populate | Area row disappears after pre-populate |
| Persistence | Pre-populated assets survive page reload |
| Trashcan — no linked data | Deleting an asset with no initiatives removes it immediately |
| Trashcan — with linked data | Deleting an asset with initiatives shows confirmation dialog |
| Trashcan — cancel | Cancelling confirmation leaves asset intact |
| Remove all | "Remove all assets" deletes all pre-populated assets for an area |
| Remove all — cancel | Cancelling confirmation leaves all assets intact |
| No regression | Full suite passes |
