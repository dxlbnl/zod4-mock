---
id: B6
title: Add `world.get(schema, predicate)` — find an existing record matching the predicate, or generate one
type: feature
priority: medium
flags: [review]
created: 2026-05-27
spec: wiki/specs/B6-world-get-find-or-create.md
---

## Description

When mocks cross-reference records by domain identifiers (slug, sku, externalId), there's
no clean way to say "give me the product with this sku, creating it if it doesn't exist."
The existing primitives don't fit: `registry.find` returns `undefined` with no auto-create
(and you must remember to merge the predicate value as an override when you do generate),
and `related` is for declared relationships, not ad-hoc lookups by domain key. This recurs
in MSW handlers — the URL carries a parameter (`/products/:sku`) and the handler wants the
_same_ mocked product every time that URL is hit; hand-writing find-or-create at every
handler is repetitive and easy to get wrong. (GitHub issue #4.)

```ts
// Without world.get — every handler reinvents this
http.get("/products/:sku", ({ params }) => {
  const existing = world.registry.find(productSchema, (p) => p.sku === params.sku);
  return HttpResponse.json(
    existing ?? world.generate(productSchema, { overrides: { sku: params.sku } }),
  );
});
```

## Proposal

```ts
interface World {
  // existing methods...
  get<TSchema extends ZodTypeAny>(
    schema: TSchema,
    predicate: Partial<input<TSchema>>,
  ): input<TSchema>;
}
```

Semantics:

1. **Search the registry** for a record where every key in `predicate` matches.
2. **If found**, return it.
3. **If not found**, generate a new record with `predicate` deep-merged as overrides (so
   the natural key is honored), store it in the registry, and return it.

## Usage examples

```ts
const a = world.get(productSchema, { sku: "WIDGET-42" });
const b = world.get(productSchema, { sku: "WIDGET-42" });
// a === b (same instance from registry)

const c = world.get(productSchema, { sku: "GADGET-99" });
// freshly generated; sku: 'GADGET-99', other fields from matchers

// Multi-field predicate
const node = world.get(nodeSchema, { externalId: "ext-1", tenantId: "t-1" });

// Handler becomes a one-liner
http.get("/products/:sku", ({ params }) =>
  HttpResponse.json(world.get(productSchema, { sku: params.sku as string })),
);
```

## Why a `Partial` predicate, not a function

1. **Encodes intent** — `{ sku: 'WIDGET-42' }` is "I want the product with this sku"; a
   function obscures that and can't double as the override on miss.
2. **Automatic override merge** — because the predicate is a value shape, the library
   applies it as `overrides` when generating. A function would force a separate `overrides`
   arg, which is just `registry.find` + `generate` re-spelled. For function-style
   predicates, `registry.find(schema, fn)` is the right tool (no auto-create — deliberate).

## Open questions / edge cases (resolve in spec)

- **Multiple matches**: return the first in insertion order (consistent with `find`);
  document it.
- **Predicate keys conflicting with matchers**: predicate wins (it's the explicit ask),
  same as `overrides` today.
- **Empty predicate `{}`**: return first record if any exist, else generate one
  (≈ `registry.all(schema)[0] ?? world.generate(schema)`) — or throw to force the caller
  to use `generate`/`registry.pick` for "any record." **Decide in spec.**
- **Nested-object predicates**: deep equality, for consistency with `overrides` deep-merge;
  document it.
- **Name**: `get` (short, reads naturally) vs. `findOrGenerate` (more explicit about dual
  behavior). Issue leans `get` with prominent docs either way.

## Notes

- **Composes on B4 (`registry.find`)**: `get` is essentially "`find`, or `generate` with
  overrides." Sequence B4 before B6.
- Determinism: same seed + same call sequence → identical records; the create-on-miss path
  is deterministic because it's just `generate` under the hood.
- Public API change (extends `World`) → update `docs/api-reference.md` in the same step.
