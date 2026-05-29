---
id: B41
title: Investigate — `populate` dispatches primary-first while `generateSingleItem`/`generateArray` dispatch derived-first
type: research
priority: medium
flags: [review]
created: 2026-05-29
report: wiki/research/populate-dispatch-divergence.md
---

## Description

Surfaced during the B25 `resolveMode` refactor. The library has four
dispatch sites that decide between `derived`/`primary`/`ad-hoc` paths,
but they don't all agree on precedence:

- `WorldImpl.generateSingleItem` (the dispatcher) — **derived first**, then
  primary, then ad-hoc.
- `WorldImpl.generateArray` — **derived first**, then primary, then ad-hoc.
- `WorldImpl.get` — uses `resolveMode` which is **derived first**.
- `WorldImpl.populate` — **primary first**, then derived, then ad-hoc.

The `populate` divergence has been there since the method shipped (the B25
refactor preserved byte-identical behaviour by keeping an explicit
`findPrimaryRegs` check ahead of `resolveMode`, with the resulting
`case "primary"` annotated unreachable). The asymmetry is silent: a schema
registered as **both** primary and derived would have `world.generate(S)`
return a derived record while `world.populate(S, N)` writes primary
records.

### Repro (hypothetical — no test pins this today)

```ts
const Source = z.object({ id: z.uuid(), name: z.string() });
const Derived = z.object({ sourceId: z.uuid(), label: z.string() });

const world = createWorld({ seed: 1 });
world.withSchema(Source);
world.withSchema(Derived, {
  from: Source,
  matchers: { sourceId: (ctx) => ctx.source.id },
});

// Now register Derived ALSO as a primary (rare but legal)
world.withSchema(Derived); // ad-hoc style — adds a primary registration

world.generate(Derived);     // → derived record (matches with-source path)
world.populate(Derived, 5);  // → 5 primary records (primary-first path)
```

This is a pathological config — most users either register a schema as
primary OR derived, not both. But the divergence is latent and could
surprise someone who adds a `withSchema` call later in development.

## Question

Three sub-questions for the audit:

1. **Is this divergence intentional?** Check the B14 (`world.populate`) +
   B6 (`world.get`) spec history and `wiki/decisions.md` for any rationale.
   The B14 spec (`wiki/specs/B14-world-populate-factory.md`) defines the
   factory-shape but may not pin the dispatch order; if not, `populate`'s
   primary-first order may be incidental.

2. **Does any test or doc rely on `populate`'s primary-first behaviour?**
   Grep the test suite for `populate(...)` patterns with dual-registered
   schemas; check `docs/api-reference.md` for any "primary first" promise
   in `.populate`'s description.

3. **What's the right unification?** Three options:
   - **A.** Align `populate` with the others — switch to derived-first.
     Breaks any consumer that relied on primary-first; arguably more
     consistent.
   - **B.** Align the others with `populate` — switch `generateSingleItem`
     /`generateArray`/`get` to primary-first. Larger surface; potentially
     breaks B8/B11 contracts.
   - **C.** Document the divergence as deliberate and codify it as a rule
     in `architecture.md` (each dispatcher has its own precedence
     rationale).
   - **D.** Forbid dual registration at `withSchema` time (throw when a
     schema is being registered as both primary and derived). Simplest
     and safest if dual registration is genuinely never intended.

Deliverable: `wiki/research/populate-dispatch-divergence.md` with a
recommendation. If the choice ends up being A/B/D (behaviour-changing),
file a follow-up `bug` item with a spec-writer.

Flagged `review` — the recommendation is design-significant and the user
should approve direction before any code change.

## Notes

- Predecessor: B25 ([wiki/backlog/done/B25-extract-resolve-mode.md](../done/B25-extract-resolve-mode.md))
  surfaced the divergence; the B25 reviewer recommended this follow-up.
- Related: B14 (`world.populate` factory), B6 (`world.get` find-or-create),
  B8 (derived schemas identity).
- No GitHub issue. No reported user impact yet — this is a "discovered
  during refactor" item.
- If the audit confirms intentionality (Option C), no code change is needed
  beyond a rule line in `architecture.md`.
