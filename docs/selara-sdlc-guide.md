# Selara SDLC Guide — From Idea to Production

This guide walks through the full development lifecycle for a Selara feature, following the process defined in `CLAUDE.md`. Every step is mandatory — skip none, except Step 0 which only applies when the requirement is genuinely ambiguous.

---

## Overview

```
0. Design Discussion (if ambiguous)  →  1. Write User Story  →  2. Write Failing Test  →
3. Implement  →  4. Verify  →  5. Document  →  6. Commit & Push
```

---

## Step 0 — Design Discussion (for ambiguous or domain-heavy work)

Before writing a User Story, check whether the requirement is actually settled. If it involves a domain rule with more than one reasonable interpretation, or a data-model change with real tradeoffs, **don't guess** — work it out first.

### When this applies

- A business rule that isn't obvious from the feature request alone (e.g. "when exactly does a deliverable count as an upgrade vs. a new build?").
- A data-model change where more than one shape would work, and the tradeoffs matter (e.g. where should a default value live — on the category, or the item itself?).
- Anything where "just write the test and go" would mean silently picking an interpretation on the user's behalf.

Skip this step entirely for straightforward bug fixes or features with an unambiguous, already-agreed shape.

### What to do

1. Brainstorm the options and tradeoffs directly with the user — lay out what you found in the code, name the real forks, and ask rather than assume.
2. Record the decision, the reasoning, and any rejected alternatives in a design-notes doc under `requirement-specs/`. Keep in-progress items under an "Open questions" heading; move them to "Decided" once resolved.
3. Only move to Step 1 once the shape of the change is actually settled.

### Example

`requirement-specs/rpti-auto-generation.md` records this pattern in practice — including a "Considered and rejected" section explaining *why* an alternative (using `Milestone` as a data source) was turned down, not just what was chosen instead. That's the point: the next person shouldn't have to re-litigate a decision whose reasoning got lost.

---

## Step 1 — Define the User Story

Before writing a single line of code or test, document the requirement.

### Where to put it

- **User-facing features** get a User Story in `docs/user-stories/`. Each file covers a feature domain (e.g. `02-initiative-management.md`). Add your story to the appropriate file, or create a new numbered file if it belongs to a new domain.
- **Complex domain rules** (data-model behavior, generation/derivation logic) get a design-notes doc in `requirement-specs/` instead — see Step 0. A feature can have both: a user story for what the user sees, a requirement-spec for the rule engine behind it.

### Format

```markdown
## US-{DOMAIN}-{NUMBER}: {Short Title}

**As an** {role},
**I want** {capability},
**so that** {benefit}.

**Acceptance Criteria:**
- {Specific, testable criterion}
- {Specific, testable criterion}
- {Specific, testable criterion}
```

### Example

```markdown
## US-IM-02: Delete an Initiative

**As an** IT portfolio manager,
**I want** to delete an initiative from the edit panel,
**so that** I can remove cancelled or mistaken entries.

**Acceptance Criteria:**
- A delete button is visible in the InitiativePanel for existing initiatives
- Clicking delete shows a confirmation modal (no browser `window.confirm`)
- Confirming removes the initiative from the timeline and from IndexedDB
- Cancelling keeps the initiative unchanged
```

### Rules
- Each acceptance criterion must be directly testable — avoid vague language like "works correctly".
- The story is the source of truth. If a criterion is not in the AC, it is out of scope.
- Use the `US-{DOMAIN}-{NUMBER}` ID convention (e.g. `US-TV-01`, `US-IM-03`).

---

## Step 2 — Write the Failing Test (Red)

Pick the test type that matches where the risk actually lives — see `CLAUDE.md`'s Philosophy section.

### UI-facing behavior → Playwright E2E

A new screen, a user interaction, an end-to-end workflow. Tests live in `e2e/`, named after the feature:

```
e2e/confirm-modal.spec.ts
e2e/initiative-delete.spec.ts
e2e/version-history.spec.ts
```

```typescript
import { test, expect, Page } from '@playwright/test';

// Selector constants at the top — never inline magic strings
const PANEL = '[data-testid="initiative-panel"]';
const DELETE_BTN = '[data-testid="delete-initiative-btn"]';
const CONFIRM_MODAL = '[data-testid="confirm-modal"]';
const CONFIRM_BTN = '[data-testid="confirm-modal-confirm"]';
const CANCEL_BTN = '[data-testid="confirm-modal-cancel"]';

async function openInitiativePanel(page: Page) {
  await page.goto('/');
  await page.waitForSelector('[data-initiative-id]');
  const bar = page.locator('[data-initiative-id]').first();
  await bar.click({ force: true });
  await page.getByTestId('initiative-action-edit').click();
  await expect(page.locator(PANEL)).toBeVisible();
}

test.describe('Initiative deletion', () => {
  test('delete button is visible in the panel', async ({ page }) => {
    await openInitiativePanel(page);
    await expect(page.locator(DELETE_BTN)).toBeVisible();
  });

  test('confirming removes the initiative from the timeline', async ({ page }) => {
    await openInitiativePanel(page);
    const initiativeId = await page.locator('[data-initiative-id]').first().getAttribute('data-initiative-id');

    await page.locator(DELETE_BTN).click();
    await page.locator(CONFIRM_BTN).click();

    await expect(page.locator(`[data-initiative-id="${initiativeId}"]`)).not.toBeVisible();
  });
});
```

