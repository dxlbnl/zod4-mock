---
id: B14
title: `world.populate` should support a per-record factory for `GenerateOptions`
type: feature
priority: medium
flags: []
created: 2026-05-28
---

## Description
`world.populate(schema, count)` generates `count` matcher-default records. For "N named
records" you fall back to a loop calling `world.generate` per record — re-inventing the
populate primitive. (GitHub issue #14.)

```ts
// Before — re-invents populate in a loop:
for (const profile of USER_PROFILES) {
  world.generate(UserSchema, { overrides: profile });
}

// After — declarative:
world.populate(UserSchema, USER_PROFILES.length, (i) => ({
  overrides: USER_PROFILES[i],
}));
```

## Proposal
Overload `populate` to accept a per-record factory that returns `GenerateOptions`:

```ts
world.populate<TSchema extends ZodTypeAny>(
  schema: TSchema,
  count: number,
  factory?: (index: number) => GenerateOptions<TSchema>,
): this;
```
The existing two-arg form remains. The factory receives the record index (0..count-1).

## Example
```ts
const UserSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  role: z.enum(['admin', 'editor', 'viewer']),
});

const USER_PROFILES = [
  { username: 'admin',  role: 'admin'  },
  { username: 'editor', role: 'editor' },
  { username: 'viewer', role: 'viewer' },
] as const;

world.withSchema(UserSchema);
world.populate(UserSchema, USER_PROFILES.length, (i) => ({
  overrides: USER_PROFILES[i],
}));
```

## Pairs naturally with
- **B8 identity-preserving derived schemas** — the factory could also return `{ source }`
  for derived schemas, making this a unified entry point for "populate this many, here's
  the per-record context."
- **B13 `populateFrom`** — same factory shape would let consumers tweak per-source
  generation:
  ```ts
  world.populateFrom(SummarySchema, OrderSchema, undefined, (order) => ({
    overrides: { label: `summary-${order.id.slice(0, 6)}` },
  }));
  ```

## Open questions (resolve in spec)
- **Factory signature**: `(i: number) => GenerateOptions` (issue's proposal) vs.
  `(i: number) => Partial<input<T>>` (overrides-only sugar). The issue picks
  `GenerateOptions` for full control (overrides + transform + future flags). Adopt.
- **Determinism**: factory is pure (no PRNG inside); deterministic across runs for the
  same seed. Document.

## Notes
- Small surface, big readability win — removes the "if I want overrides I lose populate"
  friction.
- Public API change → update `docs/api-reference.md`.
