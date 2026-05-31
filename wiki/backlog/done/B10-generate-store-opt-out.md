---
id: B10
title: Add an opt-out for registry storage on `world.generate`
type: feature
priority: medium
flags: []
created: 2026-05-28
spec: wiki/specs/B10-generate-store-opt-out.md
---

## Description

`world.generate` always stores into the registry. Correct for setup and find-or-create
flows, wrong for ephemeral generation — generating an array for a paginated response,
building a search-bucket envelope, producing ad-hoc fixtures in request handlers. Each
call inflates the registry; over a long-running dev server or many test iterations the
bucket grows unboundedly and skews subsequent queries. The standalone `generate` export
is no-store, but discards the entire world setup. (GitHub issue #10.)

## Repro

```ts
const ItemSchema = z.object({ id: z.uuid(), name: z.string() });
world.withSchema(ItemSchema);

for (let request = 0; request < 5; request++) {
  world.generate(ItemSchema.array().min(10).max(10));
}

world.registry.count(ItemSchema); // 50 — grew with every request
```

Now any legitimate `world.registry.all(ItemSchema)` sees a pool that drifted with HTTP
traffic.

## Proposal

Option A (option on `GenerateOptions`):

```ts
world.generate(schema, { store: false }); // matchers + relations, no registry write
```

Option B (named method, if `GenerateOptions` is sensitive to extension):

```ts
world.preview(schema, options?);
```

Either way, the world setup (matchers, relations, locale) still applies — only storage
is suppressed.

## Why opt-out (not opt-in)

- Storage is the right default for `withSchema`-registered entities — it's how
  `populate` / relations / `world.get` find them.
- Most ephemeral generation lives in handler/utility code where storage is noise.
- `{ store: false }` is one keyword at the call site; flipping the default would
  surprise existing callers and break find-or-create flows.

## Open questions / edge cases (resolve in spec)

- **Nested generation propagation.** When generating an object containing arrays of
  registered schemas (a search-bucket whose `content: ItemSchema[]`), should
  `store: false` propagate so inner elements aren't stored either? The principled
  answer is **yes** — propagate (the call's intent is "don't pollute the registry").
  Alternative: document `store: false` as shallow unless propagated. **Decide.**
- **Name choice**: `{ store: false }` vs `world.preview(...)`. The option keeps surface
  small and composes with overrides/transform; `preview` reads naturally for "throwaway."

## Notes

- Public API change → update `docs/api-reference.md` in the same step.
- Composes with **B8 derived-schema identity**: ephemeral generation is the explicit
  bypass for the 1:1 upsert.