Confirm it fails:

```bash
npx playwright test e2e/initiative-delete.spec.ts
```

### Pure logic → Vitest unit test

A function in `src/lib/` with no DOM dependency — data transforms, generation rules, derivations. Tests live next to the source file (`*.test.ts`):

```
src/lib/rpti.test.ts
src/lib/workspaceState.test.ts
```

```typescript
import { describe, expect, it } from 'vitest';
import { generateRptiDetails } from './rpti';

describe('generateRptiDetails', () => {
  it('classifies as "upgrade" when the deliverable already went live in a prior year', () => {
    const rows = generateRptiDetails(/* ... */);
    expect(rows[0]).toMatchObject({ developmentType: 'upgrade' });
  });
});
```

Confirm it fails:

```bash
npx vitest run src/lib/rpti.test.ts
```

### Either way

Verify the test **fails (Red)** before writing any implementation. If it passes before implementation, the test is wrong — fix it.

---

## Step 3 — Implement the Feature

With a failing test as the target, write the minimal code to make it pass.

### Guidelines

- **Minimal:** only add what is required to satisfy the AC. Do not add extra fields, options, or abstractions "for later".
- **Patterns:** follow established patterns — React functional components, Tailwind for styling, `idb` for IndexedDB persistence.
- **`data-testid` attributes:** every interactive element E2E tests target must have a stable `data-testid`. Never use class names or text content as test selectors.
- **No `window.confirm`:** all destructive confirmations use the in-app `ConfirmModal` component.

### Common file locations

| What | Where |
|------|-------|
| React components | `src/components/` |
| Pure business logic | `src/lib/` |
| Types / interfaces | `src/types.ts` |
| E2E tests | `e2e/` |
| Unit tests | next to the source file, `*.test.ts` |

---

## Step 4 — Verify (Green + No Regressions)

### Run the specific test

```bash
npx playwright test e2e/initiative-delete.spec.ts
# or
npx vitest run src/lib/rpti.test.ts
```

### Run the full suites

```bash
npm run test:unit
npx playwright test
```

**Every test must pass, in both suites.** A regression anywhere blocks the commit — fix the regression before proceeding. Do not skip or disable existing tests.

### Debugging failures

```bash
npx playwright test --ui       # interactive debugging
npx playwright test --headed   # watch the browser
npx playwright show-report     # HTML report after a run
npx vitest --ui                # interactive unit test runner
```

---

## Step 5 — Document

Update the relevant documentation before committing. Documentation is not optional.

### User guide

Add or update pages in `docs/user-guide/` that describe the feature to an end user. The directory mirrors the feature domain structure:

```
docs/user-guide/03-initiatives/deleting-an-initiative.md
```

Keep pages concise — what the user sees, what they click, what happens.

### User story or requirement-spec

If the implementation deviated from any AC, update `docs/user-stories/` to match reality. If a domain rule from Step 0 evolved during implementation, update its `requirement-specs/` doc — including moving anything newly decided out of "Open questions."

### ADRs and the database diagram

Data-model changes get an ADR in `docs/adr/` (see `docs/adr/README.md` for when one's warranted) and an update to `docs/database-diagram.md`.

### README / FEATURES

If the feature is user-visible and significant, add a line to `FEATURES.md`.

---

## Step 6 — Commit & Push

Only commit once:
- The specific test passes (Green)
- Both full suites pass (`npm run test:unit` and `npx playwright test`) — no regressions
- Documentation is updated

### Commit message format

Use a conventional commit prefix and keep the subject line under 72 characters:

```
feat: add delete confirmation modal to InitiativePanel (US-IM-02)
fix: prevent browser dialog on dependency delete (US-DM-05)
test: add E2E coverage for cascading deletes (US-IM-02)
docs: update deleting-an-initiative user guide
```

Reference the User Story ID in the message when applicable.

### Push

```bash
git push
```

**Deployment is TBD for this fork** — see `CLAUDE.md`'s Deployment Targets section. Don't assume a push automatically deploys anywhere; that was Scenia's original Cloud Build setup (`scenia.website`), not this fork's. Update this section once Selara's own CI/CD pipeline exists.

---

## Quick Reference Checklist

```
[ ] (If ambiguous) Design discussed and decided in requirement-specs/ before Step 1
[ ] User story written with testable AC in docs/user-stories/ (or a requirement-spec for domain rules)
[ ] Test written — Playwright for UI, Vitest for pure logic — confirmed FAILING before implementation
[ ] Feature implemented with data-testid attributes on all interactive elements
[ ] Specific test passes (Green)
[ ] Both full suites pass — npm run test:unit AND npx playwright test
[ ] Documentation updated — user guide, user-stories/requirement-specs, ADR + database-diagram.md if schema changed
[ ] Committed with conventional message referencing US ID
[ ] Pushed — deployment is manual/TBD until Selara's own pipeline is set up
```
