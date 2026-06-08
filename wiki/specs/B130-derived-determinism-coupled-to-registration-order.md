# B130: Derived-record determinism is coupled to registration order, not schema reference identity

## Context

A schema registered with `from:` ("derived") generates its field values from a PRNG
whose seed is keyed on the schema's **registration ordinal** (`regId`), not on its
**reference identity**. Inserting or reordering any `withSchema(...)` call *before* a
derived schema silently changes every field that derived schema generates — even though
the derived schema, its source, and the world seed are all identical. This violates the
binding determinism Rule (D4/D10): "Generation MUST be deterministic per `(seed + schema
reference + per-schema call slot)`; **call order across distinct schemas MUST NOT affect
any value**. Determinism is keyed on schema _reference_ identity (a module-global
`WeakMap`), not structural equality."

This is the **derived-path analogue of B39**
([wiki/specs/B39-stable-identity-based-fork-keys.md](B39-stable-identity-based-fork-keys.md)).
B39 converted the three ad-hoc / array / outer-wrapper fork keys from the per-world
`generationCounter` onto the module-global reference-identity `getSchemaId`
([src/world/engine.ts:160](../../src/world/engine.ts#L160), `nextSchemaSlot` at
[engine.ts:484](../../src/world/engine.ts#L484)). The **derived** record path was never
converted — it is the one remaining path that still keys on the registration ordinal.

### Mechanism (confirmed in source)

- **[src/world/engine.ts:535](../../src/world/engine.ts#L535)** — `withSchema` assigns
  `regId: this.schemaRegs.length`, i.e. the running registration count. `regId` is
  therefore the registration *ordinal*.
- **[src/world/engine.ts:1182](../../src/world/engine.ts#L1182)** —
  `generateDerivedRecord` seeds the record's field PRNG from
  `const recordId = \`dreg${reg.regId}#${sourceIndex}\`` and then
  `createPrng(fieldSeed(this.rootSeed, recordId, ""))`. The recordId is also passed as
  the `fieldPathPrefix`/relation key.

So a derived record's field PRNG seed depends on `regId`, and `regId` depends on how many
schemas were registered before it. Insert one `withSchema` earlier → every later schema's
`regId` shifts by +1 → `recordId` shifts → field PRNG reseeds → all generated fields
change. This is a soft-D4/D10 violation: holding `(seed, derived schema reference,
source)` constant, the output is **not** stable.

### Relationship to the primary path

