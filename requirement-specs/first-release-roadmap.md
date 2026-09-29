# Selara first-release roadmap

**Prepared:** 2026-09-27  
**Audience:** Individual IT planners at Indonesian commercial banks  
**Status:** Proposed implementation roadmap. The audience is confirmed; recommendations and unresolved domain choices below are not approved business rules. No implementation is included in this document.

## Release outcome

A planner can independently import existing returns, understand discrepancies, maintain the underlying plan and inventory, prepare a checked draft for the bank's review, and recover the workspace from a downloaded backup.

The supported reporting scope is **RPTI Format 3.1** and **LKPTI Format 3.2.6 — Daftar Aplikasi**. Do not describe the latter as preparation of the whole LKPTI. Submission and institutional approval remain in the bank's process; Selara does not establish regulatory acceptance.

The proposed positioning is: **Prepare your bank's IT development plan and application inventory from one connected workspace.**

## Decided and existing foundations

- The user confirmed Indonesian commercial banks and self-service use by an individual planner as the initial audience.
- Retain the existing local-first architecture for this release. The accepted [IT planning flow](it-planning-flow.md) already describes one preparer with contributions from owners, without requiring concurrent editing or a backend.
- Reuse the existing RPTI/LKPTI importers, selected reporting years, implementation-based RPTI generation, Data Health grouping and repair actions, Excel round trips, History, and decisions. These are foundations, not new backlog items.
- The accepted onboarding direction is downloadable sample returns through the real import path, eventually replacing the separate demo workspace. Samples already exist in [docs/sample-data](../docs/sample-data/README.md).
- The accepted filing direction is a complete revision represented by a saved `Version` plus submission metadata, with deletion protection. Do not introduce a second snapshot system.
- The bank keeps the actual submitted Excel file. Selara does not become a submission-document repository. Retaining exact submitted files inside Selara is not adopted because it conflicts with that recorded decision.
- Keep report generation aligned with [report rows as projections](report-rows-as-projections.md) and [ADR-0014](../docs/adr/0014-rpti-rows-belong-to-implementations.md). Older descriptions in `it-planning-flow.md` predate those changes; do not restore superseded generation behavior.

## Scope boundaries

**Required for the first public release:** clear scope and claims; safe backup/restore and workspace replacement; understandable onboarding; validation of the exact selected report; inclusion/exclusion explanations; filing snapshots using existing History; focused Indonesian terminology; production deployment and recovery documentation; a successful planner pilot.

**Deferred:** accounts, SSO, shared editing, approval routing, hosted sharing, direct OJK submission, AI assistants, arbitrary spreadsheet/PDF ingestion, automated fuzzy matching, a general owner-contribution portal, supplier master data, advanced financial forecasting, effort-based capacity planning, and a timeline redesign.

Keep existing general workspace import/export available. Deferring a new contribution workflow does not remove working spreadsheet interchange. A later enterprise release can revisit collaboration after individual use is validated.

