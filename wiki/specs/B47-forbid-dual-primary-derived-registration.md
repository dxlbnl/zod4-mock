# B47: BUG — forbid dual primary+derived registration of the same schema at `withSchema` time

## Context

Follow-up to **B41** research
([wiki/research/engine/populate-dispatch-divergence.md](../research/engine/populate-dispatch-divergence.md)).
The library has four dispatch sites (`generate` single, `generate` array, `get`,
`populate`) that each classify a registered schema as `derived` / `primary` / `ad-hoc`.
Three of them check derived first (via `resolveMode` in
[src/world/registration.ts](../../src/world/registration.ts) lines 129–138); `populate`
inverts the cascade with an explicit `findPrimaryRegs` pre-check
([src/world/engine.ts](../../src/world/engine.ts) lines 600–613). The asymmetry is
**only observable** when one schema reference is registered as **both** primary
(`withSchema(S)`) and derived (`withSchema(S, { from: T })`) on the same world —
otherwise every dispatcher agrees by construction. There is no spec, no ADR, and no
test that codifies the dual-registration configuration; B41 §3 confirmed zero in-repo
call sites exercise it.

B41's recommendation is **Option D — forbid dual registration at `withSchema` time**:

> The conceptual problem isn't "which precedence is right" — it's "the same schema is
> two things at once". Pinning precedence (A or B or C) accepts the ambiguity and picks
> a side. D refuses the ambiguity. Once D ships, all four dispatchers can use
> `resolveMode` directly with no special cases — `populate`'s explicit pre-check goes
> away as a natural consequence (since the inverted-precedence configuration can no
> longer exist). [B41 §5]

> Better error surface. Today: silent latent divergence. Under D: a clear error at the
> second `withSchema` call, with the schema identity and the conflicting `from:`
> polarity in the message. The user finds out at setup time instead of debugging a
> "populate says X, generate says Y" disagreement. [B41 §5]

The throw fires inside `WorldImpl.withSchema`
([src/world/engine.ts](../../src/world/engine.ts) line 537) **before** the new
`SchemaReg` is appended to `this.schemaRegs` (line 553). Polarity is determined by:

- The **incoming** registration's polarity from the call arguments: `opts?.from !==
undefined` ⇒ derived; otherwise primary.
- The **existing** registrations' polarity from `findPrimaryRegs(this.schemaRegs,
schema).length > 0` and `findDerivedRegs(this.schemaRegs, schema).length > 0`
  ([src/world/registration.ts](../../src/world/registration.ts) lines 104–116).

When the polarities differ, `withSchema` throws and the registration array is unchanged
(no partial state, the next `withSchema` call sees the pre-throw `schemaRegs` exactly).

The item card pins the four acceptance requirements (R1–R4); this spec turns each into
an observable `GIVEN/WHEN/THEN` scenario without changing scope. Cross-checked against
the related specs:

- **B6** (`world.get`) — composes on `find` + `generate` and uses
  `resolveMode(schema).kind !== "ad-hoc"` only as a registered/not predicate
  ([src/world/engine.ts](../../src/world/engine.ts) line 791). No requirement of B6
  exercises a schema dual-registered as both primary and derived; B6's contract is
  preserved.
- **B8** (derived schema identity / source-keyed upsert) — operates entirely on the
  derived registration of a schema; never asks "is this schema also primary". B8's
  contract is preserved.
- **B10** (`{ store: false }` ephemeral opt-out) — orthogonal to registration polarity;
  preserved.
- **B11** (`relations`) — a schema appearing in another schema's `relations: { name:
Schema }` declaration is **not** a registration of `Schema`; it is a relation target
  referenced by the _outer_ schema's registration. B11 is preserved.
- **B14** (`populate` factory) — the factory wires `GenerateOptions` into the
  dispatcher, and the dispatch precedence inside `populate` (B41 §1, Site 4) is what
  this throw makes irrelevant. B14's contract is preserved; the inverted-precedence
  path becomes unreachable as a configuration consequence (cleanup of `populate`'s
  pre-check is out of scope for B47 — the throw alone is the bug fix).

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B47-R1: derived-after-primary registration MUST throw

`WorldImpl.withSchema` MUST throw an `Error` when the incoming registration is
**derived** (`opts?.from !== undefined`) and the same schema reference (by identity)
already has at least one **primary** registration on the world (i.e.
`findPrimaryRegs(this.schemaRegs, schema).length > 0`). The throw MUST happen before
the new `SchemaReg` is appended to `this.schemaRegs`, so `this.schemaRegs` is
unchanged after the failed call. The thrown `Error`'s message MUST mention the polarity
conflict (the exact wording is the implementer's call — see Open questions).

- Scenario: order-invariant polarity conflict throws either way (regression — one test
  covers both call orders)
  GIVEN a world `const world = createWorld({ seed: 1 })` and two schemas
  `const Person = z.object({ id: z.uuid(), name: z.string() })` and
  `const Company = z.object({ id: z.uuid(), name: z.string() })`
  WHEN the consumer registers `Person` as primary then derived
  (`world.withSchema(Person); world.withSchema(Person, { from: Company });`) — and
  separately, on a fresh world, registers `Person` as derived then primary
  (`world.withSchema(Person, { from: Company }); world.withSchema(Person);`)
  THEN **both** second-`withSchema` calls throw an `Error` (assert via
  `expect(...).toThrow(Error)`), and in each case the surviving `schemaRegs` length is
  `1` (only the first, accepted registration is present). One test covers R1 and R2
  together (see Minimum-tests directive below).

### B47-R2: primary-after-derived registration MUST throw the same way

`WorldImpl.withSchema` MUST throw an `Error` when the incoming registration is
**primary** (`opts?.from === undefined`) and the same schema reference already has at
least one **derived** registration on the world (i.e. `findDerivedRegs(this.schemaRegs,
schema).length > 0`). The throw MUST happen before the new `SchemaReg` is appended.
The behaviour MUST be symmetric with R1 — order-invariance is the point.

- Scenario: covered jointly with R1
  See R1's scenario — the same test exercises both `withSchema(Person);
