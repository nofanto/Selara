# ADR-0016: Repair missing object stores in a v20 upgrade, not by skipping them

## Status

Accepted

## Context and Problem Statement

[ADR-0015](0015-workspace-backup-and-conditional-replacement.md) made every workspace read and write one IndexedDB transaction over all the workspace stores: the 14 entity stores, `settings` and `versions`. `readPersistedWorkspace` and `runWorkspaceTransaction` in `src/lib/db.ts` name every store unconditionally, so a partial read or write can't happen.

Before M1, `getAppData` and `saveAppData` checked `db.objectStoreNames.contains(...)` before touching most stores and skipped any that were missing. M1 dropped those checks.

On 2026-09-30, a planner started the M1 branch against their existing browser profile. The database was at version 19 but was missing at least one store. The load failed with `NotFoundError: … One of the specified object stores was not found` (`readPersistedWorkspace`). The app then showed its built-in fallback workspace instead of theirs, and every save failed with "Failed to save changes". The profile was cleared before the database's store list could be captured.

Nothing in the atomic path lost data: the transaction throws before any write. The workspace was still unusable, though, and the only way out left to the planner was deleting the database.

A database can be at version 19 without every store version 19 implies. `upgrade()` only runs the steps for versions the database hadn't passed yet, and most stores are created only under `oldVersion < N` guards. One way this happens: a database created by a build with a different schema at the same version number, from before this fork's schema settled. Once a database has that version, no later open creates the store.

Pull request #69 (spec 005) surfaced this. The verification log is [`specs/005-workspace-recovery/verification.md`](../../specs/005-workspace-recovery/verification.md).

## Decision Drivers

- **No silent omission.** A workspace store that can't be read or written must never be skipped quietly. That is the property ADR-0015's atomic path exists for, and backup and Restore depend on it.
- **Existing stores and records stay exactly as they were**, including orphaned stores such as `dtsPhases`.
- **Recovery without planner action.** A planner shouldn't have to delete their database to get their workspace back.
- IndexedDB can only create object stores inside a version-change transaction, so creating a store requires opening the database at a higher version.

## Considered Options

- **A. Bump `DB_VERSION` to 20, with an idempotent upgrade step that creates every missing required store** with its correct key path. *(chosen)*
- **B. Restore `objectStoreNames.contains(...)` checks in the atomic read and write**, as `main` had them.
- **C. Repair on open without a fixed version.** Detect a missing store at runtime, then reopen at `db.version + 1` to create it.
- **D. No code change: tell affected planners to clear their database.**

## Decision Outcome

Chosen option: **A**, because it is the only option that keeps the atomic path strict and also brings an affected database back into a usable state automatically.

In `src/lib/db.ts`, `DB_VERSION` becomes 20. The `upgrade()` callback now begins with a repair step:
- every name in `ENTITY_STORES`, plus `versions`, is created with `{ keyPath: 'id' }` if missing;
- `settings` is created as an out-of-line-key store if missing.

The key paths match what each store was originally created with (see [`docs/database-diagram.md`](../database-diagram.md)).

The repair runs on every upgrade, not only from v19, and does nothing where every store exists. It runs before the older migration steps, so a database missing a store an old step reads, such as `rptiDetails` for the v16 and v18 rewrites, now upgrades instead of aborting. The old steps still skip anything that already exists.

No existing store is deleted, recreated or rewritten, and no record is touched. `readPersistedWorkspace` and `runWorkspaceTransaction` stay unconditional.

### Pros and Cons of the Options

#### A. v20 upgrade that creates missing stores

- Good, because the affected database recovers on the next load, with every existing record intact.
- Good, because the atomic read and write still cover every store, so nothing can be silently skipped.
- Good, because it is idempotent and runs on any future upgrade too.
- Bad, because it is one-way: a browser that has opened v20 can't be opened by a v19 build (see Consequences).

#### B. Skip missing stores in the atomic path

- Good, because it needs no version bump.
- Bad, because a missing `decisions` store would mean the decision log is never saved, and a backup or Restore Backup would leave it out. That silently omits data, which ADR-0015 and the backup contract forbid.
- Bad, because the missing store never comes back. Every later save keeps dropping that part of the workspace.

#### C. Repair on open at `db.version + 1`

- Good, because it would repair without a code-defined version.
- Bad, because the schema version would then vary between browsers instead of being defined in code. Future migrations keyed on `oldVersion` couldn't rely on it.
- Bad, because a second version-change open during load is more moving parts than a single upgrade step.

#### D. Tell planners to clear the database

- Bad, because it loses the workspace and its History. That is the outcome M1 exists to prevent.

## Consequences

- **Version 20 is one-way.** Once a browser has opened Selara at version 20, a build still at version 19 fails to open that database. Examples are `main` before PR #69 merges, or an older deployed copy. IndexedDB refuses to open an existing database at a lower version (`VersionError`). That build then shows its fallback workspace, and its saves fail. The same applies to anything sharing the origin, such as two dev servers on `localhost:3000`. There is no downgrade path. Moving back means taking a backup or export from the version-20 build and restoring or importing it into a fresh profile on the older one.
- **The upgrade waits for old tabs.** A version-19 tab still open on the same origin keeps its connection, and the version-20 upgrade waits until that tab is closed. `db.ts` has no `blocked` or `blocking` handler. Every earlier version bump behaved the same way, and this ADR doesn't change it.
- **Stores keep being created additively.** The repair only creates stores, consistent with this database's additive-only migration history. Orphaned stores (`dtsPhases`, `applications`, …) are kept.
- **Tests:** `e2e/db-schema-repair.spec.ts` seeds a version-19 database holding the app's real template workspace, a saved Version and the orphaned `dtsPhases` store. One case leaves out `decisions` and `lkptiDetails`; the other is complete. Each asserts the version-20 upgrade, key paths, unchanged records, the load, and a later save that survives a reload.
