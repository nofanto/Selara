# ADR-0002: Add an in-app portfolio decision log

## Status

Accepted

## Context and Problem Statement

Scenia has no way for its end users (portfolio managers) to record *why* a decision was made about an initiative, programme, or asset — only Version History (a full-state snapshot mechanism) and free-text `description` fields on individual entities. This is a different, new product feature: an in-app, IndexedDB-backed decision log, distinct from the git-tracked `docs/adr/` engineering log this directory holds (see [ADR-0001](0001-record-architecture-decisions.md)) — that log is for developers reasoning about Scenia's own codebase, not for end users reasoning about their portfolio.

Adding this requires a new IndexedDB object store (`decisions`), which is the kind of data-model change `docs/adr/README.md` calls out as worth recording — so this decision is captured here before implementation.

## Decision Drivers

- Must not be confused with, or duplicate, the engineering `docs/adr/` log.
- Must fit the existing IndexedDB schema/migration pattern (`src/lib/db.ts`) rather than introduce a new persistence mechanism.
- Should let a decision reference the specific portfolio item it concerns, without forcing every decision to have one.
- Should minimize overhead for small, routine decisions — not every field should be mandatory.

## Considered Options

- No dedicated feature — rely on the `description` field on Initiative and free-text notes.
- A modal (popup), matching the Version History pattern.
- A full-page tab with a two-pane list+detail layout, matching the Data Manager / Version History structural pattern but as a dedicated view rather than a modal.

## Decision Outcome

Chosen option: "A full-page tab with a two-pane list+detail layout" (`Decisions`, next to Visualiser / Data Manager / Reports / Guide in the header navigation), backed by a new `decisions` object store at IndexedDB schema version 14, structured after MADR (Status, Context, Considered Options, Decision Outcome, Consequences). A decision may optionally set `linkedEntityType`/`linkedEntityId` to reference exactly one Initiative, Programme, or Asset — modeled after the existing polymorphic pattern used by `Dependency.sourceType`/`sourceId`.

### Pros and Cons of the Options

#### No dedicated feature

- Good, because zero implementation cost.
- Bad, because rationale ends up scattered across free-text description fields with no structure, no status lifecycle, and no way to browse decisions independently of the item they relate to.

#### Modal, matching Version History

- Good, because lower implementation footprint, consistent with an existing pattern (`isVersionManagerOpen` + toolbar icon).
- Bad, because decision records are long-form structured documents (multiple text fields), which read poorly in a cramped popup compared to a dedicated page with room for a list and a detail pane side by side.

#### Full-page tab, two-pane layout

- Good, because it gives decisions the same first-class navigation status as Data Manager and Reports, and the two-pane list+detail layout (modeled on `VersionManager.tsx`) comfortably fits the MADR field set.
- Bad, because it adds a permanent slot to the header navigation, whereas a modal would not.

## Consequences

- IndexedDB schema bumped to version 14 (`decisions` store, `keyPath: 'id'`, no seeding — empty by default in every workspace template).
- `AppState`, `TemplateAppData`, and `Version.data` (optional field, for backward compatibility with existing saved versions) all now carry a `decisions` array; every `handleUpdate`-style call site in `src/App.tsx` threads it through, following the exact pattern used when `dtsPhases` was added at schema version 13.
- `InitiativePanel` gains an optional "Linked Decisions" section; Programme and Asset don't have an equivalent detail panel yet, so decisions linked to them are only browsable from the Decisions list itself for now.
- Covered by `e2e/decisions.spec.ts` (create, required-title validation, status transitions, delete, and initiative linking).
