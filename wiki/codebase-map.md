# Codebase Map — `src/`

A high-level orientation to the library source so work doesn't start with a blind
search. End-user behavior docs live in `docs/`; this page is the *internal* layout.
Paths are relative to the repo root.

## Mental model

Generation has **two axes**, tried in priority order per field (see the pipeline in
`docs/concepts.md` / `CLAUDE.md`):

1. **Matchers** — user functions from `world.withSchema(schema, { matchers })`.
2. **Key-based ("data") generators** — keyed off the *field name* (`email`, `firstName`,
   `iban`…). Produce realistic, domain-flavored values. Live in `src/generators/data/`.
3. **Schema-based generators** — keyed off the *Zod type* (string/number/array/union…).
   Produce constraint-valid values from introspection. Live in `src/generators/schema/`.
4. `overrides` deep-merge, then `transform`.

"Data" generators are `(prng, ctx?, schema?) => value` and are the public `generators.*`
namespace. "Schema" generators are `(schema, ctx) => value` and drive the type fallback.

## Entry & orchestration

| File | Role |
|------|------|
| `src/index.ts` | Public API barrel. Exports `generate()` (zero-config one-shot), `createWorld`, the `generators` namespace, PRNG helpers, key-map constants, `extend`, and all public types. |
| `src/world.ts` | Thin re-export shim — keeps `import { createWorld } from "./world.js"` resolving byte-identically after the B28 split. Re-exports from `src/world/index.ts`. |
| `src/world/engine.ts` | **The engine.** `WorldImpl` / `createWorld`. Owns the per-field pipeline (`generateObjectFields`), array/derived/primary record generation (`generateArray`, `generateSingleItem` dispatcher + the 4 B24 branch helpers, `generateAndStorePrimary`, `generateDerivedRecord`), relation resolution methods (`resolveRelated` / `resolveRelatedMany` / `resolveRelationPool` / `ensurePrimaryRecord`), context construction (`makeFieldCtx`), and the B39 module-global stable schema identity (`globalSchemaIds` WeakMap + per-world `schemaCallCounts` + `nextSchemaSlot`). Also holds `CTX_SLOTS` + `bindNamespace` (B36/B40 eager generator binding). |
| `src/world/registration.ts` | Pure registration types + helpers: `SchemaReg`, `NormalizedRelation`, `EMPTY_REG`, the `SchemaMode` tagged union, the `isZodSchema` discriminator, `normalizeRelationEntry` (B11), and the free `findPrimaryRegs` / `findDerivedRegs` / `resolveMode` (B25) lookups over a `SchemaReg[]`. |
| `src/world/derived.ts` | B8 derived-upsert map type + access helpers (`DerivedUpsertMap`, `getDerivedUpsert`, `setDerivedUpsert`, `computeSourceIdentity`). The cache short-circuit + `derivedPairCounter--` rollback (D9 / B8-R9) live in the dispatcher in `engine.ts`. |
| `src/world/relations.ts` | Pure helpers backing the state-bearing relation methods on `WorldImpl`: the cache-key / fork-key builders and the B11-R6 error-message helpers. The stateful pool resolver itself stays on `WorldImpl` in `engine.ts` per the B28 pragmatic split. |
| `src/world/index.ts` | Barrel re-exporting `createWorld` + `WorldImpl` from `engine.ts`. |
| `src/types.ts` | All core interfaces: `World`, `GeneratorContext`, `MatcherCtx`, `SchemaOpts`, `Registry`, `WorldOptions`, `GenerateOptions`, key-map types. Re-exports locale types from `@zod4-mock/locale-core`. |

## Determinism & state

| File | Role |
|------|------|
| `src/prng.ts` | SFC32 PRNG + FNV-1a hash. `createPrng(seed)` → `{ random, int, pick, shuffle, sample, fork, bytes }`. `fork(key)` derives an independent child (no parent-state consumption). `fieldSeed(worldSeed, recordId, fieldPath)` gives per-field seeding so adding/removing a field doesn't disturb others. |
| `src/registry.ts` | `SchemaRegistry` — in-memory `Map<schema, item[]>`. `store/all/pick/filter/count`. Keys are Zod schema *object references*. Backs relations and cross-API consistency. |

## Zod v4 introspection (`src/generators/schema/`)

