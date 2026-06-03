# Context

The showcase page exists to sell zod4-mock's core value prop: **referential consistency across entities**. Right now it fails at that job:

- The code panel shows bare schemas — nothing that explains _how_ IDs get wired (the two-phase `generate` → `map FK` pattern is invisible)
- The data panel shows flat arrays of JSON with raw UUIDs — a user must manually hunt for matching IDs across tabs to see that relationships hold
- The `RelationCallout` makes a weak stab at proving consistency, but it's easy to miss and doesn't feel interactive

The goal: make the relational story obvious and immediate — a developer looking at this for 10 seconds should understand "these IDs are real, they resolve to real entities."

---

## Recommended approach

Two parts: fix the **code panel** (show the wiring, not just schemas), and fix the **data view** (show resolved entities, not raw ID arrays).

---

### 1. Code panel — show the wiring pattern

Replace schema tabs with **two tabs that show the actual generation pattern**:

**Tab "Schemas"** — keep the current schemas (condensed to one scrollable view, not per-entity tabs)

**Tab "Wiring"** — show the actual two-phase code from `generateWorld()`:

```ts
// Phase 1 — generate base records from schemas
const users = Array.from({ length: 10 }, () => generate(userSchema));
const products = Array.from({ length: 20 }, () => generate(productSchema));

// Phase 2 — wire cross-entity IDs in a second pass
const reviews = Array.from({ length: 30 }, () => ({
  ...generate(reviewSchema),
  userId: users[Math.floor(Math.random() * users.length)].id,
  productId: products[Math.floor(Math.random() * products.length)].id,
}));
```

This is the insight that needs selling. Developers immediately understand the two-pass pattern.

---

### 2. Data view — "resolved" entity inspector

Replace the flat entity tabs + JsonTree with a **two-column explorer**:

**Left column — entity list**  
A scrollable list of **mini data cards** per entity type — each card shows 2–3 contextual fields:

- Users: name + email
- Products: name + price + rating
- Reviews: star rating + date + body excerpt
- Orders: status badge + total + item count
- Categories: name + parentId indicator
- Variants: sku + color + size

Clicking a card selects it for the resolved inspector.

**Right column — resolved inspector**  
Show the selected entity _fully resolved_ — all FK UUIDs replaced with the actual nested entity object. Built with a `resolveEntity(entity, world)` utility:

```ts
// For a Review:
{ ...review,
  user:    world.users.find(u => u.id === review.userId),
  product: world.products.find(p => p.id === review.productId) }

// For an Order:
{ ...order,
  user:  world.users.find(u => u.id === order.userId),
  items: order.items.map(item => ({
    ...item,
    product: world.products.find(p => p.id === item.productId),
    variant: world.variants.find(v => v.id === item.variantId),
  })) }
```

Displayed via `JsonTree` — no custom card components needed. The resolved object is naturally nested and visually striking: you see `user: { name: "Alice Smith", email: "..." }` right inside the review, proving the ID was real.

Default selection: first Order (most relationships — user + items → products + variants).

---

### 3. Entity counts bar (small change)

Replace the clunky entity tab selector at the top with:

- A row of **clickable stat pills**: `Users 10` · `Products 20` · `Reviews 30` · `Orders 5` etc.
- Clicking one selects that entity type for the left column list
- Much cleaner, shows the scope of the world at a glance

---

### 4. Remove RelationCallout

Once the resolved inspector makes relationships obvious, the `RelationCallout` box is redundant. Remove it.

---

## Files to change

| File                               | Change                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `src/routes/showcase/+page.svelte` | Full rewrite — new layout, entity list, resolved inspector                   |
| `src/lib/runners/ecommerce.ts`     | Add exported `resolveEntity(type, entity, world)` helper (or inline in page) |
| `src/lib/components/Showcase/`     | New `EntityList.svelte` component (compact row cards); CodePanel stays       |

---

## What stays the same

- `generateWorld()` runner — data generation is correct, no changes needed
- `JsonTree.svelte` — used for the resolved inspector display
- `CodePanel.svelte` — reused with new tab content
- The **Regenerate** button — still triggers a fresh world

---

## Verification

1. Load `/showcase` — should default to Orders view with first order selected
2. Resolved inspector should show `user: { name, email, ... }` nested inside the order (not a UUID)
3. Items should show `product: { name, price, ... }` and `variant: { sku, color, size, ... }` inline
4. Clicking a Review should show `user: ...` and `product: ...` resolved
5. Clicking "Wiring" tab in code panel should show the two-phase generation code
6. Regenerate should produce a new world and update the selected entity
