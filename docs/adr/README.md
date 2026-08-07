# Scenia — Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the Scenia IT Portfolio Planning tool — a log of significant technical and architectural decisions, the alternatives that were considered, and why the chosen option won.

## When to write one

Write an ADR when a change involves a **non-trivial architectural or technical tradeoff**, for example:

- Adding a new dependency or library
- A data model / IndexedDB schema change
- An infrastructure or deployment change (`Dockerfile`, `cloudbuild.yaml`, `nginx.conf`)
- Reversing or superseding a prior decision

Routine feature work and bug fixes that don't involve one of the above do **not** need an ADR — see `CLAUDE.md` Step 1 for the exact trigger.

## Format

ADRs use the [MADR](https://adr.github.io/madr/) format: `Status`, `Context and Problem Statement`, `Decision Drivers`, `Considered Options`, `Decision Outcome` (with Pros/Cons per option), `Consequences`. Copy [`template.md`](template.md) to start a new one.

## Numbering convention

- Filename: `NNNN-kebab-case-title.md` — a 4-digit, zero-padded, sequential number, assigned in order and never reused.
- The number in the filename must match the `ADR-NNNN` heading inside the file.

## Status lifecycle

`Proposed` → `Accepted` → optionally `Deprecated` or `Superseded by ADR-NNNN`.

An ADR is never edited to reverse its outcome — if circumstances change, write a new ADR that supersedes it and update the old one's status.

## Index

| ID | Title | Status |
|----|-------|--------|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions with ADRs | Accepted |
| [0002](0002-in-app-decision-log.md) | Add an in-app portfolio decision log | Accepted |
| [0003](0003-rpti-report-and-application-type.md) | Add an RPTI report, a typed Application field, and an Initiative→target join | Accepted |
