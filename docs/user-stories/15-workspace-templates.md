# User Story 15: Workspace Templates (Multi-Taxonomy Support)

## Story

As a new user opening Selara for the first time,
I want to choose which taxonomy or reference framework best matches my agency's needs,
So that I start with a relevant portfolio structure without having to configure everything from scratch.

## Acceptance Criteria

**AC1:** On first load (empty IndexedDB, no prior session), a TemplatePickerModal is shown with 3 template cards before any data is loaded into the visualiser.

**AC2:** The modal shows exactly 3 template cards:
- GEANZ Technology Catalogue (`template-card-geanz`)
- Viewer (`template-card-viewer`)
- Blank (`template-card-blank`)

**AC3:** Selecting "GEANZ Technology Catalogue" loads the existing GEANZ demo portfolio (current default behaviour). The GEANZ catalogue section is visible.

**AC4:** The Viewer card shows a single "Upload file" button (no "With / Without demo data" options). Clicking it opens a file chooser for `.xlsx`/`.xls` files. After a file is selected the data is loaded into the app and the template picker closes.

**AC5:** Selecting "Blank" loads an empty workspace with no assets and no categories. The GEANZ catalogue section is hidden.

**AC6:** The template picker is NOT shown in E2E test mode (`scenia-e2e` localStorage flag). Demo data loads automatically (GEANZ template) so all existing tests continue to pass without modification.

**AC7:** The template picker is NOT shown on subsequent loads when IndexedDB already contains data.

**AC8:** (Added 2026-09-30, M1 / PR #69.) When the picker is opened from **Data Manager → Clear data and start again**, it has a visible **Close** button (accessible name "Close"). Closing it returns to the existing workspace. Nothing is written or deleted, and the workspace is unchanged after a reload. Close is disabled while an import or restore started from the picker is in progress. While a replacement preview opened from the picker is on top, the picker behind it can't be focused or used; after **Cancel** it works again. The picker is a dialog named after its heading. When it opens, focus moves to Close, and Close returns focus to **Clear data and start again**.

**AC9:** (Added 2026-09-30.) On first launch the picker has no Close button. Onboarding must end in a choice, because there is no workspace to return to. It is also a dialog named after its heading ("Welcome to Selara"), and focus starts inside it.

## Scope

- No changes to `Asset`, `AssetCategory`, or `Initiative` types beyond optional `templateId?: string` in `TimelineSettings`
- GEANZ catalogue section visibility is controlled by `settings.showGeanzCatalogue !== false`

## Files to Create / Modify

| File | Change |
|------|--------|
| `src/lib/workspaceTemplates.ts` | New — template descriptors and `getTemplateData()` |
| `src/components/TemplatePickerModal.tsx` | New — first-load modal with 3 template cards |
| `src/types.ts` | Add `templateId?: string` and `showGeanzCatalogue?: boolean` to `TimelineSettings` |
| `src/components/Timeline.tsx` | Make GEANZ section conditional on `settings.showGeanzCatalogue !== false` |
| `src/App.tsx` | Show TemplatePickerModal when DB empty (non-E2E); auto-load GEANZ in E2E mode |
| `e2e/workspace-templates.spec.ts` | New E2E tests |

> **Note:** A fourth template, "NZ Digital Target State" (DTS), was originally part of this story and later removed as an overly NZ-government-specific fit. See [ADR-0004](../adr/0004-remove-dts.md).
