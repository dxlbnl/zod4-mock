# Showcase Redesign — Ideas Parking Lot

> Status: sidelined, not yet scheduled. Add to backlog when ready to spec.
> Context: the current `/showcase` does a poor job of demonstrating relational consistency visually. See [current-state](current-state.md) §Components for what exists today.

## The problem with the current design

Two-column layout: code (Shiki tabs) on the left, collapsible JSON tree on the right. The relational proof is text-based (`review.userId = User#42 ✓`) but doesn't *visually connect* entities. You have to mentally parse JSON and scan for matching UUIDs. The RelationCallout is a list, not a diagram.

## Ideas captured

### Option A — Linked entity cards (recommended starting point)

Replace the collapsible JSON tree with flat entity cards (one per entity type: User, Order, OrderItem, Product, Variant…). Foreign key fields are highlighted. Hover/focus on any FK field and the referenced card glows + a connecting line appears. No static arrows to maintain — pure interaction. Clean, no graph layout library needed, degrades gracefully without JS.

**Pros:** incrementally buildable, accessible, no new dependencies.
**Cons:** doesn't show the whole graph at once.

### Option B — Comparison mode ("faker broken vs zod4-mock resolved")

Show two columns: left is "what you get with faker" (entities generated independently, UUIDs that don't cross-reference), right is "zod4-mock" (same UUIDs, verified cross-references). The *pain* is visible before the fix. Most argumentative — directly sells the why.

**Pros:** most persuasive for conversion; answers "why does this matter" immediately.
**Cons:** requires building a "broken faker world" generator alongside the fixed one; more complex layout.

### Option C — "Resolve" trace / step-through

Click-through or animated: start from a single Order, then progressively reveal → the User it belongs to → the OrderItems it contains → the Products each item references → the Variant each item pins. Narrative-driven; great for an inline homepage exhibit.

**Pros:** storytelling; could double as the homepage inline exhibit.
**Cons:** animation complexity; state machine to manage; harder to test.

## Combinations worth noting

- A + C: entity cards as the full `/showcase` page; step-through version embedded on `/` as the inline relational exhibit.
- B + A: comparison mode as the hero of `/showcase`; linked cards as the drill-down detail.

## See Also

- [site/vision](vision.md) — relational proof must be in the primary scroll path on `/`
- [product/differentiators](../product/differentiators.md) §"The relational wedge" — what the showcase is trying to prove
- [backlog](../backlog.md) — will hold the spec item when this is scheduled
