# Indonesian Bank Technology Catalogue

The RPTI catalogue gives you a pre-built list of standard Indonesian-bank technology asset types, organised into OJK's 18 RPTI application areas (`01`–`12`, `49`, `51`–`54`). Rather than typing asset names from scratch, you can browse the areas in the visualiser and add the ones relevant to your bank's portfolio in a single click.

## How it works

The 18 RPTI application areas appear as a dedicated section at the bottom of the visualiser, below your own asset categories. Each area row shows the full area name and a button to add its child assets.

Areas remain collapsed until you choose to populate them — your timeline stays uncluttered until you're ready.

Each area is backed by a real asset category carrying the matching OJK `RptiCategoryCode`, so any Deliverable you add under a catalogue asset is automatically classified for RPTI report generation — no extra step needed.

## Demo data

When you first load Selara, a representative selection of catalogue assets from 11 of the 18 areas is already pre-populated with example initiatives, lifecycle segments, and milestones. This gives you a working Indonesian-bank portfolio out of the box so you can explore the visualiser straight away.

Areas not included in the demo (`02` Third-party funds, `03` Credit/financing, `07` Treasury, `08` Trade finance, `49` Other applications, `53` Data communication network, `99` Other infrastructure) still appear as collapsed area rows ready to be populated.

## Adding assets from an area

1. Scroll to the **Indonesian Bank Technology Catalogue** section at the bottom of the visualiser.
2. Find the area you want — for example, **Credit / financing**.
3. Click **+ Add all N assets**.

The area row is replaced by individual asset swimlanes, one per catalogue asset type. Each swimlane shows the full asset name. You can now create initiatives, add lifecycle segments, and assign milestones against these assets exactly as you would with any other asset.

## Removing an area's assets

If you pre-populated an area and want to remove it:

1. Locate the thin area header above the swimlanes for that area.
2. Click **Remove all**.
3. Confirm in the dialog — all assets in that area and any linked initiatives or segments will be deleted.

The area row reappears empty, ready to be re-populated if needed.

## Deleting individual assets

To remove a single asset swimlane from any area (or from your own categories):

1. Hover over the asset's label on the left side of the visualiser.
2. Click the **trash icon** that appears.
3. If the asset has no linked initiatives or segments, it is deleted immediately.
4. If it has linked data, a confirmation dialog lists what will also be deleted. Confirm to proceed or cancel to keep the asset.

## Scope

The catalogue covers OJK's 18 RPTI category codes (`01`–`12`, `49`, `51`–`54`, `99`) — see `requirement-specs/rpti-schema.md` for the full definitions. Content is illustrative example asset types per area, not an exhaustive list.

---

- Previous: [Excel Export](excel-export.md)
- Next: [PDF / SVG Export](pdf-svg-export.md)
