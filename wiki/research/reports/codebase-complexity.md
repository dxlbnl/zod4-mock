# Codebase complexity analysis (2026-05-29)

Audience: the maintainer. Scope: `src/` plus `packages/locale-core/`; `packages/locale-{en,nl,names}/` are spot-checked but mostly data, not behaviour. Cross-checked against [docs/concepts.md](../../../docs/concepts.md) and [wiki/codebase-map.md](../../codebase-map.md).

## Summary

The shape of complexity in `zod4-mock` is sharply asymmetric. One file — [src/world.ts](../../../src/world.ts) at 1202 LOC — concentrates almost all of the architectural complexity. The remaining `src/` (≈4000 LOC) is mostly flat, generator-style code with low per-function complexity. Two other files form a second tier of complexity: [src/generators/schema/router.ts](../../../src/generators/schema/router.ts) (a 38-case dispatch over `def.type`) and [src/generators/schema/zod-def.ts](../../../src/generators/schema/zod-def.ts)' `applyModifiers` (a 5-stage string post-fixer that touches each check three times). The `data/` generators are individually small and clean.

The biggest levers, in priority order:

1. **Decompose `WorldImpl.generateSingleItem`** (the ~164-line, 4-branch single-entry path with the source-override / no-source-derived / primary / ad-hoc split). The branches are nearly disjoint pipelines fighting over one variable namespace.
2. **Lift the registration-mode dispatch out of `generate*` methods.** The `derivedRegs.length > 0 ? ... : primaryRegs.length > 0 ? ... : ad-hoc` cascade is duplicated across `generateSingleItem`, `generateArray`, `populate`, and `populateFrom`. A small `resolveMode(schema)` (returning a tagged union) + one switch per call site would replace ~80 lines of structural code with explicit cases.
3. **Extract the per-field pipeline from `generateObjectFields`.** The 0-through-6 step ladder is the engine's most important contract (it's in `docs/concepts.md`!), and right now it's a 147-line `for` body with `continue` between steps and a partial duplicate in `collection.ts:generateZodObject` (key-based fallback, optional/nullable/default unwrap loop).
4. **Replace the 38-case `generateFromSchema` switch with a typed dispatch table** — `Record<ZodDefType, (schema, ctx) => unknown>`. Reads as data, not control flow, and gives `Pick<>` typing for new contributors.
5. **Codify the `def(schema)` → unwrap → lazy-resolve pattern in one helper.** Today the `while (d.type === "lazy")` loop appears 4 times across `world.ts` (3) and `explain.ts` (1).

The accidental-complexity score is moderate-to-high but heavily localised; nothing in the generator data files needs work.

## Method

Tooling used (per architecture rules — no new deps, no ad-hoc `node -e`):

- `wc -l`, `Read`, `Grep` for line counts, file listings, imports.
- **Cyclomatic proxy**: McCabe ≈ 1 + count of branchy tokens (`if`, `else if`, `case`, `&&`, `||`, `? :`, `while`, `for`, `catch`). Computed with `grep -cE` per function body, then read-confirmed. This is an upper bound (counts ternaries inside string literals; counts `||` defaults), but consistent across files.
- **Nesting depth**: max leading-whitespace count in the file (indent = 2 spaces), so the integer is "deepest level any line reaches", not function-scoped. Sufficient for spotting outliers.
- **Cognitive complexity**: not computed precisely — there is no installed tool. Where it diverges meaningfully from cyclomatic (deeply nested loop with control-flow jumps, recursive structure), it is called out qualitatively.
- **Fan-in / fan-out**: `grep -rl 'from ".*<name>\.js"' src/` for files importing a given module; `grep -c '^import ' <file>` for the file's own imports. Two-way ESM `.js` extension makes this exact.
- **Lints**: `pnpm lint` runs `oxlint`, which does not ship cyclomatic-complexity rules (`oxc` does not currently implement `eslint(complexity)` / `eslint(max-lines)`). No complexity-related lints fire today; the 7 warnings are unused-import / unused-var in tests and scripts, none in `src/`.

Threshold for inclusion as a "hot spot":
- Dimension 1 / 3: function ≥ ~40 lines or ≥ ~10 branch tokens.
- Dimension 2: file ≥ 200 LOC, or unusual fan-in / fan-out.
- Dimension 4: any narrative-worthy structural decision.

