---
id: B16
title: Surface the auto key-match list (docs + a debug helper `world.explain`)
type: feature
priority: medium
flags: []
created: 2026-05-28
---

## Description
Auto key-matching is one of zod4-mock's best features but is discoverable only by
reading `key-map.js` in the package source. New users (and contributors evolving
matchers) miss that `kenteken` produces a VRM, `bedrag` a finance amount, `*at`/`*date`
an ISO date string / `Date`, `*name` a fullName, etc. Two affordances would make this
leverage usable. (GitHub issue #17.)

## 1. Documentation surface
A `docs/key-heuristics.md` (or expansion of the existing one) listing:
- **Exact-key generators** for `string` and `number` types (the `DEFAULT_KEY_MAP`
  contents).
- **Pattern generators** (suffix/prefix rules — `*at`, `*date`, `*url`, `*email`,
  `*id`, etc.) and which types they apply to.
- **Localised aliases** (`voornaam`, `achternaam`, `straat`, `kleur`, `bedrag`,
  `kenteken`, `telefoon`, `omschrijving`, `bericht`, …) — the Dutch coverage isn't
  visible anywhere a typical consumer would look.

An auto-generated reference table from the `DEFAULT_KEY_MAP` source (a small script
producing the markdown) would keep docs in lockstep with the code. The information is
already there; nothing in the public docs surfaces it.

## 2. Debug helper: `world.explain(schema)`
Print, per field, the resolved generator and why:
```ts
const UserSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  email: z.string(),
  createdAt: z.coerce.date(),
  homeAddress: z.string(),
  kind: z.string(),
});

world.withSchema(UserSchema);
world.explain(UserSchema);

// id          → string.uuid           (key-pattern: ends with "id")
// firstName   → person.firstName      (exact key: "firstname")
// email       → internet.email        (exact key: "email")
// createdAt   → date.anytime+toISO    (key-pattern: ends with "at")
// homeAddress → location.streetAddress (exact key: "address" — substring match)
// kind        → schema-introspection  (no key match, no matcher) ← will be random string
```

Cheap to build — the resolution logic already exists in `generateFromKey`. Makes "why
is this field random?" debugging instant, and surfaces near-misses where a user *meant*
to hit an auto-key but the field name doesn't quite match (`homeAddress` line above).

Could also work as a `world.generate(schema, { inspect: true })` flag — generate
without storing and return per-field provenance instead of values.

## Open questions (resolve in spec)
- **Output shape**: human-readable string lines (issue's proposal) vs. structured data
  (`Record<fieldName, { generator: string; reason: string }>`) for programmatic use.
  Adopt structured + a default `toString` formatter? **Decide.**
- **`explain` vs `inspect` flag**: standalone method vs. `generate({ inspect: true })`
  option (issue mentions both). The standalone method is simpler; the flag composes
  with overrides for dry-run debugging. Adopt the method + a follow-up consideration
  for the flag.
- **Scope**: explain a single schema (issue's repro) — yes. Across multiple registered
  schemas — leave for a follow-up.

## Notes
- Two affordances bundled in one issue, both about discoverability of the same feature.
  The spec-writer may split into two requirements within one spec.
- Public API change (adds `World.explain`) → update `docs/api-reference.md`.
- Doc-generation script for the key-match table could live in `scripts/` (matches the
  existing `scripts/train-markov.ts` pattern).
