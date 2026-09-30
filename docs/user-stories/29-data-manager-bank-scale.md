# User Story 29: Data Manager Stays Usable at Bank Scale

## Story

> **As** an IT Planning preparer whose workspace was onboarded from a real bank's
> LKPTI and RPTI returns (hundreds of applications),
> **I want** the Deliverables and Initiatives tabs to cost time in proportion to their rows,
> not rows × every asset in the bank,
> **So that** I can keep working in the tabs I use most instead of waiting on a
> frozen screen.

## Background and decisions

GitHub issue #36 measured the RPTI and LKPTI tabs rendering n² `<option>` elements,
because every row had a `<select>` listing every deliverable, asset, or initiative.
Since then those two tabs have become read-only tables, so that cause is gone. A new
production-build measurement (2026-10-01, see [Verification](#verification)) found the
same defect had moved to other tabs:

- Onboarding creates **one asset per application**, so a 600-application bank has
  about 840 assets.
- Every Deliverables row and every Initiatives row has an **Asset** `<select>` listing
  all of them. At 600 applications that came to 741,762 `<option>` elements on
  Deliverables and 513,254 on Initiatives. The median tab open was 12 s and 20 s, and
  the worst run took 81 s.
- The issue's own synthetic seed reported Deliverables as linear only because it used
  a handful of assets. Seeding through the real import shows it isn't.

Decisions:

- **Large option lists render on demand.** A table `<select>` whose list exceeds
  20 options (`LAZY_OPTIONS_THRESHOLD`) renders only the placeholder and the current
  value until the preparer focuses it or presses the mouse on it. Then it renders the
  full list, before the native dropdown opens. The cell looks and behaves the same,
  and it stays a native `<select>`, so keyboard, screen-reader, and form semantics are
  unchanged.
- **It collapses again when focus leaves.** At most one row holds a full list at a
  time. Without this, a keyboard user tabbing down a column, or anyone editing many
  rows in one visit, would rebuild rows × options one row at a time. This came up in
  review of PR #71. An open native dropdown keeps focus on its select, so collapsing
  never happens underneath an open list.
- **Small, fixed lists stay fully rendered.** Enumerations such as Status, Type, RAG,
  Backup Strategy, or Category Code (at most 19 options) don't grow with the workspace.
  They cost rows × a constant, which is linear, so they keep their current behaviour.
  The threshold is size-based rather than a per-column flag so that a reference column
  added later gets the same protection without anyone remembering to opt in.
- **Rejected: a searchable combobox** (the issue's original proposal). It's better UX
  for picking from 800 names, but it's a new, custom, accessibility-sensitive control
  and far more change than removing the quadratic term needs. It remains a reasonable
  follow-up as a UX improvement, not a performance fix.
- **Rejected: row virtualisation.** It's a larger rewrite of `EditableTable` (sorting,
  paste, ghost row, focus management). Rows off screen would also stop existing in
  the DOM, which changes find-in-page and every test that locates a row. After this
  fix the remaining cost is linear, so virtualisation isn't needed at bank scale.

## Acceptance Criteria

### AC1: Linear rendering

- [x] With a workspace of 150 applications, each on its own asset, the Deliverables
  and Initiatives tabs render at most two `<option>` elements per row in the Asset
  column until a dropdown is opened.
- [x] Each row still shows its current asset by name, and hovering the cell still
  shows that name as a tooltip.

### AC2: Choosing still works

- [x] Opening a row's Asset dropdown, by mouse or by keyboard focus, offers every asset.
- [x] Choosing a different asset saves it, and it's still chosen after a reload.
- [x] Moving focus out of a dropdown collapses it back to its current value, keeping
  the selection and tooltip. Walking focus down 12 rows never leaves more than the
  focused row fully expanded.

### AC3: Nothing else changes

- [x] A row whose asset no longer exists still shows the **Select...** placeholder
  rather than a stale value.
- [x] Small fixed-choice columns still render their full option list.

## Out of scope

- A searchable combobox for reference columns (possible later UX work).
- Row virtualisation.
- The data-health workflow volume noted at the end of #36 (1,240 issues at 300
  applications). That one is tracked separately.

## Verification

- E2E: `e2e/data-manager-scale.spec.ts` covers AC1–AC3 by asserting deterministic
  DOM counts, not timings, so it can't flake on a slow CI runner.
- Benchmark (not in CI): a production build (`vite build` + `vite preview`) in
  headless Chromium 1208 on an Apple-silicon Mac, seeded by importing fully-populated
  N-application LKPTI 3.2.6 and RPTI 3.1 workbooks through the real onboarding flow.
  Each tab was opened 5 times (3 when throttled) from a parked tab, timing the click
  until every row is present plus one rendered frame. Medians:

  | Workspace (apps → assets) | Tab | `main` | This change | `<option>` elements, main → this change |
  |---|---|---|---|---|
  | 300 → 420 | Deliverables | 1,771 ms | 376 ms | 194,502 → 18,522 |
  | 300 → 420 | Initiatives | 1,285 ms | 187 ms | 130,634 → 4,934 |
  | 600 → 840 | Deliverables | 12,008 ms (max 27,762) | 787 ms | 741,762 → 37,002 |
  | 600 → 840 | Initiatives | 20,478 ms (max 81,452) | 389 ms | 513,254 → 9,854 |
  | 600 → 840 | RPTI / LKPTI (already read-only) | 41 / 66 ms | 51 / 76 ms | 0 → 0 |

  A keystroke in a Deliverables cell at 600 applications took 382 ms to reach the
  screen on `main` (one 3,350 ms outlier) and 96 ms with this change.

  **Limit.** With 4× CPU throttling, as a stand-in for a slower office laptop, the
  Deliverables tab at 600 applications still takes 3.3 s to open (7.2 s on `main` at
  300). What remains is linear: 840 rows × 22 editable columns is about 15,000 form
  controls. Getting it lower would need row virtualisation, which is out of scope here.
