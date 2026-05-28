---
id: B8
title: Derived schemas (`from:`) should be 1:1 / identity-preserving with their source
type: feature
priority: medium
flags: [review]
created: 2026-05-28
spec: wiki/specs/B8-derived-schemas-identity.md
---

## Description
`from:` today is **structural** ("this schema's fields can be derived from that schema")
but not **identity-preserving**. Calling `world.generate(derivedSchema, { source: x })`
twice with the same `x` produces two derived records in the registry. After re-running
setup, or a handler re-generating, `registry.all(derivedSchema).length` quietly grows
past the source count and the implicit 1:1 contract is gone. (GitHub issue #8.)

## Repro
```ts
const UserSchema = z.object({ id: z.uuid(), email: z.string() });
const UserProfileSchema = z.object({ userId: z.uuid(), bio: z.string() });

world.withSchema(UserSchema);
world.populate(UserSchema, 1);
const user = world.registry.pick(UserSchema);

world.withSchema(UserProfileSchema, {
  from: UserSchema,
  matchers: { userId: (ctx) => ctx.source.id },
});

const a = world.generate(UserProfileSchema, { source: user });
const b = world.generate(UserProfileSchema, { source: user });

a === b;                                            // false
world.registry.count(UserProfileSchema);            // 2 — should be 1
```

## Proposal
For a schema registered with `from: X`, `generate` with `{ source }` is **upsert by
source-record identity**. Internally a `Map<sourceRef, derivedRecord>` keyed per
`(derivedSchema, sourceRef)` pair, so multiple derivations from the same source schema
don't collide:

```ts
const profile = world.generate(UserProfileSchema, { source: user });
const summary = world.generate(UserSummarySchema, { source: user });
// stored under (UserProfileSchema, user) and (UserSummarySchema, user) — independent
```

Opt-out for the rare "many derivations from one source" case:
```ts
world.generate(UserProfileSchema, { source: user, unique: false });
```

## Source identity options
- **Reference equality** on `source` — works because `registry.all` returns the same
  references each read. Fails if the caller reconstructs a look-alike (`{ ...user }`).
- **Configurable source key** for the look-alike case:
  ```ts
  world.withSchema(UserProfileSchema, {
    from: UserSchema,
    sourceKey: 'id',          // identity = source.id
    matchers: { ... },
  });
  ```

Reference equality covers most usage; `sourceKey` is the escape hatch and integrates
with `world.get`-style predicate lookup.

## Pairs with
- **B13 `world.populateFrom`** — becomes idempotent (re-running setup doesn't duplicate).
- **B11 filtered relations** — stay 1:1 over time.
- **B10 `{ store: false }`** — is the explicit opt-out for one-off ephemeral generation
  that wants fresh-and-not-stored.

## Notes
- Architecturally significant — touches the registry's identity model. Likely flagged
  `review` by the manager during planning.
- Public API change (adds `unique`/`sourceKey` options) → update `docs/api-reference.md`.
