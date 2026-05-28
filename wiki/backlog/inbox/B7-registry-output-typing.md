---
id: B7
title: Registry read methods should return `infer<T>` (output shape), not `input<T>`
type: feature
priority: medium
flags: []
created: 2026-05-28
---

## Description
`Registry.all` / `.find` / `.filter` / `.pick` are typed `input<T>`, but for schemas
using `z.coerce.*` or `.transform()` the library's generators produce **output-shaped**
values (`Date`, parsed numbers, …). The types tell consumers "you have the pre-coerce
input shape," but at runtime the registry contains the post-coerce shape. Every consumer
holding a normal `z.infer<T>` type has to cast at the registry boundary. Internally
inconsistent too: `world.generate` returns `infer<T>` (output), but `registry.all` of the
same values claims `input<T>`. (GitHub issues #7 and #16 — duplicate filings, same body.)

## Repro
```ts
const EventSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  occurredAt: z.coerce.date(),         // input: unknown · output: Date
});
type Event = z.infer<typeof EventSchema>;
// { id: string; title: string; occurredAt: Date }

world.withSchema(EventSchema);
world.populate(EventSchema, 3);

const items = world.registry.all(EventSchema);
// ^? Array<{ id: string; title: string; occurredAt: unknown }>
// runtime: occurredAt IS a Date — but TS reports unknown
const events = items as Event[];        // forced cast at every read site
```

## Proposal
Asymmetric — reads use `infer<T>`, writes still accept `input<T>` (mirrors `z.coerce`):

```ts
interface Registry {
  // reads → output shape (what generators actually produce)
  all<T extends ZodTypeAny>(schema: T): z.infer<T>[];
  find<T extends ZodTypeAny>(schema: T, predicate: (item: z.infer<T>) => boolean): z.infer<T> | undefined;
  filter<T extends ZodTypeAny>(schema: T, predicate: (item: z.infer<T>) => boolean): z.infer<T>[];
  pick<T extends ZodTypeAny>(schema: T): z.infer<T>;
  count(schema: ZodTypeAny): number;

  // writes still accept input — permissive, matches matcher returns
  store<T extends ZodTypeAny>(schema: T, item: input<T>): void;
}
```
`world.get(schema, predicate?)` likewise returns `z.infer<T>`. Matchers keep their
`input<T>[K]` return type so a matcher on a `coerce.date()` field can still return
`string | number | Date`.

## Why this asymmetry
- Mirrors `z.coerce`: input permissive, output fixed.
- Matches the library's runtime (generators produce output shapes).
- Consumers naturally hold `z.infer<T>` — no cast at reads.
- Matchers/writes stay permissive — flexibility where it belongs.

## Open question (resolve in spec)
What about matchers that deliberately return pre-coerce values (e.g. a string for a
`coerce.date()` field) and read them back as strings? Two closures:
- **(a)** Parse matcher returns through the schema on store — strong guarantee, parse
  cost at write, may break matchers that intentionally produce invalid-but-useful data.
- **(b)** Document the contract: "generators/matchers must produce output-shaped values"
  — matches today's de-facto behaviour, zero runtime change.

Issue leans **(b)** as the minimal-change pairing.

## Notes
- Touches the just-landed B4 `find` signature (replace `input<T>` with `z.infer<T>` for
  the predicate + return). Same for B6 `world.get`.
- Public type change → update `docs/api-reference.md` in the same step.
- Two duplicate GitHub issues (#7 and #16) — close both when this lands.
