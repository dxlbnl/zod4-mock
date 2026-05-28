---
id: B12
title: BUG — Nested-object overrides skip the matcher and don't deep-merge
type: bug
priority: medium
flags: [review]
created: 2026-05-28
spec: wiki/specs/B12-nested-override-skips-matcher.md
---

## Description
For an object field with both a matcher and a *partial-object* override, the matcher is
**bypassed** and the override is assigned raw, leaving the matcher's intended structure
missing. The final `deepMerge` at the end of `generateSingleItem` doesn't recover the
missing fields because `result[key]` has already been clobbered with just the partial.
The override is typed as `DeepPartial<User>['profile']`, which leads users to expect a
deep merge with the matcher output — but they get a replacement instead. (GitHub
issue #12.)

## Repro
```ts
const UserSchema = z.object({
  name: z.string(),
  profile: z.object({
    bio: z.string(),
    avatar: z.string(),
  }),
});

world.withSchema(UserSchema, {
  matchers: {
    profile: (ctx) => ({
      bio: 'matcher-bio',
      avatar: ctx.gen.internet.url(),
    }),
  },
});

const user = world.generate(UserSchema, {
  overrides: { profile: { bio: 'overridden-bio' } },
});

user.profile;
// expected: { bio: 'overridden-bio', avatar: <matcher's url> }
// actual:   { bio: 'overridden-bio' }                          // avatar dropped
```

## Root cause (from issue)
In `generateObjectFields` (src/world.ts):
```js
// 0. Overrides (Eager) — only handles primitives/null/arrays; nested objects fall through
const fieldOverride = overrides?.[key];
if (fieldOverride !== undefined &&
    (typeof fieldOverride !== 'object' || fieldOverride === null || Array.isArray(fieldOverride))) {
  // primitives/arrays handled here
}
// 1. Matcher
const matcher = reg.matchers[key];
if (matcher) {
  result[key] = fieldOverride !== undefined ? fieldOverride : matcher(fieldCtx);
  //                                          ^^^^^^^^^^^^^
  // partial-object override is used directly — matcher's full value is discarded.
  // The end-of-record deepMerge then merges over the partial, but the matcher
  // value was never computed, so nothing is recovered.
  continue;
}
```

## Proposed fix
When a matcher exists and the override is a non-null plain object, run the matcher
**and** deep-merge:

```js
if (matcher) {
  const matched = matcher(fieldCtx);
  result[key] = fieldOverride !== undefined
    ? (typeof fieldOverride === 'object' && fieldOverride !== null && !Array.isArray(fieldOverride)
        ? deepMerge(matched, fieldOverride)
        : fieldOverride)
    : matched;
  continue;
}
```
Primitives and arrays keep replace semantics (matching step 0). Nested-object overrides
merge with the matcher output, matching the `DeepPartial<T>` user expectation and the
final-pass `deepMerge` behaviour for fields without a matcher.

## Regression test (mandatory for bugs)
A unit test in `tests/unit/core/` that reproduces the issue: matcher produces a
multi-field object, override supplies one leaf field, the result MUST contain the
override leaf AND the matcher's other leaves.

## Notes
- `bug` track + `flags: [review]` per project default — regression test required (per
  D6 in `wiki/decisions.md`).
- The `deepMerge` helper already exists in `src/utils/merge.ts` (B6 also added
  `deepEqual` there); reuse it.
- Workaround today: override every leaf field explicitly. Defeats the `DeepPartial`
  typing.
