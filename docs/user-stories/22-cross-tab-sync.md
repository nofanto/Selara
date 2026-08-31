# User Story 22: Cross-Tab Sync (Active/Passive)

## Story

> **As** an IT portfolio manager working with Selara open in more than one browser tab,
> **I want** other open tabs to refresh automatically when I save a change in the tab I'm actively editing in,
> **So that** I don't have to manually reload a passive tab to see what I just changed, and don't risk a stale passive tab silently overwriting my edit later.

---

## Background

Selara has no backend (issue #5) — persistence is entirely local IndexedDB, and until now each tab loaded state once on mount and never looked at it again. Two tabs on the same workspace would silently diverge, and whichever tab saved last would win, overwriting whatever the other tab had written. Full design record, including the three follow-up decisions (stale-panel handling, refresh visibility, debounce), is in `requirement-specs/cross-tab-sync.md` (issue #13).

Scoped to **active/passive** only: one tab is the active editor, other open tabs are passive viewers that refresh to match. Two tabs both actively editing at the same time is explicitly out of scope — the save model is a full-snapshot overwrite with no merge logic, so real concurrent editing would need conflict-resolution logic this story doesn't attempt.

---

## Acceptance Criteria

### AC1 — Broadcast on save

- [x] After every successful save, the saving tab broadcasts on a `BroadcastChannel` (`src/lib/tabSync.ts`), tagged with a per-tab id so a tab never reacts to its own broadcast.

### AC2 — Passive tab refresh

- [x] A tab that receives another tab's save broadcast reloads full state from IndexedDB and replaces its in-memory state — without re-saving (the source tab already did) and without pushing onto its own undo stack.
- [x] No debounce: the passive tab reacts to every broadcast it receives, even during a rapid burst of edits in the active tab.

### AC3 — Undo/redo reset

- [x] Adopting a remote update clears the passive tab's undo and redo stacks, since those snapshots no longer correspond to the DB's current baseline.

### AC4 — Stale open panels auto-close

- [x] If the Initiative panel, Segment panel, or Asset panel (Maturity Heatmap) is open on a record that a remote update just removed, the panel closes automatically rather than continuing to show a dangling record.
- [x] If the Decisions view has a decision selected that a remote update just removed, the selection clears (which the existing selection-driven form-reset in `DecisionsView` already handles once the id is cleared).

### AC5 — Visibility

- [x] A brief "Updated in another tab" toast appears when a passive tab adopts a remote update, dismissible by the user.

---

## Out of scope (for now)

- Concurrent multi-editor sync (two tabs both actively editing at once) — needs real conflict/merge logic given the full-snapshot-overwrite save model; a meaningfully bigger problem, see the design doc's Context section.
- Coalescing/debouncing rapid broadcasts — decided against for v1, revisit only if observed to be a real problem.

---

## Files Touched

| File | Change |
|---|---|
| `src/lib/tabSync.ts` | New: `generateTabId`, `isRemoteSaveMessage`, `notifyDataSaved`, `SYNC_CHANNEL_NAME` |
| `src/lib/tabSync.test.ts` | 6 Vitest cases, including a real two-`BroadcastChannel`-instance delivery test |
| `src/App.tsx` | `applyRemoteSync`, `BroadcastChannel` lifecycle, sync toast, broadcast-after-save in `handleUpdate` |
| `src/components/Timeline.tsx` | Auto-close guards for the Initiative and Segment panels |
| `src/components/ReportsView.tsx` | Auto-close guard for the Asset panel |
| `e2e/cross-tab-sync.spec.ts` | 2 Playwright cases using two pages in one browser context: a save in tab A reaches tab B with a toast and no reload; the toast is dismissible |
