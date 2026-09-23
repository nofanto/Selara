# An initiative with no status has no status (Design Notes)

> **Status:** Decided 2026-09-23. Not part of spec 003 — found while reviewing its Phase 5 output,
> but the behaviour predates that work by months.
> **Context:** `Initiative.status` is optional (`src/types.ts:77`). Neither importer sets it, so every
> imported initiative is stored with `status: undefined`. Four components then disagree about what
> that means.

## The defect, measured on `233f17d`

One field, three different answers across four components, and one of them writes data. The Data
Manager — the screen the disagreement was reported from — turns out to be the one behaving correctly.

| Component | What an unset status does | Where |
|---|---|---|
| Data Manager | renders **blank**, and this one is **correct** — the generic table prepends an empty option to every select, so unset is selectable and clearable here | `EditableTable.tsx:567,573` |
| Visualiser | renders **"Planned"**, and colours the bar as planned | `Timeline.tsx:93-95`, used at `:133` and `:147` |
| Initiative panel | pre-selects **"Planned"**, so saving the panel persists a status the preparer never chose | `InitiativePanel.tsx:278` |
| Excel import | **stores** `'planned'` | `excel.ts:62-73` |

The last one is the reason this is worth fixing rather than tidying. Measured:

```
stored before export   = undefined
stored after re-import = "planned"
```

Export a workspace and import it back, and every status-less initiative acquires a real, stored
`'planned'` — indistinguishable from one a preparer chose. The display default has become data.

`MobileCardView.tsx:229` is the one component that already gets it right: it shows a badge only when
`initiative.status` is set.

## Decided: unset is a real state, and nothing invents a value for it

1. **`excel.ts` stops coercing.** An absent status imports as absent. A *malformed* status — a value
   that is not one of the four — also becomes absent rather than `'planned'`: that still satisfies
   the hardening `796237e` was written for, since the malformed value does not survive, without
   fabricating a claim in its place.
2. **The Visualiser renders unset the way it already renders an unset RAG.** No subtitle, and the
   neutral `bg-slate-300` that `RAG_COLORS.none` already uses. This is not a new convention: three
   lines above the status branch, `getInitiativeSubtitle` already returns `undefined` for an unset
   `ragStatus`. Status now matches its neighbour.
3. **The initiative panel offers the empty state.** It gains a `— Not set —` option and stops
   pre-selecting `Planned`, which made Save write a status the preparer never chose for any
   initiative that had none.

   **The Data Manager needed no change** — `EditableTable.tsx:573` already prepends
   `<option value="">Select...</option>` to every select column, so unset was always selectable
   there and the blank cell was correct rather than accidental. A `— Not set —` entry was added
   during implementation and then removed: it produced a *second* empty option beside `Select...`.
   Worth knowing that `ragStatus` carries exactly that duplication today (`DataManager.tsx`'s
   `{ value: '', label: '— None —' }` on top of the generic one) — harmless, pre-existing, and not
   fixed here.

### Why, in one line

`'planned'` is a claim about the work. A filing tool that invents one is doing the same thing as an
importer synthesising lifecycle history it was never given — which spec 003 removed for exactly this
reason (FR-019c). Absence is honest; a fabricated status is not, and it is worse here because it
persists.

## Rejected alternatives

**Treat unset as Planned everywhere, and fix the Data Manager to show it.** Internally consistent and
the smallest change. Rejected because it makes the product assert something it was never told. An
initiative imported from a filed return has no status in the return; deciding it is "planned"
is an invention, and once `excel.ts` stores it there is no way back to "we don't know".

**Make `status` required and have the importers set one.** Removes the ambiguity at the source, but
it either picks a value for the preparer — the same invention — or blocks an import until they
supply one, which is a gate on data the regulator's own format does not carry. Setting an explicit
status at import remains **open**, separately from this decision: if it is ever wanted, it is a
question about what the importer knows, not about what an unset field means.

**Leave it.** Rejected: the excel coercion converts a display default into stored data, so the
disagreement does not stay cosmetic.

## Verification

- Unit (`src/lib/excel.test.ts`): an initiative with no status survives an export/import round trip
  still unset; a malformed status imports as unset, not as `'planned'`.
- E2E (`e2e/display.spec.ts`): with **By Progress** colouring, an initiative whose status has been
  cleared shows no status label and carries the neutral swatch rather than Planned's; and the
  initiative panel offers the empty option and preserves it across a reload.

Each change was falsified by reverting it: the excel coercion fails 2 unit tests, the timeline label
and the timeline colour each fail the By Progress E2E, and the panel's empty option fails its own.
The first attempt at this left the timeline label and colour untested — reverting either passed the
whole suite — which is why the falsification step is written down here rather than assumed.
