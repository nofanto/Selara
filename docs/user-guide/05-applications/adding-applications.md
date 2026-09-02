# Adding Deliverables

![](../../public/features/adding-applications.png)

## What deliverables are

An asset represents something your organisation owns or operates — for example, "CIAM Platform". That asset may be delivered by several things running in parallel or in sequence: software products such as Okta, Azure AD B2C, and Keycloak, but also infrastructure, documents, or procedures. Deliverables let you record those individual items and track their lifecycles separately, all within the same asset.

## How to add a deliverable

1. Go to **Data Manager** and select the **Deliverables** tab.
2. Click **Add Row**.
3. Enter the deliverable name.
4. Select the parent asset from the **Asset** dropdown.

Changes are saved immediately — there is no separate save step.

## Key rules

- Each deliverable belongs to exactly one asset.
- Once you have at least one deliverable defined for an asset, a **Deliverables swimlane** appears beneath that asset's initiative row in the Visualiser.
- Deliverables are included in version snapshots, so your historical records capture the full landscape at the time each snapshot was taken.
- The **Type** column classifies what kind of item the row represents — Application, Infrastructure, Document, Procedure, or Other. It defaults to Application if left unset. This is used by reports (like the [RPTI Report](../14-rpti-report/recording-an-rpti-row.md)) that need to distinguish software applications from infrastructure and other non-software deliverables.
- The **Description** column is a free-text summary of what the deliverable does. It's optional, but when set it auto-fills the **Function Description** field on generated [LKPTI rows](../15-lkpti-report/recording-lkpti-rows.md), so you only have to write it once.

---

- Previous: [Critical Path](../04-dependencies/critical-path.md)
- Next: [Lifecycle Segments](lifecycle-segments.md)
