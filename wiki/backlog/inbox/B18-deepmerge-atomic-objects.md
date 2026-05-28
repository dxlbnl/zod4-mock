---
id: B18
title: BUG — `deepMerge` recurses into `Date` / `Map` / `Set` / `RegExp` and loses the value
type: bug
priority: high
flags: [review]
created: 2026-05-28
---

## Description
`src/utils/merge.ts` `deepMerge` treats anything `typeof === 'object'` (that isn't
`null` or `Array`) as a plain object and recurses by `Object.keys`. For atomic
object types — `Date`, `Map`, `Set`, `RegExp`, `URL`, `Buffer`, typed arrays, any
custom class — `Object.keys(...)` is `[]`, so the source contributes nothing and the
result is `{ ...target }`. The atomic value is silently dropped and replaced by an
empty `{}`. **Broad blast radius** because deepMerge is used by `overrides` (B12
matcher branch, B14 transform pipeline) AND by the final-pass merge in
`generateSingleItem`. Any consumer overriding a `z.date()` field gets `{}` back.
(GitHub issue #19.)

## Repro
```ts
const Event = z.object({
  id: z.string(),
  at: z.date(),
});

const e = generate(Event, {
  overrides: {
    id: 'evt-1',
    at: new Date('2024-01-01T00:00:00Z'),
  },
});

e.id;                    // 'evt-1'  ← string override works (primitive)
e.at;                    // {}       ← Date dropped
e.at instanceof Date;    // false
```

Same break for `Map`, `Set`, `RegExp`, etc.

## Root cause (from issue)
```js
// src/utils/merge.ts
export function deepMerge(target, source) {
  if (typeof source !== "object" || source === null || Array.isArray(source) ||
      typeof target !== "object" || target === null || Array.isArray(target)) {
    return source;
  }
  const result = { ...target };
  for (const k of Object.keys(source)) {
    result[k] = deepMerge(result[k], source[k]);
  }
  return result;
}
```
The early-return only catches non-objects, `null`, and arrays. `Date`/`Map`/`Set` are
`typeof 'object'`, non-null, non-array → fall into recursion. `{ ...new Date() }` is
`{}`, `Object.keys(new Date())` is `[]` → nothing restored.

## Proposed fix
Extend the early-return: treat any object that isn't a plain object as a leaf value
(replace, don't merge).
```js
const isPlainObject = (value) =>
  value !== null &&
  typeof value === 'object' &&
  (Object.getPrototypeOf(value) === Object.prototype ||
   Object.getPrototypeOf(value) === null);

export function deepMerge(target, source) {
  if (!isPlainObject(source) || !isPlainObject(target)) {
    return source;
  }
  const result = { ...target };
  for (const k of Object.keys(source)) {
    result[k] = deepMerge(result[k], source[k]);
  }
  return result;
}
```
`isPlainObject` rejects `Date`/`Map`/`Set`/`RegExp`/`URL`/`Buffer`/typed arrays/class
instances — all of which should be merge-by-replace. Plain `{}` literals still
recurse.

## Regression test (mandatory for bugs)
- Override `z.date()` field with `new Date(...)`: result MUST be the Date instance
  (`result.at instanceof Date === true`, `result.at.toISOString()` matches).
- Override `z.instanceof(RegExp)` field with `/foo/`: result MUST be `/foo/`
  (regex.test still works).
- Plain-object recursion guard (`{ a: { b: 1 } } ← { a: { c: 2 } }`): result must
  still merge to `{ a: { b: 1, c: 2 } }`.

## Compatibility / interaction with B12 + B14
- B12's matcher-fix uses `deepMerge(matched, fieldOverride)` — same broken path. The
  fix needs to land **in `deepMerge` itself** to cover both layers.
- B14's `transformApplied` flag and `generateSingleItem`'s final-pass `deepMerge`
  both flow through the same helper.
- The B6 `deepEqual` helper is unaffected — it's a separate function and the
  prototype check there is already correct.

## Open question
- **Is the prototype-chain check robust across realms?** A `Date` from another
  iframe/realm has a different `Object.prototype` reference, so the
  `Object.getPrototypeOf(value) === Object.prototype` check would return `false`
  for a plain object from another realm too. Decide in the spec whether to use
  `Object.prototype.toString.call(value)` (`'[object Object]'`) or accept the
  same-realm constraint as a documented limit.

## Notes
- `bug` track per D6 — regression test required.
- **High priority**: every existing user trying to override a `z.date()`/`z.map()`/
  `z.set()` field is silently getting `{}`. The fix is small and surgical
  (`src/utils/merge.ts`), but the impact is broad.
- Single source change + regression tests in `tests/unit/utils/` (or wherever the
  existing merge tests live).
- No new API surface; `docs/api-reference.md` doesn't change.
- Changeset: `"zod4-mock": patch`. Include `(closes #19)`.
