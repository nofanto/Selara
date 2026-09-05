# Saving a Version

![Save Named Version dialog](../../public/features/version-history-save-dialog.png)

Versions are named snapshots of your entire portfolio state at a point in time. Saving a version before a significant change — a planning cycle, a major reprioritisation, a board review — gives you a baseline you can compare against or restore later.

## When to save a version

Save a version before:

- submitting a plan for approval
- making bulk changes you may want to undo
- starting a what-if scenario

## How to save a version

1. Open the **Version History** panel from the toolbar or the main menu.
2. Click **Save Current State**.
3. Enter a name (required). Names should be short and descriptive, for example `Q2 Baseline` or `Pre-board 2026-03`.
4. Optionally add a description to record the context or reason for the snapshot.
5. Click **Save**.

The new version appears at the top of the version history list with the timestamp at which it was saved.

## What is saved

A saved version is a deep clone of the full portfolio state, including all initiatives, assets, programmes, strategies, milestones, and their relationships. The snapshot is persisted to IndexedDB and survives page reloads and browser restarts.

## Managing versions

Each version entry in the list shows its name, optional description, and creation timestamp. To remove a version you no longer need, click the **delete** icon on its row and confirm the deletion in the modal. Deleted versions are removed from IndexedDB and cannot be recovered.

## Recording why, at the same time

Under the description field the save dialog offers **Record why (optional)**. Ticking it and
giving the decision a title creates an entry in your [decision log](../13-decisions/recording-a-decision.md),
linked to the snapshot you are saving, without leaving the dialog.

The new decision:

- is saved with status **Accepted** — the snapshot exists because a change was made, so the record describes work already done. Change it afterwards if you were capturing a proposal instead.
- carries the version's description as its **Context**, if you wrote one.
- appears in the [difference report](comparing-versions.md) for any comparison spanning that point.

This is entirely optional. Leaving the box unticked — or ticking it and leaving the title empty —
saves the version exactly as before and creates nothing. Saving a version is never blocked by it.

**Why bother?** A diff tells you an initiative moved two quarters. It cannot tell you the vendor
withdrew. The snapshot is the moment you actually know why, which is why the prompt lives here
rather than somewhere you have to remember to visit.

---

- Previous: [Data Health Report](../09-reports/data-health-report.md)
- Next: [Comparing Versions](comparing-versions.md)
