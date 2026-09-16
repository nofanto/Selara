# First Launch

## Two ways to begin

When you open Selara for the first time you are asked how to start. There are two paths, because
Selara exists to prepare your OJK regulatory returns — **RPTI** (Format 3.1, the development plan)
and **LKPTI** (Format 3.2.6, *Daftar Aplikasi*, the application inventory).

![Template picker modal](../../public/features/template-picker-modal.png)

### Start from your filed returns

Upload what you last filed with OJK. Nothing is retyped.

| Slot | |
|---|---|
| **LKPTI — Daftar Aplikasi** | **Required.** The applications you run, as at 31 December of the reporting year. |
| **RPTI — Rencana** | **Optional.** Your development plan for the reporting year — applications *and* infrastructure. |

**Each return is asked for its own reporting year, and they are usually different.** A bank filing
in late 2026 files an LKPTI *as at* 2026 alongside an RPTI *for* 2027. Neither spreadsheet layout
contains a year, so Selara cannot work it out and will not guess.

The LKPTI is imported first, so your plan can be read against the inventory it refers to. Where a
planned **upgrade** matches an application you already run, the plan is attached to it rather than
creating a duplicate. Where it matches nothing — the two returns often name things differently —
the row is still imported and flagged for you in the data-health review, rather than being guessed
at or silently duplicated.

When the import finishes you land on the **data-health review**, so the first thing you see is what
needs your attention.

Importing only the LKPTI is perfectly valid; you will have an inventory and no plan.

### Start empty

| | |
|---|---|
| **Start blank** | Build your portfolio from scratch. The standard OJK technology areas can be added at any time from the catalogue section in the Visualiser. |
| **Explore with demo data** | Loads a representative bank portfolio across 11 of 18 RPTI areas, with initiatives, deliverables, lifecycle segments, resources and budget figures. Use this to see how Selara works before committing your own data. |

> **Opening a colleague's file.** Viewing a portfolio someone else exported is not a way of starting
> your own workspace, so it is not offered here. Use **Open shared** in the import/export controls.

## After choosing a template

A tutorial modal appears automatically. It walks through the key features in five slides. You can dismiss it by clicking the X button or clicking anywhere outside the modal.

## The demo data

Choosing **Explore with demo data** loads a representative bank portfolio across 11 of 18 RPTI areas, with initiatives, deliverables, lifecycle segments, resources, and budget figures.

The demo data is safe to experiment with. You can:

- Edit initiative names, dates, and fields
- Delete bars from the timeline
- Add new initiatives and dependencies
- Change display settings and grouping

None of these changes affect other users — everything is stored only in your browser.

## Resetting or switching templates

If you want to start fresh, switch to a different template, or change whether you have demo data:

1. Go to the **Data Manager** view (tab in the header).
2. Scroll to the bottom of any tab and click **Clear data and start again**.

![Clear data and start again button](../../public/features/data-manager-clear-and-start-again.png)

3. The template picker reopens with a warning that your existing data will be replaced.

![Template picker with data-loss warning](../../public/features/template-picker-reset-warning.png)

4. Choose a template and select **With demo data** or **Without demo data** — or pick **Blank** to start empty.

> **Note:** This action permanently replaces all your current data. There is no undo once you confirm a template selection.

## Reopening the tutorial

To see the tutorial again at any time, click the **Help** button (the ? icon) in the header.

---

**Previous:** [What is Selara?](what-is-selara.md) | **Next:** [Navigating the App](navigating-the-app.md)
