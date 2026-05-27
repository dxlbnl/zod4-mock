# Known issues

_No open known issues._

## Resolved

- **Self-referential relations** — a schema relating to itself (e.g. a category whose
  `parentId` points at another category) used to recurse forever. Now supported: the
  root record's relation resolves to `undefined` (so `parentId` can be `null`) and later
  records reference earlier ones. See
  [`related(name)` → self-referential relations](api-reference.md#fields-on-ctx) in the
  API reference. Regression tests live in `tests/unit/core/relations.test.ts`
  ("self-referential relations (B1)").
