---
id: B17
title: BUG — `z.record(enum, V)` should generate all enum keys, not a random subset
type: bug
priority: medium
flags: [review]
created: 2026-05-28
spec: wiki/specs/B17-record-enum-exhaustive-keys.md
---

## Description

The record generator picks 2–5 random keys regardless of `keyType`. That's correct
for `z.record(z.string(), V)` (open-ended keys), but it breaks for
`z.record(enumSchema, V)` because Zod v4 makes those records **strict over the enum's
key set** — the inferred type is `{ A: V; B: V; C: V }` with all keys required.
Generated values fail `schema.parse()` immediately. (GitHub issue #18.)

## Repro

```ts
const Status = z.enum(["PENDING", "IN_PROGRESS", "DONE"]);
const Counts = z.record(Status, z.number());

const value = generate(Counts);
// value === { PENDING: 42 }   ← random subset (1 of 3 keys)

Counts.parse(value);
// ZodError:
//   expected number at .IN_PROGRESS   (got undefined)
//   expected number at .DONE          (got undefined)
```

## Root cause (from issue)

`src/generators/schema/collection.ts` → `generateZodRecord`:

```js
const count = ctx.prng.int(2, 5);     // always 2–5 random picks
for (let i = 0; i < count; i++) { ... }
```

`d.keyType` is treated as an opaque key generator, even when it's a finite set.

## Proposed fix

When `def(keyType).type` is a finite-key type (`enum`, `nativeEnum`, or a
literal-union), emit **one entry per enum member**:

```js
const enumKeys = enumKeyValues(def(d.keyType));   // string[] for finite sets, null otherwise
const keys = enumKeys ?? Array.from({ length: ctx.prng.int(2, 5) }, ...);
const result = {};
for (const [i, key] of keys.entries()) {
  result[key] = ctx.generate(d.valueType, { prng: ctx.prng.fork(`rv-${i}`), ... });
}
```

`enumKeyValues` returns the enum's values (`d.values` / `Object.values(d.entries)` —
check Zod v4 def shape) for enum / native-enum, `null` otherwise.

## Regression test (mandatory for bugs)

- `z.record(z.enum(['A', 'B', 'C']), V)` → generated value MUST have all three keys
  AND MUST pass `schema.parse(value).success`.
- `z.record(z.string(), V)` → unchanged (2–5 random keys; regression guard).

## Compatibility

- `z.record(z.string(), V)` — unchanged.
- `z.record(literal-union, V)` — same finite-set treatment if the inferred `keyType`
  def exposes the option set.
- `z.record(z.enum([...]), V)` — now exhaustive.

## Open question

- **Same issue applies to `z.map(enum, V)`?** The issue flags this — `generateZodMap`
  next to `generateZodRecord` has the same 2–4 random keys shape. For Maps, consumer
  story is different (iterable, not parsed key-by-key), so it matters less; worth
  deciding in the spec whether the same exhaustion principle should apply.

## Notes

- `bug` track per D6 — regression test required.
- Touches `src/generators/schema/collection.ts` (`generateZodRecord`, possibly
  `generateZodMap` as a follow-up).
- Public output behavior change → update `docs/api-reference.md` (or
  `docs/zod4-schema-coverage.md` if record/enum coverage is documented there).
- Changeset: `"zod4-mock": patch` (bug fix). Include `(closes #18)`.
