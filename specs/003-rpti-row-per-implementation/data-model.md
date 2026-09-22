# Data Model: An RPTI row is one planned implementation

**Feature**: 003-rpti-row-per-implementation · **Date**: 2026-09-22

## The shape of the change

One sentence: **the lifecycle segment becomes the plan line.**

```
            BEFORE                                  AFTER

  Initiative ──(grouped)──> 1 row            Initiative  (trigger only)
      │  capex, opex, rptiRemarks                 │
      │  deliverableId (the target)               │  capex, opex (portfolio, not filed)
      └──< DeliverableSegment                     └──< DeliverableSegment ──> 1 row each
             deliverableId, dates, status               deliverableId, dates, status
                                                        capexAmount, opexAmount, rptiRemarks
```

## DeliverableSegment — gains three fields

The implementation. Already carries `deliverableId` (which application), `initiativeId` (which
trigger), `startDate` (when it goes live) and `status` (new or upgrade). It gains what a filed line
also states:

| Field | Type | Meaning |
|---|---|---|
| `capexAmount` | `number?` | `Estimasi Biaya CapEx` for **this** implementation. In `TimelineSettings.defaultCurrency`, as every other figure. |
| `opexAmount` | `number?` | `Estimasi Biaya OpEx` for this implementation. |
| `rptiRemarks` | `string?` | `Keterangan` for this implementation. Moves from `Initiative` (Q14/Q17). |

**Optional, not required.** An implementation with no stated cost files zero rather than blocking
generation — the preparer is told by data health, not by a thrown error. A segment that is not
attributed to an initiative is not an implementation at all and these fields are meaningless on it.

### Validation

- `capexAmount` / `opexAmount` MUST NOT be negative — `validation.ts:36`'s rule **extended** to
  the implementation. The initiative's own rule stays, since that field is still editable.
- No uniqueness rule. Two implementations of one application in one quarter are permitted; whether
  they collapse in the filing is a generation question, not a storage one.

## Initiative — keeps its budget, loses its filing role

| Field | Before | After |
|---|---|---|
| `capex` | Stored, editable, **filed** | Stored, editable, **not filed** — a portfolio figure driving the timeline and budget report. |
| `opex` | Stored, editable, **filed** | Same. Seeded from the filed row on import; may then diverge. |
| `rptiRemarks` | Stored, filed as `Keterangan` | **Removed** — moves to the implementation. |
| `deliverableId` | The single RPTI target | **No filing role.** Survival is an open question (plan.md, Complexity Tracking). |
| `description` | Filed as `Deskripsi` | Unchanged. Still describes the work, still filed. |

**Why kept rather than derived or deleted** *(revised 2026-09-22)*: these are not two copies of one
value needing a precedence rule — they are two different values. An initiative's budget may
legitimately include what the filing does not, and grouping several applications under one
initiative is a portfolio act rather than a filing one, so adjusting one should not silently rewrite
the other. Neither derives from the other, so the two-sources hazard that produced the previous
feature's silent-overwrite defect does not arise here.

**The cost of that**: they can drift apart without either being wrong. Data health reports the
divergence as a **warning**, naming both figures and both places a preparer could act. It is never
an error and never blocks export, because it compares two legal states — a finding that calls a
legitimate arrangement a defect is how preparers learn to ignore the gate.

## RptiDetail — a stored row's meaning narrows

Unchanged in shape. Its **meaning** narrows: it remains read-only evidence of what was filed, and
reconciliation now matches it to an **implementation** rather than to an `(initiative, target)`
pair.

`RptiDetail.deliverableSegmentId` already exists — set when a quarter was auto-derived — and becomes
the natural correspondence anchor rather than an incidental breadcrumb.

## Deliverable, Asset, AssetCategory — unchanged

Nothing moves. What describes an application stays on the application and appears identically on
every row targeting it (spec FR-007). The cascade of category defaults is untouched.

## Derivation rules

**A row exists** when a segment satisfies all of:

1. `initiativeId` set, and that initiative exists and is not a placeholder
2. status flagged `isLiveStatus` or `isPreLaunchStatus`
3. **`startDate` falls within the filed year** — replaces the overlap test (R1)

Condition 3 is the change. Conditions 1 and 2 are unchanged and already correct.

**A row's values**:

| Column | Source |
|---|---|
| Application name | the segment's `deliverableId` |
| `Deskripsi` | the initiative's `description` |
| `Jenis Pengembangan` | `new` when the deliverable has no prior live segment, else `upgrade` |
| `Waktu Rencana Implementasi` | quarter of the segment's `startDate` |
| `Estimasi Biaya CapEx` / `OpEx` | the segment's own |
| `Keterangan` | the segment's own |
| Category, developer, locations, related party | the deliverable, then its category — unchanged |

**An initiative's budget** is its own stored figure, not a total. It is seeded from the filed row at
import and edited independently thereafter; an initiative with no implementations keeps it.

## Migration

**Stored rows**: not rewritten. Matched by correspondence, consistent with rows being immutable
evidence (Q12).

**Costs**: nothing to migrate. The initiative's budget keeps its meaning and its readers; an
existing workspace simply has no implementation figures until a preparer enters them, and the
divergence warning announces exactly that state rather than letting it be discovered at filing
time.

**No IndexedDB version bump.** Optional fields on an existing entity; stores are schemaless within a
store and `flatten()` is generic — verified in the previous feature rather than assumed.

## Version history

`diff.ts:294-313` compares `DeliverableSegment` on `title`, `startDate`, `endDate`, `status` and
`deliverableId`. It must gain `capexAmount`, `opexAmount`, `rptiRemarks` — and `initiativeId`, which
is a **pre-existing gap**: re-attributing a segment to a different initiative changes the filing
today with no history entry. `compareEntities` is generic over entities, not fields
([#42](https://github.com/nofanto/Selara/issues/42)).
