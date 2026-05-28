# B11: `relations` should support a `where` predicate to filter the candidate pool

## Context

`relations:` on `withSchema` lets a matcher pick a related record from the registry —
[src/world.ts](../../src/world.ts)'s `resolveRelated` (single pick) and
`resolveRelatedMany` (B5 — many pick) both read the candidate pool from
`this.registry.all(relSchema)`. Today the **only** pool the resolver knows is the
relation schema's **full** registry: a `Comment` with `relations: { post: PostSchema }`
can be related to any post, even one whose `kind === 'draft'`. The card surfaces this
gap: real domains type-segment their entities (orders by status, files by mime-type,
posts by kind) and the relation almost always wants a slice.

Today's two workarounds both lose something:

- `ctx.registry.all(schema)` + `ctx.prng.sample(...)` bypasses `relations:` entirely so
  the schema stops documenting "Comment relates to Post" and auto-provision is gone.
- Calling `ctx.related(name)` repeatedly returns the same pick (record-scoped cache in
  `relationPools`, keyed `${recordId}:${relName}` and `${recordId}:${relName}:many`),
  so filtering at the matcher level still picks from the full pool first.

This item extends the existing bare-schema declaration with an **object form** that
carries a `where` predicate:

```ts
world.withSchema(CommentSchema, {
  relations: {
    post: { schema: PostSchema, where: (p) => p.kind === 'article' },
  },
  matchers: { postId: (ctx) => ctx.related('post').id },
});
```

`ctx.related.many` (B5) honours the same predicate:

```ts
world.withSchema(DigestSchema, {
  relations: {
    items: { schema: PostSchema, where: (p) => p.kind === 'article' },
  },
  matchers: { posts: (ctx) => ctx.related.many('items', 5) },
});
```

The bare-schema form (`relations: { post: PostSchema }`) is preserved unchanged.

### How the real implementation grounds these requirements

The requirements below are written against the **actual** code, not illustrative
sketches:

- **Declaration shape.** `SchemaOpts.relations` is currently
  `relations?: TRelations` where `TRelations extends Record<string, ZodTypeAny>`
  ([src/types.ts](../../src/types.ts) lines 226, 235). The B11 change makes a relation
  entry accept **either** a `ZodTypeAny` (bare-schema form, today) **or** an object
  `{ schema: ZodTypeAny, where?: (item: z.infer<RelationSchema>) => boolean }`. The
  internal `SchemaReg.relations` field in `WorldImpl` (today
  `Record<string, ZodTypeAny>`) stays a normalised record — the parser in
  `withSchema` discriminates the two shapes once at registration time and stores a
  normalised `{ schema, where? }` shape internally; resolvers see one shape, not two.
- **Discriminator.** The object form is detected by a **runtime check**: an entry that
  is an object **with an own `schema` property whose value is a Zod schema** is the
  object form. (A `ZodTypeAny` is itself an object, but it does not have a `schema`
  property pointing at another schema.) The TypeScript surface is expressed as a
  discriminated union of "a `ZodTypeAny`" vs. "an object with `{ schema, where? }`"; no
  `any` (Rules → D1).
- **Predicate input type — B7.** Per [B7](B7-registry-output-typing.md) (B7-R1), the
  registry's read side returns `z.infer<T>` (the **output** shape). The pool the
  predicate filters comes from `this.registry.all(relSchema)`, which is now typed
  `z.infer<RelationSchema>[]`. The `where` parameter type is therefore
  `(item: z.infer<RelationSchema>) => boolean`. No cast at the matcher call site, no
  `any` (Rules → D1).
