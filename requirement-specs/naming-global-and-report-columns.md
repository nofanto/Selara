# Naming: Selara's own concepts are not named after a return — Design Notes

> **Status:** Decided 2026-09-19 by the product owner. Applied to three columns; one
> deliberately held (see "Open"). Arose while verifying [ADR-0013](../docs/adr/0013-report-rows-as-projections.md)
> by hand.

## The rule

**A column on one of Selara's own entities is named in Selara's own terms. A column that
belongs to a specific return may be named in that return's terms.**

Selara's concepts — Initiative, Deliverable, Asset, Asset Category, Lifecycle Segment — are
*global*. They exist whether or not a bank files anything. LKPTI and RPTI are *local*: one
Indonesian regulator's formats, which this tool happens to produce. A global entity whose
column is called `RPTI Target` or `PPJTI Related Party` has been named after one of its
consumers, which inverts the relationship and reads as though the entity exists to serve
the return.

## Why it matters more than tidiness

It is how the same field ended up with two names. `Initiative.deliverableId` was labelled
**Deliverable** in the initiative panel and **RPTI Target** in the Data Manager, so the app
called one thing two things depending on which screen you were on. The product owner hit
exactly that while following a repair instruction — the message named a control that, on
the screen it sent them to, did not exist under that name.

That is the same failure as the FR-025 defects: an instruction is only as good as the
vocabulary shared between it and the screen. One vocabulary per concept is what makes a
named repair followable.

## What changed

| Entity | Was | Now |
|---|---|---|
| Initiative | `RPTI Target` | `Deliverable` |
| Asset Category | `Default RPTI Category` | `Default Category Code` |
| Deliverable | `RPTI Category Override` | `Category Code Override` |
| Deliverable | `PPJTI Related Party` | `Provider Related Party` |

`Default Category Code` rather than `Default Category`, because the Categories tab already
has a **Category Name** column and "a category's default category" reads as nonsense. The
value is a code (`01`, `06`, `49`…), so saying so is both neutral and more accurate.

Any data-health message naming one of these columns was changed with it. A message and the
control it names must share words, or repointing a finding just moves where the preparer is
confused.

## What is deliberately NOT renamed

- **The RPTI and LKPTI tabs**, and the report views. These *are* the local returns; naming
  them after the returns is correct.
- **`DC City`, `DR City`, `DC Provider`, `DRC Provider`.** Data centre and disaster recovery
  are industry vocabulary that Selara uses in its own right, not report names. Renaming them
  would cost clarity and buy nothing.
- **Historical records** — ADRs, and the requirement-specs tables that map a return's columns
  to fields. Those describe the *return's* column, where the local name is the right one.

## The tension this rule has to live with

ADR-0013 deliberately moved report fields onto global entities, so some global columns exist
only to feed a filing. `Initiative.rptiRemarks` has no purpose except the RPTI `Keterangan`
column. Strip the report name and the preparer loses the only clue about which filing a
column serves.

**Resolution: the header carries the global name; the placeholder or tooltip carries the
report meaning.** The model stays self-describing and the filing relationship stays
discoverable. `Deliverable`'s existing placeholder — *"— Infer from lifecycle segments —"* —
already works this way.

## Open

**`Initiative.rptiRemarks`, currently labelled `RPTI Remarks (Keterangan)`.** It is in scope
for the rule, but renaming it to a bare `Remarks` in isolation would sharpen a confusion that
already exists: `Description` and `Remarks` sit adjacent on the Initiatives tab and read as
duplicates, when they supply two *different* columns of the same return — `Deskripsi` says
what the work is, `Keterangan` says why it is in the plan. Measured on the filed sample:

| Deskripsi | Keterangan |
|---|---|
| BI-FAST phase 3 and ISO 20022 message migration. | Regulatory deadline driven. |
| Multi-currency GL and faster daily close. | Vendor-led; related party under common ownership. |

They are independently populated — the sample has rows with a Deskripsi and no Keterangan —
and the second carries disclosure a regulator reads, which has no place in a technical
description. So they cannot be merged.

Held pending a decision on how to label the pair so the *what* / *why* distinction is visible
in the UI rather than only in a type comment.
