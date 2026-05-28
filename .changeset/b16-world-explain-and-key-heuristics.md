---
"zod4-mock": minor
---

Add `world.explain(schema)` — a read-only, PRNG-neutral debug helper that reports, per field of a Zod object schema, which step of the generation pipeline (matcher → withKeyMap → withGenerators → exact-key → key-pattern → schema-based) would resolve the field, plus a short reason. The result is a structured `ExplainResult` with a `toString()` formatter producing an aligned, paste-able table; declared relations are surfaced on `result.relations` with their `where`-predicate presence.

```ts
const r = world.explain(UserSchema);
r.fields.email; // { generator: 'internet.email', reason: 'exact key: "email"' }
console.log(r.toString());
// id          → string.uuid      (key-pattern: ends with "id")
// firstName   → person.firstName (exact key: "firstname")
// email       → internet.email   (exact key: "email")
// createdAt   → date.anytime     (key-pattern: ends with "at")
// homeAddress → schema-based     (no key match, no matcher)
// kind        → matcher:kind     (matcher registered via withSchema)
```

`explain` consumes no PRNG state, writes nothing to the registry, advances no counter, and never auto-provisions a related record — calling `explain` followed by `generate` produces the same value as `generate` alone.

Also regenerates `docs/key-heuristics.md`: the page now lists every exact-key entry in `DEFAULT_KEY_MAP.string` and `DEFAULT_KEY_MAP.number`, every rule in `DEFAULT_KEY_PATTERNS` (with the leaf-type-aware date identifiers), and the Dutch-localised aliases (`voornaam`, `achternaam`, `straat`, `stad`, `land`, `kenteken`, `voertuigkleur`, `kleur`, `telefoon`, `bedrag`, `prijs`, `omschrijving`, `bericht`) that ship in `DEFAULT_KEY_MAP` itself (not in the locale packages). (closes #17)
