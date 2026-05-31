---
id: B4
title: Add `registry.find()` — single-record predicate lookup
type: feature
priority: medium
flags: [review]
created: 2026-05-27
spec: wiki/specs/B4-registry-find.md
---

## Description

The `Registry` interface has `store`, `all`, `pick`, `filter`, `count` — but no way to
look up a _specific_ stored record by a property. `filter` returns an array and `pick` is
random, so matchers that want "the one user with this username" or "the case with this
caseNumber" must write `filter(schema, pred)[0]`, which obscures intent and (via the `T[]`
return) doesn't force handling the absence case. Add a `find` that returns the first match
or `undefined`. (GitHub issue #2.)

## Proposal

```ts
interface Registry {
  // existing methods...
  find<T = unknown>(schema: ZodTypeAny, predicate: (item: T) => boolean): T | undefined;
}
```

Semantically `filter(schema, pred)[0]`, but expressed as the actual intent and with a
return type that forces handling absence. If multiple records match, return the first in
**insertion order** in the registry (matches `Array.prototype.find`); document this.

## Usage examples

```ts
// Pick a known fixture user
matchers: {
  createdBy: (ctx) => {
    const admin = ctx.registry.find(userSchema, (u) => u.username === "admin");
    return admin?.username ?? "system";
  };
}

// Look up by ID across derived schemas
matchers: {
  authorName: (ctx) => {
    const author = ctx.registry.find(personSchema, (p) => p.personId === ctx.source.authorId);
    return author ? `${author.firstName} ${author.lastName}` : "Unknown";
  };
}
```

## Open question (resolve in spec)

Return contract: **`T | undefined`** (recommended — symmetric with `Array.prototype.find`,
forces null-handling, low friction when the fixture might not exist yet) vs. **throw on no
match** (symmetric with `pick`, cleaner happy path). Issue recommends `T | undefined`, with
a possible `findOrThrow` variant added later if the throwing form proves common.

## Notes

- No PRNG / determinism concerns — pure data lookup.
- Foundational for **B6 (`world.get`)**, which is "`find`, or `generate` with overrides."
  Sequence B4 before B6.
- Public API change → update `docs/api-reference.md` in the same step.
