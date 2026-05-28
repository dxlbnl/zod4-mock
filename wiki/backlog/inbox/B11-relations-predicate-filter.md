---
id: B11
title: `relations` should support a predicate to filter the candidate pool
type: feature
priority: medium
flags: []
created: 2026-05-28
---

## Description
`relations` auto-provisions from the related schema's **full** registry — no native way
to express "relate to a subset." A common pattern is a relation that should only draw
from a typed sub-pool: comments relating to *published* posts, line items relating to
*shipped* orders, sub-tasks relating to tasks of a specific kind. Today the only escape
is to abandon `relations` and use `from:` + an explicit `source` passed at the call
site — which loses the declarative "this entity relates to that filtered slice"
expression in the world. (GitHub issue #11.)

## Proposed API
Relations entries gain an object form with `schema` + `where`:
```ts
world.withSchema(CommentSchema, {
  relations: {
    post: { schema: PostSchema, where: (p) => p.kind === 'article' },
  },
  matchers: { postId: (ctx) => ctx.related('post').id },
});
```
`ctx.related.many` (B5) honours the same predicate:
```ts
world.withSchema(DigestSchema, {
  relations: {
    items: { schema: PostSchema, where: (p) => p.kind === 'article' },
  },
  matchers: { posts: (ctx) => ctx.related.many('items', 5) },
});
```
Backwards compatible: passing `relations: { name: schema }` (the schema directly) keeps
no-filter behaviour.

## Why it matters
Most real domains have type-segmented entities (orders by status, files by mime-type,
users by role, posts by kind) where a relation should draw from one slice. Today the
predicate lives in helper layers, not in the world — the world's contract ("Comment
relates to Post") under-specifies what consumers actually want ("Comment relates to an
*article* Post").

## Pairs with
- **B13 `world.populateFrom`** — declarative one-per-source population using the same
  predicate shape.
- **B8 identity-preserving derived schemas** — together they express the typed 1:1 view
  entirely in world setup.

## Open questions (resolve in spec)
- **Predicate input shape**: runs over `input<T>` or `z.infer<T>`? Almost certainly
  `z.infer<T>` (consumer-facing) — see **B7 registry-output-typing**.
- **Evaluation timing**: re-evaluate on every `related()` call (simpler, handles mutable
  registries) vs. cache at registration / first-resolve.
- **Empty filtered pool behaviour**: today's auto-provision generates an arbitrary
  record; with a predicate the library would need to coax matchers into satisfying the
  predicate, or simply throw. **Decide.**

## Notes
- Touches `relations:` declaration shape (`src/types.ts`) and the resolver in
  `src/world.ts` (`resolveRelated`/`resolveRelatedMany`).
- Public API change → update `docs/api-reference.md`.
- Architecturally significant — likely flagged `review` by the manager at planning.
