# Research: An RPTI row is one planned implementation

**Feature**: 003-rpti-row-per-implementation · **Date**: 2026-09-22

All spec clarifications (Q1–Q3) were answered before planning, so this document records what the
**code** says rather than resolving open questions. Every claim below was measured or read on
`7a75726`, not inferred.

---

## R1 — What actually produces a row today, and which condition is wrong

**Measured.** A `DeliverableSegment` produces an RPTI row when all four hold:

| # | Condition | Code |
|---|---|---|
| 1 | `seg.initiativeId` is set | `rpti.ts:178` |
| 2 | That initiative exists and is not a placeholder | `rpti.ts:155, 178` |
| 3 | Status flagged `isLiveStatus` **or** `isPreLaunchStatus` | `rpti.ts:87-91` |
| 4 | Segment **overlaps** the report year | `rpti.ts:151` |

Conditions 1–3 ask *"is this real development work?"* and answer correctly. **Condition 4 asks a
different question than the filing poses**: `startDate <= yearEnd && endDate >= yearStart` means
*"was this in progress during the year"*, where the column `Waktu Rencana Implementasi` asks *"when
does it go live"*.

**Three defects share that one cause**, all measured:

1. Two go-lives in one year → **1 row**, the earlier silently dropped (the originating defect, #52).
2. One upgrade in 2027 with an open-ended live segment → a row in **2027, 2028, 2029, 2030, 2031**,
   each stating Q2 2027. It stops only when the segment's arbitrary `asAtYear + 5` horizon expires.
3. A retirement where the pre-existing live segment is attached to the retiring initiative → a row
   typed `upgrade` with quarter **Q1**, derived from the segment's **2020** start date.

**Decision**: replace overlap with a **start-within-year** test on the implementation. This is
Q2 + Q3 of the spec, and it resolves all three symptoms with one change rather than three patches.

**Alternatives considered**: patch each symptom separately (rejected — three rules where one
concept was missing); keep overlap and deduplicate by quarter (rejected — still cannot express two
implementations, and invents a collapse rule the format does not ask for).

---

## R2 — Where the filed values must live

**Decision (spec Q1)**: the implementation carries `capexAmount`, `opexAmount` and `rptiRemarks`.
`DeliverableSegment` gains three optional fields. No new store.

**Rationale**: a filed row carries one `Estimasi Biaya CapEx`, one `OpEx` and one `Keterangan`
(`rpti-schema.md`). With rows at implementation grain, an initiative-level figure would repeat
across every row, filing the same budget twice. `DeliverableSegment` already carries both
`deliverableId` and `initiativeId`, so it is the only entity where application, trigger and time
are present at once — extending it is cheap, and `AppState` already enumerates it everywhere.

**Alternatives considered**: a new `Implementation` store (rejected — `AppState` is enumerated at
every call site, so a new store is the expensive change here and the segment already *is* the
implementation); keeping cost on the initiative with a split rule (rejected in Q7 and again in Q17
— the rule is an invention the regulator did not ask for).

---

## R3 — `Initiative.capex` / `opex` stay put, and why that is safe here

**Measured.** Thirteen non-test files read `.capex`/`.opex`: `App.tsx`, `InitiativeBar.tsx`,
`InitiativePanel.tsx`, `MobileCardView.tsx`, `ReportsView.tsx`, `Timeline.tsx`, `attributeLift.ts`,
`db.ts`, `diff.ts`, `excel.ts`, `rpti.ts`, `rptiImport.ts`, `validation.ts`.

**Two are editing surfaces**, which matters for the decision below:

- `InitiativePanel.tsx:221-226` — an editable CapEx input in the initiative modal.
- `DataManager.tsx` — editable `capex`/`opex` columns on the Initiatives tab.

Both **stay editable**. An earlier draft of this research made them read-only totals; that followed
from deriving the initiative figure, which is no longer the decision.

**Decision** *(revised 2026-09-22)*: `Initiative.capex`/`opex` stay **stored and editable**. They
are not a second copy of the filed figure — they are a different value. The initiative's budget is a
portfolio number driving the timeline, budget report and mobile cards; the implementation's is what
the return states. Import seeds both from the filed row, after which they may diverge.

Cost is *additionally* entered on the implementation, in `DeliverableSegmentPanel.tsx`, which today
edits deliverable, title, status, initiative and dates.

**Rationale**: the two-sources hazard that produced the F3 silent-overwrite defect needs two copies
of **one** value competing for authority. Here neither derives from the other and neither overwrites
the other, so no precedence rule exists to get wrong. Grouping several applications under one
initiative is a portfolio act, not a filing one — adjusting a budget should not silently rewrite
what is filed, nor the reverse.

**The cost of that choice**: the two figures can drift apart. Data health reports the divergence as
a **warning**, naming both figures and both places a preparer could act. Never an error, never
blocking: it compares two legal states, and a finding that calls a legitimate arrangement a defect
teaches preparers to ignore the gate.

**Alternatives considered**: derive the initiative's figure from its implementations (rejected — an
initiative with no implementations would derive zero and silently empty its cost on the timeline,
and it forces a migration of every existing workspace); delete the field (rejected — thirteen
non-test files read it); initiative figure as a *default* when an implementation states none
(rejected — that genuinely is two copies of one value, and is the F3 shape).

**Consequence**: `validation.ts:36`'s negative-cost rule is **extended** to the implementation
rather than moved; the initiative's field is still editable.

