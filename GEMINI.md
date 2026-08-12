# Selara Development Standards

This document defines the foundational mandates for all automated engineering tasks within the **Selara** repository (forked from [Scenia](https://github.com/waylonkenning/scenia) by Waylon Kenning, under the Apache License 2.0 — see `LICENSE`).

## Philosophy

Scenia's original process (User Story → Playwright TDD → build) fits a general-purpose UI tool, where most work is adding a feature whose acceptance criteria are obvious just from looking at the screen. Selara's hardest work isn't that — it's getting *domain rules* right for something with real regulatory stakes (a bank's OJK filing), where the correct answer isn't obvious upfront and has to be worked out with someone who has the domain knowledge an engineer or a model doesn't. That calls for a different set of priorities:

1. **Rules before pixels.** The primary risk in this product is a wrong business rule — a deliverable misclassified as "new" when it's an upgrade, a report row generated for the wrong year — not a UI bug. Cosmetic issues are cheap to fix later; a wrong regulatory classification isn't. Domain-rule correctness gets the process rigor below; UI polish doesn't need the same ceremony.
2. **Nothing ambiguous gets built silently.** Any time a requirement has more than one reasonable reading, it gets discussed and decided *before* code, not guessed at and corrected later (see Step 0). Nobody — human or model — silently picks an interpretation of a business rule on the project's behalf.
3. **Test at the altitude of the risk.** A pure function gets a unit test because the risk lives in its logic. A UI workflow gets an E2E test because the risk lives in the interaction. Forcing everything through one test type, as Scenia's original rule did, tests the wrong thing for half of Selara's actual work.
4. **Rejected alternatives are as valuable as decisions.** Recording *why* an option was turned down is what stops the same debate from happening again once the reasoning is forgotten. A rules-heavy product treats its design docs as accumulating institutional memory, not one-time specs.

## 0. Design Discussion (for ambiguous or domain-heavy work)

Before Step 1, when a requirement involves a genuinely open design question — a domain rule with more than one reasonable interpretation, a data-model change with real tradeoffs, something where "just write the test and go" would mean guessing at intent — work it out in conversation first:

1. Brainstorm the options and tradeoffs directly with the user; don't silently pick one.
2. Record the decision (and the reasoning, and any rejected alternatives) in a design-notes doc under `requirement-specs/` before writing any code. Keep deciding-in-progress items in an "Open questions" section; move them to "Decided" once resolved.
3. Only proceed to Step 1 once the shape of the change is actually settled.

Skip this step for straightforward bug fixes or features with an unambiguous, already-agreed shape — go straight to Step 1.

## 1. Development Lifecycle

All feature development and bug fixes must follow this sequence:

1. **Define Requirements:**
   - User-facing features get a **User Story** with clear Acceptance Criteria in `docs/user-stories/`.
   - Complex domain rules (data-model behavior, generation/derivation logic, anything with edge cases worth writing down) get a **design-notes doc** in `requirement-specs/` instead — see Step 0. A feature can have both: a user story for what the user sees, a requirement-spec for the rule engine behind it.
2. **Test-Driven Development (TDD):**
   - **UI-facing behavior** (a new screen, a user interaction, an end-to-end workflow): write a **Playwright E2E test** in `e2e/`.
   - **Pure logic** (a function in `src/lib/` with no DOM dependency — data transforms, generation rules, derivations): write a **Vitest unit test** next to it (`*.test.ts`). Faster to run, and pinpoints the exact function under test.
   - Either way: confirm the test **fails first (Red)** before writing the implementation.
3. **Implementation:**
   - Write the minimal code necessary to fulfill the requirements.
   - Adhere to established patterns (React, Tailwind, IndexedDB).
4. **Verification:**
   - Run the specific test to confirm it passes (Green).
   - Run the full suite — `npm run test:unit` and `npx playwright test` — to ensure no regressions. Both must be green before committing.
5. **Documentation:** Update the relevant page(s) in `docs/user-guide/`, the originating doc in `docs/user-stories/` or `requirement-specs/`, and any relevant README sections. Data-model changes get an ADR in `docs/adr/` (see `docs/adr/README.md` for when one's warranted) and an update to `docs/database-diagram.md`.
6. **Commit & Push:** Only commit once the full suite is green. Push and deployment triggers: **TBD** — update this section once Selara's own CI/CD pipeline is set up. Don't assume Scenia's Google Cloud Build trigger or `scenia.website` deployment apply here; they're Waylon Kenning's infrastructure, not this fork's.

## 2. Technical Stack

- **Frontend:** React (TypeScript) + Vite
- **Styling:** Tailwind CSS
- **State/Persistence:** IndexedDB (via `idb` library)
- **Testing:** Vitest (unit) + Playwright (E2E)
- **Deployment:** TBD — the inherited `Dockerfile`/`cloudbuild.yaml` build a Docker image served via Nginx on port 8080, but the actual hosting target (Cloud Run, elsewhere) hasn't been set up for this fork yet.

## 3. Deployment Targets

- **Production URL:** TBD
- **CI/CD Configuration:** TBD — `cloudbuild.yaml` is inherited from Scenia and untouched; confirm it still fits before relying on it.
- **Environment:** Containerised via `Dockerfile` (Nginx on port 8080)