Not measured (and why):
- **True cognitive complexity (SonarSource definition)**: would require either an ESLint plugin or a hand-walk per function. The cyclomatic proxy plus a read-through caught everything material. Gap: the `else if` in `applyModifiers` and `generateFromSchema` would score higher under cognitive than cyclomatic; flagged narratively.
- **Test coverage of the hot spots**: out of scope for this audit. The current test suite is green.
- **Bundle-size impact** of the hot files: tracked separately under `wiki/research/`.

---

## Dimension 1 — Per-function cyclomatic + cognitive complexity

### Hot spots

| # | Function | File:lines | LOC | ~Branches | Diagnosis | Recommendation |
|---|----------|------------|-----|-----------|-----------|----------------|
| 1 | `generateFromSchema` | [router.ts:54-223](../../../src/generators/schema/router.ts#L54) | 170 | ~51 (38 `case`) | One giant switch over `def.type` (28 distinct types); 4 cases (`union`, `pipe`, `xor`, `intersection`) contain nested branching. Type erasure via `dAny`. | Replace with a dispatch table `Record<ZodDefType, GenFn>`. Extract `generateUnion`, `generatePipe`, `generateXor`. Type the table so adding a Zod type is a compile error if missed. |
| 2 | `applyModifiers` | [zod-def.ts:76-180](../../../src/generators/schema/zod-def.ts#L76) | 105 | ~34 | Five-pass string post-fixer (overwrites → format adds → length bounds → format re-fix → overwrites re-apply). Iterates the same `formats` array three times. Two parallel concerns (string vs number) share one function. | Split into `applyStringModifiers` (a pipeline of named steps) and `applyNumberModifiers`. Each pass becomes a named function — the order is then the only thing the caller has to read. |
| 3 | `WorldImpl.generateSingleItem` | [world.ts:1030-1193](../../../src/world.ts#L1030) | 164 | ~23 | The `sourceOverride !== undefined` → `derivedRegs.length > 0` → `primaryRegs.length > 0` → ad-hoc cascade is four pipelines glued together. `transformApplied` flag and the trailing `deepMerge` / `transform` block exist to paper over the fact that one branch already applies them and the others don't. | Split per branch: `generateWithSourceOverride`, `generateDerivedAutoSource`, `generatePrimary`, `generateAdHoc`. Each is ~30-40 lines and reads end-to-end. The trailing block becomes the dispatcher. |
| 4 | `WorldImpl.generateObjectFields` | [world.ts:765-911](../../../src/world.ts#L765) | 147 | ~21 | Implements the canonical 0-6 pipeline as a flat `for` body with `continue` between each step. Step 3 (optional/nullable/default unwrap) is a nested `while` with mutated state (`skip`, `hasFallback`, `fallbackValue`). | Extract each pipeline step as a named function returning a `FieldResolution` discriminated union (`{ kind: "override", value } \| { kind: "matcher", value } \| ... \| { kind: "fallback" }`). The body becomes `for (key) { for (step of pipeline) { if hit return } }`. The optional-unwrap stays as its own helper. |
| 5 | `generateZodString` | [string.ts:180-238](../../../src/generators/schema/string.ts#L180) | 59 | ~26 | 22-arm `else if` chain on `format` strings, then a four-arm chain on check formats. Trivial to read line-by-line but resists scanning. | Replace the `format` chain with a `Record<string, (prng) => string>` table at file top. The check-format chain stays a switch (it's order-sensitive). |
| 6 | `WorldImpl.generate` | [world.ts:322-385](../../../src/world.ts#L322) | 64 | ~12 | Three sequential loops (outer-wrapper strip, lazy-resolve, then dispatch on `array` vs single), each duplicated almost verbatim in `generateSingleItem` and `generateObjectFields`. | Extract `resolveSchemaWrappers(schema)` returning `{ inner, outerWrappers }`, and `resolveLazy(schema, cache)`. Then `generate` is ~25 lines. |
| 7 | `WorldImpl.generateArray` | [world.ts:917-1024](../../../src/world.ts#L917) | 108 | ~14 | Three full mode-pipelines (derived / primary / ad-hoc), each with its own auto-provision loop and PRNG-fork conventions. The ad-hoc branch alone is 35 lines. | Same mode-dispatch refactor as recommendation #2 in the summary. Each branch becomes its own `generateArrayDerived` / `generateArrayPrimary` / `generateArrayAdHoc`. |
| 8 | `WorldImpl.resolveRelated{,Many}` | [world.ts:541-679](../../../src/world.ts#L541) | 67 + 71 | ~11 / ~12 | Twin methods, ~80% identical: cache key, pool snapshot, `where` filter, empty-pool throw, PRNG fork. The auto-provision logic differs (`ensurePrimaryRecord` vs explicit loop). | Extract a private `resolveRelationPool(reg, recordId, relName, kind: "single"|"many", count?): {items, prng}` that does the cache + filter + auto-provision; the two public methods become 6-line wrappers. |
| 9 | `email` (generator) | [internet.ts:101-127](../../../src/generators/data/internet.ts#L101) | 27 | ~5 | Six-stage sibling fallback (nickname → first/last → company → default). Each stage has its own `domain()` reference and ad-hoc transforms. Not deeply complex — just dense. | Pull the sibling-priority list into a data-driven helper `siblingLocalPart(ctx, fallback)` that returns the email local part and lets `email` just join. Same shape used in `username`, `displayName` — generalise once. |
| 10 | `lastName` | [person.ts:73-90](../../../src/generators/data/person.ts#L73) | 18 | ~6 | Tight, but the weighted-prefix selection inlines its CDF traversal. | Lift to `sampleWeightedPrefix(prng, prefixes, noPrefixWeight): string \| null` in `markov/sample.ts` or `prng.ts`. The same shape will be needed for any future weighted picker. |

### Diagnosis

**The shape**: the worst cyclomatic offenders are not deeply nested — they're flat, wide switches and ladders. That's the easy kind of complexity to refactor: each case is a candidate for a dispatch-table entry or a named sub-function. The hard kind (deeply nested control flow with cross-cutting state) appears in only one place — `generateSingleItem`'s 4-branch single-result-variable pattern.

**The proxy is conservative**: `||` and `??` for option defaults inflate the count. `generate` shows ~12 branches but only 3 of those are real decisions; the rest are `options?.X ?? default`. The numbers are still ordered correctly relative to each other.

---

## Dimension 2 — Module size & shape

### Hot spots

| # | File | LOC | Fan-in (importers) | Fan-out (own imports) | Diagnosis | Recommendation |
|---|------|-----|--------------------|-----------------------|-----------|----------------|
| 1 | [src/world.ts](../../../src/world.ts) | **1202** | 1 (index.ts) | 12 | The engine. Owns 7 distinct concerns: registration storage, pipeline orchestration, primary/derived/relational generation, the array path, relation resolution + auto-provision, `effectiveStore` state machine, the derived-upsert map. Class has 11 private methods + 5 public. | Split into `src/world/engine.ts` (single-item / array / object-field pipeline), `src/world/relations.ts` (relation pools + auto-provision), `src/world/derived.ts` (upsert map + B8 identity logic), `src/world/registration.ts` (`SchemaReg`, `normalizeRelationEntry`, `findPrimaryRegs` / `findDerivedRegs`). Re-export from `src/world/index.ts`. |
| 2 | [src/types.ts](../../../src/types.ts) | 430 | **26** | 4 | Fan-in is justified — every module imports types here. But it bundles unrelated interfaces (`Registry`, `GeneratorContext`, `MatcherCtx`, `GenerateOptions`, `WorldOptions`, `SchemaOpts`, `ExplainResult`). Three of the seven major interfaces are >50 lines of JSDoc + types. | Split into `types/context.ts`, `types/options.ts`, `types/world.ts`, `types/explain.ts`. Keep a barrel `types/index.ts`. Mostly aesthetic — does not change fan-in. |
| 3 | [src/generators/data/key-map.ts](../../../src/generators/data/key-map.ts) | 352 | 3 | 6 | The ~165-entry exact-key table + 5 patterns + dispatch function. Half the LOC is repetitive `inline` closures for length-aware text fields (`text`, `description`, `note`, `summary`, `comment`, `body`, `content`, `message`, `omschrijving`, `bericht` are all the same closure). | Build the text-aware aliases programmatically: `for (const k of TEXT_ALIASES) map[k] = textWithLength;`. Move the constant to a `key-aliases.ts` data file so the table reads as data, not a literal. Cuts ~80 LOC. |
| 4 | [src/explain.ts](../../../src/explain.ts) | 315 | 1 (world.ts) | 5 | Re-implements the per-field decision pipeline of `generateObjectFields` for read-only inspection. The two implementations are guaranteed to drift. | Refactor `generateObjectFields` so the per-step decision is a `decideField(...)` function (see Dim 1 #4). `explain.ts` then calls the same `decideField` with a non-PRNG-consuming flag. Eliminates the ~150 LOC of mirrored logic. |
| 5 | [src/generators/schema/string.ts](../../../src/generators/schema/string.ts) | 258 | 4 | 8 | 22 generator helpers, each tiny, plus the format-dispatch `generateZodString`. Coherent. | Already fine. The cleanup is `generateZodString` (Dim 1 #5), not the file as a whole. |
| 6 | [src/generators/schema/collection.ts](../../../src/generators/schema/collection.ts) | 253 | 2 | 5 | Houses 6 generators (array, tuple, record, map, set, object). `generateZodObject` re-implements the optional/nullable/default unwrap loop already in `generateObjectFields`. | Either delete `generateZodObject` and have `router.ts` call back into the world engine for objects (but that re-introduces a cycle), OR extract the unwrap-loop into a shared `unwrapOptionalForField(fieldSchema, prng, optProb): {inner, absent, fallback}` helper. Prefer the helper. |
| 7 | [src/generators/schema/router.ts](../../../src/generators/schema/router.ts) | 223 | 2 | 8 | One giant switch (Dim 1 #1). | Dispatch table (see Dim 1 #1). |
| 8 | [src/default-locale.ts](../../../src/default-locale.ts) | 214 | **11** | 1 | Pure data + 6 inline `formatX` closures. Fan-in 11 is the locale-fallback pattern — every `data/*.ts` does `ctx?.locale ?? defaultLocale`. | The `?? defaultLocale` fallback in every generator is a recurring smell. Move it into context construction: `ctx.locale` is *always* defined inside the world (already true — see `makeFieldCtx`), so generators called with `ctx` never need the fallback. Only the `prng`-only call signatures need it. Could split the surface into `gen(prng)` (no locale, panics if reached without one) vs `gen(prng, ctx)`. Lower priority. |
| 9 | [src/generators/data/internet.ts](../../../src/generators/data/internet.ts) | 210 | 2 | 5 | One file mixing identity (email, username, displayName) and unrelated network primitives (ipv4, ipv6, mac, userAgent, jwt). The identity functions all share the sibling-lookup pattern. | Split into `internet/identity.ts` (email, username, displayName) and `internet/network.ts` (ip, mac, userAgent, jwt, http*). Index barrel kept. |
| 10 | [src/generators/schema/zod-def.ts](../../../src/generators/schema/zod-def.ts) | 181 | **8** | 1 | The only place that reads Zod v4 internals (D3) — high fan-in is correct. `applyModifiers` is the inflated function (Dim 1 #2). | Keep the file's role as the v4 boundary; refactor `applyModifiers` per Dim 1 #2. |

### Diagnosis

**The shape**: `src/` is mostly small files. The outliers are the engine (`world.ts`), the routing layer (`router.ts`, `string.ts`, `collection.ts`), and one large data table (`key-map.ts`). The locale and generator data files are well-distributed.

**Dependency topology** is clean: one big consumer (`world.ts` imports 12), one big producer (`types.ts` is imported by 26), no circular imports, no surprising cross-cuts. The locale workspaces are coupled to `locale-core` and nothing else.

**Cross-package boundary**: `packages/locale-core` (203 LOC across 4 files) is a clean shared-types contract: `Prng` interface, `LocaleData`, `MarkovModel`, `extend()`. The locale packs depend only on `@zod4-mock/locale-core` and `@zod4-mock/locale-names`. The main library depends on `@zod4-mock/locale-core` for types and re-exports them. No coupling smell.

---

## Dimension 3 — Structural / nesting depth & long functions

### Hot spots

| # | Function | File:lines | LOC | Max nest | Diagnosis | Recommendation |
|---|----------|------------|-----|----------|-----------|----------------|
| 1 | `generateSingleItem` | [world.ts:1030-1193](../../../src/world.ts#L1030) | 164 | 5 (object-literal inside `for` inside `if`) | Long body + medium nesting + 4 disjoint sub-pipelines glued by `result` / `transformApplied` flags. | Decompose per Dim 1 #3. |
| 2 | `generateObjectFields` | [world.ts:765-911](../../../src/world.ts#L765) | 147 | 5 (inner `while` inside `for` inside method) | Long body + an inner nested `while` for the unwrap loop + mutated `skip` / `hasFallback` / `fallbackValue` state. | Extract `decideField(...)`; see Dim 1 #4. |
| 3 | `generateArray` | [world.ts:917-1024](../../../src/world.ts#L917) | 108 | 5 (object-literal inside `for` inside `if`) | Three full mode-paths plus ad-hoc tail logic for overrides/transform on arrays. | See Dim 2 #1 — extract per-mode helpers. |
| 4 | `applyModifiers` | [zod-def.ts:76-180](../../../src/generators/schema/zod-def.ts#L76) | 105 | 4 | Stacks 5 sequential `for` passes over `checks`. | Named-stage pipeline; see Dim 1 #2. |
| 5 | Lazy-resolve `while` loop | world.ts:350, 780, 1040 + explain.ts:251 | ~10 each | 3 | Four near-identical copies. | One helper `resolveLazyChain(schema, cache): ZodTypeAny`. Cuts ~30 LOC and one drift risk. |
| 6 | Optional/nullable/default unwrap loop | world.ts:853-878 + collection.ts:218-241 | ~25 each | 4 | Two copies of the same state machine (`isAbsent` roll, `default` capture, `fallbackValue` carry, `skip` bailout). | One helper `unwrapOptionalChainForField(fieldSchema, prng, optProb): { inner, absent: { kind, value } | null }`. Each call site shrinks to ~5 lines. |
| 7 | `generateZodString` chain | [string.ts:180-238](../../../src/generators/schema/string.ts#L180) | 59 | 4 | 22-arm `if/else` chain. Reads top-to-bottom but you can't scan it. | Dispatch table; see Dim 1 #5. |
| 8 | `generateFromSchema` | [router.ts:54-223](../../../src/generators/schema/router.ts#L54) | 170 | 3 (most), 4 in `union` | Long switch; each case is shallow, only `union` (discriminated-union path) goes 4 deep. | Dispatch table + per-case fns; see Dim 1 #1. |
| 9 | `generateJson` | [router.ts:26-52](../../../src/generators/schema/router.ts#L26) | 27 | 3 | Tiny recursive switch; depth bookkeeping is implicit (passing `depth + 1`). Fine as-is, but the per-case PRNG-fork keys (`"a${i}"`, `"o"`) are stringly typed. | Leave it. Not a hot spot, listed for completeness. |
| 10 | `bindGenerators` Proxy | [world.ts:472-494](../../../src/world.ts#L472) | 23 | 3 (closure inside Proxy inside method) | Uses `any` (`Record<string, any>`) where the SDK could use `BoundGenerators`. The double Proxy is correct but heavy. | Replace with an eagerly-bound object built once per `makeFieldCtx`. The current per-namespace cache is good — keep the cache, lose the Proxy. Also lose the two `any` types. |

### Diagnosis

The depth metric is harmless on its own (max 7 indent levels = 4 logical levels in `world.ts`). The real "resists reading" issue is **width**: 100+ line functions where the local mental stack has to hold 4+ mode flags simultaneously. `generateSingleItem` is the worst offender by this measure; everything else is at most a 2-flag mental model.

---

## Dimension 4 — Architectural / pipeline complexity

### The generation pipeline

The 0-through-5 pipeline is the engine's contract. It is documented in three places: `docs/concepts.md` (rendered docs), `wiki/codebase-map.md` (internal map), and the module-level JSDoc at the top of [src/world.ts:14-26](../../../src/world.ts#L14). Plus `CLAUDE.md`. The JSDoc, however, lists **6 steps**, not 5 (it numbers the per-schema key map as step 2 and bumps the rest down). `docs/concepts.md` lists 5. **The two documents disagree on numbering**, and the code actually implements 7 ladder rungs (override eager → matcher → schemaKeyMap → optional-unwrap → custom-gen → key-based → schema-based).

This is **essential complexity** — the ladder exists because the library deliberately gives the user that many escape hatches. But the **structure** — a flat `for` body with `continue` between rungs — is **accidental**. There is no expression of "the pipeline" as data. You can't list it; you can't iterate over it for `explain`; you can't add a rung without editing the function body.

**Recommendation**: the pipeline is the architecture. Promote it to a list:

```ts
const PIPELINE: ReadonlyArray<PipelineStep> = [
  overrideEagerStep, matcherStep, schemaKeyMapStep,
  unwrapOptionalStep, customKeyGenStep, keyHeuristicStep,
  schemaBasedStep,
];
```

Then `generateObjectFields` walks the list, returning on the first non-empty `FieldResolution`. This removes the duplicate implementation in `explain.ts` (the same list drives the read-only walk), removes the duplicate in `collection.ts:generateZodObject` (it should also walk the list), and makes the contract scannable.

### `WorldImpl.generateSingleItem`

The function (164 LOC, 23 branch tokens) is the clearest example of accidental complexity in the engine. Five concerns are interleaved:

1. Schema unwrapping (outer optional / nullable, then lazy chain).
2. Lookup of `derivedRegs` for both `schema` and `targetSchema` (post-lazy), with a two-level fallback.
3. The B8 upsert hit-or-miss path under `sourceOverride !== undefined`.
4. The auto-source provisioning when there are derived regs but no `source` (B20's fix lives here, and B21 has already noted the asymmetry with the with-source branch).
5. The "ad-hoc" fallback for unregistered schemas.

Each of those concerns wants a 30-40 line function. Today they share a `result` variable and a `transformApplied` flag, and the trailing `if (options?.overrides) result = deepMerge(...)` + `if (options?.transform && !transformApplied) result = options.transform(...)` cleans up after whichever branch ran. **B21 is already filed against this asymmetry**; the larger fix should be the decomposition, with B21 falling out as a side effect.

### `derivedRegs` / `primaryRegs` / `from:` registry interactions

The pattern `const derivedRegs = this.findDerivedRegs(schema); const primaryRegs = this.findPrimaryRegs(schema);` appears in `generateSingleItem`, `generateArray`, `populate`, and implicitly in `populateFrom` (which delegates to `generate`). Each call site then implements its own decision tree: "if derived, do X; else if primary, do Y; else ad-hoc". This is the same dispatch four times.

**Recommendation**: a small tagged union at the entry point.

```ts
type SchemaMode =
  | { kind: "derived";   regs: SchemaReg[] }
  | { kind: "primary";   reg:  SchemaReg }
  | { kind: "ad-hoc" };

private resolveMode(schema: ZodTypeAny): SchemaMode { ... }
```

Then each caller becomes `const mode = this.resolveMode(schema); switch (mode.kind) { ... }`. Identity-equality lookup, fast, type-safe, and removes ~80 LOC of structural code.

### The `effectiveStore` flag + B8 upsert map + B10 transitive suppression

The state machine here is small but real:

- `effectiveStore` is a per-call mutable boolean restored in a try/finally in `generate`.
- It propagates through nested generation because `ctx.generate` re-enters `generate`.
- It gates two side effects: `registry.store` (lines 719-721) and `derivedUpsert.set` (lines 1111-1118).
- `world.get` overrides it back to true (B10-R5) because its create path must always store.
- `populate` / `populateFrom` strip incoming `store: false` (B10-R6).

This is essential — the contract is part of B10. But it is **invisible**: there is no named state, no method called `withEphemeralStorage(fn)`. The `try { this.effectiveStore = false; ... } finally { this.effectiveStore = previous }` pattern is open-coded inside `generate`.

**Recommendation** (small): extract `withEffectiveStore<R>(value: boolean | undefined, fn: () => R): R`. Then `generate` reads `return this.withEffectiveStore(options?.store, () => { ... })`. The contract is named, the try/finally is encapsulated, and the next person who needs to suppress storage for a new code path has somewhere to call.

### The two generator axes (key-based vs schema-based)

Today the dispatch lives inside `generateObjectFields`:

```ts
// 5. Key-based heuristic generator
const keyResult = generateFromKey(key, innerSchema, fieldCtx);
if (keyResult !== undefined) { result[key] = ...; continue; }

// 6. Schema-based generator
result[key] = ... generateFromSchema(innerSchema, fieldCtx);
```

This is clean. The accidental complexity is that the same key-based dispatch is also called from inside `generateZodObject` ([collection.ts:246](../../../src/generators/schema/collection.ts#L246)), without the full ladder above it. So there are two "object-field generators" — `WorldImpl.generateObjectFields` (the full 7-rung ladder, used when a record is being generated against a registration) and `generateZodObject` (key-based + schema-based only, used when the object schema appears nested without registration). Their behaviours diverge: only the world's version honours matchers, the per-schema key map, custom key generators, and overrides.

**Recommendation**: make the two converge. `generateZodObject` should call back into the world's pipeline. The way to do this without re-introducing a cycle is the `decideField`/`PIPELINE` refactor from above: the pipeline list is a pure value, both call sites import it, and `generateZodObject` can be `(schema, ctx) => walkPipeline(PIPELINE_NO_REGISTRATION, schema, ctx)`.

### `Prng` and `fork(key)` discipline (D4)

D4 says per-field PRNG forking so adding/removing fields doesn't disturb others. The discipline is **mostly consistent** but with a few inconsistencies worth noting:

- [collection.ts:28-45](../../../src/generators/schema/collection.ts#L28) defines `createBatchElementPrng` to avoid string allocation per array element — a clean optimisation that respects fork-key semantics by precomputing base seeds per field name. Good.
- [router.ts:42, 48](../../../src/generators/schema/router.ts#L42) uses fork keys `"a${i}"` and `"o"` inside `generateJson`'s recursive walk. These are positional, not field-name-based. Fine because the schema being walked is `z.json()` with no semantic fields, but the convention is undocumented.
- `world.ts` uses several **different** fork-key conventions: `"registry"` (in `SchemaRegistry`), `"gen-N"`, `"gen-wrap-N"`, `"rel:relName"`, `"rel-many:relName"`, `"jwt-p"`/`"jwt-s"` (in `string.ts`). The number-based ones (`gen-N`) are seeded by `generationCounter`, so the **PRNG sequence depends on generation order** — adding a stray `world.generate(X)` call earlier changes downstream PRNG state. This is contrary to D4's spirit. ([world.ts:927](../../../src/world.ts#L927), [world.ts:1003](../../../src/world.ts#L1003))
- [world.ts:362-369](../../../src/world.ts#L362) — the outer-wrapper optional/nullable roll uses a generation-counter-based fork. Same issue.

**Recommendation**: audit the `generationCounter` dependency. The intent of D4 is that schema *shape* changes don't disturb values; the current code is also stable across schema-shape changes, but **not stable across call-order changes**. This is a soft violation of D4's premise that the seed alone determines the data — today the seed + call-order does. Either rename `generationCounter` to something that signals "yes, this is a call-counter; values depend on call order" (and document that), or replace it with a stable per-call key (the schema's identity + a deterministic index).

This is the most architecturally interesting finding in the audit and deserves its own item.

### Cross-package boundaries

`packages/locale-core` is a thin shared-types contract — ~200 LOC across 4 files. Locale packs (`locale-en`, `locale-nl`) each have a single `locale.ts` (258 / 278 LOC, all data). `locale-names` ships pre-trained Markov models per cultural group. No structural complexity here; the only mild observation is that `defaultLocale.ts` lives in the main library (not in `locale-core`), so the dependency graph is `data/* → src/default-locale.ts → @zod4-mock/locale-core` (for the type) rather than `data/* → @zod4-mock/locale-core` for both type and default. Could move `defaultLocale` to `locale-core` and re-export from main if you want to flatten — minor.

### Drift between code and documentation

- Pipeline numbering: 5 steps in `docs/concepts.md`, 6 in `world.ts` JSDoc. Code implements 7 rungs (the `withGenerators` custom-key step isn't called out anywhere in the rendered ladder).
- The `withGenerators` custom-key step ([world.ts:881-887](../../../src/world.ts#L881)) is registered as step 4 (between optional-unwrap and key-based) — but in `docs/concepts.md` it isn't listed at all in the pipeline ladder. `explain.ts` calls it "Rule 3 — world-level custom generator" and puts it before the exact-key map; `generateObjectFields` runs it **after** unwrap-optional and **after** matcher/schemaKeyMap. The orderings differ.

**Recommendation**: pick one canonical ordering (the code), document it in one place (`docs/concepts.md`), and make every other doc point at that page. The `PIPELINE` list (from above) becomes the literal source of truth.

---

## Cross-cutting observations

Recurring patterns of accidental complexity:

1. **Three duplicated state-machines.** The optional/nullable/default-unwrap roll, the lazy-resolve `while`, and the derived-vs-primary mode dispatch each appear in 3-4 places. All three are crying out for a helper.
2. **One file (`world.ts`) owns too many concerns.** Engine, registration store, relation pools, B8 upsert map, B10 store flag, lazy cache, generation counter, PRNG binding. Splitting it is a M-sized refactor that compounds returns — it would also enable easier targeted refactors of the long functions inside.
3. **Three "object-field generators" with subtly different behaviour.** `generateObjectFields`, `generateZodObject` (collection.ts), and `explainSchema`'s `decideField`. They should be one walked-list driven by a shared `PIPELINE`.
4. **The `generationCounter` is a hidden global.** Reads as call-order state. Several internal fork keys depend on it. This is the only thing I'd call a possible correctness smell rather than a readability smell.
5. **`any` slips in via Proxies and option-shape coercion.** The `Record<string, any>` cache in `bindGenerators`, the `any` casts on `options.source` ([world.ts:1062](../../../src/world.ts#L1062)), `options.overrides as any[]` in `generateArray`. None are reachable from public API, but they break the spirit of D1.

---

## Proposed backlog items

These are sketches, not yet `/intake`-ed. They are listed in roughly priority order (highest leverage first) within each dimension. Each gives a one-line summary, the hot spot it targets, a rough size estimate, and the dimension(s) it improves.

1. **Promote the per-field pipeline to a `PIPELINE` list of steps.** Replace `generateObjectFields`'s flat `for` body with a walked list of named `PipelineStep` functions returning a `FieldResolution` tagged union. Also retires the duplicate ladder in `explain.ts`. — Dim 1 #4, Dim 3 #2, Dim 4 (pipeline). Size: **L**.

2. **Decompose `generateSingleItem` into four named methods.** `generateWithSourceOverride`, `generateDerivedAutoSource`, `generatePrimary`, `generateAdHoc`. The trailing override-deep-merge / transform block becomes the dispatcher. Closes B21 along the way. — Dim 1 #3, Dim 3 #1, Dim 4 (single-item asymmetry). Size: **M**.

3. **Extract `resolveMode(schema): SchemaMode` and unify the derived/primary/ad-hoc dispatch across all call sites.** — Dim 4 (registry interactions), Dim 1 #7. Size: **M**.

4. **Replace the 38-case `generateFromSchema` switch with a typed dispatch table.** Each case becomes a `(schema, ctx) => unknown` keyed on `def.type`. New Zod types become compile errors if missed. — Dim 1 #1, Dim 2 #7. Size: **M**.

5. **Audit `generationCounter` and document the "call-order matters" semantics, or remove it.** Choose: (a) rename to `callCounter` + document, or (b) replace counter-based fork keys with stable identity-based ones so PRNG state is independent of call order. — Dim 4 (Prng / D4). Size: **S** for the audit, **M** if option (b). High priority — possible correctness smell.

6. **Split `world.ts` into `world/{engine,relations,derived,registration}.ts`.** Re-export from a barrel. Each file < 400 LOC. — Dim 2 #1. Size: **L**, but mechanical once the function-level refactors above are done.

7. **Extract `applyModifiers` into `applyStringModifiers` + `applyNumberModifiers`, with each pass as a named function.** — Dim 1 #2, Dim 3 #4. Size: **S**.

8. **Extract `unwrapOptionalChainForField` helper.** Removes duplicated optional/nullable/default loops in `world.ts` and `collection.ts`. — Dim 3 #6, Dim 4 (key-based vs schema-based convergence). Size: **S**.

9. **Extract `resolveLazyChain(schema, cache)` helper.** Removes 4 duplicate `while (d.type === "lazy")` loops. — Dim 3 #5. Size: **XS**.

10. **Extract `resolveRelationPool` shared between `resolveRelated` and `resolveRelatedMany`.** Twin methods become 6-line wrappers. — Dim 1 #8. Size: **S**.

11. **Encapsulate the `effectiveStore` state as `withEffectiveStore(value, fn)`.** Names the contract; removes the open-coded try/finally. — Dim 4 (state machine). Size: **XS**.

12. **Replace `generateZodString`'s 22-arm `else if` chain with a `Record<format, (prng) => string>` table.** — Dim 1 #5, Dim 3 #7. Size: **S**.

13. **Build `key-map.ts` text-aliases programmatically.** Replace 10 identical length-aware text closures with a loop over a `TEXT_ALIASES` constant. — Dim 2 #3. Size: **XS**.

14. **Replace the double `Proxy` in `bindGenerators` with an eagerly bound object and drop the two `any` types.** — Dim 3 #10. Size: **S**.

15. **Reconcile the pipeline-numbering drift** between `docs/concepts.md`, `world.ts`'s module JSDoc, `wiki/codebase-map.md`, `CLAUDE.md`, and `explain.ts`. Make one (the `PIPELINE` from item #1) the source of truth and link from the rest. — Dim 4 (drift). Size: **XS**, but blocking until #1 lands.

Total: **15 candidates**. Distribution across dimensions:
- Dim 1 (per-function): #1, #2, #4, #7, #10, #12, #14 (7 items)
- Dim 2 (module shape): #6, #13 (and partially #1, #4) (4 items)
- Dim 3 (nesting / length): #1, #2, #7, #8, #9, #12, #14 (7 items)
- Dim 4 (architectural): #1, #2, #3, #5, #6, #8, #11, #15 (8 items)

Most items improve more than one dimension; #1 alone touches all four, which is why it's the headline lever.