---

## R4 — Reconciliation identity moves, and what stays

**Decision**: a canonical row identity becomes the **implementation** — `(initiative, deliverable,
implementation)` — rather than `(initiative, target)`. `identity-conflict` and the one-to-one
accounting established in Q12 continue to hold at the new grain.

**Rationale**: reconciliation exists so a filed row is never silently absent. If the generated row
set changes grain while reconciliation matches at the old one, a stored row that *is* reproduced
would be reported as missing, and two stored rows for one application would stop conflicting when
they should.

**What does not change**: matching is by **identity, never by contents** (Q12, and FR-027 as
narrowed). Field drift between a stored row and its regeneration remains deliberately unreported.

---

## R5 — What the Q10 reversal removes

**Measured**, and this is the argument that settled it. One initiative with live segments on two
applications:

| Setup | RPTI 2027 | Data health |
|---|---|---|
| No declared target | **0 rows** | `initiative-rpti-multi-target` error |
| Declares `App One` | **1 row** (App One) | **clean** — App Two's work silently absent |

The second line is the problem: the model deliberately drops filed-relevant work **without
reporting it**, which is the failure the previous feature was built to eliminate.

**Decision**: remove `initiative-rpti-multi-target` (it forbids what is now legal), and retire
target inference (`resolveRptiTarget`) for filing purposes — a segment names its own application.

**Decided 2026-09-22: `Initiative.deliverableId` is removed with its UI.** Every logic use is a
filing use (`rpti.ts:97,338,391,420`, `dataHealth.ts:233,249-261`, `rptiImport.ts:421`) and all of
them die with the single-target rule. What is left is an editable control on two screens that
nothing reads, plus a dangling check on it.

Rejected: keeping it deprecated in the type comment — nobody reads type comments, and a visible
control that silently does nothing is worse than removing it. Also rejected: repurposing it as a
default application for new segments — a new feature wearing an old field's name, which users would
reasonably expect to behave as it does today.

**Two consequences worth carrying**, neither obvious from the field itself:

1. The `initiative-rpti-unanchored-target` check goes with it. It exists because a *declared* target
   might carry no work; with no declared target the situation cannot arise.
2. It is load-bearing for the F2 repair path. A stored row whose deliverable was deleted is repaired
   today by selecting the replacement on the initiative, which `rpti.ts:338` matches on. That route
   must be rebuilt around the segment's own `deliverableId` **before** the field is removed, and the
   repair messages must name the segment panel rather than the Initiatives tab.

---

## R6 — Migration of existing data

**Decision**: no rewriting of stored rows; correspondence only. Existing rows keyed
`rpti-gen-<initiative>-<deliverable>-<year>` are matched to current implementations by
reconciliation, consistent with the standing position that stored rows are immutable evidence.

**Costs do not need moving** *(revised 2026-09-22)*. The initiative's budget keeps its meaning and
all thirteen of its readers; what is new is a *separate* figure on the implementation, which a
preparer enters. An existing workspace therefore loses nothing — it simply has no implementation
figures yet, and the divergence warning announces exactly that state rather than letting it surface
at filing time.

This removes the migration this section previously described, and with it the question of how one
budget divides across several implementations: nothing is divided.

---

## R7 — The detection shipped for #52 becomes false

`initiative-rpti-multi-implementation` warns that a second implementation **will be dropped**. Once
it is filed, the warning is untrue.

**Decision**: remove it with the change that makes it false, in the same commit. It currently lives
unpushed on branch `052-multi-implementation-detection` (`7a75726`).

**Rationale**: a stale warning is worse than no warning — it reports a defect that no longer exists
and teaches preparers that findings can be ignored, which is the credibility the export gate
depends on.

---

## R8 — Scale

**Measured**: `src/lib/scale.test.ts` covers 300 applications through projection, LKPTI generation
and reconciliation with a deliberately loose bound that catches an accidental O(n²).

Per-implementation rows **increase** the row count — an application with three implementations
files three rows where it filed one. The existing test builds one segment per deliverable, so it
will not exercise the new row count.

**Decision**: extend the scale fixture to multiple implementations per application. Reconciliation
is the part to watch: it walks stored rows against canonical identities, and both sides grow.

---

## R9 — Fields must be named in the version diff

**Measured**: `diff.ts:294-313` compares `DeliverableSegment` on `title`, `startDate`, `endDate`,
`status` and `deliverableId` — each named explicitly, with a comment recording why. It does **not**
compare `initiativeId`.

**Decision**: name the three new fields, and `initiativeId` alongside them.

**Rationale**: `compareEntities` is generic over entities, not fields ([#42](https://github.com/nofanto/Selara/issues/42)),
so an unnamed field changes with no history entry and no error. These feed a regulatory return.
`initiativeId` is a pre-existing gap in the same comparator — re-attributing a segment to a
different initiative currently changes the filing invisibly.

---

## R10 — The fixture cannot exercise this feature

**Measured**: the published sample RPTI holds 13 rows across 13 initiatives, one implementation
each, and no duplicated application name.

**Decision**: the round-trip fixture gains a multi-implementation case before implementation
begins, not after.

**Rationale**: in the previous feature, an asset-target repair test passed while skipping the
repair it claimed to verify, because its fixture already satisfied the condition under test. A
fixture that cannot express the new grain would let SC-002 report zero losses while the feature is
entirely unverified.
