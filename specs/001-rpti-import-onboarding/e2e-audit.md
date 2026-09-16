# T003 — Audit of e2e specs touching onboarding

**Date**: 2026-09-14 · Blocks T014/T019/T020/T023 (anything changing the picker).

Ten specs reference the picker. **Five use it only as setup** to reach a workspace and protect
something else entirely; **five have it under test**. Changing selectors without this distinction is
how a rename-heavy change silently drops a guarantee — the failure mode seen in the History-tab
refactor, where a marker missing from a rebuilt list was caught only by hand.

## Under test — must be rewritten deliberately

| Spec | What it protects | Impact |
|---|---|---|
| `workspace-templates.spec.ts` | Asserts the card set directly (`template-card-rpti/viewer/blank`), demo-data buttons, viewer upload, blank workspace, and AC8 *picker not shown when DB already has data* | Card assertions rewritten for two paths. **AC8 must survive** — it is the only coverage of FR-006 |
| `template-demo-toggle.spec.ts` | The with/without demo-data choice itself | Rewrite against the rehomed demo option on the start-empty path (T020) |
| `lkpti-import-onboarding.spec.ts` | The LKPTI card, its upload button and the import flow | Rewrite against the LKPTI **slot**; the import behaviour it protects stays valid |
| `template-picker-file-reset.spec.ts` | The viewer file input resets between attempts | Viewer leaves the picker (T023). Move with it, or this guarantee is lost |
| `confirm-modal.spec.ts` | In-app confirm modals, incl. *clear data and start again* | Mostly setup, but the start-over path is genuinely under test and is now the documented recovery route (FR-011) |

## Setup only — must keep working, no rewrite intended

| Spec | Uses | Depends on |
|---|---|---|
| `data-manager.spec.ts` | `clear-and-start-again-btn` → `template-start-blank-btn` | `template-start-blank-btn` surviving |
| `versioned-import-export.spec.ts` | same | same |
| `initiative-create-edit.spec.ts` | `template-select-with-demo-btn-rpti` | **A demo-data entry point existing** |
| `navigation.spec.ts` | same | same |
| `report-history-diff.spec.ts` | same | same |

## Two selectors carry most of the blast radius

- **`template-start-blank-btn`** — four specs depend on it as setup. **Keep this testid** on the new
  Start blank button; renaming it breaks four specs for no reason.
- **`template-select-with-demo-btn-rpti`** — three specs use it purely to obtain a demo workspace.
  It disappears with the catalogue card, so **T020 (rehoming demo data) blocks those three specs**,
  not just SC-006. Without a replacement entry point they have no way to reach a populated
  workspace.

## Consequence for task order

T020 is not merely a tidy-up for SC-006; three unrelated specs cannot pass without it. It should
land in the same change as the catalogue card removal (T019), never after it.
