---
"zod4-mock": minor
---

**Behaviour change — PRNG sequences shift for ad-hoc, array, and outer-wrapper paths.** Downstream snapshot tests against `world.generate(unregistered)`, `world.generate(schema.array(...))`, or `world.generate(schema.optional()/nullable())` will produce different (still-deterministic) values. Registered primary and derived paths are unchanged.

Strengthen PRNG determinism so call order across distinct schemas no longer affects any value. Previously, `world.generate(X)` after `world.generate(Y)` produced a different value than `world.generate(X)` alone — because per-call fork keys were derived from a global generation counter. Now fork keys are derived from a stable per-schema identity (a module-global `WeakMap<ZodTypeAny, number>`) plus a per-schema call slot, so the Nth `generate(X)` on a world always uses the same fork key regardless of what other schemas were generated in between.

The determinism contract is now **reference-identity-based**: two schemas that are `===` equal share fork keys; two schemas constructed separately (even if structurally identical) do NOT. Construct schemas once at module scope and reuse them — that is the deterministic-output pattern.

Registered primary and derived paths are unchanged (they already used stable identity-based keys via `reg{id}#{index}` / `dreg{id}#{sourceIndex}`). Ad-hoc generation, array generation, and the outer optional/nullable roll all switch to the new shape.

For most consumers this is invisible — the in-repo test suite required zero functional re-pins (three tests were restructured to hoist schema construction, preserving their intent under the new contract).
