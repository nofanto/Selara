# Linking Decisions to Portfolio Items

A decision can optionally be linked to the specific initiative, programme, or asset it concerns. This makes the decision discoverable from that item, not just from the Decisions list.

## Linking a Decision

While creating or editing a decision:

1. Choose a type in the **Linked to** dropdown — Initiative, Programme, or Asset.
2. Choose the specific item in the **Item** dropdown that appears next to it.
3. Save the decision as usual.

A decision can link to at most one item. Leave **Linked to** set to "None" for decisions that aren't specific to a single portfolio item.

## Viewing Linked Decisions on an Initiative

Open any initiative's panel from the timeline. If one or more decisions are linked to it, a **Linked Decisions** section appears near the bottom of the panel, showing each linked decision's title and status. Click a decision there to jump straight to it in the Decisions view.

Programmes and assets don't yet have their own detail panel in Selara, so decisions linked to them are visible from the Decisions list (each row shows what it's linked to) rather than from a dedicated panel.

## When the linked item is deleted

Deleting an initiative, programme, asset or category **does not delete the decisions that
reference it**. A decision records why a choice was made, and that reasoning stays true after the
thing it describes is gone — see [ADR-0011](../../adr/0011-history-tab-decisions-as-audit-trail.md).

Two things happen instead:

**Before the delete**, the confirmation names them:

> Deleting "Customer IAM (CIAM)" will also remove 3 initiative(s), 2 dependency(ies).
> 1 decision(s) will keep their record but lose their link to it. Continue?

Note the separate sentence. Everything in the "will also remove" list is deleted; the decisions
are not — only their link to the deleted item is.

**After the delete**, the decision shows a marker where its link used to be:

> Linked to an asset that no longer exists. This record is kept — only the link is broken.

This matters because it distinguishes a decision whose subject was deleted from one that was
never linked to anything. Previously both rendered as no link at all, so a broken reference was
indistinguishable from an intentional one — and a decision log you cannot trust to tell you what
it was about is worth much less than one you can.

The link cannot be repaired: the item it pointed to is gone. Edit the decision to point at a
current item, or leave the marker as an honest record that its subject was removed.

---

- Previous: [Recording a Decision](recording-a-decision.md)
- Next: [Recording an RPTI Row](../14-rpti-report/recording-an-rpti-row.md)
