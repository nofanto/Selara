# Quickstart: validating implementation-grained RPTI rows

**Feature**: 003-rpti-row-per-implementation · **Date**: 2026-09-22

Levels are ordered so a failure at level *n* makes level *n+1* meaningless. Run them in order.

```sh
npm run dev                              # http://localhost:3000
npm run test:unit
npx playwright test > /tmp/pw.log 2>&1; echo "exit=$?"   # never pipe to tail: it returns tail's status
```

---

## Level 1 — The defect is gone

One initiative, one application, two live segments starting Q2 and Q4 of 2027. Generate the RPTI
for 2027.

**Expect two rows**, one stating Q2 and one Q4.

Measured before the change: **one row, Q4** — the Q2 implementation silently absent. This is the
whole feature; if it fails, nothing below matters.

## Level 2 — Ordinary work is untouched

A workspace where every initiative has one implementation produces exactly what it produces today —
same rows, same values, same order.

This is the regression that matters most in practice. Almost every real workspace is this shape,
and a grain change that quietly alters single-implementation output would be far worse than the
defect it fixes.

## Level 3 — One go-live files once, in one year

An upgrade going live in Q2 2027, its live segment running open-ended to 2031. Generate 2027, 2028,
2029, 2030, 2031.

**Expect a row in 2027 only.**

Measured before the change: a row in **every one of those years**, each stating Q2 2027 — stopping
only when the segment's arbitrary `+5` horizon expired. The second of the three symptoms in
research.md R1.

## Level 4 — A run-up is not an implementation

A new application with a planned phase in Q1 and its go-live in Q3, both in 2027.

**Expect one row**, stating Q3, typed `new`.

Two rows here would duplicate the application within a single return.

## Level 5 — Costs belong to the implementation

Give the Q2 and Q4 implementations different CapEx figures. Generate.

**Expect** each row to state its own figure — not the initiative's, and not a share of it.

Then set the initiative's own budget to something different from their total. **Expect**: the filing
is unchanged (it reads the implementation), and data health raises a **warning** naming both
figures. It must not be an error and must not block export — the two are allowed to differ, and a
gate that treats a legitimate arrangement as a defect is one preparers learn to skip.

Both figures stay editable: the initiative's on the Initiatives tab and in the initiative panel, the
implementation's on the segment panel.

## Level 6 — One initiative, several applications

An initiative with implementations on two different applications in 2027.

**Expect two rows**, one per application, and **no data-health error**.

Measured before the change: **zero rows** and a `multi-target` error, or — once a target was
declared — one row with the other application's work **silently absent**. That silent absence was
the argument for reversing Q10.

## Level 7 — A retirement stays out of the RPTI

An application live since 2020, its live phase ended mid-2027, followed by a sunset phase.

**Expect**: LKPTI as at 31 Dec 2026 lists it; as at 31 Dec 2027 does not; RPTI 2027 has **no row**
for it — including when the preparer attaches the pre-existing live segment to the retiring
initiative.

That last clause is the third symptom from research.md R1: today it files a row typed `upgrade`
with quarter **Q1**, derived from the segment's 2020 start date.

## Level 8 — Round trip, on a fixture that can actually fail

Import a filed return containing **two rows for one application in one year**, regenerate for that
year, compare field by field.

**Expect zero losses.**

The published sample holds 13 rows across 13 initiatives with one implementation each, so it cannot
exercise this feature. Without a new fixture case, this level reports success while verifying
nothing — the failure mode that let several defects reach review in the previous feature.

## Level 9 — Stored history survives the grain change

A workspace whose stored rows were filed under the previous model.

**Expect**: rows matching exactly one current implementation raise nothing; rows matching none are
named before export; two rows matching one implementation report a conflict.

The grain change must not turn correctly-filed history into noise. A gate that cries wolf about
valid rows is a gate preparers learn to skip.

## Level 10 — An existing workspace loses nothing

A workspace whose budgets sit on initiatives, loaded after the change.

**Expect**: every initiative keeps its budget, the timeline and budget report are unchanged, and no
migration has run. The implementations have no figures yet, and the divergence warning says so.

Generating a filing at this point states zero for each row — correct, since nothing has been
entered — and the warning is what tells the preparer why, before they file rather than after.

## Level 11 — Version history sees the new fields

Change an implementation's cost, and separately re-attribute a segment to a different initiative.
Save a version, run the difference report.

**Both must appear.** `initiativeId` is a pre-existing gap — re-attribution changes the filing today
with no history entry at all.

## Level 12 — Scale

300 applications with **several implementations each** generate and reconcile within the existing
bound. The current fixture builds one segment per deliverable and will not exercise the increased
row count; reconciliation is the part to watch, since both sides of the matching grow.