Hosted sharing ([#5](https://github.com/nofanto/Selara/issues/5)) stays deferred with the other collaboration work; `SHARING_ENABLED` remains `false` for this release.

## Open GitHub issues mapped to this roadmap

Several open issues are already-diagnosed parts of the milestones below. Start from the issue's recorded cause and measurements rather than re-deriving them.

| Issue | Roadmap item | Note |
|---|---|---|
| [#62](https://github.com/nofanto/Selara/issues/62) Open shared replaces the workspace with no confirmation and no undo | R1-05 | The suggested first slice. `App.handleViewerImport` saves directly and bypasses `handleUpdate`; the issue lists three candidate fixes. |
| [#47](https://github.com/nofanto/Selara/issues/47) RPTI importer's input contract is a Selara export, not an OJK return | R1-02, D6 | Lists concrete value mismatches (category codes, `TW1`–`TW4`, `1.000.000`, `Baru`/`Pengembangan`). Its em-dash-only LKPTI category split is a cheap fix that need not wait for M0. |
| [#36](https://github.com/nofanto/Selara/issues/36) RPTI and LKPTI tabs render n² DOM nodes | R1-20a | Measured and root-caused at 300–600 applications, which is the target bank size. Needs a fix, not only a re-measurement. |
| [#60](https://github.com/nofanto/Selara/issues/60) Demo workspace can't show current-year RPTI and other features | R1-07 | Conflicts with retiring the demo. Close as superseded, or re-scope to what the samples must demonstrate. |
| [#27](https://github.com/nofanto/Selara/issues/27) User guide screenshots show Scenia branding and a pre-OJK UI | R1-16, R1-18 | The guide renders inside the product, so these images are user-facing. |
| [#61](https://github.com/nofanto/Selara/issues/61) Playwright retries hide ~13 flaky tests | R1-20 | A green suite with silent retries is weak release evidence. |
| [#59](https://github.com/nofanto/Selara/issues/59) CI uploads a stale upstream Playwright report | R1-19, R1-20 | CI must produce evidence from the actual run. |
| [#56](https://github.com/nofanto/Selara/issues/56) Category reorder lost on reload; [#63](https://github.com/nofanto/Selara/issues/63) segment link tooltip is wrong | Pre-release polish | Not release-gating; fix opportunistically. |
| [#5](https://github.com/nofanto/Selara/issues/5) Sharing with Selara's own backend | Deferred | See scope boundaries above. |

### Can start now, without M0 decisions

These are unambiguous fixes with no dependency on an open domain question:

- #62 confirmation or undo for Open shared (the first slice of R1-05).
- The #47 em-dash/hyphen category split in the LKPTI importer.
- Human-readable headings for the four Data Health checks that show raw IDs (R1-17).
- The `src/lib/excel.ts` typecheck error in version restoration (R1-04).
- #59 CI report artifact and #63 tooltip.
- The landing page's "no risk" claim (R1-16).

## Milestones and dependencies

Estimates are rough focused engineering days for one developer familiar with the codebase. They include targeted tests and documentation, but exclude waiting for domain answers and bank participants. Re-estimate after M0; these are not promised delivery dates.

| Milestone | Deliverable | Depends on | Estimated effort |
|---|---|---|---|
| M0 | Confirmed release contract and reporting evidence | None | 3–5 days |
| M1 | Safe workspace recovery and replacement | M0 backup decisions | 4–6 days |
| M2 | Self-service onboarding through real sample returns | M0 import contract, M1 | 5–8 days |
| M3 | Report-specific checks, full preview, and explanations | M0 domain decisions, M2 | 7–10 days |
| M4 | Filing revisions and comparison in History | M1, M3, filing decisions | 5–8 days |
| M5 | Consistent banking language and first-use guidance | M2–M4 workflows | 4–6 days |
| M6 | Release candidate, planner pilot, and launch evidence | M0–M5 | 3–5 engineering days plus 2–3 calendar weeks for pilot |

Total planning allowance: **31–48 engineering days**, plus pilot elapsed time. M0's estimate is engineering time only; its critical path is recruiting a bank reporting practitioner and obtaining workbooks from at least two banks, so that outreach should start immediately. Participant recruitment and deployment preparation can start earlier. Copy corrections in M5 can also start immediately; dependent implementation waits for the relevant decisions, not for every unrelated milestone.

## M0 — Establish the release contract

**Purpose:** Confirm the actual documents and rules the product must support before adding more workflow around them.

- [ ] **R1-01 — Build a reporting coverage matrix.** For each supported field and generation/validation rule, record the official source and version, relevant section/form, current implementation, test fixture, reviewer, and known limitation. Separate official requirements from Selara design choices. Have the product owner and a bank reporting practitioner review it.
- [ ] **R1-02 — Verify realistic input workbooks.** Start from [#47](https://github.com/nofanto/Selara/issues/47), which records the current parser's accepted and rejected values. Obtain permitted, anonymised examples from at least two target banks if possible. Check worksheet selection, header rows, category codes versus labels, date cells, amounts, and blank/unknown values. Confirm how users obtain these files. Keep confidential originals outside the repository; create fictional regression fixtures for supported variants.
- [ ] **R1-03 — Resolve the blocking choices in Open questions.** Record answers, reasoning, and rejected alternatives before creating implementation stories for those choices. Domain work can stop at its gate while unrelated work proceeds.

**Exit evidence:** agreed scope; reviewed coverage matrix; documented supported workbook layouts; representative expected report outputs and exclusions; no unresolved interpretation blocking M2/M3. If a genuine workbook is unsupported, specify a transparent conversion path or a bounded parser change instead of claiming it imports directly.

**Source reference:** the product review checked [OJK's PADK 1/2026 page](https://ojk.go.id/id/regulasi/Pages/PADK-1-Tahun-2026-Penyelenggaraan-Teknologi-Informasi-oleh-Bank-Umum.aspx). M0 must verify applicable annexes and subsequent changes for the release date; a link alone is not evidence that every implemented rule is correct.

## M1 — Make losing or replacing work difficult

**Planning update — 2026-09-29:** M1 now has [specification and tasks](../specs/005-workspace-recovery/spec.md) and [accepted design decisions](workspace-backup-recovery.md): 1A/2A/3A plus all seven analysis refinements. #62 is complete; the remaining R1-04–06 work below is not implemented or verified. This dated update supersedes the earlier suggestion to start with #62 while retaining the original roadmap rationale.

**Purpose:** An individual planner can recover without depending on their original browser profile.

- [ ] **R1-04 — Make workspace backup explicit.** Add a clearly named backup action and document exactly what it contains: current entities, stored report evidence, versions, decisions and links, and relevant settings. First assess whether the existing Excel round trip meets the agreed backup contract before choosing another format. Much of it already exists: the workspace export writes every entity for current state and each saved version (tagged by `versionId`), a Versions metadata sheet, and a Decisions sheet that keeps version links (`excel.test.ts` covers decisions). What is missing is a whole-workspace export → import equality test; `roundTrip.test.ts` covers import → regenerate, not backup. The one current typecheck error (`src/lib/excel.ts`, version restoration) is in this path: a snapshot whose timeline settings fail sanitisation is restored with `{}` settings. Fix it here rather than treating it as M6 cleanup. Surface when an export was initiated; do not claim the file was safely stored if the browser cannot verify that.
- [ ] **R1-05 — Unify safe restore and replacement.** Inventory every replacement path: ordinary overwrite import, Open shared, reset/onboarding replacement, and restore. Preview incoming contents and explain replacement before mutation. Cancelling or invalid input leaves current data unchanged. Resolve whether Open shared is a preview or workspace replacement rather than relying on its inconsistent name/comment. Today it replaces the whole workspace with no confirmation and no undo ([#62](https://github.com/nofanto/Selara/issues/62)).
- [ ] **R1-06 — Prove recovery and failure handling.** Restore a downloaded backup into a fresh browser profile. Handle parse, storage/quota, and persistence failures without reporting success or leaving a partly replaced workspace. Correct the guide that currently implies local History snapshots survive browser-storage clearing (`docs/user-guide/01-getting-started/what-is-selara.md` recommends Version History as a backup).

**Acceptance evidence:** round-trip equality for supported data, including decisions linked to versions; successful restoration after source-profile deletion in a disposable test; no mutation on cancel, corrupt input, or failed persistence; documented compatibility for older workbooks. Repeat recovery tests when M4 introduces filing metadata.

**Likely implementation areas:** `DataControls.tsx`, `App.tsx`, `lib/excel.ts`, `lib/db.ts`, `lib/workspaceState.ts`, and the import/export and History guides.

## M2 — Make the first useful result attainable without assistance

**Purpose:** A prospective user exercises the same path as a real planner.

- [ ] **R1-07 — Surface downloadable samples in onboarding.** Reuse the fictional sample generator and tests. Supply a short clean walkthrough plus an explicitly labelled reconciliation exercise. Preserve existing edge-case fixtures; do not weaken tests to make the demonstration look clean. Retire the separate demo entry only after its replacement is usable and documented, as already decided in `it-planning-flow.md`. Resolve [#60](https://github.com/nofanto/Selara/issues/60), which proposes improving the demo, as superseded or re-scoped to the samples.
- [ ] **R1-08 — Preserve an import reconciliation summary.** Show each file and stated reporting year, source data-row count, imported count, skipped count, and unresolved matches. Explain that an imported unresolved row is a subset of imported rows, not an extra count. Provide downloadable rejected-row details. Keep the summary available after navigating away and reloading; settle its persistence/retention model before implementation.
- [ ] **R1-09 — Add an obvious next action.** Guide users from import review to the selected report's outstanding items, preview, and export. Reuse existing screens and repair actions. Fixes update progress; leaving and returning does not lose context. Unknown identity is offered for explicit review and never silently matched.

**Acceptance evidence:** a fresh browser can download samples, import the two different years, reconcile every source data row, resolve the example discrepancy, and reach the expected report. A reload preserves the chosen context and summary. An unsupported layout produces an actionable explanation and no silent data loss.

**Likely implementation areas:** `TemplatePickerModal.tsx`, importers, `DataHealthReportView.tsx`, `ReportsView.tsx`, sample generator/assets, and first-launch guide.

## M3 — Make the report checkable and explainable

**Purpose:** The planner can verify the exact output and understand both present and absent records.

- [ ] **R1-10 — Unify pre-export checks for both reports.** Validate the selected report/year and exact generated rows, along with relevant source/reconciliation findings. Keep unrelated workspace warnings separate. Specify blocking errors, acknowledged warnings, and draft export behavior in M0; do not infer those policies from current severity labels. Any relevant edit or year change invalidates a prior check result or recomputes it before export.
- [ ] **R1-11 — Show all output fields and their origins.** Let the user inspect the complete report, even if the main table remains compact. Explain selected-year eligibility, category/default source, new/upgrade classification, implementation quarter, CapEx/OpEx source, and imported or synthetic dates. Use the same pure rule results as generation; avoid a second set of explanatory rules that can disagree with the exporter.
- [ ] **R1-12 — Explain exclusions and unresolved coverage.** Account for relevant inventory and planned implementation candidates as included, legitimately excluded, or unresolved. Give reasons such as infrastructure outside the application list, outside the selected year, or missing lifecycle evidence. Do not label a valid legacy application erroneous merely because it has no new planned work. The exact candidate boundary is a domain decision in M0.

**Acceptance evidence:** independently reviewed fixtures cover new builds, upgrades, multiple implementations, infrastructure, retired/not-yet-live applications, year boundaries, unmatched imports, missing values, and currency treatment. Exported cells match the displayed preview. No stale validation survives an affecting edit. An empty/partial workspace cannot acquire an unqualified readiness claim merely by having no detected issues.

Replace “Ready to file” with wording scoped to Selara's checks and the chosen report. Passing checks is not bank approval or confirmation that OJK accepted a submission.

**Likely implementation areas:** `lib/rpti.ts`, `lib/lkpti.ts`, `lib/dataHealth.ts`, `ReportsView.tsx`, report components, and reporting schemas/design notes.

## M4 — Preserve filing context using History

**Purpose:** The planner can return to a prior reported state without confusing it with the live workspace.

- [ ] **R1-13 — Add filing metadata to saved snapshots.** Implement the accepted Version-based design: report type, period, revision number, status, and submitted date as agreed in M0. Each amendment is a full revision. Record the app/export-rule version if that recommendation is accepted. Clearly distinguish a generated draft from a submission the planner says happened outside Selara.
- [ ] **R1-14 — Protect and recover filing revisions.** Add the agreed deletion/reset behavior, a Filings filter, and backup/import support. Ordinary workspace edits must not change a saved filing's data. Resolve migration for old snapshots lacking filing metadata. UI protection is not a tamper-proof institutional audit trail; do not market it as one.
- [ ] **R1-15 — Compare a filing with current work or another revision.** Reuse existing diff summaries and decision links. Show dates/quarters, implementation additions/removals, budgets, and relevant application details. Ensure comparison orientation is explicit. Regenerating a past report reads the selected snapshot, not today's application attributes, and identifies the exporter version used.

**Acceptance evidence:** a saved revision remains unchanged after live edits; different report periods remain distinct; a second revision leaves the first intact; a fresh-profile backup restore preserves filing metadata and decision links; protected deletion paths behave consistently. A regenerated file is described as regenerated, never asserted to be the byte-identical file submitted externally.

**Likely implementation areas:** `types.ts`, `lib/db.ts`, `lib/excel.ts`, `HistoryView.tsx`, diff/report code. Write an ADR and update the database diagram before shipping the model change.

## M5 — Align language, positioning, and assistance

**Purpose:** The interface explains the banking job without requiring users to learn internal implementation terms.

- [ ] **R1-16 — Align the landing page, README, onboarding, and Guide.** The landing page is still Scenia's generic portfolio pitch: it never mentions RPTI, LKPTI, OJK, or banks, so this is a rewrite rather than an alignment. Refresh the in-product guide screenshots, which still show Scenia branding and a pre-OJK UI ([#27](https://github.com/nofanto/Selara/issues/27)). State the individual-planner audience and the two supported formats consistently. Replace “no risk” with factual local-storage behavior and recovery guidance. Distinguish report export, workspace backup, and timeline export. Describe resource counts as assignments rather than effort-based capacity.
- [ ] **R1-17 — Apply a reviewed reporting glossary.** Start with bilingual labels and explanations for onboarding, discrepancies, validation, repair, and report preview. Have target users review the terminology. Do not undertake full application localisation for this release unless pilot evidence requires it. Remove raw internal labels from user-facing findings. Four Data Health checks currently fall back to their raw ID as the group heading (`SUMMARIES[check] ?? check` in `DataHealthReportView.tsx`): `initiative-budget-divergence`, `initiative-rpti-missing-target`, `initiative-orphaned-rpti-remarks`, and `rpti-identity-conflict`. Add their labels and a unit test that every check has one, mirroring the existing `REPORTS_BY_CHECK` completeness test.
- [ ] **R1-18 — Publish task-based guidance and support boundaries.** Cover first import, interpreting exclusions, preparing a draft, recording a filing revision, and restoring after browser-data loss. Include supported formats/browser versions, known limitations, a support contact, and steps for reporting a problem using a sanitised example rather than sending bank workspaces by default.

**Acceptance evidence:** the documented walkthrough matches the built interface; no page implies support for the complete LKPTI, regulatory approval, hosted sync, or bank-wide access controls; representative keyboard-only users can complete the core path and read validation messages without relying on colour alone.

## M6 — Validate the product and operate a real release

**Purpose:** Demonstrate usefulness and recoverability with users who did not build it, on a deployment Selara controls.

- [ ] **R1-19 — Prepare a production release candidate.** Confirm hosting/distribution, a stable origin, supported browsers, release identifier, and update/rollback procedure. Local storage is origin-bound: domain, protocol, or port changes must not silently strand work. Verify network behavior against the local-data claim and remove unnecessary inherited infrastructure permissions/references. Keep hosted sharing disabled. Verify migrations and rollback compatibility; rolling back JavaScript alone does not necessarily roll back a database schema.
- [ ] **R1-20 — Run correctness, recovery, and scale verification.** Run required suites, build, lint/typecheck, and a production-build walkthrough. Confirm the typecheck is clean (its one current error is fixed under R1-04) rather than equating a tolerated error with a clean check. Run the Playwright suite without silent retries, or at least report flakes visibly, and investigate the flaky tests in [#61](https://github.com/nofanto/Selara/issues/61) for the seed-versus-app-save race already found in one of them. Make CI upload this run's report rather than the stale committed one ([#59](https://github.com/nofanto/Selara/issues/59)). Agree the supported device/browser and latency budget, then re-measure report, import, repair, history, and backup flows with 300 and 600 applications.
- [ ] **R1-20a — Fix the n² RPTI/LKPTI Data Manager rendering.** [#36](https://github.com/nofanto/Selara/issues/36) measured 4.3 s to open the RPTI tab at 300 applications and 7.4 s for LKPTI at 600: each row renders a `<select>` holding every deliverable (and, for RPTI, every asset and initiative). These are the screens planners use most, at the expected bank size, so this is a known fix rather than something a re-measurement might discover. Verify against the same 300/600 fixtures.
- [ ] **R1-21 — Pilot with 5–10 individual planners from at least two commercial banks.** Recruit early; use permitted anonymised data or representative fictional workbooks. Ask participants to import, explain one included/excluded item, fix a discrepancy, preview/export, save a revision, and restore a backup without coaching. Observe where they stop and compare with their current preparation process. Record whether a bank purchase/reimbursement route exists; do not assume the user can authorise a purchase.

**Proposed pilot gates:** at least 80% complete the agreed core scenario without facilitator intervention; every supported reference case reconciles with its reviewed expected output; no unexplained row loss or material cell mismatch; every recovery exercise succeeds. Measure time against a comparable baseline rather than promising a percentage saving in advance. Fix failed gates and retest the affected scenario before public release.

If dates tighten, reduce secondary polish or remain in a labelled beta. Do not trade away row accounting, report correctness, recoverability, or unresolved domain decisions to meet a launch date.

## Open questions — resolve before dependent implementation

These are Step 0 decisions under [CLAUDE.md](../CLAUDE.md), not permission to invent new business rules. Keep confirmed decisions and rejected alternatives in the originating design notes and link them back here.

| ID | Choice and tradeoff | Working recommendation, not yet decided | Blocks |
|---|---|---|---|
| D1 | Reporting periods and actual versus planned go-live: retain the current year-based scope or support more cadences? | Verify the existing year-based contract with a practitioner; defer additional cadences. Do not assume a planned date proves an application actually went live. | M0 reference outputs; M3; M4 period identity |
| D2 | May a report with problems be exported as a draft? Which issues block a checked output? | Keep draft and checked-output states explicit, prevent checked export on agreed blockers, and record relevant warnings. Exact classification requires domain review. | R1-10 |
| D3 | What is the candidate population for inclusion/exclusion accounting, especially legacy applications and unknown lifecycle history? | Report uncertainty separately from legitimate absence; do not guess identity or synthesise history solely to clear a check. Preserve existing accepted repair rules. | R1-12 |
| D4 | Backup format, reminder policy, privacy needs, and replacement semantics, including Open shared. Existing workbook versus a new package; optional encryption versus added key-recovery burden. | Reuse the workbook if it preserves all required types. Preview all replacement operations. Choose a truthful export indicator; browser download initiation does not prove durable storage. | R1-04–06 |
| D5 | Filing states, report/period identity, numbering, deletion/reset behavior, and exporter-version metadata. Also clarify how stored import evidence and freshly projected report rows are captured together. | Reuse Version and keep submission externally attested. Protect filing snapshots without claiming tamper-proof storage. Add version metadata if accepted; retaining exact submitted files stays out of scope. | R1-13–15 |
| D6 | Import-summary persistence and supported external layouts: exact layouts versus a general mapping tool. | Store a small summary linked to the import, with agreed retention/export behavior. Support a tested finite set of layouts; defer arbitrary mapping and PDF/OCR. | R1-02, R1-08 |
| D7 | Public hosted app versus bank-hosted distribution; supported browsers/device budget; free beta versus paid launch. | Start with a controlled beta on one stable origin, then choose commercial packaging from pilot evidence. Keep both product claims and deployment instructions accurate. | R1-19 and public launch |

## Delivery method for each backlog item

1. Confirm applicable decisions; read current implementation before assuming an old finding is still missing.
2. Create the user story with testable acceptance criteria in `docs/user-stories/`; extend design notes for complex rules. Treat the milestone evidence above as input to those stories, not an approved substitute for unresolved decisions.
3. Write a failing Vitest test for pure rules and/or a failing Playwright test for the user interaction. Observe Red before implementation.
4. Implement a reviewable slice. Preserve existing accepted classifications and import evidence unless an explicitly recorded decision changes them.
5. Confirm Green, then run `npm run test:unit` and `npx playwright test` before committing. Run build and relevant static checks. Record failures and fixes, not just a green summary.
6. Update the user guide, originating story/design notes, and relevant README/feature documentation. Model changes require an ADR and database-diagram update.
7. Record completion evidence against R1-xx. Deployment is a separate launch action, not an assumed consequence of push.

Suggested first implementation slice: **R1-05**, beginning with a design decision for Open shared and a failing test proving that cancelling replacement preserves the workspace. In parallel with ordinary planning work, begin R1-01/R1-02 evidence collection; do not wait until launch to discover whether real input files and interpretations match the product.

## Public-release checklist

- [ ] M0 reporting/source matrix reviewed; supported formats and limitations published.
- [ ] All source rows in supported imports accounted for; no unexplained generated omissions.
- [ ] Both report previews, validation, and exports use the same selected scope and state.
- [ ] Backup restores the complete supported workspace in a fresh profile, including filing revisions.
- [ ] Replacement and storage failures cannot silently destroy the prior workspace.
- [ ] Filing history preserves reported context without misrepresenting external submission or exact file retention.
- [ ] Samples, labels, Guide, and landing page tell the same product story.
- [ ] Full required tests, production build, and release static checks pass; core scale/accessibility scenarios reviewed.
- [ ] Selara-controlled distribution, stable origin, update/recovery procedure, and support contact are ready.
- [ ] Pilot gates met and material findings resolved; unsupported scenarios remain explicitly out of scope.

## Later releases

After the first release demonstrates repeated use, prioritise from observed demand: safer owner contributions and durable match decisions; richer management-review exports; vendor consistency; actual effort allocations; or selected integrations. Revisit multi-user architecture only when a validated use case requires it. Maintain regulatory coverage and compatibility as continuing product responsibilities rather than one-time release tasks.
