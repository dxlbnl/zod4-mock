---
id: B21
title: BUG/inconsistency — `world.generate(DerivedSchema)` (no source override) does not store the derived record
type: bug
priority: medium
flags: [review]
created: 2026-05-29
---

## Description

The no-source derived branch of `WorldImpl.generateSingleItem` (`src/world.ts`
~lines 1122-1156, the `else if (derivedRegs.length > 0)` block reached when
`world.generate(DerivedSchema)` is called **without** `{ source }` and the schema
is registered with `from: SourceSchema`) generates the derived record and returns
it, but **does not** write it to the registry — even under default `store: true`.

This is asymmetric with the **with-source** branch at `src/world.ts:1110`, which
B8 made write-by-default (inside `if (this.effectiveStore)`), and which the B19
tracking card explicitly confirmed:

> `world.generate(DerivedSchema, { source })` now stores by default. (B19,
> referencing B8's identity-preserving derivation.)

The asymmetry was surfaced during B20's pipeline by the test-writer (#21
investigation) and verified in code by the manager (see B20's spec
`## Out of scope` and the B20 progress entry). B20 deliberately left it
unchanged to stay narrow on the #21 crash; the design question — should
no-source derived generate **also** store by default? — belongs in its own
backlog item.

### Repro (today's behaviour against 0.7.1 + B20)

```ts
const Source = z.object({ id: z.uuid(), name: z.string() });
const Derived = z.object({ sourceId: z.uuid(), label: z.string() });

const world = createWorld({ seed: 1 });
world.withSchema(Source);
world.withSchema(Derived, {
  from: Source,
  matchers: { sourceId: (ctx) => ctx.source.id },
});

// Default store:true. With source override → stores (B8).
const a = world.generate(Derived, { source: world.generate(Source) });
world.registry.count(Derived);   // 1  ✓

// Default store:true. No source override → auto-provisions a source AND stores it,
// generates the derived record, but does NOT store the derived record.
const b = world.generate(Derived);
world.registry.count(Source);    // 2  ✓  (auto-provisioned source IS stored)
world.registry.count(Derived);   // still 1  ✗  (derived record NOT stored)
```

The natural mental model from B8's API surface is "derived generate stores by
default, opt out with `{ store: false }`" — but it only applies on the
with-source path. A user who does
`for (let i = 0; i < 5; i++) world.generate(Derived);` ends up with five sources
and one derived (the first call's), instead of the symmetric five-and-five.

### Possible directions

- **A. Make the no-source branch also store by default** (the symmetric fix).
  After `generateDerivedRecord` returns, write to the registry inside
  `if (this.effectiveStore)` — mirroring the with-source branch at line 1110.
  Pros: removes the asymmetry, matches B8's documented intent, matches the
  with-source branch's behaviour byte-for-byte (modulo the upsert map, which only
  applies on the with-source identity-preserving path). Cons: changes
  observable behaviour for any user who has relied on "no-source generate is
  ephemeral" — likely a minor break, but should be flagged as such in the
  changeset (`patch`-vs-`minor` is a judgement call for spec-writer).

- **B. Leave the asymmetry, document it explicitly** in
  `docs/api-reference.md` and `docs/concepts.md` as the contract. Pros:
  no behaviour change, zero break risk. Cons: keeps a surprising surface and
  forces consumers to either (a) thread `{ source }` to get storage, or
  (b) call `world.populate(Derived, n)` instead of `generate` in a loop.

- **C. Move the no-source branch to also call the B8 upsert map** keyed by
  the auto-provisioned source — i.e. treat it as an "auto-source" variant of
  the with-source path. Pros: full B8 semantics on both paths, including the
  per-(Derived, source) idempotence. Cons: most invasive, raises questions
  about cache key choice when the auto-provisioned source isn't user-named.

Recommended: spec-writer to weigh A vs B. C is likely overkill for this round.

Flagged `review` — this is a semantic / design choice the user should
explicitly approve before tests are written.

## Notes
- Discovered during B20's pipeline (see commit `96537da` and
  `wiki/specs/B20-store-false-empty-from-crash.md`'s `## Out of scope` note).
- Related cards: B8 (with-source store-by-default), B10 (`{ store: false }`
  opt-out), B19 (tracking marker — issue #20, fixed by B8), B20 (the #21 crash
  on the no-source path that surfaced this).
- Not tied to a GitHub issue. The B20 commit didn't change this; it deliberately
  preserved today's "byte-identical to today" behaviour on the no-source path
  per B20-R5.
- Regression test required if direction A (the behavioural fix) is chosen —
  the with-source path's existing tests already guard line 1110.
- Changeset implications: A is at minimum `patch` (bug fix per "derived generate
  should store by default"), but spec-writer may classify as `minor` if user
  visibility warrants. B is `patch` (docs-only) or no changeset (depending on
  whether `docs/` is in the release surface). C is `minor` (new upsert semantics
  on the auto-source path).
