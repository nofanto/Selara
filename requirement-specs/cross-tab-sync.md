# Cross-Tab Sync — Design Notes

> **Status:** Implemented. See [User Story 22](../docs/user-stories/22-cross-tab-sync.md) for the acceptance criteria and `src/lib/tabSync.test.ts` (6 tests) + `e2e/cross-tab-sync.spec.ts` (2 tests) for coverage. Tracked as [issue #13](https://github.com/nofanto/Selara/issues/13).

## Context and Problem Statement

Selara has no backend (issue #5 is still open) — persistence is entirely local IndexedDB in one browser profile. Nothing stops a user from opening the same workspace in two tabs. Today, each tab loads state once on mount and never looks at IndexedDB again; `saveAppData()` (`src/lib/db.ts`) clears and rewrites every store from the tab's full in-memory `AppState` on every edit — no per-field diffing, no merge logic anywhere. Two tabs open on the same workspace silently diverge, and whichever tab saves last wins, silently overwriting whatever the other tab wrote, even data the second tab never saw.

Two shapes of "multi-tab support" came up during discussion:

- **Concurrent editing** — two tabs both actively making edits around the same time. Given the full-snapshot-overwrite save model, this needs real conflict/merge logic (or some form of cross-tab write serialization plus re-fetch-before-apply), which is a much bigger problem — closer in weight to a data-model change than a UI feature.
- **Active/passive** — one tab is the active editor at a time; other open tabs (e.g. Reports open in a second tab while editing continues in the first) are passive viewers that should refresh to reflect what the active tab just saved.

**Decision: this doc scopes to active/passive only.** Concurrent multi-editor sync is explicitly out of scope for this doc — revisit only if a real use case for simultaneous editing across tabs shows up; it's a meaningfully bigger problem than "add a listener."

---

## Decided

### 1. Sync mechanism: `BroadcastChannel`, not the `storage` event

**Decision:** use a `BroadcastChannel` (e.g. `'selara-sync'`), not the `storage` event.

**Why:** `storage` only fires for `localStorage`/`sessionStorage` writes — using it here would mean writing a throwaway "ping" key to `localStorage` on every save purely to trigger the event in other tabs, a workaround for something `BroadcastChannel` does natively. `BroadcastChannel` has full support across Selara's target browsers and needs no such indirection.

**Rejected alternative — `storage` event + ping key.** Same eventual behavior, more indirection for no benefit.

### 2. Trigger and payload

**Decision:** after every successful `saveAppData()` call, broadcast `{ type: 'data-saved', tabId, savedAt }`. Every other tab listening reloads full state via `getAppData()` and replaces its in-memory state — the same state-setting half of `handleUpdate()` in `App.tsx`, without re-invoking `saveAppData()` (the source tab already saved) and without pushing onto the undo stack (see §3).

`tabId` is a random id generated once per tab (e.g. on module load), so a tab can recognize and ignore its own broadcast.

### 3. Undo/redo: cleared on a remote-triggered reload

**Decision:** when a tab adopts state via a remote broadcast, its (in-memory-only, per-tab) `undoStack`/`redoStack` are cleared.

**Why:** those stacks hold full prior `AppState` snapshots specific to what *this tab* has done. Once a remote change lands, those snapshots no longer correspond to the DB's current baseline — undoing against them would either silently discard the remote tab's change (the exact data-loss failure mode this feature exists to prevent) or produce a confusing partial state. Clearing is the conservative choice: an explicit, visible boundary (undo history resets) over a silently wrong automatic behavior.

### 4. Stale open panels/modals: auto-close

**Decision:** if a passive tab has an entity's edit panel open and a remote reload lands with that entity gone (deleted, or the id it's editing no longer resolves), the panel auto-closes.

**Why:** simplest option, and consistent with how a record deleted out from under an open panel should probably be handled generally, not just for cross-tab sync specifically. No existing guard for "the entity this panel is editing no longer exists" was found in `App.tsx` — this decision applies to whatever panel/modal components hold an open reference to a single entity (initiative panel, asset panel, etc.).

**Rejected alternatives:**
- **Inline "changed in another tab" notice** — more visible, but more UI surface to build for a case that should be rare (passive tab + open panel + concurrent delete).
- **Leave it open, do nothing special** — simplest to build, but the panel would keep showing stale data, and any edit/save attempt from it would need its own dangling-reference handling downstream.

### 5. Refresh visibility: small toast

**Decision:** show a brief "Updated in another tab" toast when a passive tab adopts a remote update.

**Why:** a silent full-state swap while a tab is mid-read (scrolled into a table, mid-filter) could be disorienting even though nothing is structurally broken — a low-friction cue is worth the small UI cost.

### 6. Debounce/coalescing: none — react to every broadcast

**Decision:** no debounce. The passive tab reloads on every `data-saved` broadcast it receives, even during a rapid burst of edits in the active tab.

**Why:** `getAppData()` reads are cheap relative to typing speed — simplest option, ship it and add coalescing later only if it's an observed problem, not a hypothetical one.

---

## Implemented

`src/lib/tabSync.ts` implements §1–2 as designed, using a *real* `BroadcastChannel` in tests rather than a mock — Node has had a global `BroadcastChannel` since v18, and two separate instances of the same channel name in one process deliver to each other exactly like two real tabs would, so the cross-instance delivery test in `tabSync.test.ts` needed no mocking at all.

One implementation note on §4 (stale open panels): rather than adding sync-specific "close on remote update" signal plumbing, each panel-owning component (`Timeline.tsx` for the Initiative/Segment panels, `ReportsView.tsx` for the Asset panel) got a small `useEffect` that closes the panel whenever its own entity-id state no longer resolves against the current props array. This is *not* sync-specific — it fires the same way regardless of why the array changed — which is arguably the more correct fix anyway (the same staleness was already reachable via same-tab actions, e.g. undo; see the "Rejected alternatives" note in §4 in the original decision). `DecisionsView`'s own edit form already resets whenever its `selectedId` prop changes, so clearing `App.tsx`'s `selectedDecisionId` when the selected decision disappears was enough to reuse that existing behavior — no changes needed inside `DecisionsView` itself.

The e2e test (`e2e/cross-tab-sync.spec.ts`) uses two Playwright `page`s in one `browserContext`, which share localStorage and IndexedDB exactly like two real tabs on one profile — the setup real `BroadcastChannel` delivery needs, unlike the direct-IndexedDB seeding other e2e specs use (which never goes through the save path, so never triggers a broadcast).
