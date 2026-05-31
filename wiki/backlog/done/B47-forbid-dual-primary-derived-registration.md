---
id: B47
title: BUG — forbid dual primary+derived registration of the same schema at `withSchema` time
type: bug
priority: medium
flags: []
created: 2026-05-31
spec: wiki/specs/B47-forbid-dual-primary-derived-registration.md
---

## Description

Follow-up to **B41** (research: [wiki/research/engine/populate-dispatch-divergence.md](../../research/engine/populate-dispatch-divergence.md)). User-approved direction is **Option D**: `withSchema` MUST throw when a schema reference is being registered as both **primary** (no `from:`) and **derived** (with `from:`).

The library has four dispatch sites (`generate` single, `generate` array, `get`, `populate`) that all classify a registered schema as derived / primary / ad-hoc. Three of them check derived first; `populate` checks primary first. The asymmetry is silent and undocumented (B41 §2). The user — the maintainer — was previously unaware dual registration was even possible.

Rather than picking which dispatch order is "right" (Option A or B), the user chose to **remove the configuration** at the registration boundary. There is no documented use case for dual registration; no test exercises it; no doc explains it. Throwing at `withSchema` time converts a latent footgun into a setup-time error, before any data flows.

### Behavior change

```ts
const Person = z.object({ id: z.uuid(), name: z.string() });

const world = createWorld({ seed: 1 });
world.withSchema(Person);                          // OK — primary registration
world.withSchema(Person, { from: Company });       // THROWS — already registered as primary

// Reversed order also throws
world.withSchema(Person, { from: Company });       // OK — derived registration
world.withSchema(Person);                          // THROWS — already registered as derived
```

### What does NOT throw

- Re-registering with the **same polarity** (two primary registrations of the same schema). Multi-primary semantics are unchanged — last-write-wins for matchers, per the existing `engine.ts:746` pattern. This is out of B47's scope (a separate axis).
- A schema appearing in another schema's `relations:` declaration (B11 `RelationEntry`) — relations are not registrations.
- A schema appearing in another schema's `from:` declaration (the *source* schema can itself be registered however the user wants — primary, derived from yet another, or unregistered).

## Acceptance

- B47-R1: `withSchema` MUST throw a clear error when a schema is being registered as derived and the same schema reference already has a primary registration on the world.
- B47-R2: `withSchema` MUST throw the same way when a schema is being registered as primary and the same schema reference already has a derived registration.
- B47-R3: Multi-primary registration of the same schema (no `from:` twice) MUST NOT throw — out of scope.
- B47-R4: Use as a relation target or a `from:` source MUST NOT throw — those are not registrations.

## Notes

- **Minimum tests**: per [[feedback-minimal-tests]], the failing-test file should contain **at most ~4 tests** — one per requirement ID (R1, R2, R3, R4). The regression test for the reported (latent) failure is the R1 throw assertion. Do NOT add exhaustive variation probes.
- Spec-writer: confirm the throw message wording is implementer's call (B41 non-blocking question #4) and call out the order-invariance (primary-then-derived MUST throw the same way as derived-then-primary; one assertion covers both via two `withSchema` call orders in a single test, NOT two separate tests).
- Implementer: throw site is `WorldImpl.withSchema` in `src/world/engine.ts`. The polarity check is `findPrimaryRegs(schemaRegs, schema).length > 0` (already-primary) vs the new registration's `opts?.from !== undefined` (incoming-derived). Mirror for the reverse case.
- Bump: `patch` per user direction (B41 non-blocking question #3).
- No docs update required (the dual-config can no longer exist; nothing to document).
- Standing constraint candidate: "A schema MAY be registered only as one of primary OR derived; mixing throws at `withSchema` time." If the reviewer agrees this is a standing constraint, the manager promotes it to a one-line rule in `architecture.md` paired with a new ADR (`D12`) on close.
- Predecessor: B41 [wiki/backlog/done/B41-populate-dispatch-precedence-divergence.md](../done/B41-populate-dispatch-precedence-divergence.md).
- No GitHub issue.
