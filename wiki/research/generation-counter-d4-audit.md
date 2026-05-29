# `generationCounter` PRNG fork-key audit — D4 implications (2026-05-29)

> Research output for B27. Read-only audit. No code or end-user docs changed.

## Summary

**Yes, the dependency is real.** A stray `world.generate(X)` earlier in a session
shifts the PRNG state observed by subsequent calls that exercise either of two code
paths: (1) the **ad-hoc** branch in [`generateSingleItem`](../../src/world.ts#L1043)
(unregistered schemas), and (2) **every** array generation through
[`generateArray`](../../src/world.ts#L917) — both registered and ad-hoc — because the
array's `genPrng` is seeded by `gen-${counter}`. The outer-wrapper optional/nullable roll
at [world.ts:362](../../src/world.ts#L362) is the third call site. The B22 report's
characterisation is accurate.

**However, the call-order dependence does *not* leak into the two paths that are
actually load-bearing for the library's deterministic-fixtures value proposition.**
Registered primary schemas seed their `recordPrng` from
[`fieldSeed(rootSeed, "reg{regId}#{recordIndex}", "")`](../../src/world.ts#L702-L703),
where `recordIndex` is `registry.count(schema) + pending` — *not* the counter.
Registered derived schemas key off
[`"dreg{regId}#{sourceIndex}"`](../../src/world.ts#L740-L741) — also not the counter.
So `world.populate(Person, N)`, `world.generate(RegisteredSchema)`, and the
registry-driven derived path are all already counter-independent. The counter is
load-bearing only for **(a) ad-hoc primitive/object generation** and **(b) every array
mode (count + per-element PRNG)**.

**Recommendation: Option (a) for now — rename + document.** The mixed picture above is
exactly what makes Option (b) hazardous: changing the fork keys would re-roll every
ad-hoc generation and every array length/element in the test suite (and the
integration tests do exercise both). Option (a) costs almost nothing, codifies the
already-implicit contract that `docs/api-reference.md` and B8-R9 *already* state
("same seed and same call order"), and leaves a clean path for Option (b) as a future
breaking change tied to a major version. If we ever take Option (b), the right shape is
sketched in §"Option (b)" below; file it as a separate `bug` item, not a fold-in to
this audit.

## Background

### What D4 actually says

[`wiki/architecture.md`](../architecture.md) Rule for D4:

> "Generation MUST stay deterministic: per-field PRNG `fork(key)`, so adding/removing a
> field does not disturb other fields. (→ D4)"

The decision entry in [`wiki/decisions.md`](../decisions.md):

> **Context**: Reproducible fixtures are the core value proposition; values must be
> stable when schemas evolve.
> **Decision**: Seed a per-world PRNG and derive per-field generators via `Prng.fork(key)`
> (hash-based child PRNG that does not consume parent state). One world = one seed = one
> dataset.
> **Consequences**: Adding/removing a field does not disturb other fields' values;
> output is identical across runs/machines.

So D4's **letter** is narrow: "per-field `fork(key)`". Its **stated consequence** is
"adding/removing a field does not disturb other fields". The phrase **"one world = one
seed = one dataset"** is the part the B22 report reads as the unstated full intent —
that the *seed alone* determines the data.

### What the docs actually promise

`docs/concepts.md` §Determinism (line 171):

> "Same seed → same output. The PRNG is deterministic (SFC32). Rebuild the world with
> the same seed and **the same builder chain**; you get byte-identical data."

`docs/api-reference.md` (line 90):

> "**seed** — master seed for all generation in this world. The same seed with **the
> same builder chain** always produces byte-identical output."

`docs/api-reference.md` (line 485, on `world.get`):

> "`get` is deterministic for a given seed **and call sequence** and idempotent for a
> repeated predicate."

These are the contracts shipped to users. They already say "same builder chain" and
"call sequence" — that is, **call order is part of the public determinism contract,
not just the seed.** This matters: D4's "spirit" as the B22 report frames it is not
backed by the published documentation. The docs are already explicit that the order of
calls matters.

### What B22 flagged

The codebase-complexity report
[wiki/research/codebase-complexity.md](codebase-complexity.md) §"Dimension 4 → Prng
and fork(key) discipline (D4)" (lines 197-208) and cross-cutting observation #4 (line
230) called this out as the only audit finding that smells like a possible *correctness*
issue rather than a readability one. Proposed item #5 (line 247) gave the option-a /
option-b split this audit resolves.

## The dependency, demonstrated

### The three call sites (verified post-B38)

1. [`src/world.ts:362`](../../src/world.ts#L362) — outer-wrapper optional/nullable roll:
   ```ts
   const prng = this.prng.fork(`gen-wrap-${this.generationCounter + 1}`);
   ```
2. [`src/world.ts:927`](../../src/world.ts#L927) — `generateArray`:
   ```ts
   this.generationCounter++;
   const genPrng = this.prng.fork(`gen-${this.generationCounter}`);
   ```
3. [`src/world.ts:1180`](../../src/world.ts#L1180) — ad-hoc branch of `generateSingleItem`:
   ```ts
   const recordId = `adhoc-${this.generationCounter}`;
   const adHocPrng = this.prng.fork(recordId);
   ```

Counter reads/writes total:
[`src/world.ts:151`](../../src/world.ts#L151) (init `= 0`);
[`src/world.ts:366`](../../src/world.ts#L366) (increment, after wrap-roll),
[`src/world.ts:926`](../../src/world.ts#L926) (increment, top of `generateArray`),
[`src/world.ts:1048`](../../src/world.ts#L1048) (increment, top of
`generateSingleItem`),
[`src/world.ts:1100`](../../src/world.ts#L1100) (decrement, B8/D9 upsert short-circuit),
[`src/world.ts:1171`](../../src/world.ts#L1171) (read, derived-without-source pair
picker: `idx = (counter - 1) % pairs.length`).

### Scenarios

**Scenario A** — single ad-hoc call from a freshly seeded world:

```ts
const X = z.object({ x: z.number().int() });
const w = createWorld({ seed: 42 }).withSchema(X);
const v1 = w.generate(X);
```

Code path:
- `WorldImpl.generate` → schema is an object (not array, not optional/nullable at the
  outer level), so falls through to `generateSingleItem`.
- `generateSingleItem` increments `generationCounter` from `0 → 1`.
- `derivedRegs.length === 0` and `primaryRegs.length === 1` (because `withSchema(X)`).
- Takes the `primaryRegs.length > 0` branch (line 1175), calls
  `generateAndStorePrimary(X, primaryRegs[0])`.
- `generateAndStorePrimary` builds `recordId = "reg0#0"` from `regId=0` and
  `recordIndex = registry.count(X) + pending = 0 + 0 = 0`. Counter is **not read**.
- `recordPrng = createPrng(fieldSeed(rootSeed, "reg0#0", ""))`. **Seed-and-shape-stable.**

So in Scenario A, `v1` is determined entirely by `rootSeed` + the schema's regId +
the recordIndex `0` — not by the counter.

**Scenario B** — intervening generate on Y:

```ts
const X = z.object({ x: z.number().int() });
const Y = z.object({ y: z.number().int() });
const w = createWorld({ seed: 42 }).withSchema(X).withSchema(Y);
w.generate(Y);
const v1 = w.generate(X);
```

Code path:
- `withSchema(Y)` assigns `regId=1` to Y (X is `regId=0`).
- `w.generate(Y)`: `generateSingleItem` increments counter `0 → 1`,
  `generateAndStorePrimary(Y)` runs with `recordId = "reg1#0"`. **No counter read.**
- `w.generate(X)`: `generateSingleItem` increments counter `1 → 2`,
  `generateAndStorePrimary(X)` runs with `recordId = "reg0#0"`. **No counter read.**

So `v1` in Scenario B *equals* `v1` in Scenario A. The registered-primary path is
counter-insensitive.

**Scenario C** — same setup but X is **not** registered (ad-hoc):

```ts
const X = z.object({ x: z.number().int() });
const Y = z.object({ y: z.number().int() });
const w = createWorld({ seed: 42 }).withSchema(Y); // X NOT registered
const v1 = w.generate(X);                          // counter goes 0 → 1
// elsewhere…
const v1Prime = createWorld({ seed: 42 }).withSchema(Y).generate(Y).then(_ =>
  // counter went 0 → 1 then 1 → 2; ad-hoc X seeds off `adhoc-2`
  w2.generate(X)
);
```

Here `generateSingleItem` falls into the **ad-hoc** branch:
[`src/world.ts:1180`](../../src/world.ts#L1180):

```ts
const recordId = `adhoc-${this.generationCounter}`;
const adHocPrng = this.prng.fork(recordId);
```

In the first variant the counter is `1` → `recordId = "adhoc-1"`. In the second
variant the counter is `2` → `recordId = "adhoc-2"`. The two ad-hoc PRNGs are
independent forks of the world PRNG with **different keys**, so `v1 !== v1Prime`.
**The dependence is real on the ad-hoc path.**

**Scenario D** — arrays (both ad-hoc and registered):

`generateArray` *always* derives its `genPrng` from `gen-${counter}`. That `genPrng`
picks the array length ([line 989](../../src/world.ts#L989) primary mode and
[line 1013](../../src/world.ts#L1013) ad-hoc mode) and forks every per-element PRNG
([line 1016](../../src/world.ts#L1016)). So if you add an intervening
`world.generate(SomethingElse)` before a `world.generate(ArraySchema)`, the array's
length and every element's PRNG shift — even when the element type is a registered
primary.

The element bodies, if registered, recover their stable `recordId = "reg{id}#{i}"`
inside `generateAndStorePrimary` — but the *array length* and the *element ordering
order* still ride on the counter-derived `genPrng`. For ad-hoc array elements there is
no recovery: the entire element PRNG tree is rooted at the counter-derived `genPrng`.

**Verdict**: the dependence is real on (ad-hoc generation) + (every array's length
picker and element PRNG seeding) + (outer-wrapper optional/nullable rolls). It is
**not** present on the registered-primary and registered-derived record paths because
their `recordPrng` is seeded off `registry.count(schema)` and `sourceIndex` —
counter-free identities.

### One existing test already encodes call-order semantics

[`tests/unit/core/derived-identity.test.ts:496-538`](../../tests/unit/core/derived-identity.test.ts#L496)
("B8-R9: upsert short-circuit does not consume PRNG") deliberately uses an
**unregistered** `AdHocSchema = z.object({ x: z.number().int() })` to expose the
counter dependence — its comment explicitly states:

> "Ad-hoc generation uses `adhoc-${this.generationCounter}` as its recordId seed
> source (src/world.ts), so any PRNG-state shift made by the upsert call WOULD shift
> this output. Registered primary schemas seed their recordPrng off
> `registry.count(schema)` (D4 per-record determinism), so they are insensitive to
> whether one extra intervening derive happened — that's why we use an ad-hoc schema
> here."

This is the most explicit acknowledgement in the codebase that **per-record
determinism for registered schemas is counter-independent, but ad-hoc generation
participates in call-order state**. The test author understood the picture exactly.

## Intentional or incidental?

The counter has three load-bearing uses, only one of which is unambiguously
*intentional design*:

1. **Counter-as-round-robin in the derived-without-source path** (intentional,
   line 1171: `idx = (counter - 1) % pairs.length`). Here the counter gives the
   classic "cycle through available sources" behaviour: call `generate(Profile)`
   four times, get profiles paired with sources 0, 1, 2, 3 in order. This is the
   documented behaviour in `docs/api-reference.md` (the "cycle through sources"
   guarantee for derived schemas). Removing the counter here would break a published
   contract.

2. **Counter-as-unique-name in the ad-hoc PRNG fork key** (incidental, line 1180:
   `adhoc-${counter}`). The job of this key is *only* to give each top-level call a
   distinct PRNG fork so that `w.generate(X); w.generate(X)` on an ad-hoc schema
   returns two different values. There is nothing about "counter" specifically that
   matters — any stable per-call identity would do. The counter was the cheapest
   readily-available identity at the time it was written.

3. **Counter-as-unique-name in the array `genPrng` and the outer-wrapper roll**
   (incidental, lines 927 and 362). Same story as #2 — the counter's only role is to
   make each call distinct. Schema identity + per-schema counter would do the same
   job without leaking call order.

D9's decision entry ([`wiki/decisions.md` D9](../decisions.md), lines 167-196) is the
only place the counter has been formally reasoned about in the wiki. D9 codifies the
*compensation* rule (cache short-circuits roll back any counter increments) — i.e. it
treats the counter as a load-bearing piece of state but does not justify *why* the
fork keys are counter-based in the first place. B8-R9 in
[`wiki/specs/B8-derived-schemas-identity.md`](../specs/B8-derived-schemas-identity.md)
line 362 says "byte-identical across runs of the same world seed and **same call
order**" — confirming that the spec author understood call-order to be part of the
contract.

So: use **#1 is intentional and contract-bound**. Uses **#2 and #3 are incidental** —
the counter happened to be a stable per-call distinguisher and was reused. The B22
report's complaint is about #2 and #3, not #1.

## What D4 requires

**Letter**: per-field `fork(key)`, adding/removing a field does not disturb other
fields. Both #2 and #3 above satisfy the letter: `gen-N` and `adhoc-N` are still
`fork(key)` calls; adding a field to schema X does not perturb the values of other
fields *within the same `generate(X)` call*.

**Stated consequence**: "one world = one seed = one dataset". This is the phrase the
B22 report reads as the unstated full intent. But this phrase appears in
`docs/concepts.md` and `wiki/decisions.md` D4 right next to "same builder chain", and
the actual user-facing contract in `docs/api-reference.md` line 90 reads "same seed
**with the same builder chain**" — and in line 485 reads "deterministic for a given
seed **and call sequence**". The docs already concede call order matters.

**Unwritten spirit**: "the seed alone determines the data". This is **not** documented
anywhere. The B22 report invented this framing. It's a plausible interpretation, but
it is not what the wiki, the specs, or the user docs say today.

So: the counter-based fork keys are a **soft violation of the B22 report's framing**
of D4's spirit. They are **not** a violation of D4 as written, nor of the
user-facing determinism contract.

## Option (a) — document the call-order semantics

### Churn estimate

Renaming `generationCounter → callCounter` is mechanical. Per the grep at the top of
this report, there are 9 occurrences in `src/world.ts`, plus references in:

- [`tests/unit/store-false-empty-from.test.ts:15`](../../tests/unit/store-false-empty-from.test.ts#L15) — comment.
- [`tests/unit/core/derived-identity.test.ts:500`](../../tests/unit/core/derived-identity.test.ts#L500) — comment.
- [`wiki/decisions.md`](../decisions.md) D9 — three references in the decision text.
- [`wiki/specs/B20-store-false-empty-from-crash.md`](../specs/B20-store-false-empty-from-crash.md) — four references.
- [`wiki/specs/B16-surface-key-match-list.md`](../specs/B16-surface-key-match-list.md) — two references.
- [`wiki/research/codebase-complexity.md`](codebase-complexity.md) — three references.

None of these are user-facing — `generationCounter` is a private field. The rename
is comment-only outside `src/world.ts`. Total: a few dozen line edits, no test
re-pins, no behaviour change. Reviewer can verify in a single read.

### Proposed Rule addition to `wiki/architecture.md`

Insert after the existing D4 rule, before D5:

> Generation determinism is **per-(seed + builder chain + call sequence)**: the same
> seed, same `withSchema`/`withGenerators` chain, and same sequence of `generate` /
> `populate` calls produce byte-identical output. Call order is part of the contract;
> reordering `world.generate(X); world.generate(Y)` to `world.generate(Y);
> world.generate(X)` MAY change the values of either. Registered-primary and
> registered-derived records are call-order-insensitive within their own
> `registry.count`-keyed slots; ad-hoc generation and array length/element rolls are
> call-order-sensitive. (→ Dn)

(Number to be assigned when promoted — D10 at time of writing.)

### Proposed ADR entry for `wiki/decisions.md`

```
## Dn: Call order is part of the deterministic-generation contract

- **Date**: 2026-05-29
- **By**: researcher (B27)
- **Context**: B22 flagged `WorldImpl.generationCounter`-derived PRNG fork keys at
  src/world.ts:362 (`gen-wrap-${counter+1}`), :927 (`gen-${counter}` array genPrng), and
  :1180 (`adhoc-${counter}` ad-hoc PRNG) as a soft violation of D4's spirit, because
  inserting a stray `world.generate(X)` earlier in a session shifts the counter and
  therefore those forks. B27 audited and confirmed the dependence is real for the
  ad-hoc path, every array (count + element PRNG), and the outer-wrapper optional
  roll — but NOT for registered-primary or registered-derived records (their
  `recordPrng` is seeded from `registry.count(schema)` and `sourceIndex`, both
  counter-free identities). The user-facing docs (`docs/api-reference.md` lines 90 and
  485) already say "same builder chain" and "deterministic for a given seed and call
  sequence", and spec B8-R9 says "same call order" — so call-order-as-contract is
  already implicit. This decision makes it explicit.
- **Decision**: Deterministic generation is contracted on (seed + builder chain +
  call sequence), not seed alone. Adding or reordering `generate` / `populate` calls
  MAY change the values of ad-hoc generations, array lengths and elements, and outer
  optional/nullable rolls; registered primary/derived records remain stable because
  their PRNG is keyed on registry-count and source-index identities. The
  `WorldImpl.generationCounter` field is renamed to `callCounter` to reflect this.
- **Consequences**: No code behaviour changes. The contract that was already
  implicit in the docs becomes explicit in the wiki rules. Future audits can
  reference this rule when adding call sites that would be tempted to use the
  counter. If we later decide call-order independence is a feature worth pursuing
  (Option (b) in `wiki/research/generation-counter-d4-audit.md`), this entry
  is superseded by the new one.
- **Rule added/changed**: "Generation determinism is per-(seed + builder chain + call
  sequence): same seed + same withSchema/withGenerators chain + same sequence of
  generate/populate calls produce byte-identical output. Registered records are
  call-order-insensitive within their registry-keyed slots; ad-hoc + array + outer
  optional/nullable paths are call-order-sensitive."
- **Supersedes**: none (extends D4)
```

### Pros / cons

**Pros**:
- Zero behavioural change; zero risk of test re-pins.
- Codifies what the user docs already say.
- Names the contract so future contributors don't introduce *new* counter-based fork
  keys without realising they are joining a load-bearing call-order chain.
- Keeps Option (b) on the table as a future major-version change.

**Cons**:
- Codifies a slightly weaker contract than "seed alone determines data".
  Anyone building a fixture system on top of this who *assumed* the stronger version
  has to read the new rule. (Mitigation: no public surface exists today that exposes
  call-order independence as a feature; this is a documentation correction, not a
  removal.)
- The rename `generationCounter → callCounter` causes a few churn-y diffs in wiki
  pages that reference the old name. (Mitigation: this is one mechanical search-replace
  done at the same time.)

## Option (b) — replace counter with stable identity-based fork keys

### Implementation sketch

The three call sites can each be replaced with a schema-identity + per-schema index
fork key:

```ts
// Add a per-schema call counter:
private readonly schemaCallCounts: Map<ZodTypeAny, number> = new Map();

private nextSchemaIndex(schema: ZodTypeAny): number {
  const n = (this.schemaCallCounts.get(schema) ?? 0) + 1;
  this.schemaCallCounts.set(schema, n);
  return n;
}

// Site 1 (outer-wrapper roll, line 362):
const i = this.nextSchemaIndex(schema);
const prng = this.prng.fork(`wrap:${schemaKey(schema)}:${i}`);

// Site 2 (generateArray, line 927):
const i = this.nextSchemaIndex(arraySchema);
const genPrng = this.prng.fork(`array:${schemaKey(arraySchema)}:${i}`);

// Site 3 (ad-hoc, line 1180):
const i = this.nextSchemaIndex(schema);
const recordId = `adhoc:${schemaKey(schema)}:${i}`;
const adHocPrng = this.prng.fork(recordId);
```

`schemaKey` needs to be a stable string for a given schema reference. The natural
choice is reference identity via a `WeakMap<ZodTypeAny, number>` that mints a
monotonically increasing integer the first time we see each schema. This produces
a stable per-world key without requiring the schema to expose any identifier.

After this change, **the Nth `world.generate(X)` always uses the same fork key
regardless of what other `generate(Y)`/`generate(Z)` calls happened between
them** — exactly the "seed-alone-determines-data" contract the B22 report wanted.

### What breaks

1. **Every existing pinned test value on the three counter-bearing paths.** I have
   not exhaustively enumerated, but the integration tests (`tests/integration/*`)
   exercise arrays heavily and pin specific shapes. Every snapshot that depends on
   an array's length or per-element output would shift. Same for any test that
   constructs an ad-hoc unregistered schema and asserts a specific generated value.
   A test-writer would need to re-pin systematically. Risk: medium — the test count
   is high (the codebase-complexity report notes 906 tests at B8 time).
2. **The `idx = (counter - 1) % pairs.length` round-robin at
   [src/world.ts:1171](../../src/world.ts#L1171) is a use #1 — intentional
   behaviour, documented as part of the derived-schema contract.** It MUST keep
   working. Either (i) leave a `derivedCallCounter` field for this single use,
   distinct from the per-schema counters; or (ii) replace the global counter here
   with a per-derived-pair counter (`Map<DerivedSchema, number>` of calls). Option
   (ii) is purer but changes the cycling behaviour when the derived registration
   list grows mid-session. Either way, this site is not a fork-key issue — it's
   a "pick the Nth source" issue, and the counter is doing meaningful work there.
3. **B8 / D9 compensation pattern** ([src/world.ts:1100](../../src/world.ts#L1100)).
   The upsert short-circuit currently does `this.generationCounter--` to keep
   cache-hit and cache-miss paths in lockstep. With per-schema counters, the
   `generateSingleItem` increment moves into the schema-specific counter slot, and
   the same compensation pattern applies one level down — straightforward to port.

### Consistency with B8

B8 already keys its upsert map on `(DerivedSchema, source-identity)` pairs — pure
source-identity, no counter. Option (b) moves the rest of the generation pipeline
toward the same identity-based model. There is no conflict; if anything, Option (b)
makes the world's PRNG-keying discipline consistent with B8's already-implemented
per-source-identity model.

### Recommendation for Option (b)

If we take it, **do not implement it in this audit**. The shape is correct but the
behaviour change is too broad to fold in as a side effect. The right path is a
follow-up `bug` (or `feature`, depending on framing) item that goes through the full
spec → tests-first → implement → review pipeline. The spec should pin the new
behaviour as a published contract change, the tests-first step should explicitly
re-pin all affected snapshots from the new PRNG state, and the changeset should
flag this as a **minor** bump if we want to call it a feature, or stay **patch** only
if the public observable values shift but no API surface does. The decision on bump
type belongs in the spec, not here.

## Recommendation

**Option (a) — rename + document.** Reasons:

1. The user-facing docs (`docs/api-reference.md` lines 90 and 485) **already** say
   "same builder chain" and "deterministic for a given seed and call sequence". The
   stronger interpretation B22 invoked ("seed alone determines data") is not in fact
   what we ship. Option (a) brings the wiki Rules section into alignment with the
   user docs.
2. The cost of Option (b) is paid in test re-pinning across the whole suite, and
   the **benefit** is largely conceptual — the published contract already says call
   order matters. A future major version is a more honest moment to pay that cost.
3. Option (a) **doesn't close the door** on Option (b) — it just makes the
   call-order contract explicit and stops it from being an unstated foot-gun for
   the next person who touches `world.ts`. We can supersede the new ADR with a
   stronger one when we're ready.
4. The B22 report's strongest charge — that the counter is "a hidden global,
   reads as call-order state" (cross-cutting observation #4) — is fixed by the
   rename `generationCounter → callCounter`. The variable name *was* the
   confusing part: "generation counter" reads as "number of records generated"
   when it actually counts top-level call sites.

### Follow-up backlog item to file (only if we change our minds)

If during review the user decides Option (b) is the right path after all, file
this item via `/intake`:

> **Title**: B?? — replace `callCounter`-derived PRNG fork keys with stable
> per-schema identity-based ones (D4 strengthening).
> **Type**: bug (correctness, although behaviour-stable from the user's perspective).
> **Priority**: medium — possible correctness smell, but B22's evidence is
> readability/spirit, not a reproducer of broken output.
> **Size**: M for the change + S for the snapshot re-pinning across `tests/unit/`
> and `tests/integration/`.

## Out of scope

- **The `(counter - 1) % pairs.length` derived round-robin at line 1171.** This is
  intentional contract behaviour, separate from the fork-key question. It would only
  need a refactor if Option (b) is taken, and then the right shape is a
  derived-pair-specific counter (sketched above).
- **The `Prng` algorithm change from Mulberry32 to SFC32.** The codebase has already
  moved to SFC32 (per [src/prng.ts](../../src/prng.ts) docstring), but `CLAUDE.md`
  and [wiki/codebase-map.md](../codebase-map.md) still describe Mulberry32. That's a
  separate drift; flag it for a future `/wiki-sync` pass.
- **The cluster of distinct fork-key conventions** (`gen-N`, `gen-wrap-N`,
  `rel:relName`, `rel-many:relName`, `jwt-p`, `jwt-s`, `el-${i}`, `t-${i}`,
  `[${i}]`, etc.) flagged in B22. They are not a correctness issue, just a
  consistency / discoverability one. A future `chore` could collect them into a
  named-constants module if it ever bites.
- **Recommending whether to actually take Option (b) in the future.** This audit
  recommends (a) now and lays out (b) as a viable future change; the timing call on
  whether to ever take (b) belongs in a future architecture review, not this report.
