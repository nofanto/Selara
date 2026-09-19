# User Story 25: Data Manager Filter Indicator

## Story

> **As** a preparer following a Data Health issue to its source record,
> **I want** the Data Manager to say when its rows are filtered and let me clear that filter beside the data,
> **So that** I do not mistake a filtered table for the complete dataset.

## Background and decisions

Data Health navigation puts the issue record's name into the app-wide search and opens
the owning Data Manager tab. Previously, the only evidence of that filter was the small
header search field, far from the table.

- **The clear action clears the global search.** Search is one shared app state used by
  the Visualiser and Data Manager, so a Data Manager-only override would create two
  competing meanings for the same search field. The control is labelled **Clear global
  search** to make its scope explicit.
- **Filtered mode is source-agnostic.** Any non-blank global search activates the Data
  Manager indicator, whether it came from Data Health or was typed directly in the
  header. The table's state, not the navigation path, is what matters to the preparer.
- **Every Data Manager tab honours the filter.** The read-only RPTI and LKPTI tables,
  and Deliverable Statuses, must filter too so the indicator never claims that an
  unfiltered table is filtered.
- **Tab badges stay as total counts.** They describe the size of each underlying
  dataset and remain stable while searching. The nearby indicator explains why the
  visible table contains fewer rows; duplicating separate filtered counts across all
  tabs would add noise and require users to distinguish two count conventions.

## Acceptance Criteria

### AC1 — Visible filtered mode

- [x] With a non-blank global search, Data Manager shows an indicator immediately above
  the table that names the active term as **Filtered by “term”**.
- [x] The indicator appears regardless of whether the term came from Data Health or was
  typed directly into the global search field.
- [x] With a blank global search, the indicator is absent.

### AC2 — One-action clear

- [x] The indicator provides a **Clear global search** button.
- [x] Activating it clears the header search field, removes the indicator, and restores
  the unfiltered Data Manager rows.

### AC3 — Consistent tab behaviour

- [x] All editable tabs, Deliverable Statuses, RPTI, and LKPTI honour the active search.
- [x] RPTI/LKPTI matching includes displayed target and initiative names as well as
  stored row values.
- [x] Tab badges continue to show total record counts while a filter is active.

## Out of scope

- A separate Data Manager-only search state.
- Per-tab filter toggles or saved filters.
- Scroll-to-row or transient row highlighting after Data Health navigation.

## Verification

- Red: the focused Data Health and direct-search cases failed because
  `data-manager-filter-indicator` did not yet exist.
- Green: 39 focused Playwright tests passed across Data Health, search, RPTI, and LKPTI.
- Full unit suite: 385 passed (24 files).
- Full Playwright suite: 670 passed, 4 skipped, 0 failed.
