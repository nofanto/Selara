# Report Rows as Projections, Not Storage — Design Notes

> **Status:** Q1-Q13 implemented and shipped on branch `002-report-year-field-ownership`
> (see [ADR-0013](../docs/adr/0013-report-rows-as-projections.md)). Q4's broad in-place migration
> remains deferred, but its boundary-lift design now covers ordinary load, shared-workspace load,
> generic workbook import and version restore. Raised jointly with
> [#40](https://github.com/nofanto/Selara/issues/40) — see "Why this cannot ship before #40".
>
> **Read the title as the destination, not a claim that stored rows disappear now.** Attributes
> move to the entities they describe; report generation moves to Reports; and the Data Manager
> report tabs become read-only projections that remain populated for continuity. Emptying and
> removing those tabs is a later step.

## The observation

Importing LKPTI and RPTI fills the Data Manager's RPTI and LKPTI tabs with rows. The
question raised: should those tabs not be **empty** after import, with rows produced by
pressing **Generate** from the data that was imported?

It is a good instinct. Step 2 of `it-planning-flow.md` — *Maintain, the year-round work* —
describes a workspace of assets, deliverables, segments and initiatives; step 3 *prepares
the filing* by generating rows from it. Import currently short-circuits that, writing the
step-3 output directly. So the model the diagram describes and the model the importer
produces disagree.

## Verified: it cannot work today, and this is why

Discarding the imported rows and regenerating from the same workspace loses, on the 13-row
sample:

| LKPTI field | rows losing it | | RPTI field | rows losing it |
|---|---|---|---|---|
| `platform` | 13/13 | | `capexAmount` | 13/13 |
| `database` | 13/13 | | `opexAmount` | 13/13 |
| `dcProvider` | 13/13 | | `remarks` | 11/13 |
| `drcProvider` | 13/13 | | `ppjtiRelatedParty` | 10/13 |
| `backupStrategy` | 13/13 | | | |
| `systemOwner` | 13/13 | | | |
| `ownership` | 13/13 | | | |
| `developer` (vendor name) | 9/13 | | | |

`generateLkptiDetails` derives seven cascaded fields (`lkpti.ts:100-108`). The rest have **no
source anywhere in the workspace**: the filed return is the only place they exist, and
`LkptiDetail` is the only record that can hold them. Generate-on-demand would produce 13 rows
with seven fields filled and eight blank.

The RPTI losses are milder and two are not real: `capexAmount`/`opexAmount` are *overrides*,
and `resolveCost` (`rpti.ts:296-301`) falls back to the linked Initiative's figures, which the
importer does set — so the exported value survives even though the detail field empties.

## Diagnosis: `LkptiDetail` is two things wearing one name

The reason the proposal fails is not that generation is weak. It is that the record conflates:

1. **Attributes of the application.** `platform`, `database`, `dcProvider`, `drcProvider`,
   `backupStrategy`, `systemOwner`, `ownership`, and the vendor name in `developer`. These are
   facts about the deliverable, true whether or not anyone files anything this year.
2. **A projection into a report row.** `categoryCode`, the four location fields,
   `functionDescription` — every one already derived by cascade from the Deliverable and its
   AssetCategory.

Group 1 has nowhere else to live, so it is stored on the report row by default rather than by
design. Move it onto `Deliverable` and `LkptiDetail` becomes purely derived — at which point
the proposal works exactly as described.

**There is already precedent in the codebase for exactly this move.** `goLiveDate` was once
manual-only; it is now derived by `suggestGoLiveDate()` from the deliverable's first live
segment (`lkpti.ts:117`, `lkpti.ts:46-54`). It is the one field in group 1's original list
that *survived* the discard-and-regenerate test, because it stopped being storage and became a
projection. The same argument applies to the other eight; they simply have no timeline concept
to derive from, so they need a home on the entity instead.

## Field inventory

The unit of the eventual decision. **D** = already derived, **A** = an attribute of the
application, **R** = genuinely about this report row.

### `LkptiDetail`

| Field | | Notes |
|---|---|---|
| `categoryCode` | D | cascades Deliverable → AssetCategory |
| `dcCity` `dcCountry` `drCity` `drCountry` | D | cascade, per field |
| `functionDescription` | D | `Deliverable.description` |
| `goLiveDate` | D | `suggestGoLiveDate()` from the first live segment |
| `platform` | A | what the application is built on |
| `database` | A | |
| `dcProvider` `drcProvider` | A | who runs the data centre — 'self' or a company |
| `backupStrategy` | A | |
| `systemOwner` | A | the person accountable for the application |
| `ownership` | A | lease or outright purchase |
| `developer` | A | 'inhouse' derives; the vendor **name** does not |

Every non-derived field is an **A**. `LkptiDetail` has no genuine **R** at all — which is the
strongest evidence that it should be a pure projection.

### `RptiDetail`

| Field | | Notes |
|---|---|---|
| `initiativeId` `targetType` `targetId` | D | the pair generation groups by |
| `categoryCode` `developer` | D | from the Deliverable |
| `developmentType` | D | prior-live history — see `rpti-auto-generation.md` |
| `dcCity` `dcCountry` `drCity` `drCountry` | D | cascade |
| `plannedImplementationQuarter` | D | anchor segment's start date |
| `deliverableSegmentId` | D | the anchor itself |
| `capexAmount` `opexAmount` | D\* | overrides; `resolveCost` falls back to the Initiative |
| `ppjtiRelatedParty` | A? | derived as `'n/a'` when the developer is not PPJTI, but **left blank when it is** — so the answer for a PPJTI row is a fact about the vendor relationship with no source |
| `remarks` | **R** | free commentary on this row of this year's plan |

RPTI is nearly a projection already. `remarks` is the one field that is genuinely about the
report row rather than the thing it describes.

## Why this cannot ship before #40

Not merely related — a prerequisite.

Today the stored `rptiDetails` **are** the 2027 plan. That is the only record anywhere that a
year was involved: `reportYear` appears in no type and no store (#40). Delete the rows in
favour of generating them and the year exists nowhere at all, so there is nothing to generate
*for*.

Worse, generation is year-scoped and merge-preserving over a single set. A purely-generated
model has no way to hold 2027 and 2028 rows at once — filing next year's plan would have to
destroy this year's record of what was filed. Doing this first would make #40 harder, not
easier.

## Open questions

### Q15 — an RPTI row's grain is one planned implementation, not one initiative (raised 2026-09-19)

**Deferred to its own Spec Kit feature — filed as [#52](https://github.com/nofanto/Selara/issues/52).**
Raised by the product owner: *"RPTI is the plan, the plan segment should generate the RPTI row."*

**Measured** on `221d546`. One initiative, one application, two qualifying live segments in 2027
starting in Q2 and Q4:

```
projectRptiReturn(workspace, 2027)  ->  rows = 1, quarters = Q4
```

The Q2 implementation is silently absent — reachable through ordinary timeline work.

**The filed format is the argument.** An RPTI row carries column 9 `Waktu Rencana Implementasi`,
a single planned implementation time, and columns 10-11, a single CapEx/OpEx estimate. An
application with two go-lives in a year genuinely has two implementation times and two estimates,
which the format expresses as two rows and the current model cannot express at all. So the row's
grain is the *implementation*, which is what a `DeliverableSegment` is; an `Initiative` is the
trigger, and can trigger several.

**This reopens decisions rather than extending them**, which is why it is its own feature:

- **FR-029 / Q10** — the target stays single; the number of *rows* becomes many.
- **Q12** — canonical identity for reconciliation is `(initiative, target)` today and would become
  per-implementation, changing `identity-conflict` and the one-to-one accounting.
- **Q7** — initiative-level cost was chosen partly because a per-pair cost had no home. The format
  puts one CapEx per *row*, so per-implementation cost is the natural grain. That decision was
  taken against a different model of what a row is.
- **Q14** — `rptiRemarks` sits on `Initiative` because a row is not 1:1 with a segment *under the
  current grouping*. If a row becomes an implementation, the segment is the right home and
  per-year remarks fall out for free rather than needing the deferred ledger. The owner's original
  instinct was right; the analysis in Q14 reasoned from the grouping rather than from the format.

**Shipped now, deliberately not prejudging any of that:** a `initiative-rpti-multi-implementation`
warning when an initiative has qualifying implementations in more than one quarter of a year,
naming the quarters and which one generation would file. It changes nothing about what is filed.
It stays silent when two segments share a quarter, since one implementation time loses nothing.

Unlike the other open model questions here, this one rests on the filed format rather than on
internal consistency.

---

### Q13 — repairing an unresolved imported row is a three-screen manual job (raised 2026-09-19) — **REVISED by Q22 (2026-09-25)**

The text below is kept as written. Since then, spec 003 removed the Initiative's Deliverable selection, so the journey is two steps rather than three. More importantly, it moved the filed values onto the segment, which turned the manual repair into one that silently files wrong values. Q22 records what was measured and what was decided.

**Deferred to its own Spec Kit feature — filed as [#51](https://github.com/nofanto/Selara/issues/51).**
Raised by the product owner after repairing the sample's unresolved row by hand.

An RPTI row needs three things before generation can reproduce it: the Deliverable, the
Initiative's selection of it, and a qualifying lifecycle segment linking the two. Those live on
three different screens — Deliverables tab, Initiatives tab, Visualiser timeline — so clearing
one finding is a three-step journey the preparer has to assemble themselves.

**The importer already holds everything needed to do it.** It knows the application name, the
category code, the development type and the planned quarter, because the filed row said so. It
declines to act on them deliberately (`rptiImport.ts:286-300`): FR-019 holds an unmatched
*application* back "because the two returns are known to disagree on naming, so a non-match is a
judgement call for a person." An unmatched *infrastructure* item is auto-created (FR-019a),
precisely because LKPTI never lists infrastructure, so there is no judgement to defer.

That reasoning is sound and must survive. The risk it guards against is real: the RPTI's
"Legacy Teller Application" may be the same system the LKPTI already lists under a slightly
different name, and auto-creating it would put a **duplicate application into the filed LKPTI** —
worse than the friction it saves.

**But the current design conflates two things.** Making the judgement needs a person; *recording*
it needs nobody. Today the preparer decides in their head, then performs three manual steps to
write down what they decided.

**Shape to explore, not yet decided:** the finding offers two one-click, source-side resolutions —
*"this is the same as &lt;existing application&gt;"* (link the initiative, anchor the segment) or
*"this is a new application"* (create the Deliverable and its segment from what the filed row
already says). Both leave the stored row untouched, so this is compatible with Q12 and the
option-A decision, unlike the identity-remap rejected there. Open within it: whether the
"new application" path should warn on a near-match to an existing name, which is exactly the case
FR-019 worries about.

### Q14 — remarks cannot vary by filing year (raised 2026-09-19) — **REVISED by Q17 (2026-09-22)**

This entry records the earlier initiative-grain decision unchanged. Q17 later made a row one
implementation and moved RPTI remarks to that implementation; see Q17 for the current rule.

Raised by the product owner asking whether `rptiRemarks` belongs on `DeliverableSegment` rather
than `Initiative`, since RPTI rows come from segments.

**Measured, and it answers the placement but exposes a gap.** One initiative with three segments
spanning two years generates **one row in 2027 and one in 2028**:

```
3 segments  ->  rows2027 = 1 (rpti-gen-i1-d1-2027),  rows2028 = 1 (rpti-gen-i1-d1-2028)
```

So a row is **not** 1:1 with a segment — several collapse into one — and since Q10 generation
groups by initiative. Putting remarks on the segment would need an arbitrary rule for which
segment wins, and the answer would change silently as the timeline is edited. The sample's
Keterangan values describe the work, not a phase: *"Phase 2 of the digital channel roadmap"*,
*"Regulatory deadline driven"*. `Initiative` is the right home, as Q2 decided.

**The model, in the product owner's words (2026-09-19):** *"RPTI is a plan for development of
application/infra; the Initiative is the trigger of the development; the segment is the link of
the application/infra with the Initiative."*

That framing is better than the one this note started with, and it is worth following through
because it looks at first like an argument for the segment.

An RPTI row **is the link**, not the trigger — a row says *this application is being developed,
triggered by this initiative*, which is a pair. But **a segment is not the link; it is one
time-slice of it.** The same link is normally expressed by several segments, a planned phase and
then a live one, which is exactly why three collapse into one row above. So "the row is the link"
argues for hosting remarks on the *pair*, and the segment is not the pair.

**What closes it is Q7.** The owner chose option (c) there: cost belongs to the initiative, and an
initiative has at most one RPTI target. FR-029 made that binding and Q10 followed by grouping
generation on the initiative — so `(initiative, deliverable)` and `(initiative)` are now the *same
grain*. The link has no separate identity because it was deliberately collapsed onto the trigger.
Remarks on `Initiative` therefore **are** remarks on the link; the link simply happens to be
spelled "initiative" since Q7.

Worth recording the counterfactual, because it shows the reasoning is not circular: had Q7 gone
the other way — a cost per `(initiative, target)`, many targets per initiative — the link would be
a distinct thing needing its own entity, and remarks would belong **there**. Not on the initiative,
and still not on the segment.

**The rest of the cons stand on their own**, and were measured or read from the code rather than
argued:

- The anchor moves. `rpti.ts:209-211` picks the last live segment, or the last new one when none
  are live, among those qualifying *for the selected year*. Change a status, add a phase, or shift
  a date across a year boundary and a different segment becomes the anchor — so filed commentary
  would change on its own. For a value a regulator reads, that is the worst property on the list.
- Deleting a segment would delete filed commentary. Segments are redrawn as ordinary timeline
  work; initiatives are not.
- There is no editing surface. Segments have no Data Manager tab, so writing a `Keterangan` would
  mean finding the right segment on the timeline — worse than a column on Initiatives, and the
  same friction that made repairing an unresolved row a three-screen job ([#51](https://github.com/nofanto/Selara/issues/51)).
- It would split the pair. `Deskripsi` comes from `Initiative.description`; sourcing `Keterangan`
  from a segment would put two adjacent filed columns at two different grains, and they could never
  be shown side by side in any one table.

**The real finding is the gap.** Segments decide which *years* a row appears in; the initiative
decides what the row *is*. An initiative filing in both 2027 and 2028 carries identical remarks in
both, with no way to say "phase 1" in one and "phase 2" in the other — and Keterangan is exactly
the column where a preparer would want that.

Per-year remarks need a per-(initiative, year) home, which nothing in the model provides. That is
the **third** thing now pointing at the deferred option-5 ledger (`merge-path-options.md`):
F4 needs a year anchor, F5 needs per-year reconciliation precision, and this needs per-year
remarks. Worth weighing when that work is scheduled.

---

## Decided

### Q22 — an unresolved row is repaired semi-automatically, from the finding (2026-09-25)

**Why this is more than friction — measured on `main` at 7da8edd.** On the published samples, the
repair the error message describes (create the Deliverable, then a live segment linking it to the
initiative) **clears the export gate while the return then states three wrong values**:

| | Filed in the return | After the documented repair |
|---|---|---|
| Blocks export? | — | no |
| Development type | `upgrade` | `new` |
| CapEx / OpEx | 2.9bn / 640m | 0 / 0 |
| Keterangan | *"Not present in the 2026 LKPTI — needs a target."* | empty |

The only signal is a non-blocking budget-divergence warning. It comes from three earlier decisions
working together:
- spec 003 moved filed cost and Keterangan onto the segment, and the repair creates a bare one;
- `new` versus `upgrade` is decided from the application's live history, and a freshly created
  application has none;
- the gate matches rows by identity, not contents (Q12), so it does not notice.

This breaks **spec 002's FR-025**: *"Nothing MUST require the preparer to re-key a value the return
already supplied."* The message is also wrong on its own terms. It says the row *"points at a
Deliverable that no longer exists"*, but for an unresolved import the Deliverable never existed.

**An unresolved row is always an upgrade.** Rows filed as `new` always create their application
(`rptiImport.ts`). An upgrade is left unresolved when it matches **no** entry or **several**. Only
applications can match none, because unmatched infrastructure is created automatically (FR-019a).
Either kind can match several: two same-named applications, or two same-named infrastructure
entries. Either way Q13's option *"this is a new application"* contradicts the filed return, which
says `upgrade`. *(Corrected 2026-09-25 after Codex review: the first version said "always an upgrade
to an application", which missed ambiguous infrastructure.)*

**Decided (product owner): a semi-automatic repair, started from the finding.** The finding — in
Data Health and in the pre-export gate — offers two resolutions. Each opens a form **pre-filled from
what the return filed**, which the preparer checks and confirms. Making the judgement still needs a
person; *recording* it no longer means re-typing what the return said.

- **A — "It's this existing entry."** The inventory lists it under another name, or lists several
  entries of that name. The preparer picks one; the filed implementation is created on it. This is
  the only option for ambiguous infrastructure: entries of that name exist, so B would create a
  duplicate.
- **B — "The bank runs it, but the inventory doesn't list it."** The application is created much as
  unmatched infrastructure already is (FR-019a), including a prior live phase so that it stays an
  upgrade.

Either way, confirming creates the **live segment for the filed implementation**: linked to the
initiative, starting in the filed quarter, carrying the filed CapEx, OpEx and Keterangan. The
initiative moves to that application's asset. Until now it sat under an unrelated one — the first
asset in the inventory.

**Where each pre-filled value comes from** *(confirmed by the product owner)*.
- **From the stored row, which remains read-only evidence (Q12):** category, developer and
  related party, DC/DR locations, planned quarter, Keterangan. A PPJTI row states `PPJTI`, not the
  provider's name, so the form asks for the name.
- **From the imported initiative's name:** the application's name. The stored row does not hold one,
  and the importer's list of unresolved rows is not kept after import. The importer names the
  initiative `<application> — Q3 2027` (Q21), so the form offers that name without the quarter
  suffix, for the preparer to check, since the initiative may have been renamed. *(Corrected
  2026-09-25 after Codex review: the first version listed the name under the stored row.)*
- **From the initiative's budget:** CapEx and OpEx. The stored row no longer holds cost (Q7), and
  FR-026 says the system need not keep a separate copy of what was imported. The importer seeded
  the initiative's budget from the filed row, but the preparer may have edited it since, which is
  exactly why the form shows it for confirmation rather than using it silently.

**Unchanged by this.** The stored row stays as it is (Q12's source-side principle, and the rejected
identity-remap editor stays rejected). Creating a deliverable directly in the Data Manager stays
exactly as it is.

**A, when the chosen entry has no live history before the filed quarter** *(product owner,
2026-09-25)*. The row would file as `new`, contradicting the return. The repair adds the same
continuous prior live phase as B, and the form shows it before confirming. Choosing the entry
states that the bank already runs it; an upgrade needs that history.

**A, when the chosen entry's attributes differ from the filed row** *(product owner, 2026-09-25)*.
Category, developer, related party and DC/DR are the Deliverable's (ADR-0013): the return files
the Deliverable's values, and the same values feed the LKPTI. The form lists each field that
differs, filed next to current, and the preparer decides per field whether to update the
Deliverable, which also changes the LKPTI, or keep it. Nothing changes silently in either
direction. Rejected: always keeping the Deliverable's values, which misfiles silently; always
taking the filed values, which rewrites the inventory silently.

**Near matches (A)** *(confirmed by the product owner)*. Likely candidates are suggested for the preparer to choose from, and never
chosen automatically. That is FR-019's reason for holding the row back in the first place: the two
returns name things differently. The published sample has no near match.

**Rejected — a default live segment whenever a deliverable is created, starting in the quarter it
is added.** Proposed by the product owner as a lighter-weight alternative, then withdrawn after
measurement. "The quarter it was added" is when someone typed it in, not when it goes live.
Measured on the samples:
- In the #51 repair it still leaves the gate blocked, because the segment names no initiative.
- Once linked, it files the row in **2026** instead of 2027, typed `new`, with no cost or Keterangan,
  and lists the application in the 2026 inventory.
- In ordinary planning, a genuine first build going live in 2027 files as **`upgrade`**, because
  the default segment counts as earlier live history, and it appears in an inventory before it exists.

This is the same class of problem the project has already removed twice, with invented import
history (FR-018b) and an invented `Planned` status: the application stating as fact something
nobody told it.

**Rejected — Q13's "this is a new application" option.** It contradicts the filed development type.

**B's prior live phase is continuous (product owner).** An application "the bank runs" gets live
history that runs continuously up to the shared five-year horizon (`openEndedDate`). The same rule
applies to the importer's synthetic prior phase, so the repair and the importer create the same shape.
This **closes Q21's open consequence 2**. That case is an upgrade with no live history of its own,
which drops out of the inventory in its upgrade year unless it was filed for Q4. Fixing it only for
repairs would have left two rules for one situation.

**The error message is corrected now, separately (product owner).** It no longer says the
Deliverable "no longer exists". It also warns that the manual repair files a new application with
zero cost unless the preparer enters the filed values. This is a separate, small change and does
not wait for the feature: the current message leads preparers into the silent corruption measured
above.

Codex review then measured a second silent misfiling on the sample. A bare new Deliverable files
category **01**, no developer and empty DC/DR, where the row filed 12, `inhouse`, Jakarta and
Surabaya. It raises no finding and no Data Health error. So the message also lists the filed
Deliverable attributes, using the Deliverables tab's labels. That includes a PPJTI row's related
party even when it is `n/a`, because a blank Deliverable regenerates it as empty.

**A row anchored to a deleted implementation is repaired by restore or re-import** *(product owner,
2026-09-25)*. Codex review found that a stored row anchored to a segment that no longer exists can
never clear: recreating the Deliverable or the segment makes a new implementation, and contract
14 / T038 forbid an anchored row from falling back to another one. The product owner first chose
a fallback when the anchor is gone. That choice was withdrawn once it came out that the fallback
is the case T038 was written against. Suppose an initiative filed Q2 on X and Q4 on Y, and X is
deleted: the fallback would find Y's Q4 as the only match and silently drop the Q2 row, which is
the #52 defect. Narrowing the fallback by quarter would match on contents, which Q13 rules out.
**Decided:** keep the rule. For these rows, the message and Data Health's `rpti-segment` issue say
to restore a saved version from before the deletion (History tab), or to re-import the filing.
The old advice ("create or open the segment", "restore that work on the timeline") could never
clear the finding. An anchored segment that still exists but is not live keeps the segment-panel
repair, which works. The rule applies whatever else is missing: the Initiative, the Deliverable or
a legacy Asset target. Restoring any one of them still leaves the anchored segment gone, so every
one of those findings gets the restore-or-re-import repair (third Codex review). Restoring a saved
version brings back the original segment id; a test pins that the finding then clears.

### Q19 — the legacy remarks lift follows the field; the legacy cost lift does not (2026-09-23)

**Raised by the implementer during Phase 4**, not by the task list, which is the reason it is
recorded here: `attributeLift.ts` reads `Initiative.rptiRemarks`, and T024a removes that field. A
removed field whose readers survive is the orphan T024a exists to prevent, one level up.

`attributeLift` is the idempotent lift that rescues attributes from pre-ADR-0013 stored rows at
each boundary where old-shaped data enters live state (Q4). It does two things to an RPTI row:
carries `remarks` onto the initiative, and carries legacy `capexAmount`/`opexAmount` onto the
initiative's budget, deleting the cost properties afterwards as a durable completion marker (F3).

**Decided — the two halves part company, because only one destination is being removed.**

1. **The cost lift is unchanged.** `Initiative.capex`/`opex` survive Q17 as a portfolio figure, so
   the lift still has a real home and still preserves the value. That it is no longer the *filed*
   figure is the decision, not a defect: T045 records that nothing migrates, an existing workspace
   keeps its budgets, and the divergence warning announces the absence of implementation figures
   rather than letting it surface at filing time.

2. **The remarks lift moves to the implementation named by the row's `deliverableSegmentId`**, with
   the same precedence as before — a value already on the segment wins, because it is the newer home
   and the one the preparer edits, and old evidence must never overwrite a deliberate edit.

3. **A row naming no segment, or a segment that no longer exists, keeps its property where it is.**
   Not deleted, not dropped on the nearest segment of the same initiative, not invented a home for.
   This is the file's existing non-destructive rule: an unplaceable property stays put so a later
   migration tool can still find it, and it stays readable on the read-only RPTI tab meanwhile.
   Cost is the sole exception, and only because leaving it would make every later load overwrite a
   newer edit. **A value that cannot be placed is a value that must not be deleted.**

**Rejected — infer the segment from the initiative when the row names none.** It guesses at which
implementation a filed comment belonged to, and with several implementations per initiative now
legal, guessing wrong attaches a filed remark to the wrong plan line. Silence plus a recoverable
orphan is the honest state.

**Rejected — drop the remarks lift entirely and let preparers re-enter them.** It discards a filed
value that the workspace can still place unambiguously whenever `deliverableSegmentId` is set,
which is the silent-loss failure this whole line of work exists to end.

**Consequence**: `AttributeLiftInput` gains `deliverableSegments`, and all three callers in
`App.tsx` — share load, workbook import, version restore — must persist what the lift returns. A
lift whose result is discarded is a defect this project has already shipped once, so it is asserted
by test rather than by inspection.

---

### Q21 — an imported implementation's dates follow what the return states (2026-09-24)

**Raised by the product owner** after importing both sample returns and finding two overlapping
`Open API Banking Platform` initiatives on one asset. The overlap had nothing to do with there being
two initiatives — one per filed row is required, because Deskripsi is initiative-owned and the two
rows state different descriptions. It came from the dates the importer invented.

**Decided — three rules.**

1. **An imported initiative spans exactly its filed quarter.** It used to start on 1 January of the
   report year whatever quarter was filed, so a bar's length encoded *which quarter was filed* rather
   than anything about the work: Q1 three months, Q4 twelve. The return states a go-live quarter and
   nothing about when work began. The quarter is the one thing it does say.
2. **An imported initiative's name carries its filed quarter**, as `<application> — Q3 2027`. The RPTI
   has no initiative-name column, so both Open API initiatives were named after the application and
   could not be told apart. Naming them after their descriptions was rejected: those are sentences,
   and they make unreadable bar labels.
3. **An imported implementation's live phase depends on its development type** *(product owner's
   first version, 2026-09-24; revised below)*:
   - **`new`** — from the filed quarter's first day for **three years**. A new build *creates* the
     application, so its live phase is the application's existence, bounded to a planning horizon
     rather than extended five years as before.
   - **`upgrade`** — **the filed quarter only**. An upgrade is an event on an application that already
     exists. Its continued existence is carried by its own inventory history, so an open-ended upgrade
     segment drew a second live bar in parallel with the inventory's own, through 2032, saying nothing
     the first did not.

   *"Three years" is taken as exactly three years of live phase from the go-live quarter's first day
   — a Q3 2027 go-live is live until 2030-06-30 — held in one named constant.*

   **Revised by the product owner, 2026-09-24:** `new` uses the same five-year horizon as the LKPTI
   importer, through **31 December of the filed go-live year plus five**. Thus every 2027 new build
   remains live through 2032-12-31, regardless of quarter. The original three-year rule above remains
   as the first version of this decision. `upgrade` remains the filed quarter only; the open edge case
   below is still open. Both importers call `openEndedDate`, which owns the one horizon constant.

**What it revises: FR-001c and contract 2c** (2026-09-23), which anchored both types on an
open-ended live phase. Under the first version, the defect that motivated them stayed fixed for
`new`: a quarter-bounded anchor put a Q4 build into that year's LKPTI and left Q1–Q3 builds out,
and a three-year phase from any 2027 quarter spans 31 December 2027. The revised five-year phase
also spans that date. For `upgrade` that reasoning never applied in the ordinary flow,
because the application's inventory segment carries its LKPTI membership, not the upgrade's.

**Rejected — keep both open-ended (FR-001c as written).** It treats an event and an existence as the
same thing, and draws the redundant parallel bar described above.

**Measured on the published samples, before → after the first version.** The RPTI regenerates identically — 13 rows,
the same development types in the same order, zero round-trip losses. The two Open API initiatives
now sit in Q1 and Q3 without overlapping. The inventory:

| As at 31 Dec | 2026 | 2027 | 2028 | 2029 | 2030 | 2031 | 2032 |
|---|---|---|---|---|---|---|---|
| Before | 13 | 16 | 16 | 16 | 16 | 16 | 7 |
| After first version | 13 | 16 | 16 | 16 | **13** | **13** | **0** |

Before, the four upgraded inventory applications stayed "live" into 2032, a year past their own
inventory horizon, purely because an upgrade's open-ended segment outlived it — an event extending
an existence. After the first version, the three new applications leave in 2030 while the thirteen LKPTI applications
stay until 2031.

**Two consequences recorded with the first version:**

1. **RESOLVED by the 2026-09-24 revision — the two importers used different horizons.** LKPTI entries
   ran to their as-at year plus five; RPTI new builds ran three years from go-live. When an application
   left the inventory therefore depended on which return supplied it. Contract 2c's shared horizon existed to prevent
   exactly that. The revised rule gives both importers the same five-year horizon. Their end dates
   legitimately differ because the LKPTI sample is evidence of being live as at 2026-12-31 and the
   RPTI sample is evidence of a 2027 go-live: the former ends in 2031, the latter in 2032. Measured
   inventory rows as at 31 December, 2026–2032: **13, 16, 16, 16, 13, 13, 0** before this revision;
   **13, 16, 16, 16, 16, 16, 3** after. The regenerated 2027 RPTI stays at **13 rows**, with
   development types in the same order: `upgrade, upgrade, upgrade, upgrade, new, upgrade, new, new,
   new, new, new, new, upgrade`; round-trip losses remain **zero**.
2. **DECIDED by Q22 (2026-09-25): prior live history is continuous to the shared horizon** — was OPEN: **an upgrade to an application with no live history of its own** — a hand-built workspace, not
   the LKPTI + RPTI onboarding flow — **drops out of the inventory in the year it is upgraded**,
   unless the quarter is Q4. Measured: Q1–Q3 upgrades are in the 2026 LKPTI through the synthetic
   prior phase and absent from 2027 on; a Q4 upgrade is present in 2027 only. It is the Q4-only
   defect FR-001c fixed, returning for this one case. The rule's premise — that the application's
   existence is carried by its own inventory history — does not hold when there is none. Its RPTI
   filing is unaffected and still types as `upgrade`.

### Q20 — current initiative remarks move only when placement is certain (2026-09-23)

**Raised during the Phase 4 migration audit.** Q19 covers the pre-ADR-0013 shape, where a stored
`RptiDetail.remarks` can name its implementation through `deliverableSegmentId`. The current
workspace shape is different: `Initiative.rptiRemarks` has no implementation pointer, yet removing
that field and its editor would otherwise make a preparer-entered value disappear silently.

**Decided**: when an initiative has exactly one live-status implementation across all years, lift
its remark onto that implementation. Planned and funded run-up segments do not count: an
implementation is the transition into production, and counting run-up would misclassify the common
one-run-up/one-go-live shape as ambiguous. An existing segment remark wins. The old schemaless
property is never deleted, including after a successful lift, so the recoverable source remains.

With several live implementations, leave the property on the initiative and raise a non-blocking
data-health warning that quotes it and directs the preparer to the intended lifecycle segment
panel. With zero implementations, place nothing and warn about nothing. An absent status vocabulary
is also safe failure: without evidence of which segments are live, place nothing and warn about
nothing.

**Rejected — copy the remark to every implementation.** That can put words written about one piece
of work onto another application's regulatory row. A blank optional value is honest; a wrong
sentence in a filing is not.

**Rejected — leave ambiguous remarks orphaned silently.** This value was visible and editable on
the Initiatives tab before the change. Making it disappear without explanation repeats the silent
loss this feature exists to prevent.

**Two rules added in review, 2026-09-23**, both measured on the first implementation rather than
reasoned about, and neither stated when Q19 and Q20 were written.

1. **Where the Q19 and Q20 lifts name the same segment, the initiative's value wins.** Both can
   target one implementation: a legacy `RptiDetail.remarks` through `deliverableSegmentId`, and the
   initiative's own remark through the exactly-one rule. The first implementation applied them in
   the other order, so a remark typed on the Initiatives tab was overwritten by evidence of an older
   filing — and the overwritten value was the one that would have been filed as `Keterangan`. The
   initiative's remark is the newer home and the one a preparer edits; old evidence must never
   overwrite a deliberate edit, which is this lift's standing rule and was already the behaviour
   before the field moved.

2. **The ambiguity warning stays silent when an implementation already carries that remark.** The
   lift is deliberately non-destructive, so a successfully placed remark stays on the initiative
   too. Adding a second go-live afterwards made the naive count read "more than one implementation"
   and tell the preparer to enter a remark already sitting on the first implementation and already
   filed. A finding with no action behind it is how the gate loses the credibility the export path
   depends on.

---

### Q18 — `Initiative.deliverableId` is removed with its UI (2026-09-22)

**Decided** during planning for [#52](https://github.com/nofanto/Selara/issues/52). The field exists
only to serve Q10's single-target rule, which Q17 withdrew. Every logic use is a filing use —
`rpti.ts:97, 338, 391, 420`, `dataHealth.ts:233, 249-261`, `rptiImport.ts:421` — and all of them die
with that rule. What remains is an editable control on two screens that nothing reads, plus a
dangling-reference check on it.

The grouping the product owner described — *"the user can group many deliverables into one
initiative"* — runs entirely through segments' `initiativeId`. This field plays no part in it.

**Rejected: keep it, deprecated in the type comment.** Nobody reads type comments. A visible control
that silently does nothing is worse than either removing it or giving it a real job, because a
preparer will set it and expect the filing to follow — which is exactly what it used to do.

**Rejected: repurpose it as a default application for new segments.** A genuine convenience, but it
is a new feature wearing an old field's name, and a control identical to today's would reasonably be
expected to behave as today's does.

**Two consequences, neither visible from the field itself:**

1. **A whole data-health finding goes with it.** `initiative-rpti-unanchored-target` — added days
   earlier as F6 — exists precisely because a *declared* target might carry no work. With no
   declared target the situation cannot arise.
2. **It is load-bearing for the F2 repair path.** A stored row whose deliverable was deleted is
   repaired today by selecting the replacement on the Initiative, which `rpti.ts:338` then matches
   on. Under the implementation grain the repair is to correct the **segment's** own
   `deliverableId`, which is more direct — but the matching and every repair message must be
   rebuilt around it **before** the field is removed. Removing it first would delete a repair route
   before its replacement exists, which is the shape of a defect this project has already shipped
   once (the FR-025 round: three messages naming repairs that could not clear their findings).


### Q17 — the plan line lives on the implementation; Q7 and Q10 are reversed (2026-09-22)

**Decided.** The RPTI is a plan for *development*, and a plan line is a *development*. So the line
lives on the implementation — the lifecycle segment — which names its own application, its own
time, its own type, its own cost and its own commentary. The initiative becomes the **trigger**:
why the work exists, who owns it, which programme it belongs to.

Product owner: *"RPTI is only for development plan, then it should be on the segment"*, and,
confirmed explicitly, *"one initiative can file for several applications."*

**Two recorded decisions are reversed, and both keep their reasoning.**

**Q7 — cost belongs to the initiative.** Reversed. The principle behind it was *"if one piece of
work needs two budgets, it is two pieces of work."* That principle survives untouched; what changed
is the identification of the piece of work. The filing asks about an implementation, carries one
`Estimasi Biaya CapEx` per row, and an initiative-level figure would be repeated across every row —
filing the same budget two or three times. So the budget belongs to the implementation.

`Initiative.capex`/`opex` are **kept stored and editable**, not deleted or derived. They are
portfolio figures used by the timeline, mobile cards and budget report; the implementation's
`capexAmount`/`opexAmount` are separate filed figures. Neither derives from, defaults to, or
overwrites the other. They may legally diverge, so Data Health names both values and both editing
surfaces in a warning rather than blocking export.

**Correction (2026-09-24).** This paragraph previously said the initiative values were derived
totals and the single source of truth. That was the model rejected by the same-day two-figures
decision recorded in research R3: deriving would zero a legitimate initiative budget when no
implementation figures exist and would force a migration of every existing workspace. The
initiative-as-default alternative remains rejected, but for a different reason: a fallback makes
two editable values compete to represent one fact. The accepted model holds two different facts,
and nothing falls back to anything.

**Q10 — an initiative has at most one RPTI target.** Reversed. A programme of work spanning three
systems is ordinary planning, and once each line names its own application the restriction buys
nothing. Verified before reversing (2026-09-22): an initiative with live segments on two
applications currently files **zero rows** and raises `initiative-rpti-multi-target`; declaring one
target files **one row** and the other application's work becomes silently absent with no finding.
That silent absence is the strongest argument against keeping the rule — it is the one place the
model deliberately drops filed-relevant work rather than reporting it.

**Consequences, to be carried by [#52](https://github.com/nofanto/Selara/issues/52)'s feature:**

- The `initiative-rpti-multi-target` error must be **removed**. It forbids what is now legal.
- Target inference (`resolveRptiTarget`, Q10's machinery) loses its purpose for the RPTI, because a
  segment names its own application. Whether `Initiative.deliverableId` survives for other uses is a
  planning question rather than a filing one.
- Reconciliation's canonical identity (Q11/Q12) moves to the implementation.
- `rptiRemarks` moves to the implementation (Q14), which the owner's original instinct proposed and
  which Q14 recorded as correct-but-blocked by the old grouping. Per-year remarks fall out for free,
  removing two of the four justifications for the deferred option-5 ledger.

**What is not reversed.** An implementation still means a transition *into* production (Q2 of the
003 spec, settled by Q16), a retirement still leaves through the LKPTI rather than the RPTI (Q16),
and a row still belongs to the year its implementation happens (Q3 of the 003 spec).


### Q16 — retirement leaves through the LKPTI, never through the RPTI (2026-09-22)

**Decided.** Decommissioning an application is **not** an RPTI event. The RPTI is a plan for
*developing* applications and infrastructure; a retirement is recorded by ending the application's
live phase, after which it simply falls out of the LKPTI at the next as-at date. Nothing about the
retirement appears in the development plan.

Raised while enumerating what makes a lifecycle segment produce an RPTI row. The product owner
first proposed that an implementation meant any change of live state, *including* sunset, then
corrected it: *"rpti doesn't include the sunset or decommission, for sunset/decommission,
application will be taken out from lkpti."* The correction is recorded because the first reading
was reasonable and someone will arrive at it again.

**The format agrees, which is why this is worth pinning.** `Jenis Pengembangan` is an enum of
`new | upgrade` only (`requirement-specs/rpti-schema.md:15`, enforced at `rptiImport.ts:127`).
There is no value that could express a decommission, so a retirement has nowhere to go in an RPTI
row. Had the first reading stood, either the schema was incomplete — which would have entangled
this with [#47](https://github.com/nofanto/Selara/issues/47)'s unverified input contract — or a
retirement would have had to file as `upgrade`, putting "upgrade" in front of a regulator for a
system being switched off. Both were avoided by asking rather than encoding a guess.

**Verified against the implementation** (2026-09-22). An application live from 2020, its live phase
ended 30 June 2027 and followed by a sunset phase:

| | Result | |
|---|---|---|
| LKPTI as at 31 Dec 2026 | 1 row | still running |
| LKPTI as at 31 Dec 2027 | **0 rows** | retired, correctly absent |
| RPTI 2027 | **0 rows** | retirement is not development |

So the behaviour already matches the ruling, and the `sunset` status carrying neither
`isLiveStatus` nor `isPreLaunchStatus` is **correct** rather than an oversight. It had been flagged
as a possible gap; it is not one.

**One trap this exposed, which is not about retirement.** If the preparer also attaches the
*pre-existing live segment* to the retirement initiative, RPTI 2027 does file a row — typed
`upgrade`, with implementation quarter `Q1` derived from the segment's **2020** start date. A
retirement filed as a development, dated seven years before the return it appears in.

That is not a flaw in this ruling. It is the segment-overlap membership rule
(`rpti.ts:151`, `startDate <= yearEnd && endDate >= yearStart`) reaching a date far outside the
filed year, and it is the third symptom of the same cause as
[#52](https://github.com/nofanto/Selara/issues/52) — generation reads a segment's *state* where the
filing asks about an *event*. Recorded here so the three symptoms are known to share a root:

1. a second go-live in one year is dropped (#52);
2. one go-live re-files every year until its open-ended live segment expires;
3. a retirement can file as an upgrade dated from the original go-live.

**Consequence for [#52](https://github.com/nofanto/Selara/issues/52)'s spec:** its Q2 — what counts
as one implementation — resolves to *a transition into production*. The owner's correction removes
the "any live-state change" reading that would have required a third branch for sunset.


### Q9 — post-feature filing correctness outranks byte identity (2026-09-18)

**Decided:** a generated post-feature return must state the year the preparer selected and retain
every pre-existing filed value, subject only to the intended correction that an application no
longer live at the LKPTI as-at date is excluded. Byte-identical comparison with a pre-feature
file is not a meaningful success criterion: the previous file did not state the selected year.

**Rationale:** a regulatory return's correctness is its stated period and filed values, not a
binary match against an earlier format that omitted required context. The earlier SC-004 wording
would incorrectly fail an improved export merely because it now tells the preparer and reviewer
what period it covers.

**Rejected:** preserve pre-feature byte identity (contradicts the requirement to state the year
in exported output); omit the year from the export while showing it only on screen (contradicts
FR-003 and leaves an exported filing ambiguous).

### Q8 — bare-Asset RPTI targets are not supported (2026-09-18) — **IMPLEMENTED** (ADR-0013)

**Decided: no.** Selara files infrastructure, as OJK Format 3.1 requires, but it models an
infrastructure item as a **Deliverable** under its Asset — the same as an application. An RPTI row
whose target is a bare Asset is not a supported way to file, and the rule is now explicit rather
than implied by what the importer happens to do.

Raised by Codex against the read-only decision. My first answer — "the importer does not create
them" — was not an argument: it describes one producer, when the question is what a workspace can
contain. The row is two clicks away. `DataManager.tsx:208-210` builds the Initiative Deliverable dropdown from
deliverables **and** assets, and `deriveRptiTargetTypes` sets `targetType: 'asset'` from whichever
list the chosen id is found in. `generateRptiDetails` emits only deliverable-target rows, so once
the tab is read-only and Reports is the filing path, such a row would leave the filing in silence.

**The evidence that this is an existing answer, not a new restriction** (measured 2026-09-18):

| | Rows | Target type |
|---|---|---|
| Infrastructure rows in the sample (category `51`-`54`, `99`) | **5** | all `deliverable` |
| Every imported row | 13 | all `deliverable` |

`rptiImport.ts:435` sets `targetType: 'deliverable'` unconditionally — there is no asset path
anywhere in the importer. The bare-asset target is an affordance that predates the importer.

**Consequences:**

- An existing asset-target row gets a **pre-export data-health error** naming the complete repair:
  record the infrastructure item as a Deliverable under its Asset on the Deliverables tab,
  select it in the initiative's Deliverable column on the Initiatives tab, and add a qualifying lifecycle segment
  for that pair on the Visualiser timeline. Error, not warning — the row is otherwise dropped from
  a filing without a word. Repair copy is progressive: after the Deliverable and target are in
  place, it names only the remaining timeline segment rather than repeating completed work.
- The Deliverable dropdown stops offering assets. T026a does this anyway by making the tab read-only.
- A **constructed** test proves such a row cannot vanish silently from a Reports-generated filing.
  The sample cannot carry this: it holds only deliverable targets and would pass either way.

**Rejected: supporting asset targets.** It reads like the smaller change and is the larger one. An
Asset carries no `developmentType`, `categoryCode`, planned quarter or cost, so a second generation
path would need a canonical source defined for each of the four before it could file anything —
more work than the rest of this feature, for a shape nothing in the product or the samples needs.


### Q7 — cost belongs to the initiative, and an initiative has at most one RPTI target (2026-09-18) — **REVISED by Q17 (2026-09-22)**

This entry is retained as the historical decision and reasoning. Q17 reverses its cost placement
and single-target outcome while preserving the principle that one piece of work has one budget.

**Decided: option (c).** `RptiDetail.capexAmount` and `opexAmount` are removed. `Initiative.capex`
and `Initiative.opex` are the filed figures, with no per-row override and no fallback chain.

Raised by Codex as a blocker on the read-only decision: those two fields are *not* derived — they
are per-row overrides (`resolveCost` is `detail.capexAmount ?? initiative?.capex ?? 0`,
`src/lib/rpti.ts:310-314`) and the RPTI tab is their only editing surface. Read-only would have
removed it.

**Why (c) rather than a per-target cost.** An RPTI row is a line of the bank's development plan,
and the plan's unit of work is the initiative. If one initiative needs two different budgets, it
is two pieces of work. Modelling a cost per (initiative, target) pair would let the tool express
something the filing has no way to say, and the override existed only because generation had
nowhere else to put an imported figure.

**This is not a new constraint; it is an existing one made explicit.** Measured 2026-09-18:

| Source | Initiatives | With more than one target |
|---|---|---|
| Shipped demo catalogue (`workspaceTemplates.ts`) | 7 | **0** |
| Imported sample RPTI (`sample-rpti-2027.xlsx`) | 13 | **0** |

`Initiative.deliverableId` (`src/types.ts:70`) has always been a single-valued target link, edited
in `InitiativePanel.tsx:132` and dangling-ref-checked in `dataHealth.ts:177`. What changes is that
RPTI generation stops grouping by `initiativeId::deliverableId` off the segments and honours the
initiative's own target instead.

**Historical Q7 enforcement — superseded by Q10 below.** The broad multi-target error described in this paragraph now applies only when no target is declared.

**Enforcement is a data-health error, not a hard block.** Nothing stops a user attaching segments
on two applications to one initiative, and generation would then emit two rows carrying the same
budget — a double-count in a filed return, which is why it cannot be a warning. But refusing the
arrangement outright would make the timeline reject a legal way to draw work, for the benefit of
one consumer. So: allow it to be drawn, flag it as an error, and name the fix (split the
initiative).

**Consequences:**

- `RptiDetail.capexAmount`/`opexAmount` are removed from the type. Every field in the RPTI tab is
  then genuinely derived, which is what FR-021's read-only justification claimed and, until this
  decision, was not true of two columns.
- Lifting is required before the fields go: an imported override equals its initiative's figure
  (the importer writes both from the same cell, `rptiImport.ts:424-425` and `:443-444`), but a
  hand-edited one may not. A differing override must be lifted onto the initiative, not dropped.
- SC-001 is unaffected — it compares through `resolveCost`, which now reads the initiative
  directly.
- My earlier recommendation that the fixture needs a multi-target initiative is **withdrawn**.
  Under (c) that arrangement is a defect to detect, so what it needs is a data-health test, not a
  supported case.

**One-time lift completion (2026-09-19).** Legacy `capexAmount`/`opexAmount` properties are removed
from stored rows immediately after their values are lifted and the cleaned rows are persisted on
the live-state boundary: ordinary load, shared-workspace load, workbook import, or version restore.
This is the durable completion signal. Leaving those two properties as orphaned evidence was
rejected because every later entry would treat them as authoritative again and overwrite a newer
Initiative edit. This exception applies only to costs; the other legacy properties remain
non-destructive evidence as Q4 records.

**Rejected:** a cost on `DeliverableSegment` (the segment is a time slice, so an initiative with
three phases on one application would need a summing rule that the filing never asks for); a new
`InitiativeTarget` join entity (exact grain, but a new store is the expensive change in this
codebase and it buys the ability to express something OJK cannot receive); keeping the two columns
editable in an otherwise read-only tab (reinstates the split-brain the decision exists to end, on
the two columns most likely to be wrong).


### Q1 — the eight attributes move onto `Deliverable` (2026-09-17) — **IMPLEMENTED** (ADR-0013)

`Deliverable` gains the seven fields it lacks — `platform`, `database`, `dcProvider`,
`drcProvider`, `backupStrategy`, `systemOwner`, `ownership` — taking it from 11 fields to 18.
`developer` already exists there and widens from the two-value `RptiDeveloper` enum to also
carry a service provider's name, as `LkptiDetail.developer` does today.

**Because the attributes belong to the thing, not to the filing.** A bank knows who runs its
data centre, whether a server is leased or bought, and who owns a system, regardless of which
return is due. RPTI simply has no column for any of it.

*A claim made and withdrawn during the discussion:* that these seven are meaningful only for
`type: 'application'` and would sit uselessly on the other four deliverable types. That is
wrong. `systemOwner`, `ownership`, `dcProvider`, `drcProvider` and `backupStrategy` describe
infrastructure at least as naturally as they describe applications — you lease servers, a data
centre has a provider. What is application-only is the **LKPTI report** that asks for them, not
the attributes. Recorded because the objection sounds right and is not.

**And because a new store is disproportionately expensive here.** `AppState` is enumerated at
every call site rather than spread, so `App.tsx` alone holds **73** references to
`lkptiDetails`. A child store would need a schema bump (19 → 20) and migration, a sheet in
`excel.ts`, a `compareEntities` block in `diff.ts`, dangling-reference checks in `dataHealth`,
a Data Manager tab, and those ~73 call sites. Extending `Deliverable` needs seven lines in
`types.ts`, seven columns, and seven lines in `diff.ts` — `excel.ts` is generic so the
round-trip is free, `db.ts` needs nothing because IndexedDB is schemaless within a store, and
`App.tsx` needs nothing because `Deliverable` already flows everywhere.

**Costs accepted:**

- The Deliverables tab goes from 10 to 18 columns, roughly 2,800px wide. It scrolls, and the
  widths work since [#44](https://github.com/nofanto/Selara/issues/44), but it is a lot of columns.
- Per [#42](https://github.com/nofanto/Selara/issues/42), each new field must be named
  explicitly in `diff.ts` or version history will not see it — silently.
- Broad in-place migration remains deferred, while the idempotent entry-boundary lift prevents
  legacy row values from being lost during live use — see Q4.

**Left open by this decision:** `AssetCategory` already supplies category-level defaults for
`categoryCode` and the four locations. Several of the new fields — `dcProvider`, `drcProvider`,
`backupStrategy` — would plausibly want the same, since a bank tends to answer them identically
across a whole category. Not decided here; it is additive and can follow.

**Rejected — a new `applicationProfiles` child store.** Structurally identical to what
`LkptiDetail` already is: a 1:1 record keyed by deliverable holding exactly these fields. It
would be a rename with a migration attached, at the cost listed above.

**Rejected — reframing `LkptiDetail` as the application profile.** The cheapest option by far,
since it moves no data and needs no migration: declare the existing record to *be* the
application's regulatory profile and generate the LKPTI export from it. Turned down because it
leaves the attributes in a record named after one report, so every future reader has to learn
that `LkptiDetail` is not what it sounds like — and it entrenches the conflation this document
set out to remove. Worth revisiting only if the migration in Q3 proves more dangerous than
expected.

### Q2 — `remarks` moves onto `Initiative` (2026-09-17) — **IMPLEMENTED** (ADR-0013)

`RptiDetail.remarks` — the RPTI's `Keterangan` column — becomes a field on `Initiative`.
Confirmed with the product owner: *Keterangan is commentary on the item*, not on this year's
filing of it, so it belongs to the work rather than to the row.

**The precedent is two lines above it in the same export.** `exportRptiReportToExcel` already
takes `Deskripsi` from `initiative?.description` and `Keterangan` from `detail.remarks`
(`rpti.ts:364` and `:374`). The RPTI's two free-text columns were arbitrarily split between two
records; this makes them symmetric.

**It is also what makes the whole change land.** `RptiDetail` has exactly two fields with no
derivation source: `remarks`, and `ppjtiRelatedParty` for PPJTI rows (Q3). Resolve both
and `RptiDetail` is 100% derived, so the RPTI tab can genuinely be empty until generated. Keep
a thin `RptiDetail` alive to hold one optional string and the tab never empties, which defeats
the purpose.

**Accepted consequences:**

- Commentary is per-initiative, not per-year. An initiative spanning 2027 and 2028 carries the
  same `Keterangan` into both returns. Acceptable given the answer above — if it later turns
  out a bank needs to say "delayed from 2027", that is a different field, not this one.
- An initiative touching two deliverables generates two rows sharing one remark, since
  generation groups by `(initiative, deliverable)`.
- **Naming needs care.** `Initiative` already has `description`, which is general-purpose and
  shown on the timeline. A second free-text field must make the distinction obvious in its type
  comment, or the two will be filled interchangeably.

**Rejected — keep a thin `RptiDetail` for identity plus `remarks`.** Preserves per-row, per-year
commentary exactly, but keeps a whole record alive for one optional string and prevents the tab
from ever emptying.

**Rejected — accept that regeneration discards it.** That is precisely the data loss fixed in
`aabee9f`, reintroduced on purpose.

### Q3 — `ppjtiRelatedParty` moves onto `Deliverable` (2026-09-18) — **IMPLEMENTED** (ADR-0013)

`Deliverable` gains `ppjtiRelatedParty`, joining the Q1 fields. Confirmed with the product
owner: the bank holds this **per application**, not centrally per vendor.

The RPTI column is *PPJTI Pihak Terkait* — is the IT service provider a related party? — with
values `yes | no | n/a`. Generation already derives half of it: when the developer is not
PPJTI the answer is `n/a` by definition, because there is no third party to disclose a
relationship with (`rpti.ts:206`). The other half has no source, which is why ten of the
thirteen sample rows lost it when regenerated.

It sits well beside `developer` on the same record, and generation already reads `developer`
from the `Deliverable` to decide the `n/a` half, so both halves of the answer end up in one
place.

**Known simplification, recorded so it is not a later surprise.** *Related party* is really a
property of the bank's relationship with a supplier, not of one application — the same vendor
should answer the same way everywhere. Held per-deliverable, ten applications supplied by the
same company can be answered ten different ways and nothing will catch the inconsistency.
Accepted because it matches how the bank actually holds it, and because the alternative is a
supplier entity Selara does not have: `developer` is free text today, so modelling vendors is
its own piece of work and should be its own decision rather than smuggled in here.

**With this and Q2 settled, `RptiDetail` has no field left without a derivation source** — the
condition the whole change depends on.

### Q4 — broad migration remains deferred; the existing lift covers live-state entry (2026-09-18, revised 2026-09-19)

**Original decision (2026-09-18): do not build broad migration tooling as part of this work.**
This is a major overhaul of how report rows relate to the entities behind them; Selara is pre-1.0
and local-first, and the population of workspaces carrying pre-change data is small and known.
At the time, covering live IndexedDB, version snapshots, exported workbooks and shared files was
framed as one four-surface migration project to undertake only if demand appeared.

**Revised decision (2026-09-19): widen the lift across the entry boundaries that already exist.**
That earlier framing was overtaken when `liftReportRowAttributes` shipped as a pure, idempotent
function. The choice is no longer whether to build migration machinery for four surfaces; it is
whether to call an already-tested function at three additional sites. Old-shaped data is now
lifted and persisted before it enters live state through:

1. **Ordinary IndexedDB load.** The original lift site. A changed result is saved immediately.
2. **Shared-workspace load.** The lifted data is folded into the existing write that accepts the
   shared workspace.
3. **Generic workbook/viewer import.** An exported `.xlsx` on someone else's disk remains beyond
   Selara's reach, but the existing import path now lifts it as soon as it becomes reachable and
   saves only the lifted form.
4. **Version restore.** Snapshots remain immutable in the versions store; their restored copy is
   lifted before `handleUpdate` admits it to live state, and `handleUpdate` persists the result.
   This matters even though a version is Selara's own data: restoring a pre-ADR-0013 snapshot
   reintroduces legacy cost properties whose removal is the one-time migration marker. Restore
   followed immediately by Generate must file the lifted values without relying on a reload to
   self-heal first.

**Cross-tab sync is deliberately excluded.** `applyRemoteSync` reads IndexedDB after the writing
tab has already lifted and persisted the data. Repeating the lift there guards no real ingress and
would blur the active/passive rule that the receiving tab never re-saves a remote update.

**What remains deferred.** There is still no eager rewrite of every saved snapshot, no schema
version stamped onto historical snapshots or exports, and no way to mutate files outside Selara.
Those are broad migration tools. They are not needed to prevent loss during live use because the
idempotent boundary lift handles a snapshot or workbook when it is restored or imported. Entity
values win over legacy row values, and removed legacy cost properties durably mark completion.

**Rejected alternatives:** narrowing ADR-0013 and contract 14 to say only ordinary mount load was
covered would make the records less false but leave plausible restore-then-Generate loss in place;
adding the lift to cross-tab sync was rejected because the writer has already performed and saved
it; eagerly rewriting the versions store was rejected because lifting the restored copy preserves
snapshot immutability while covering the moment the old shape can affect a filing.

### Q5 and Q6 — SUPERSEDED, see below (2026-09-18)

> **Superseded the same day by the decision recorded under "Q5/Q6 revised".** Left in place
> because the reasoning still explains why the smaller step was attempted first.
### Q5 and Q6 — the Data Manager tabs stay exactly as they are (2026-09-18)

**Decided: no change to either tab in this work.** Both keep their rows, stay editable, and
keep their Generate buttons. No read-only mode, no removal.

That answers Q5 (read-only?) with *no*, and defers Q6 (empty-until-generated, or merely
obviously-derived?) entirely.

**What this means for the change, stated plainly: the observation that opened this document is
not addressed by it.** Importing will still fill both tabs. What remains is the data-model
half — the eight attributes and `remarks` move to the entities they describe (Q1-Q3) — so the
tabs show rows whose remaining fields are genuinely derived, with fewer own-fields to edit.

That is worth doing on its own terms. It removes the conflation diagnosed above, and it is the
prerequisite for ever making the rows projections: nothing can be generated-on-demand while
`LkptiDetail` is the only home for eight fields. But it is a step toward the goal rather than
the goal, and the doc's title should be read as the destination, not this instalment.

**Also considered and set aside: deleting both tabs entirely**, generating the reports from the
Reports menu instead. `RptiReportView` and `LkptiReportView` already exist and already export,
so they would generate rather than receive rows. It would delete two tabs, roughly thirty
column definitions, two stores, two `excel.ts` sheets, two `diff.ts` blocks, and the whole
merge-preserving apparatus — which only exists because rows are stored. It would also give the
report year a natural home as a report parameter, resolving much of #40.

Two consequences stopped it being a small change, and both should be carried forward:

1. **Filed rows that do not match the workspace have nowhere to live.** The unresolved upgrade
   from #38 is stored as an `RptiDetail` with a deliberately unresolvable `targetId`. It cannot
   be generated, by definition — no segment, no initiative link, nothing to derive it from.
   Removing stored rows means either dropping that filed row or creating a deliverable for it,
   which FR-019 explicitly refuses.
2. **A past filing would be reproducible only under today's rules.** Generation is
   deterministic, so regenerating from a restored snapshot is safe — until a rule changes. One
   changed this session: `hasPriorLiveSegment` moved from `endDate` to `startDate`, flipping
   rows between `new` and `upgrade`. A pre-change snapshot would now regenerate differently from
   what was filed. For a History meant to be an audit trail, "what we filed" quietly becoming
   "what we would file today" is a real weakness.

   The resolution that fits rather than fights #40: **generated during preparation, snapshotted
   at filing.** Nothing stored while working, and the produced rows frozen into the filing
   record as what was actually submitted — which also makes the filing record the natural owner
   of the report year.

### Q5/Q6 revised — the report tabs become read-only, and generation moves to Reports (2026-09-18) — **IMPLEMENTED** (ADR-0013)

**Decided, superseding the above.** Both Data Manager report tabs become **read-only**, and will
be removed once the destination is reached. Generation moves to the Reports tab, where the
preparer states the year period and the return is shown.

**Why the earlier answer did not hold.** Leaving the tabs editable created a screen whose edits
would have no effect on the filing — reviewed by Codex, who put it plainly: a preparer could
reasonably assume that editing a Data Manager report row changes the result generated from
Reports. The proposed mitigation was a warning. Read-only removes the confusion at its source
instead of labelling it, and it is the honest description of what those rows now are: a
projection, not an input.

It also settles a question the mandatory as-at date had opened. `generateLkptiDetails` has exactly
one production caller, `DataManager.tsx:251` — the tab's Generate button — which has no year
prompt. Options were to add a prompt there, to pass today's date (reintroducing the very defect
the as-at rule fixes), or to move generation out. This decision takes the third, and the button
leaves Data Manager with it.

**Consequences, all of which the spec and task list must now carry:**

- `FR-021` inverts: the tabs remain present and populated but are **not** editable, and their
  generate actions move to Reports.
- **Seven data-health findings point at these tabs** as the place to fix something, across eleven
  check kinds (`rpti-target`, `rpti-incomplete`, `lkpti-incomplete`, `lkpti-golive-future`,
  `lkpti-too-long` and others). Every one now sends the preparer to a screen where nothing can be
  fixed. They must be repointed at the entity that owns the value — a significant expansion of
  T028, and the part of this decision most likely to be missed.
- **The unresolved imported row is repaired differently.** Today the preparer sets its Target in
  the RPTI tab. With the tab read-only, the repair is on the source side: create or rename the
  application the filed plan refers to, and the next generation reproduces the row. That is what
  FR-025 always intended — repair the workspace, not the row — but the data-health message must
  say so, because "points at a deliverable that no longer exists" does not.
- **Seven e2e specs** touch these tabs and will need revisiting.

**Not changed:** the rows remain stored and exported as they are today. This decision is about
who may write them, not about removing them — that is still the deferred step.

## Carried into the Spec Kit spec

No questions remain open. Three things were decided *not* to be solved here and must be
carried forward, since each is load-bearing for the destination:

1. **Migration (Q4)** — broad in-place rewriting remains deferred, but the shipped idempotent lift
   covers every reachable entry into live state: ordinary load, shared-workspace load, generic
   workbook import and version restore. Files outside Selara are lifted when re-imported; cross-tab
   sync reads the writing tab's already-lifted persisted result.
2. **Filed rows with no derivation source** — the unresolved upgrade from #38 cannot be
   generated, so a projection model needs a home for it.
3. **Snapshot at filing time** — generation rules change, so a past filing must be frozen
   rather than re-derived. This is where the report year naturally lives, and it is the piece
   that must land with [#40](https://github.com/nofanto/Selara/issues/40).

## Rejected

- **Empty the tabs now, accept the loss.** Silently discards eight fields of a filed return.
  Not a trade-off worth naming twice.
- **Teach generation to read the import.** Making generation consult the last imported file
  would preserve the values without a data-model change, but it makes a pure function depend on
  import history, and the values would be unrecoverable once the file is gone.
- **Do this before #40.** See above.

## Related

- [#40](https://github.com/nofanto/Selara/issues/40) — the report year is never stored
- `requirement-specs/rpti-auto-generation.md` — the generation rule and its merge-preserving behaviour
- `requirement-specs/lkpti-integration.md` §3 — why LKPTI generation is not year-scoped
- `requirement-specs/it-planning-flow.md` — step 2/3 of the cycle this document reconciles
- ADR-0010 — merge-preserving LKPTI generation, which exists precisely because these fields cannot be regenerated

## Q10 — Existing initiatives without a declared RPTI target (decided 2026-09-18) — **REVISED by Q17 (2026-09-22)**

This entry is retained as the historical compatibility rule. Q17 reverses the single-target
model; Q18 removes `Initiative.deliverableId` and rebuilds repair around the segment's target.

Coordinator-approved compatibility rule: an explicit `Initiative.deliverableId` wins.
Otherwise infer a target only when all the initiative's lifecycle segments name exactly
one existing Deliverable, including infrastructure. Inference considers all years because
FR-029 makes the target a property of the initiative, not the filing year. Generation
uses only qualifying segments on that resolved target for the selected year.

An initiative with qualifying segments but no resolvable target gets a data-health error
and blocks RPTI export, with instructions to select/repair the target or split ambiguous
work. Multiple segment targets are an error only without an explicit target; other
segments on an explicitly targeted initiative remain timeline history. This supersedes
FR-030's broad multiple-application check: the declared-target generator emits one budget
once, so its old double-counting justification no longer applies to declared targets.

Rejected: silently skipping undeclared targets loses existing template/hand-built work;
requiring manual re-keying for an unambiguous target creates unnecessary migration work;
year-dependent inference lets one initiative change targets between filings; blocking all
multi-deliverable history falsely rejects an explicitly declared, unambiguous target.

Acceptance: regression tests cover the shipped demo, unambiguous application/infrastructure
inference, ambiguous and missing targets, explicit target precedence, and the pre-export
repair gate. Stored rows remain readable in Data Manager; report edits belong on entities.

## Q11 — The Reports path is a pure projection; stored rows are reconciliation evidence (decided 2026-09-18) — **IMPLEMENTED** (ADR-0013)

**Decided: option 3 + option 1 of `specs/002-report-year-field-ownership/merge-path-options.md`.**
`generateRptiDetails(input, reportYear)` — which accepted an optional `existingDetails` and ran
`mergeWithExisting` over its result — is removed. In its place:

- **`projectRptiReturn(input, reportYear)`** — the projection, whose input type
  (`ProjectRptiInput`) has no `existingDetails` key. Reports calls this. Handing stored
  rows to the projection is a **compile error**, asserted by a `@ts-expect-error` test in
  `src/lib/rpti.test.ts`, so the fix cannot be bypassed by convenience at a call site.
- **`reconcileRptiReturn(input)`** — the gate's other half. It compares stored rows against
  the source model and returns **findings** (typed `RptiReconciliationFinding`, reason codes
  `asset-target | missing-initiative | missing-target | unanchored`, each naming a source-side
  repair), never rows. The gate may display `finding.row` as evidence; the row enters neither
  the return nor the export.

**The defect this closes (#40):** `ReportsView.tsx` passed stored `rptiDetails` as
`existingDetails`, so `mergeWithExisting` carried every unmatched stored row into the selected-year
return — measured: a workspace whose only segments sit in 2027, generated for 2026, returned a row
`rpti-gen-i1-d1-2027`. A 2027 plan line inside a 2026 filing was contract 2 (`generation.md`)
broken in the shipped path.

**The rule the reconciler encodes — the two axes are independent.** Selected-year membership and
reproducibility are different questions: a valid 2027 row absent from a 2026 projection is
*correct* and produces no finding; an asset-target, dangling-reference, or permanently-unanchored
row is unreproducible *in any year* and blocks until repaired. Derivability is therefore tested
across all years (resolve the initiative's Q10 target; require one qualifying-status segment on
that (initiative, target) pair), never against the selected year's output.

**The merge is deleted, not renamed.** `regenerateStoredRptiRows` (the analysis's name for a
preserved merge API) has no caller to preserve it for: DataManager's Generate buttons left in
the read-only revision (Q5/Q6), Reports was the only production caller, and Reports must not
merge. The v2 safety net the merge provided — unreproduced rows surviving with filed values —
is replaced by the gate: the row stays visible in Data Manager, and its absence from the return
is now *loud* (FR-024) instead of papered over by carrying it.

**The accepted honesty limit.** `RptiDetail` carries no report year and one cannot be inferred: a
quarter is not a year, generated-id suffixes are not a contract, and `deliverableSegmentId` is
absent in exactly the unresolved cases that matter. So findings are global — an unreproducible
row blocks *every* year's export until repaired — and messages say "no filing year can reproduce"
rather than naming a year the data cannot support. Precise selected-year attribution is the job of
the deferred option 5 (a year-bearing unreconciled-row ledger at import time); it is explicitly
not built here.

**Verified, not assumed — LKPTI has no equivalent hazard.** `generateLkptiDetails` does take
`existingDetails`, but its row membership is purely derived: a deliverable live as at the as-at
date is in, everything else is out "even if an existing row was present for it" (pinned by a unit
test in `src/lib/lkpti.test.ts`). `existingDetails` there only refreshes values *on a row whose
membership already holds* (its id and pre-lift manual attributes) — a cascade, per ADR-0010, not a
carry. No foreign row can enter an LKPTI return, so no projection-only API is imposed on it.

**Rejected (full analysis in `merge-path-options.md`):**
- **Option 2, year-scoped preservation merge** — requires authoritative year provenance the type
  does not have; the metadata-free version (guess the year from segment, id suffix, or quarter) is
  the same inference this decision rules out, and it keeps the return a union rather than a
  projection.
- **Option 4, filing/import snapshots** — the right long-term shape for reconciling a whole prior
  filing, but a new persisted concept with baseline-selection UX; heavier than this defect needs.
- **Option 5, unreconciled-row ledger** — deferred, not refused: it is what later fixes exact
  year attribution and import-time completeness. Building ledger + gate now would design the gate
  twice.
- **Leaving `existingDetails` optional on `projectRptiReturn` "for now"** — the analysis's trap
  warning: an `Omit` wrapper over an API that still accepts stored rows is cosmetic. The whole
  point of option 3 is that the projection's input *cannot* carry them.
- **Branding projected vs stored row types** (the analysis's "stronger variant") — deferred;
  `RptiDetail` flows through DataManager, diff, excel and the exporter, and the input-type split
  already makes the observed defect uncompilable. Revisit if a caller ever constructs stored rows
  from projection output.

**Consequences:** contract 2 of `generation.md` is restored and restated with explicit
reconciliation contracts (22–25); the pre-export gate in `ReportsView.tsx` is
source diagnostics + `reconcileRptiReturn` findings, never merge residue; `rpti-auto-generation.md`
records the merge as v2, superseded.

## Q12 — Repair stale row identities by canonical correspondence, never by editing evidence (decided 2026-09-19)

**Decided:** stored report rows remain immutable evidence. A source-side repair clears an RPTI
finding when the stored row corresponds one-to-one with a current canonical row by the surviving
filing identity: the same Initiative identifies a replacement target, or the same target identifies
a replacement Initiative. A bare-Asset row therefore becomes repairable when its Initiative is
pointed at a generatable Deliverable under that Asset. Cardinality is part of identity: two stored
rows cannot both be accounted for by one canonical row.

This deliberately does **not** compare filed contents. Development type, quarter, category,
provider, locations, related-party answer and remarks remain outside the reconciliation policy
by the product decision recorded in Q13. The gate says only whether each stored row has exactly
one current canonical counterpart and each counterpart accounts for at most one stored row.

LKPTI has an important asymmetric case. `LkptiDetail` historically stored only `targetId` plus
report contents; the filing identity — the application name — was resolved from the Deliverable.
Once that Deliverable is gone, an already-orphaned row contains no identity from which a newly
created application can be recognised. For those rows the honest repair is to re-import the
filing, and `lkpti-target` must say why. Newly imported LKPTI rows retain the application name as
identity evidence so a future orphan can be matched to exactly one same-named Deliverable. There
is no inference-based backfill or migration of already-orphaned rows.

**Rejected — an identity-remap editor in Data Health.** It would make stored rows editable again
one screen removed from the report tabs, recreating the split-brain authorship that Q5/Q6 removed.

**Rejected — exact-one-by-elimination for LKPTI.** One orphan plus one new application does not
prove they are the same application. A wrong automatic attachment would be silent regulatory
misclassification precisely when the workspace is least trustworthy.

**Rejected — matching by report contents.** Identity repair must not invent equality rules for
filed values; Q13 records the now-settled field-fidelity policy explicitly.

## Q13 — Reconciliation matches filing identity, not field contents (decided 2026-09-19) — **IMPLEMENTED**

**Decided:** once a stored RPTI row has one unambiguous canonical counterpart, field-level drift
between the filed evidence and today's regeneration is deliberately not reported. This includes
`developmentType`, quarter, `categoryCode`, developer, locations, related-party answer and remarks.
`reconcileRptiReturn` matches identity and cardinality only; `rpti.test.ts` pins the case where an
old filed quarter and remarks differ from the current projection but produce no finding.

The portfolio is expected to evolve after a filing. A stored row is evidence of what was filed,
not an assertion that its contents should override or condemn a correct regeneration from today's
canonical entities. Re-flagging every detectable drift would train preparers to ignore the gate,
while offering no different repair from accepting the current, correctly derived return. The gate
therefore stays focused on the actionable failure FR-024 names: a filed row that cannot be
reproduced at all, or cannot be matched one-to-one to a canonical row.

**Rejected — warn only for fields that appear to change filing meaning.** The considered subset
was category, development type and developer, while remaining silent on quarter and remarks. It
was rejected because a warning with no action distinct from correct regeneration is still noise;
splitting fields into more- and less-important drift would make the gate look authoritative about
content fidelity while stored evidence intentionally does not govern current generation.