The registered-**primary** path
([engine.ts:1142](../../src/world/engine.ts#L1142),
`reg${effectiveRegId}#${recordIndex}`) intentionally keys on `regId` and is **out of
scope**: per B39-R9, reordering `withSchema(X)` vs `withSchema(Y)` *can* legitimately
shift primary values because it shifts which `regId` each schema receives — that is the
documented "same builder chain" caveat, not a defect. B130 changes **only** the derived
record path, whose dependence on the ordinal of *other, unrelated* registrations is the
defect.

### Composition with B8 (must be preserved)

B8 ([wiki/specs/B8-derived-schemas-identity.md](B8-derived-schemas-identity.md)) makes
`world.generate(D, { source })` a per-pair upsert keyed by `(D, identity(source))`. The
upsert map keys on schema reference + source identity — already pure identity, no `regId`.
B130 changes only the **field-PRNG seed** of the *generating* call; the upsert lookup /
write semantics, the `#<sourceIndex>` suffix, `unique`, `sourceKey`, and `store: false`
behaviour are all unchanged.

### Expected value shift (acceptable per D4/D10)

Because the derived field-PRNG seed changes shape (from `regId`-based to
`getSchemaId`-based), the **specific generated values** for existing derived schemas will
shift **once** to the new order-independent sequence. This is the same kind of one-time
determinism-sequence change B39 shipped, and is acceptable per D4/D10. Requirements below
pin **behavioral invariants** (order-independence, B8 idempotence, suffix semantics), not
specific bytes.

Item card:
[wiki/backlog/doing/B130-derived-determinism-coupled-to-registration-order.md](../backlog/doing/B130-derived-determinism-coupled-to-registration-order.md).
This supersedes the original (confounded) B130 framing (a fresh-schema-per-call artifact;
see `wiki/progress.md` 2026-06-08).

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B130-R1: derived output is independent of unrelated prior registrations (the order-independence invariant)

For a schema `D` registered with `from: Source`, the record produced by
`world.generate(D, { source })` MUST be **byte-identical** whether or not one or more
unrelated `withSchema(...)` calls were made on the world **before** `D` was registered,
holding the world seed, the `D` reference, the `Source` reference, and the `source`
record constant. "Byte-identical" is asserted via `JSON.stringify` deep equality on the
returned value. (This is the canonical D6 regression scenario from the item card.)

- Scenario: an unrelated earlier registration does not change a derived record
  GIVEN `Parent = z.object({ id: z.string() })` and `Derived = z.object({ pid: z.string(), label: z.string() })` constructed once at module scope, and a builder
  `const run = (insertEarlierReg: boolean) => { const w = createWorld({ seed: 1 }); if (insertEarlierReg) { w.withSchema(z.object({ unrelated: z.string() })); } w.withSchema(Derived, { from: Parent, matchers: { pid: (c) => c.source.id } }); w.populate(Parent, 1); const [p] = w.registry.all(Parent); return JSON.stringify(w.generate(Derived, { source: p })); };`
  WHEN the consumer evaluates `run(false)` and `run(true)`
  THEN `run(false) === run(true)` — the `label` field (the non-source field the PRNG fills) is byte-identical with and without the unrelated earlier registration.

- Scenario: the non-source PRNG-filled field is the observable that shifts under the bug
  GIVEN the same `run` builder, run against the codebase **before** the B130 fix
  WHEN `run(false)` and `run(true)` are compared
  THEN they differ (the bug: `Derived`'s `recordId` `dreg<regId>#<index>` shifted because the earlier registration bumped its `regId`); AND after the fix, `run(false) === run(true)`.

### B130-R2: two worlds that register the same derived schema at different positions produce identical derived data

For two identically-seeded worlds that both register the same derived schema `D` (same
reference) `from:` the same `Source` (same reference), the record produced by
`world.generate(D, { source })` (for reference-equal-or-`sourceKey`-equal sources holding
the same field values) MUST be byte-identical **regardless of `D`'s registration position**
relative to other, unrelated `withSchema(...)` calls on each world.

- Scenario: derived data matches across worlds with different registration positions
  GIVEN `Source = z.object({ id: z.string() })` and `Derived = z.object({ sid: z.string(), note: z.string() })` at module scope; `worldA = createWorld({ seed: 7 }).withSchema(Source).withSchema(Derived, { from: Source, matchers: { sid: (c) => c.source.id } })` (D registered 2nd), and `worldB = createWorld({ seed: 7 }).withSchema(Source).withSchema(z.object({ x: z.string() })).withSchema(z.object({ y: z.string() })).withSchema(Derived, { from: Source, matchers: { sid: (c) => c.source.id } })` (D registered 4th), each populated `world.populate(Source, 1)` so each holds a byte-identical `source` (same seed → same Source values)
  WHEN each world calls `world.generate(Derived, { source: world.registry.all(Source)[0] })`
  THEN the two returned records are `JSON.stringify` byte-identical — `Derived`'s `note` field does not depend on its registration position.

### B130-R3: the derived field-PRNG seed keys on schema reference identity, not the registration ordinal (mechanism requirement)

The `recordId` that seeds the derived record's field PRNG in `generateDerivedRecord`
([src/world/engine.ts:1182](../../src/world/engine.ts#L1182)) MUST be keyed on the
module-global schema reference identity (`getSchemaId(schema)`, the same identity model
B39 adopted), NOT on the registration ordinal `reg.regId`. The recordId MUST retain a
`#<sourceIndex>` suffix so distinct source indices remain distinct draws (B130-R4). The
recordId shape is not a public surface, but the **identity it keys on** is fixed by this
requirement so the implementer cannot reintroduce the ordinal dependence. `reg.regId`
MUST NOT appear in the derived field-PRNG seed.

- Scenario: derived seed depends on the derived schema reference, not its regId
  GIVEN two derived schemas `DerivedA` and `DerivedB` (distinct module-scope references) each registered `from: Source` on the same world, and a stored `source`
  WHEN the consumer calls `world.generate(DerivedA, { source })` and `world.generate(DerivedB, { source })`
  THEN the two records draw from independent field PRNGs (their non-source fields are produced from distinct seeds because `getSchemaId(DerivedA) !== getSchemaId(DerivedB)`), AND re-running B130-R1's `run(false)`/`run(true)` comparison for either schema yields equality (the seed no longer carries `regId`).

### B130-R4: `#<sourceIndex>` suffix semantics preserved — distinct source indices stay distinct

The derived field-PRNG seed MUST continue to incorporate the `sourceIndex` so that
deriving from different source records (different indices) yields independent field draws,
and the same `(D, sourceIndex)` is reproducible across runs of the same seed. Replacing
`regId` with `getSchemaId` MUST NOT collapse or alias distinct source indices.

- Scenario: two source records produce distinct derived field values
  GIVEN `Source = z.object({ id: z.string() })` and `Derived = z.object({ sid: z.string(), tag: z.string() })` at module scope, a world `createWorld({ seed: 3 }).withSchema(Source).withSchema(Derived, { from: Source, unique: false, matchers: { sid: (c) => c.source.id } })`, and two stored sources via `world.populate(Source, 2); const [s0, s1] = world.registry.all(Source);`
  WHEN the consumer calls `const a = world.generate(Derived, { source: s0, unique: false }); const b = world.generate(Derived, { source: s1, unique: false });`
  THEN `a.tag !== b.tag` (distinct source indices drew from distinct field PRNGs) — the suffix still differentiates indices after the identity-keying change.

### B130-R5: B8 per-pair upsert idempotence and identity contract are unaffected

The B8 upsert contract MUST continue to hold after B130: a default-mode
`world.generate(D, { source: x })` repeated with the same identity returns the same stored
instance (`===`), `registry.count(D)` does not grow past 1 for that pair, `{ unique: false }`
still produces fresh records, `sourceKey` look-alike identity still resolves, and
`store: false` derived calls stay fresh and unstored. B130 changes only the field-PRNG
seed of the *generating* call, never the upsert lookup/write or its keying.

- Scenario: same-source upsert still returns the same instance
  GIVEN the B8-R1 setup — `UserSchema`, `UserProfileSchema` (module scope), a world `createWorld({ seed: 42 }).withSchema(UserSchema).withSchema(UserProfileSchema, { from: UserSchema, matchers: { userId: (ctx) => ctx.source.id } })`, and one stored user
  WHEN the consumer calls `const a = world.generate(UserProfileSchema, { source: user }); const b = world.generate(UserProfileSchema, { source: user });`
  THEN `a === b`, `world.registry.count(UserProfileSchema) === 1`, and `a.userId === user.id` (B8-R1 holds unchanged under B130).

- Scenario: `{ unique: false }` still produces distinct fresh records
  GIVEN the same setup with one stored user
  WHEN the consumer calls `const a = world.generate(UserProfileSchema, { source: user, unique: false }); const b = world.generate(UserProfileSchema, { source: user, unique: false });`
  THEN `a !== b` and `world.registry.count(UserProfileSchema)` grew by 2 (B8-R4 holds unchanged under B130).

### B130-R6: `populate` / `populateFrom` and the no-source / array derived paths stay correct

`world.populateFrom(...)`, `world.populate(...)`, the no-source derived auto-source path
([engine.ts:1766](../../src/world/engine.ts#L1766) `generateDerivedAutoSource`), and the
derived-array arm MUST continue to satisfy their existing behavioral contracts after
B130: the round-robin pair pick (`(derivedPairCounter - 1) % pairs.length`), the
`store: false` transitive suppression, the B14 factory path, and D14's uniform array
trailing pass. Their generated **values** will shift once to the order-independent
sequence (expected, acceptable); the **behavioral invariants** (counts, idempotence,
structural validity, store-suppression) MUST stay intact.

- Scenario: `populateFrom` produces one derived record per source and is byte-equivalent across same-seed worlds
  GIVEN `Source` and `Summary` (module scope), two worlds each `createWorld({ seed: 9 }).withSchema(Source).withSchema(Summary, { from: Source, matchers: { sid: (c) => c.source.id } })`, each `world.populate(Source, 3)`
  WHEN each world calls `world.populateFrom(Summary, Source)`
  THEN each world's `world.registry.count(Summary) === 3`, and `JSON.stringify(worldA.registry.all(Summary)) === JSON.stringify(worldB.registry.all(Summary))` (byte-equivalent across two same-seed, same-builder-chain worlds).

- Scenario: no-source derived auto-source path still resolves and stores
  GIVEN `Source` and `Derived` (module scope), a world `createWorld({ seed: 5 }).withSchema(Source).withSchema(Derived, { from: Source, matchers: { sid: (c) => c.source.id } })`, with no source pre-populated
  WHEN the consumer calls `world.generate(Derived)` (no `source` argument)
  THEN it returns a structurally valid `Derived` record (auto-provisions a `Source`), and `world.registry.count(Derived) === 1` (the no-source store path is unchanged).

### B130-R7: regression test pinning the order-independence invariant (D6)

A regression test MUST be added (D6) that fails on the codebase **before** the B130 fix
and passes **after**. It MUST encode the item card's order-based reproduction (B130-R1):
two runs of an identical derived-generate, one with an unrelated `withSchema(...)`
inserted before the derived schema's registration, asserting byte-identical output.

- Scenario: order-based regression test is red before / green after
  GIVEN a new test (location at the test-writer's discretion, e.g. `tests/unit/core/derived-determinism-order.test.ts`) encoding the B130-R1 `run(false) === run(true)` scenario
  WHEN it is run against HEAD before the B130 fix
  THEN it FAILS (`run(false) !== run(true)`); AND WHEN it is run after the implementer keys the derived recordId on `getSchemaId` (B130-R3)
  THEN it PASSES.

### B130-R8: changeset created in the same step

A changeset MUST be created at `.changeset/b130-derived-determinism-coupled-to-registration-order.md`
recording the bump for `"zod4-mock"` with a user-facing summary covering: (a) the
behavioral fix — `from:`-derived records are now order-independent of unrelated prior
registrations; (b) the one-time value shift for existing derived data to the
order-independent sequence; (c) the unchanged surfaces — B8 upsert idempotence,
`unique` / `sourceKey` / `store: false`, `populate` / `populateFrom`, and the registered-
primary path (which is intentionally still `regId`-keyed). Given derived values shift once
for existing users, the bump SHOULD be `minor` (matching B39, which shipped `minor` when a
documented determinism sequence changed under the 0.x SemVer convention); see the
non-blocking open question below.

- Scenario: changeset file exists and is shaped
  GIVEN B130 implemented
  WHEN `.changeset/b130-derived-determinism-coupled-to-registration-order.md` is read
  THEN its frontmatter declares a `"zod4-mock"` bump (`minor` per the rationale above unless the open question resolves otherwise), and the body summarises the order-independence fix, the one-time value shift, and the unchanged surfaces.

## Out of scope

- **The registered-primary path** (`reg${regId}#${recordIndex}`,
  [engine.ts:1142](../../src/world/engine.ts#L1142)) — intentionally keyed on `regId`;
  reordering `withSchema` calls legitimately shifts primary values (B39-R9 "same builder
  chain" caveat). B130 leaves it untouched.
- **The B8 upsert map keying** — already pure `(schema reference, source identity)`; no
  change (B130-R5 only confirms it stays correct).
- **The `derivedPairCounter` round-robin pair picker**
  ([engine.ts:1795](../../src/world/engine.ts#L1795)) — the documented no-source
  derived "cycle through sources" behaviour; B130 does not touch it (carried over
  unchanged from B39-R4 option (a)).
- **`src/prng.ts` / `getSchemaId` / `nextSchemaSlot`** — B130 reuses the existing
  module-global identity infrastructure B39 already built; it does not change the PRNG
  algorithm, the hash, or the identity helper.
- **Re-snapshotting downstream consumers** — out-of-repo; documented in the B130-R8
  changeset rationale (consumers who snapshot derived output re-pin once).
- **The ad-hoc / array / outer-wrapper paths** — already fixed by B39; not revisited.

## Open questions

- **Changeset bump `minor` vs `patch` — Non-blocking.** Recommended `minor` in B130-R8:
  derived field values shift once for existing users (a determinism-sequence change), and
  B39 shipped the analogous fix as `minor` under the 0.x convention. A reviewer could argue
  `patch` since this is strictly a bug fix with no API-surface change. Recorded; the spec
  proceeds with `minor` as the default. Does not change what gets built — purely the bump
  label — so it is non-blocking.

- **Whether B130 promotes a new standing rule — Non-blocking.** D10 already states the
  binding invariant ("call order across distinct schemas MUST NOT affect any value"); B130
  is bringing the derived path into compliance with the *existing* rule, not establishing a
  new one. No new ADR or `architecture.md` rule line is required — D10 covers it. Recorded;
  not blocking. (If the reviewer prefers an ADR cross-reference noting the derived path was
  the last hold-out, that is a documentation nicety, not a new constraint.)

No blocking open questions remain; the spec can advance to `test-writer`.