withSchema(Person, { from: Company });` and the reversed order
  `withSchema(Person, { from: Company }); withSchema(Person);`, asserting both throw.
  Per the Minimum-tests directive (see Notes below), R1 and R2 share **one** test, not
  two — they are the same throw rule observed from opposite incoming polarities.

### B47-R3: same-polarity re-registration MUST NOT throw

`WorldImpl.withSchema` MUST NOT throw when the same schema reference is registered a
second time with the **same** polarity as an existing registration — two primary
registrations (`withSchema(S); withSchema(S);`), or two derived registrations from any
source (`withSchema(S, { from: T1 }); withSchema(S, { from: T2 });`, or even
`withSchema(S, { from: T }); withSchema(S, { from: T });`). The existing
multi-primary semantics ("most recent registration wins for matchers", documented
inline at `engine.ts:744–747`) are out of B47's scope and MUST be preserved verbatim.
The multi-derived pattern (the media-library `RawDataSchema` case — B41 §3) MUST also
be preserved.

- Scenario: same-polarity re-registration does not throw
  GIVEN a world `const world = createWorld({ seed: 1 })` and schemas
  `const Person = z.object({ id: z.uuid(), name: z.string() })`,
  `const Company = z.object({ id: z.uuid(), name: z.string() })`,
  `const Org = z.object({ id: z.uuid(), name: z.string() })`
  WHEN the consumer performs two primary registrations
  (`world.withSchema(Person); world.withSchema(Person);`) and, on a second fresh
  world, two derived registrations from different sources
  (`world.withSchema(Person, { from: Company }); world.withSchema(Person, { from: Org });`)
  THEN neither call throws (assert via `expect(...).not.toThrow()`), and the final
  `schemaRegs` length is `2` on each world (both registrations are present).

### B47-R4: non-registration appearances MUST NOT throw

`WorldImpl.withSchema` MUST NOT throw based on a schema's appearance in another
schema's `relations:` declaration (B11 `RelationEntry`) or as another schema's `from:`
source. Relations are not registrations of the relation target, and a `from:` source
schema's own registration polarity is independent of the derived registration that
references it.

- Scenario: relation-target and from-source roles do not trigger the throw
  GIVEN a world `const world = createWorld({ seed: 1 })` and schemas
  `const Post = z.object({ id: z.uuid(), title: z.string() })`,
  `const Comment = z.object({ id: z.uuid(), postId: z.uuid() })`,
  `const Summary = z.object({ id: z.uuid(), title: z.string() })`
  WHEN the consumer registers `Post` as primary, then registers `Comment` as primary
  with `relations: { post: Post }`, then registers `Summary` as derived with
  `from: Post` (so `Post` appears once as a registered primary, once as a relation
  target, and once as a derivation source — three roles, but **only one** registration
  of `Post` itself)
  THEN none of the three `withSchema` calls throws (assert via
  `expect(...).not.toThrow()`), and the final `schemaRegs` length is `3` (one entry
  per registration: `Post` primary, `Comment` primary, `Summary` derived).

## Minimum tests directive

Per the [[feedback-minimal-tests]] rule and the item card's reinforcement: this spec
drives a test file with **~3 tests total**, not four. The covering test count is:

| Test | Covers  | What it asserts                                                                                                                                                                 |
| ---- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | R1 + R2 | Throws on polarity mismatch in **both** call orders (primary-then-derived and derived-then-primary). One test, two `expect(...).toThrow(Error)` assertions on two fresh worlds. |
| 2    | R3      | Same-polarity re-registration does **not** throw (two primary + two derived sub-cases).                                                                                         |
| 3    | R4      | Relation-target / from-source / mixed-role appearances do **not** throw.                                                                                                        |

The test-writer MUST NOT split R1 and R2 into separate tests — they are the same throw
rule observed from opposite incoming polarities; that fact is itself part of the
contract.

## Out of scope

- **Multi-primary tightening.** Re-registering the same schema as primary a second time
  ("last `withSchema` wins for matchers", documented inline at
  [src/world/engine.ts](../../src/world/engine.ts) lines 744–747) is unchanged. B47
  only addresses the **polarity mismatch** axis. If the team later decides multi-primary
  is a footgun, that is a separate item.
- **Multi-derived from different sources.** `withSchema(S, { from: T1 })` followed by
  `withSchema(S, { from: T2 })` is the media-library fan-in pattern (B41 §3) and is
  preserved. B47 does **not** narrow this.
- **A schema appearing in another schema's `relations:`.** Relations are not
  registrations of the relation target — B11's `RelationEntry` documents the relation
  on the _outer_ schema's registration. B47's throw does not consult the outer
  schema's `relations:` field.
- **A schema appearing as another schema's `from:` source.** The source schema can
  itself be registered however the user wants — primary, derived from yet another
  source, or unregistered. B47 does not constrain the source's own polarity.
- **Self-referential `from:` (`withSchema(S, { from: S })`).** Distinct edge case
  (same schema reference filling both the incoming and source roles); not the dual
  primary+derived case B47 forbids and not addressed here.
- **Removing `populate`'s primary-first pre-check at
  [src/world/engine.ts](../../src/world/engine.ts) lines 606–613.** Once B47 lands, the
  dual-registration configuration that motivated the pre-check can no longer exist, so
  the explicit check becomes dead code. Cleaning it up is a separate follow-up
  (chore-class — code-only, no behavioural change); B47 only adds the throw.
- **Public docs update.** No `docs/api-reference.md` change is required: the dual
  configuration was never documented as a feature, so there is no doc paragraph that
  becomes wrong. (Confirmed under Notes.)

## Open questions

- **Throw-message wording — Non-blocking.** Final wording is the implementer's call
  (B41 Open question #4). The card and Context above pin the constraint: the message
  MUST mention the schema's polarity conflict — naming `S`, the existing polarity, and
  the incoming polarity, with a hint pointing the user at the resolution ("declare a
  distinct schema reference for the other role"). Recorded; not blocking.
- **Changeset bump shape — Non-blocking.** `patch` per user direction (B41 Open
  question #3). No observable change to any non-pathological caller; the configuration
  the throw forbids has no in-repo test, doc, or call site. A `minor` bump would only
  be warranted if the team chooses to surface "primary+derived dual registration is
  now an error" as a release-note line; user's direction is `patch`. Recorded; not
  blocking.
- **Multi-primary tightening — Non-blocking (deferred by user).** Whether `withSchema`
  should also reject `withSchema(S); withSchema(S);` (two primary registrations of the
  same reference, last-write-wins for matchers today) is a separate axis the card
  explicitly defers. B47 does not change this behaviour. Recorded; not blocking.

No blocking open questions remain; the spec can advance to `test-writer`.

## Standing constraint candidate

**Proposed rule (verbatim from the item card):** "A schema MAY be registered only as
one of primary OR derived; mixing throws at `withSchema` time."

Rationale: this is a constraint **future work must obey** — every new dispatch site,
every new `withSchema` variant, every new resolver helper must assume a schema's
polarity is unambiguous at registration time. It is therefore a candidate for the
binding **Rules** index in `architecture.md` paired with a new ADR (proposed `D12`).
The reviewer confirms or rejects this on close; the **manager** promotes it to the
Rules section and writes the ADR when B47 lands (per the workflow: subagents flag,
reviewer confirms, manager promotes).

## Notes

- **No public API change.** `withSchema`'s signature is unchanged; the throw is a
  runtime tightening of an existing call. No `docs/api-reference.md` edit is required
  (D5 not triggered).
- **No `any`.** The throw site uses `opts?.from !== undefined` (plain JS narrowing on
  the existing `SchemaOpts<TSchema, TSource, TRelations>` type parameter) and the
  already-`unknown`-safe `findPrimaryRegs` / `findDerivedRegs` helpers. No `any` is
  introduced (D1).
- **No Zod-internals touch.** The polarity check reads `opts?.from`, the user-facing
  registration argument — not `schema._zod.def`. D3 is not exercised by this change.
- **Regression test required (D6).** The R1+R2 covering test (primary-then-derived
  AND derived-then-primary both throw) IS the regression test for the latent B41
  divergence. No separate regression test is needed.
- **Pipeline untouched (D11).** B47 does not touch `src/pipeline.ts` or any per-field
  step — the throw fires at registration time, before any field-level pipeline runs.
- **Determinism untouched (D4 / D10).** The throw consumes no PRNG state and changes
  no schema-identity or per-schema call-index bookkeeping.
- **Registry storage rule untouched (D8).** The throw runs before any record is
  generated or stored, so D8's "registry storage equals `generate`'s return value" is
  not exercised.
- **Cache neutrality untouched (D9).** The throw is not a cache short-circuit; D9
  doesn't apply.
- **`prepublishOnly` untouched (D7).** Not a packaging change.
