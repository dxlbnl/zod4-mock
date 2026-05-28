---
"zod4-mock": minor
---

Add a `where` predicate to `withSchema` relations to filter the candidate pool:

```ts
world.withSchema(CommentSchema, {
  relations: {
    post: { schema: PostSchema, where: (p) => p.kind === "article" },
  },
  matchers: { postId: (ctx) => ctx.related("post").id },
});
```

- Relations entries accept a new object form `{ schema, where? }` alongside the existing bare-schema form. The bare form (`relations: { post: PostSchema }`) is fully backwards compatible.
- The predicate is honoured by both `ctx.related(name)` (single pick) and `ctx.related.many(name, count)`. The predicate input is `z.infer<RelationSchema>` (the registry-read shape, per B7) — no cast or `any` required.
- `where` is evaluated once per `(record, relation)` when the snapshot is built, so same-record cache hits consume no PRNG and never re-run the predicate (D9). The snapshot is re-evaluated for each new record, so records stored between generations are observable.
- When the filtered pool is empty (or, for `.many`, smaller than `count`), the resolver throws a clear error naming the relation and pointing at the remediation ("pre-populate the registry or relax the predicate"). Self-referential relations are exempt: empty filtered pools return `undefined` (or clamp for `.many`), preserving the existing self-reference behaviour.

(closes #11)
