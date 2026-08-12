# ADR-0001: Record architecture decisions with ADRs

## Status

Accepted

## Context and Problem Statement

Selara's `CLAUDE.md` mandates a strict SDLC (User Story → TDD → Implementation → Verification → Documentation → Commit/Push), but nothing in that lifecycle captures **why** a non-trivial technical or architectural choice was made — only what was built and how to use it. `docs/user-guide/` is purely end-user facing. One-off reports like `docs/sync-audit.md` and `docs/security-review-indexeddb.md` contain decisions (e.g. "add HTTP security headers") but were never captured as discrete, indexed records, so that rationale is easy to lose track of as the codebase evolves. There's no existing ADR/RFC convention anywhere in the repo or its history.

## Decision Drivers

- Need a searchable, durable record of *why* a technical/architectural choice was made, not just what changed (git log and PR descriptions decay in discoverability over time).
- Must fit the repo's existing documentation idioms rather than introduce an unfamiliar structure.
- Must not add meaningful overhead to small, routine changes.

## Considered Options

- No formal process — rely on commit messages and PR descriptions.
- Lightweight Nygard-style ADRs (Title, Status, Context, Decision, Consequences).
- Structured MADR-style ADRs (adds Decision Drivers, Considered Options, Pros/Cons per option).

## Decision Outcome

Chosen option: "Structured MADR-style ADRs", stored under `docs/adr/` as sequentially numbered, immutable Markdown files with a `README.md` index — following the same directory-with-index pattern already used by `docs/user-stories/` (`US-{DOMAIN}-{NUMBER}`) and `docs/user-guide/`.

ADR creation is **conditional**, not mandatory for every change: `CLAUDE.md` Step 1 ("Define Requirements") now calls for an ADR only when a change involves a non-trivial architectural or technical tradeoff — a new dependency, a data model/schema change, an infrastructure/deploy change, or the reversal of a prior decision. Routine feature work and bug fixes are unaffected.

### Pros and Cons of the Options

#### No formal process

- Good, because zero overhead.
- Bad, because rationale is scattered across commit messages and PR threads with no index, and is effectively unsearchable once a PR is merged and closed.

#### Lightweight Nygard-style ADRs

- Good, because minimal friction, matches the terse style of existing Selara docs.
- Bad, because it doesn't force enumeration of alternatives considered, which is often the most valuable part of a decision record for future readers.

#### Structured MADR-style ADRs

- Good, because it forces explicit listing of decision drivers and alternatives, making the record useful even to someone who disagrees with the outcome.
- Bad, because more time to write per record — mitigated by only requiring it for non-trivial decisions.

## Consequences

- New non-trivial technical/architectural decisions must be recorded under `docs/adr/` before implementation begins (see `docs/adr/README.md` for the process and numbering convention).
- `CLAUDE.md` and `GEMINI.md` (kept in lockstep) both reflect this conditional requirement.
- Past decisions (e.g. choosing IndexedDB for persistence) are **not** backfilled — the record starts fresh from ADR-0001 onward.