| File | Role |
|------|------|
| `zod-def.ts` | The only place that touches Zod v4 internals (`schema._zod.def`, `check._zod.def`). `def()`, `checks()`, `unwrap()` (strip optional/nullable/default/readonly/catch/brand), `getLeafDef()`, `resolveLazyChain()` (walk `z.lazy` references with an optional per-world cache; B31), `unwrapOptionalChainForField()` (single-field optional/nullable/default unwrap loop with per-layer absent-roll; shared by `world.ts:generateObjectFields` and `collection.ts:generateZodObject`; B30), `applyModifiers()` (post-fix dispatcher routing to `applyStringModifiers()` — 5-stage named pipeline: overwritePass → formatAddPass → lengthBoundsPass → formatRefixPass → overwriteRefixPass — or `applyNumberModifiers()` — intCoercePass → multipleOfPass; B29). |
| `router.ts` | `generateFromSchema(schema, ctx)` — typed `DISPATCH` table keyed on `def.type` (`Record<ZodDefType, GenFn>`), dispatching to the type generators; non-trivial arms (`generateUnion` incl. discriminated-union, `generateXor`, `generateIntersection`, `generatePipe` incl. transform/preprocess) are named functions; covers optional/nullable, default/catch, lazy, json, and throws `UnsupportedSchemaError` for custom/function/instanceof/file. New Zod type → compile error if missed (B26). |
| `string.ts` | String generation + format resolution (`generateZodString`, `generateTemplateLiteral`, `resolveStringLength`, low-level `generateString`). |
| `number.ts` | Number/bigint with bounds (`generateZodNumber`, `generateZodBigInt`, `resolveNumberBounds`, `generateNumberWithBounds`). |
| `date.ts` | `generateZodDate` (min/max date checks). |
| `collection.ts` | `generateZodArray` (batched per-element seeding, min/max/length), `generateZodTuple/Record/Map/Set/Object`. |
| `index.ts` | Re-exports `generateFromSchema`. |

## Key-based data generators (`src/generators/data/`)

Field-name → realistic value. Each module is a flat set of `(prng, ctx?) => value` fns.

| File | Domain |
|------|--------|
| `key-map.ts` | **`DEFAULT_KEY_MAP` + `DEFAULT_KEY_PATTERNS`** — the ~165-entry field-name → generator table (exact keys + a few regex patterns), plus `generateFromKey`. The dispatch table the whole key axis hangs off. |
| `person.ts` | names, gender/sex, jobTitle/area/type, bio, prefix/suffix. |
| `internet.ts` | email, url, domain, username, IP/MAC, emoji, userAgent. |
| `location.ts` | address parts, city, country, zip/postalCode, lat/long. |
| `finance.ts` | iban, account, currency, credit-card (issuer→BIN). |
| `commerce.ts` | product, price, department, SKU. |
| `company.ts` | company name (tech-style formats), catchphrase. |
| `phone.ts` | phone numbers. |
| `vehicle.ts` | vin, make/model (manufacturer→model coherence). |
| `system.ts` | platform, browser, semver, fileName/Path, mimeType. |
| `color.ts` | colorName/Hex/Rgb/Hsl. |
| `word.ts` | Markov-backed noun/adjective, `sentence`, `paragraph`; `TECH_WORDS`. |
| `string.ts` | low-level string primitives (alphanumeric, etc.). |
| `date.ts` | date key generators (createdAt/updatedAt/birthdate…). |
| `sibling.ts` | sibling-aware helpers — read already-generated fields via `ctx.current` (e.g. firstName→gendered output, issuer→card prefix). |
| `markov/sample.ts` | runtime Markov-chain sampler (traverses compiled transition tables from the locale). |
| `index.ts` | Assembles the public `generators` namespace (note aliases: `internet.domain`, `location.postalCode`, `lorem.word`). |

## Locale & utils

| File | Role |
|------|------|
| `src/default-locale.ts` | The minimal, Markov-free English locale shipped with the core package — the fallback when no `locale` is passed. Richer locales are the `packages/locale-*` workspaces. |
| `src/utils/merge.ts` | `deepMerge` — used for overrides and intersections. |
| `src/utils/encoding.ts` | base64url / byte encoding helpers (uuid, nanoid, jwt). |

## Tooling

| File | Role |
|------|------|
| `scripts/train-markov.ts` | Build/train Markov models from corpora (the open-class word/name models). |
| `scripts/verify-markov.ts` | Inspect/sample a trained model. |

> Per-locale corpora and their own training scripts live in `packages/locale-*`. The
> generator-overhaul design + status is in [`research/`](research/overview.md).
