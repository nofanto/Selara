# Lifecycle Segments

![](../../public/features/lifecycle-segments.png)

## What lifecycle segments are

A lifecycle segment is a time-bounded bar within the Deliverables swimlane that represents the status of a specific deliverable during a specific period. For example, "Okta — In Production from 2025 to 2027" would appear as a single coloured bar spanning those years.

Segments let you model the full lifecycle of each deliverable across your portfolio — from planning through to retirement.

## Creating a segment

1. Double-click an empty area in the Deliverables swimlane beneath an asset.
2. The **Add Lifecycle Segment** panel opens.
3. Choose which **Deliverable** the segment belongs to.
4. Select a **Status**.
5. Optionally pick an **Initiative** — this attributes the lifecycle phase to the piece of work driving it.
6. Set the **Start Date** and **End Date**.
7. Click **Add Segment**.

The bar is labelled with the deliverable's name.

## Statuses are yours to define

The **Status** dropdown is populated from the **Deliverable Statuses** tab in the Data Manager, so you control the list and each status's colour. A starting set — Planned, Funded, In Production, Sunset, Out of Support, Retired — ships with the demo templates, and you can rename, recolour, add, or remove entries.

Two flags on a status matter beyond colour:

- **Live status** marks a status as "in production", which is how the [RPTI Report](../14-rpti-report/recording-an-rpti-row.md) derives a planned implementation quarter.
- **Pre-launch status** marks planned or funded work, which is RPTI generation's allow-list.

## Status colours and patterns

Each status has a distinct colour and stripe pattern so you can tell them apart at a glance without relying on labels alone. This is useful when multiple segments from different deliverables are stacked in the same swimlane.

## Modelling progression through a lifecycle

The same deliverable can have multiple segments. Use this to represent progression — for example, a series of segments showing Funded, then In Production, then Sunset for the same deliverable as it moves through its lifecycle over time.

## Labels near the left edge

If a segment's start date falls before the visible timeline window, its label is pinned to the left edge of the content area so it remains readable even when the bar itself begins off-screen.

## Persistence

Segments are stored in IndexedDB and survive page reload. They are also captured in version snapshots.

---

- Previous: [Adding Deliverables](adding-applications.md)
- Next: [Managing Segments](managing-segments.md)
