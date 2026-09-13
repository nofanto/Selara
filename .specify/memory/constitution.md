<!--
SYNC IMPACT REPORT
Version change: (none) → 1.0.0
Rationale: initial ratification. Selara's principles already existed in CLAUDE.md and were
being followed; this records them in the governance format rather than introducing new rules.
MAJOR bump is not applicable to a first version, so 1.0.0 is the baseline.

Principles (all newly recorded here, four carried verbatim in substance from CLAUDE.md):
  + I.   Rules Before Pixels                  (CLAUDE.md philosophy 1)
  + II.  Nothing Ambiguous Gets Built Silently (CLAUDE.md philosophy 2, Step 0)
  + III. Test at the Altitude of the Risk      (CLAUDE.md philosophy 3)
  + IV.  Rejected Alternatives Are Recorded    (CLAUDE.md philosophy 4)
  + V.   Verification Is Enforced, Not Reported (NEW — not in CLAUDE.md; derived from repo
         policy established in PR #37, where continue-on-error was removed and the known
         typecheck error was ratcheted rather than silenced. Flagged for explicit approval.)

Sections added:
  + Development Lifecycle          (CLAUDE.md §0 and §1, unchanged in substance)
  + Records and Documentation      (docs/adr/, requirement-specs/, docs/user-stories/, user guide)
  + Governance

Deferred / TODO: none.
-->

# Selara Constitution

## Core Principles

### I. Rules Before Pixels

Domain-rule correctness MUST take precedence over interface polish when the two compete for
attention. Selara's output is a bank's regulatory filing to OJK; a deliverable misclassified as
new rather than an upgrade, or a report row generated for the wrong period, reaches a regulator
and cannot be withdrawn by shipping a patch. A cosmetic defect can.

Concretely: changes to generation, classification, validation or period logic MUST be treated as
higher risk than changes to layout, styling or navigation, and MUST carry the process weight
described in the Development Lifecycle. UI work does not require the same ceremony.

### II. Nothing Ambiguous Gets Built Silently

When a requirement admits more than one reasonable reading, the reading MUST be settled with the
product owner before code is written — never chosen by whoever implements it first.

Neither a human nor a model may adopt an interpretation of a business rule on the project's
behalf. Where an ambiguity is discovered mid-implementation, work that does not depend on the
answer SHOULD continue while the question is raised; work that does depend on it MUST stop.

This applies with equal force to *reversing* a settled reading: a decision that turns out to be
wrong is superseded in writing, with the reason it changed, and never edited away.

### III. Test at the Altitude of the Risk

Tests MUST be written where the risk actually lives, and MUST be seen to fail before the code
that satisfies them is written.

- Pure logic (functions in `src/lib/` with no DOM dependency — transforms, generation rules,
  derivations) MUST have Vitest coverage adjacent to the source.
- UI-facing behaviour (a screen, an interaction, an end-to-end workflow) MUST have a Playwright
  test in `e2e/`.

A test that has never been observed failing has not been shown to test anything. Where a test is
added after its implementation, it MUST be verified to have teeth — by temporarily reverting the
implementation and confirming the failure — before being treated as coverage.

### IV. Rejected Alternatives Are Recorded

A decision record MUST state what was turned down and why, not only what was chosen.

Recording the rejected option is what prevents the same debate recurring once the reasoning is
forgotten, and what allows a future reversal to be made knowingly rather than accidentally. A
decision that lists only its outcome is incomplete.

### V. Verification Is Enforced, Not Reported

A check that can fail MUST fail the build. Checks MUST NOT be configured to report a failure
while presenting as successful.

Where known debt prevents a check from passing, it MUST be *ratcheted* — a recorded baseline that
tolerates the existing failures while failing on any regression — rather than suppressed. The
baseline MUST be visible, and clearing it MUST prompt closing the ratchet.

Rationale: a green tick over a failing check is worse than no check, because it converts an
absence of verification into a false assurance of it.

## Development Lifecycle

Work follows this sequence. Step 0 applies only where it is needed; Steps 1-6 always apply.

**0. Design discussion** — for a domain rule with more than one reasonable reading, a data-model
change with real tradeoffs, or anything where writing the test first would mean guessing at
intent. Options and tradeoffs are worked through with the product owner, then recorded in a
design-notes document under `requirement-specs/` before any code. Undecided items stay in an
"Open questions" section until resolved. Straightforward bug fixes and features with an agreed
shape skip this step.

**1. Define requirements** — user-facing features get a user story with acceptance criteria in
`docs/user-stories/`; complex domain rules get a design-notes document in `requirement-specs/`.
A feature may need both.

**2. Test-driven development** — write the test, confirm it fails (Red), per Principle III.

**3. Implementation** — the minimal code that satisfies the requirement, following established
patterns (React, Tailwind, IndexedDB).

**4. Verification** — the specific test passes (Green), and the full suite is green:
`npm run test:unit` and `npx playwright test`. Both MUST pass before committing.

**5. Documentation** — update the relevant `docs/user-guide/` pages, the originating user story
or requirement-spec, and any affected README sections. Data-model changes get an ADR in
`docs/adr/` and an update to `docs/database-diagram.md`.

**6. Commit and push** — only once the suite is green. Commits, pushes, pull requests and merges
happen only on explicit request.

## Records and Documentation

Four record types, each with a distinct job. They MUST NOT be conflated:

| Location | Records |
|---|---|
| `docs/adr/` | Architecture decisions — MADR format, numbered, never edited to reverse an outcome; a reversal is a new ADR that supersedes |
| `requirement-specs/` | Domain design notes, open questions, and amendments dated in place |
| `docs/user-stories/` | User-facing behaviour with acceptance criteria |
| `docs/user-guide/` | End-user documentation, rendered inside the product by `HelpView` |

Because the user guide is rendered in-app, documentation drift is a product defect rather than a
housekeeping matter.

An amendment to a requirement-spec MUST be dated and MUST state what changed and why, leaving the
superseded reasoning readable. The same applies to an ADR's status transition.

## Governance

This constitution records how Selara is built. `CLAUDE.md` remains the operational companion for
day-to-day agent guidance; where the two overlap, this document states the principle and
`CLAUDE.md` states the practice. If they conflict, the conflict is a defect in one of them and
MUST be resolved rather than worked around.

**Amendment procedure.** Amendments require an explicit decision from the product owner, a
recorded rationale, and a version bump. An amendment that changes how work is verified or
approved MUST also state what happens to work already in flight.

**Versioning.** Semantic versioning applies to this document:

- **MAJOR** — a principle is removed or redefined in a backward-incompatible way.
- **MINOR** — a principle or section is added, or guidance is materially expanded.
- **PATCH** — clarification, wording, or non-semantic refinement.

**Compliance review.** Pull requests are expected to comply. Where a change departs from a
principle, the departure MUST be stated in the pull request rather than left for a reviewer to
notice. Complexity that a principle does not obviously justify MUST carry its justification with
it.

**Version**: 1.0.0 | **Ratified**: 2026-08-09 | **Last Amended**: 2026-09-13
