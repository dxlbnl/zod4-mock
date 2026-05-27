---
id: B5
title: Add `ctx.related.many(name, count)` for one-to-many relations in matchers
type: feature
priority: medium
flags: [review]
spec: wiki/specs/B5-related-many.md
created: 2026-05-27
---

## Description
`ctx.related(name)` resolves a single related record — perfect for foreign keys (one
document → one author). But one-to-many relationships (a case → many users, an order →
many line items, a folder → many files) have no good primitive. Current workarounds both
fail:

```ts
// Option A — registry.all + manual sampling. Bypasses the `relations:` declaration
// entirely, so the schema no longer documents the relationship, and no auto-provision.
matchers: { users: (ctx) => ctx.prng.sample(ctx.registry.all(userSchema), 3) }

// Option B — call ctx.related repeatedly. ctx.related is record-scoped, so every call
// within the same record returns the SAME pick.
matchers: { users: (ctx) => [ctx.related('users'), ctx.related('users')] } // identical
```

Add a `.many()` method on `ctx.related`. (GitHub issue #3.)

## Proposal
```ts
interface GeneratorContext<T = any> {
  related: {
    <T = unknown>(relationName: string): T;            // existing single-pick
    many<T = unknown>(relationName: string, count: number): T[];  // new
  };
}
```
Semantics:
- Picks `count` **distinct** records from the related schema's registry.
- If the registry has fewer than `count`, **auto-provisions the difference** (same
  auto-provision behavior as single `related`).
- **Deterministic**: same world seed → same `count` records in the same order.
- **Record-scoped**, like `related`: calling `related.many('users', 3)` twice within the
  same record returns the same three records in the same order, so sibling matchers stay
  consistent.

## Usage examples
```ts
// Case has 2-4 users; sibling matchers see the same set in the same order
withSchema(caseSchema, {
  relations: { users: userSchema },
  matchers: {
    users: (ctx) => ctx.related.many('users', ctx.prng.int(2, 4)),
    usernames: (ctx) => ctx.related.many('users', ctx.prng.int(2, 4)).map(u => u.username),
  },
});

// Order has line items; total derived from the same items
withSchema(orderSchema, {
  relations: { items: lineItemSchema },
  matchers: {
    items: (ctx) => ctx.related.many('items', ctx.prng.int(1, 5)),
    totalCents: (ctx) =>
      ctx.related.many('items', ctx.prng.int(1, 5))
        .reduce((sum, item) => sum + item.priceCents, 0),
  },
});
```

## Open questions (resolve in spec)
- **Distinctness**: distinct picks (recommended default) vs. allow repeats — document the
  choice.
- **API shape**: `related.many()` (recommended — namespaces as the API grows:
  `related.all()`, `related.find()`?) vs. flat `relatedMany()`.
- **`count` as a range**: accept `related.many(name, [min, max])` as shorthand? Issue
  leans no — leave to userland via `related.many(name, prng.int(min, max))` to avoid
  doubling the API surface.

## Notes
- Internal impl likely reuses `prng.sample` (issue #1, already landed).
- No registry mutation beyond the auto-provisioning already documented for `related`.
- Public API change (extends `GeneratorContext`) → update `docs/api-reference.md` in the
  same step.