- **Filter site.** The filter applies to the candidate pool *before* sampling — in
  `resolveRelated` immediately before the `pickedIdx = relPrng.int(0, items.length - 1)`
  draw ([src/world.ts](../../src/world.ts) lines 442–478), and in
  `resolveRelatedMany` before `relPrng.sample(items, count)`
  ([src/world.ts](../../src/world.ts) lines 481–531). The cached snapshot
  `this.relationPools` (keyed by `${recordId}:${relName}` / `${recordId}:${relName}:many`)
  is the **filtered** pool — sibling matchers within the same record continue to see the
  same pick (B5-R5's stability guarantee is preserved).
- **Re-evaluation timing.** Per the card's open question, evaluation is
  **re-evaluated per record**: each new record's resolution rebuilds the cache key for
  that record, calls `registry.all(relSchema)` afresh, and re-applies `where`. So a
  record added to the registry **between** two distinct record generations IS observed
  by the second. Within a single record's generation, the snapshot is record-scoped and
  immutable (B5-R5 — sibling matchers in one record see the same set; this is the
  meaning of "record-scoped"). This is the cheapest model that handles mutable
  registries and is consistent with how the cache key is already scoped per-record.
- **Auto-provision under a filter.** Today `resolveRelated`'s
  `ensurePrimaryRecord` and `resolveRelatedMany`'s shortfall loop generate **arbitrary**
  records via `generateAndStorePrimary` — there is no mechanism to coax the generation
  pipeline into producing a record that satisfies a user-supplied predicate. Returning
  an arbitrary record under a `where` filter would silently break the relation's
  contract. Per the card's open question, B11 chooses **throw** (option (a)) over
  silently ignoring the predicate (option (b)): the predicate IS the user's contract.
  The error message names the relation and points at the resolution ("pre-populate the
  registry or relax the predicate").
- **Self-referential relations.** The self-reference guard in `resolveRelated`
  ([src/world.ts](../../src/world.ts) lines 454–457) and `resolveRelatedMany`
  (lines 502) already skips auto-provision when the relation schema **is** the
  registering schema (would recurse forever). For self-referential relations under a
  `where` filter, the same guard applies: B11 does NOT add a throw for the
  self-referential empty-filtered-pool case — `resolveRelated` already returns
  `undefined` and `resolveRelatedMany` already clamps to whatever distinct records
  exist (B5-R6). The throw rule (B11-R6) applies to **non-self-referential** relations
  only; the self-reference path stays as today.
- **B10 — `store: false` interaction.** Under B10's
  `effectiveStore === false`, the auto-provision codepath in `resolveRelated` /
  `resolveRelatedMany` builds an in-memory pool from the registered records plus any
  provisioned-but-not-stored records ([src/world.ts](../../src/world.ts) lines 460–470,
  500–518). With B11, that in-memory pool is **also** filtered by `where`. If the
  resulting pool is empty, B11-R6's throw applies — the matcher saw zero records
  satisfying `where` and there is no record to relate to. (Auto-provision in B11 does
  not get smarter under `store: false`; the throw is the contract.)
- **D9 — cache neutrality.** The per-record snapshot
  cache (`relationPools`) was already PRNG-neutral on a cache hit (no PRNG draw on
  re-resolution within a record); B11 does not change this. The filter is applied
  inside the same code path that builds the snapshot, **before** the sampling PRNG fork
  — a cache miss runs the filter; a cache hit short-circuits the snapshot and does not
  consume any PRNG (Rules → D9). When the filtered pool is empty B11-R6 throws — the
  throw itself is PRNG-neutral (no `relPrng` fork happens, since `int`/`sample` never
  run).
- **B8 — derived schemas (`from:`) — independent axis.** B11's `relations` are part of
  the matcher pipeline (`ctx.related` / `ctx.related.many`); B8's `from:` is the
  derived-schema upsert axis. `where` on a relation does NOT interact with the B8
  per-pair upsert map. (Recorded under Out of scope.)
- **B14 — `populate` factory — independent axis.** B14's per-record `factory` returns
  `GenerateOptions` per record (overrides / transform); a factory could in principle
  arrange that the relation's matcher sees a constrained pool indirectly, but that is
  a userland composition. (Recorded under Out of scope.)
- **Imports** in `src/*.ts` use `.js` extensions (Rules → D1 / Node16 ESM). B11 adds no
  new module-level imports.
- **Public API change.** Extending `SchemaOpts.relations` is a public type surface
  change → `docs/api-reference.md` MUST be updated in the same step (Rules → D5;
  see B11-R9).
- **Changeset.** Per the same-step doc + release discipline (the recent siblings B8 /
  B10 / B12 / B14 / B15 all shipped with a changeset), B11 adds
  `.changeset/b11-relations-where-predicate.md` (`"zod4-mock": minor`,
  `(closes #11)`).

Item card: [wiki/backlog/doing/B11-relations-predicate-filter.md](../backlog/doing/B11-relations-predicate-filter.md).
Closes GitHub issue #11.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

## Requirements

### B11-R1: `SchemaOpts.relations` accepts both the bare-schema form and an object form with `where`

The `relations` field of `SchemaOpts` in `src/types.ts` MUST accept, per relation name,
**either** the existing bare `ZodTypeAny` form **or** a new object form
`{ schema: ZodTypeAny, where?: (item: z.infer<RelationSchema>) => boolean }`. The
TypeScript surface MUST express this as a discriminated union (per-key) so:

- a bare `RelationSchema` continues to type-check unchanged,
- the object form's `schema` field is a Zod schema reference, and
- the object form's `where` parameter is typed `z.infer<RelationSchema>` (per
  [B7](B7-registry-output-typing.md) — registry reads are output-shaped); no cast at
  the call site, no `any`.

Internally, `WorldImpl.withSchema` MUST normalise both forms to a single canonical
`{ schema, where? }` shape (stored on `SchemaReg`) so the resolvers
(`resolveRelated`, `resolveRelatedMany`) see one shape only.

- Scenario: bare-schema form still type-checks and behaves as today
  GIVEN a registration `world.withSchema(CommentSchema, { relations: { post: PostSchema }, matchers: { postId: (ctx) => ctx.related('post').id } })` (the bare form)
  WHEN the project is type-checked (`pnpm typecheck`) and a comment is generated
  THEN `pnpm typecheck` exits 0, generation succeeds, and `comment.postId` equals the
  `id` of the post `ctx.related('post')` resolved.

- Scenario: object form with `where` type-checks; `where`'s parameter is `z.infer<RelationSchema>`
  GIVEN a registration
  `world.withSchema(CommentSchema, { relations: { post: { schema: PostSchema, where: (p) => p.kind === 'article' } }, matchers: { postId: (ctx) => ctx.related('post').id } })`
  where `PostSchema = z.object({ id: z.string(), kind: z.enum(['article', 'draft']) })`
  WHEN the project is type-checked
  THEN `pnpm typecheck` exits 0, `p` inside `where` is typed `z.infer<typeof PostSchema>`
  (the output shape), `p.kind` is the enum literal type `'article' | 'draft'`, and no
  `any` and no cast are required.

- Scenario: object form is detected by a runtime shape check
  GIVEN two registrations on the same world — one with the bare form
  `relations: { a: SchemaA }` and one with the object form
  `relations: { b: { schema: SchemaB, where: () => true } }`
  WHEN matchers calling `ctx.related('a')` and `ctx.related('b')` both run
  THEN both calls resolve through the same code path (`resolveRelated`), the bare entry
  is treated as `{ schema: SchemaA }` (no `where`), and the object entry is treated as
  `{ schema: SchemaB, where: () => true }` — the runtime discriminator uses the
  presence of an own `schema` property pointing at a Zod schema (a `ZodTypeAny` itself
  does not carry a `schema` field referencing a different schema).

### B11-R2: bare-schema form behaviour is byte-equivalent to today (regression guard)

A schema registered with `relations: { name: RelationSchema }` (the bare form) MUST
produce **byte-identical** generation output to the pre-B11 implementation for the
same world seed, registration order, and call sequence. No new behaviour, no new
PRNG draw, no new cache key MUST be observable on the bare-form path; B11 MUST be
purely additive for the bare form.

- Scenario: existing `relations.test.ts` suite stays green
  GIVEN the existing tests in
  [tests/unit/core/relations.test.ts](../../tests/unit/core/relations.test.ts) — every
  `it(...)` block that uses the bare-schema form (the auto-provisioning,
  reuse-of-existing-instances, determinism, deep-chain, multiple-relations,
  self-referential, B5, and regression sections)
  WHEN B11 is applied and `pnpm test` is run
  THEN every existing `it(...)` still passes with **unchanged assertion bodies** —
  bare-form behaviour is regression-tested by the existing suite.

- Scenario: same-seed bare-form output is unchanged
  GIVEN a world `createWorld({ seed: 42 }).withSchema(PersonSchema).withSchema(FileSchema, { relations: { owner: PersonSchema }, matchers: { ownerId: (ctx) =base> ctx.related('owner').personId } })`
  (bare form, same as today's relations test fixture)
  WHEN `world.generate(FileSchema)` is called and the resulting `ownerId` is recorded
  THEN the value of `ownerId` is identical to the value produced by the same world on
  the pre-B11 codebase — i.e. the bare-form path consumes the same PRNG sequence as
  before.

### B11-R3: `ctx.related(name)` draws from the `where`-filtered pool

When a relation is declared with the object form `{ schema, where }`,
`ctx.related(name)` MUST return a record drawn **only** from the subset of
`registry.all(schema)` for which `where(item)` is true. The record-scoped snapshot
in `relationPools` (key `${recordId}:${relName}`) MUST hold the **filtered** pool;
sibling matchers within the same record continue to receive the **same** pick (B5-R5
stability is preserved).

- Scenario: filtered single pick on a typed-segmented pool
  GIVEN a schema
  `PostSchema = z.object({ id: z.string(), kind: z.enum(['article', 'draft']) })`,
  a world `createWorld({ seed: 1 }).withSchema(PostSchema)` populated with 5 posts —
  3 with `kind === 'article'` and 2 with `kind === 'draft'` — and
  `CommentSchema = z.object({ id: z.string(), postId: z.string() })` registered with
  `relations: { post: { schema: PostSchema, where: (p) => p.kind === 'article' } }` and
  matcher `postId: (ctx) => ctx.related('post').id`
  WHEN a `CommentSchema` record is generated
  THEN `comment.postId` is the `id` of one of the **3 article posts** (not one of the
  drafts); i.e. `world.registry.all(PostSchema).filter(p => p.kind === 'article').some(p => p.id === comment.postId)` is `true`.

- Scenario: sibling matchers within one record see the same filtered pick
  GIVEN the same world and a `CommentSchema` with two matchers calling
  `postId1: (ctx) => ctx.related('post').id` and
  `postId2: (ctx) => ctx.related('post').id` on a relation with
  `where: (p) => p.kind === 'article'`
  WHEN a `CommentSchema` record is generated
  THEN `comment.postId1 === comment.postId2` (record-scoped snapshot of the filtered
  pool is shared between sibling matchers), and both refer to an article post.

### B11-R4: `ctx.related.many(name, count)` draws from the `where`-filtered pool

When a relation is declared with `{ schema, where }`,
`ctx.related.many(name, count)` MUST return `count` **distinct** records drawn from
the filtered candidate pool (`registry.all(schema).filter(where)`). The per-record
snapshot in `relationPools` (key `${recordId}:${relName}:many`) MUST hold the
filtered pool; sibling-matcher stability (B5-R5) MUST be preserved.

- Scenario: filtered many pick on a typed-segmented pool
  GIVEN the `PostSchema` from B11-R3 populated with 8 posts — 5 articles and 3 drafts
  — and `DigestSchema = z.object({ digestId: z.string(), posts: z.array(PostSchema) })`
  registered with
  `relations: { items: { schema: PostSchema, where: (p) => p.kind === 'article' } }`
  and matcher `posts: (ctx) => ctx.related.many('items', 3)`
  WHEN a `DigestSchema` record is generated
  THEN `digest.posts` has length 3, the three entries are pairwise distinct by
  reference, and every entry satisfies `kind === 'article'` (no drafts appear).

- Scenario: sibling matchers within one record see the same filtered set
  GIVEN the same world and a `DigestSchema` with two matchers
  `postsA: (ctx) => ctx.related.many('items', 3)` and
  `postsB: (ctx) => ctx.related.many('items', 3)` on the same `where: kind === 'article'`
  relation
  WHEN a `DigestSchema` record is generated
  THEN `digest.postsA.map(p => p.id)` deep-equals `digest.postsB.map(p => p.id)` (same
  three article posts in the same order), and every entry has `kind === 'article'`.

### B11-R5: predicate is re-evaluated per record (cross-record observation)

The `where` predicate MUST be re-evaluated on each fresh record's first resolution of
the relation — i.e. each new `recordId` rebuilds its snapshot by calling
`registry.all(relSchema)` and applying `where` to the result. Records added to the
registry **between** two record generations MUST be considered by the second
generation's filter. (Within a single record's generation, the per-record snapshot
remains immutable — B5-R5 stability holds; this requirement is about cross-record
observations.)

- Scenario: a record added between two generations is considered by the second
  GIVEN a world with `PostSchema` populated with 2 article posts and 1 draft, and
  `CommentSchema` registered with
  `relations: { post: { schema: PostSchema, where: (p) => p.kind === 'article' } }`,
  matcher `postId: (ctx) => ctx.related('post').id`
  WHEN the consumer calls `const c1 = world.generate(CommentSchema);`, then stores a
  **3rd article post** into the registry via
  `world.registry.store(PostSchema, { id: 'p3', kind: 'article' });`, then calls
  `const c2 = world.generate(CommentSchema);` over a long enough sequence (or in a
  configuration that exercises both filtered pools)
  THEN there exists a `c2`-style generation in that world whose `postId` is `'p3'`
  (the new article is reachable to a later record's filtered pool) — i.e. the
  filtered pool for the second `recordId` includes `p3`. Equivalently, repeating the
  call N times after the store, `'p3'` appears in the result set at least once for a
  sufficiently large N driven by the seed.

- Scenario: within one record, the filtered snapshot is stable
  GIVEN a world with one article post pre-populated, `CommentSchema` registered with
  `where: (p) => p.kind === 'article'`, and two matchers on the comment:
  `postId1: (ctx) => { const r = ctx.related('post'); world.registry.store(PostSchema, { id: 'mid', kind: 'article' }); return r.id; }` and
  `postId2: (ctx) => ctx.related('post').id`
  WHEN the comment is generated
  THEN `comment.postId1 === comment.postId2` — the in-record snapshot of the filtered
  pool was taken on first resolution and is not affected by the mid-record
  registry growth (per-record stability, B5-R5 analog for filtered pools).

### B11-R6: empty filtered pool throws on `ctx.related` and `ctx.related.many`

When a non-self-referential relation has a `where` predicate and the candidate pool
for that record — `registry.all(relSchema).filter(where)` plus any
`store: false`-mode in-memory provisioned records — is **empty** (or, for
`related.many(name, count)`, **smaller than `count`** when no record can be
auto-provisioned that satisfies `where`), the resolver MUST throw a clear error of
the form:

```
No related '<relName>' matches the `where` predicate. Pre-populate the registry
with records satisfying the predicate, or relax the predicate.
```

The error message MUST name the relation (`<relName>`) and mention both remediations
(pre-populate / relax). The throw MUST happen **before** any PRNG draw or any
auto-provision side-effect under `effectiveStore === true` (i.e. B11 does NOT call
`generateAndStorePrimary` and then realise the result fails the predicate; the
filtered registry pool's emptiness is the trigger).

Self-referential relations are exempt from this throw and continue to behave per
[B5](B5-related-many.md)-R6: `resolveRelated` returns `undefined` and `related.many`
clamps to whatever distinct records exist that satisfy `where`. (This preserves the
self-reference guard at world.ts lines 454–457 / 502.)

- Scenario: empty filtered pool — single pick throws
  GIVEN a `PostSchema` populated with 2 posts, **both** `kind === 'draft'`, and
  `CommentSchema` registered with
  `relations: { post: { schema: PostSchema, where: (p) => p.kind === 'article' } }`
  and matcher `postId: (ctx) => ctx.related('post').id`
  WHEN the consumer calls `world.generate(CommentSchema)`
  THEN the call throws an `Error` whose message contains the relation name
  (`'post'`) and the strings `'where'` and either `'pre-populate'` / `'populate'` /
  `'relax'` (the remediation hint), and the throw happens before any PRNG draw on the
  relation fork (no side-effect on `world.registry.all(PostSchema)`).

- Scenario: empty filtered pool — `.many` throws when filtered count < requested count
  GIVEN the same setup but with `DigestSchema` registered with
  `relations: { items: { schema: PostSchema, where: (p) => p.kind === 'article' } }`
  and matcher `posts: (ctx) => ctx.related.many('items', 3)`, and the registry holds
  2 articles + 2 drafts (filtered pool has size 2, less than the requested 3)
  WHEN the consumer calls `world.generate(DigestSchema)`
  THEN the call throws an `Error` whose message contains `'items'` and the same
  remediation hint, because no record can be auto-provisioned that is guaranteed to
  satisfy `where` (auto-provision under a predicate is not implemented — the
  predicate is the user's contract).

- Scenario: self-referential relation under `where` does not throw on empty filtered pool
  GIVEN a self-referential `CategorySchema = z.object({ id: z.uuid(), kind: z.enum(['leaf', 'branch']), parentId: z.uuid().nullable() })`
  registered with
  `relations: { parent: { schema: CategorySchema, where: (c) => c.kind === 'branch' } }`
  and matcher `parentId: (ctx) => ctx.related('parent')?.id ?? null`, with no
  categories pre-populated
  WHEN `world.generate(CategorySchema)` is called for the first record
  THEN the call does NOT throw, `category.parentId === null` (no branch in the
  filtered pool, self-reference guard returns `undefined`), and behaviour matches
  the existing self-referential auto-provision exemption.

### B11-R7: cache-and-PRNG neutrality is preserved (D9)

The per-record snapshot cache `this.relationPools` MUST continue to short-circuit
PRNG-neutrally on a cache hit (Rules → D9). Specifically:

- The first resolution of a `(recordId, relName)` snapshot under a `where` filter MUST
  build the filtered pool **once**, store it under the cache key, and only then
  consume PRNG state via the relation fork (`recordPrng.fork('rel:...')` /
  `recordPrng.fork('rel-many:...')`).
- A subsequent resolution for the same `(recordId, relName)` MUST hit the cache, MUST
  NOT re-evaluate `where`, MUST NOT re-read `registry.all(relSchema)`, and MUST NOT
  consume additional PRNG state beyond the same per-relation fork (the existing
  behaviour for the bare-schema form).

This requirement pins that adding `where` does not move the filter from the
pool-build step into the pick step — the filter belongs to the snapshot, not to
each sample.

- Scenario: same-record repeated `.many` calls do not re-filter or re-PRNG
  GIVEN a `DigestSchema` registered with
  `relations: { items: { schema: PostSchema, where: (p) => p.kind === 'article' } }`
  and matchers
  `postsA: (ctx) => ctx.related.many('items', 3)` and
  `postsB: (ctx) => ctx.related.many('items', 3)`, the registry populated with 5
  articles + 3 drafts, and a counter incrementing inside the `where` body
  WHEN one digest record is generated
  THEN `where` runs **8 times** for the first matcher's snapshot build (once per post
  in `registry.all(PostSchema)`) and **0 times** for the second matcher (cache hit on
  the same `(recordId, items:many)` key), and `digest.postsA` deep-equals
  `digest.postsB` element-wise (same filtered set, same PRNG-sampled order).

### B11-R8: orthogonal to B8 (`from:` upsert), B10 (`store: false`), and B14 (`populate` factory)

`where` on a relation MUST NOT interact with:

- **B8** — the derived-schema upsert keyed by `(DerivedSchema, identity(source))`.
  Relations are part of the matcher pipeline (`ctx.related` / `ctx.related.many`);
  the B8 upsert lives in `generateSingleItem`'s `sourceOverride` branch. B11 changes
  neither.
- **B10** — under `effectiveStore === false`, the in-memory provisioned-pool path
  (world.ts lines 460–470 and 504–518) MUST filter that pool by `where` the same way
  it filters `registry.all(relSchema)`. If the filtered in-memory pool is still
  empty / smaller than `count`, B11-R6's throw applies (auto-provision does not
  attempt to satisfy `where`).
- **B14** — `populate(schema, count, factory)` continues to call the same primary
  generation helpers; B14's factory returns per-record `GenerateOptions` (overrides /
  transform) that flow through `generateAndStorePrimary`. A factory MAY use
  `overrides` to constrain a relation indirectly, but that is userland composition;
  B11 introduces no `factory.relations.<name>.where` shape.

- Scenario: `where` does not break a `from:`-derived schema's upsert
  GIVEN a world with `UserSchema` registered, `UserProfileSchema` registered with
  `from: UserSchema, matchers: { userId: (ctx) => ctx.source.id }`, AND
  `CommentSchema` registered with
  `relations: { post: { schema: PostSchema, where: (p) => p.kind === 'article' } }`
  in the same world; with one stored user and 1 article post
  WHEN the consumer calls
  `const a = world.generate(UserProfileSchema, { source: user });`,
  then `world.generate(CommentSchema);` (which exercises the filtered relation),
  then `const b = world.generate(UserProfileSchema, { source: user });`
  THEN `a === b` (B8's upsert is unaffected by the unrelated B11 relation), and the
  comment's `postId` is the article's `id`.

- Scenario: filtered relation under `store: false` filters the in-memory provisioned pool
  GIVEN a world with `PostSchema` registered (no posts populated) and
  `CommentSchema` registered with
  `relations: { post: { schema: PostSchema, where: (p) => p.kind === 'article' } }`
  WHEN the consumer calls `world.generate(CommentSchema, { store: false })`
  THEN the call throws per B11-R6 (the in-memory provisioned pool may contain
  arbitrary posts whose `kind` was generated without regard to `where`; the
  predicate filter is applied to that pool and finds it empty of articles), and the
  error message names the `'post'` relation and the predicate hint.

### B11-R9: `docs/api-reference.md` updated in the same step (Rules → D5)

The public API change in B11 (the object form on `SchemaOpts.relations`) MUST be
reflected in `docs/api-reference.md` in the same change. Specifically:

- The `.withSchema` subsection MUST document the new object form
  `{ schema, where? }` alongside the existing bare-schema form, with a one-line
  description ("filter the candidate pool to records satisfying `where`").
- The doc MUST show a typed example mirroring the card's
  `comments → article posts` case, with `where: (p) => p.kind === 'article'`.
- The doc MUST state that `where` receives `z.infer<RelationSchema>` (per
  [B7](B7-registry-output-typing.md), the output shape).
- The doc MUST note the empty-filtered-pool behaviour: when the filtered pool is
  empty (or smaller than the requested `count` for `.many`),
  `ctx.related`/`ctx.related.many` throws a clear error; pre-populate the registry
  or relax the predicate.
- The bare-schema form's documentation MUST remain present and unchanged.

- Scenario: docs describe the object form
  GIVEN the B11 change applied
  WHEN `docs/api-reference.md` is read
  THEN the `.withSchema` `relations` subsection shows both the bare-schema form
  `relations: { name: Schema }` and the object form
  `relations: { name: { schema: Schema, where?: (item) => boolean } }`, with the
  `z.infer<RelationSchema>` predicate-input note, an example with a
  `kind === 'article'` predicate, and the empty-pool-throws clause.

### B11-R10: changeset entry created in the same step

A changeset MUST be created at `.changeset/b11-relations-where-predicate.md` recording
B11 as a `"zod4-mock": minor` bump. The body MUST summarise (a) the new object form
`relations: { name: { schema, where? } }`, (b) `where` honoured by both
`ctx.related(name)` and `ctx.related.many(name, count)`, (c) the empty-filtered-pool
throw, and (d) full backwards compatibility with the bare-schema form. The final
non-empty line MUST be `(closes #11)`, matching the convention of sibling changesets
(`.changeset/b8-*.md`, `.changeset/b10-*.md`, `.changeset/b14-*.md`).

- Scenario: changeset file exists and has the required shape
  GIVEN the B11 change applied
  WHEN `.changeset/b11-relations-where-predicate.md` is read
  THEN its frontmatter has `"zod4-mock": minor`, the body summarises the object form,
  the `where` predicate, the empty-pool-throw, and the bare-form back-compat, and
  the final non-empty line is `(closes #11)`.

## Out of scope

- **Auto-provision-under-filter heuristics.** B11 does NOT attempt to coax matchers,
  overrides, or the generation pipeline into producing records that satisfy `where`.
  When the filtered pool is empty (or smaller than `count`), the resolver throws
  (B11-R6). A future item MAY explore predicate-driven generation (e.g. a
  `provision: (ctx) => RelationInput` companion that yields records guaranteed to
  satisfy `where`), but that is not B11.
- **Composite predicates / boolean DSL.** `where` is a single function. No
  `where: { kind: 'article' }` shape, no `whereAll: [...]`, no `whereAny: [...]`.
  Callers compose via plain JS in the predicate body.
- **`where` on the bare-schema form** (e.g. an inline `relations.post.where: (p) => ...`
  on a bare schema). The bare form stays a `ZodTypeAny`; to add a predicate, switch
  to the object form.
- **B8 (`from:` upsert) interaction.** Relations and `from:` are independent axes
  (B11-R8); the spec does not extend B8 with a per-source filter.
- **B14 (`populate` factory) interaction.** The factory's per-record options stay
  scoped to overrides / transform (B11-R8); no per-record `relations` shape is
  introduced.
- **B13 (`world.populateFrom`).** A future item that re-runs setup idempotently for
  every source record — the card notes B11 pairs with B13, but no requirement here
  defines `populateFrom`. B13 is a separate spec.
- **Runtime predicate validation.** `where` is a user-supplied function; B11 does
  NOT introspect or validate its body. A predicate that throws is the user's
  responsibility (the thrown error propagates through `resolveRelated` to the
  matcher and out of `world.generate`, as for any other matcher exception).
- **Per-call override.** `where` is declared at registration on `withSchema` and
  MUST NOT be overridable per `generate` call. (Mirrors B8's `sourceKey` — declared
  once at registration.)
- **Mutating `where` after registration.** Re-registering a schema with a different
  `where` would produce two registrations under the existing `SchemaReg[]` model;
  the cache key (`recordId`) is fresh per record, so a later registration's `where`
  applies from then on. B11 does not introduce a "swap predicate in place" API.

## Open questions

- **Predicate input type — `input<T>` vs `z.infer<T>`.** *Non-blocking.* Adopted as
  `z.infer<T>` (the **output** shape) per [B7](B7-registry-output-typing.md): the
  candidate pool is read from `registry.all(relSchema)`, which is output-typed under
  B7-R1; the predicate sees what the matcher consumes. No cast, no `any`. Recorded;
  not blocking.
- **Evaluation timing — re-evaluate per record vs cache at registration / first
  resolve.** *Non-blocking.* Adopted as **re-evaluate per record** (B11-R5): the
  filter is part of the per-record snapshot build, so records added to the registry
  between two record generations are observed by the second. Within a single record's
  generation, the snapshot is record-scoped and immutable (B5-R5 stability holds).
  This is consistent with how `relationPools` is already keyed per-record and is the
  simplest model for mutable registries. Recorded; not blocking.
- **Empty filtered pool behaviour — throw vs ignore-predicate-on-auto-provision.**
  *Non-blocking.* Adopted as **throw** (option (a), B11-R6): the predicate is the
  user's contract, and silently returning an arbitrary auto-provisioned record that
  fails `where` would break that contract. Option (b) (auto-provision ignoring the
  predicate) is rejected — it would couple the silent contract violation to an
  invisible code path. A future item MAY explore predicate-driven provisioning
  (recorded under Out of scope); for now the throw error message tells the user
  exactly what to do ("pre-populate the registry or relax the predicate"). Recorded;
  not blocking.

No blocking open questions remain; the spec can advance to `test-writer`.
