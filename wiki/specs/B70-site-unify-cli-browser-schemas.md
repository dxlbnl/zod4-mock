# B70: Unify CLI + browser bench schema set

## Context

`site/` currently maintains **two parallel schema sets** that overlap in intent but
diverge in shape and name:

- **CLI bench** (`site/bench/perf.test.ts`, `site/bench/regression.bench.ts`,
  `site/bench/perf-thresholds.test.ts`) defines its `simple` / `user` / `nested` /
  `matcher` (`CompanySchema` + `UserSchema`) tiers **inline**. These are the schema
  shapes the **perf-gate baseline** in `site/bench/results/baseline.json` and the
  historical `site/bench/results/versions.json` are pinned against. Changing them
  invalidates every per-version row and the B97-R1 / B97-R7 / B98-R5 / B98-R7
  threshold tests.
- **Browser bench** (`site/src/lib/schemas/flat.ts`, `nested.ts`, `array.ts`,
  `ecommerce.ts`, consumed by `site/src/lib/runners/{zod4mock,zodmock,faker,ecommerce}.ts`
  and the `/bench` route) defines `flat` / `nested` / `array` / `ecommerce` as
  per-schema files, each with a paired `zod3` parity export for
  `@anatine/zod-mock` comparison.

Drift makes the two benches incomparable: name collisions (CLI `nested` ≠ browser
`nested`), missing tiers (browser has no `user` / `matcher` equivalent; CLI has no
`array` / `ecommerce`), and double maintenance of the same intent (browser `flat`
overlaps with CLI `simple` but is richer).

This item promotes **one canonical schema set under `site/src/lib/schemas/`**
consumed by both harnesses. The acceptance test is structural: removing a schema
file from `site/src/lib/schemas/` MUST remove it from both `pnpm site:bench` (CLI)
and `/bench` (browser) without further edits.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as defined in
> RFC 2119 — they mark genuine requirements, not emphasis.

### Binding constraints (recap)

- **D16** — within `site/`, `"zod3"` imports MUST be parity-only benchmark code;
  production schemas import from `"zod"`. Every canonical schema therefore exports
  both a zod4 form (canonical) and a zod3 parity form.
- **D4 / D10** — schemas MUST be constructed once at module scope and reused;
  determinism is keyed on reference identity. Re-export, never re-construct.
- **D17 / D20** — speed claims cite the CLI baseline; the CLI `simple` / `user` /
  `nested` / `matcher` tiers are the citable surface. Browser numbers are
  qualitative, never quoted as ops/sec.
- **D1** — no `any`. Schemas use Zod's own types; runner-side adapters use
  `ZodTypeAny` (as `zodmock.ts` already does), not `any`.
- **B97 / B98 perf gate** — `baseline.json` is keyed on tier names
  `simple` / `user` / `nested` / `matcher`. `regression-compare.ts` exports
  `TIERS = [...] as const` over the same names. `versions.json` (`versions-schema.ts`)
  pins those names in both `avg_us` and `memory` blocks.

### Canonical-naming + shape decision (informs all requirements)

Two paths considered:

1. **Rename CLI tiers to browser names** (`flat` / `nested` / `array` / `ecommerce`).
   Rejected: breaks `baseline.json`, `versions.json`, `regression-compare.ts`'s
   `Tier` union, and every B97-R*/B98-R* threshold test, forcing a full
   re-baseline and historical backfill rerun.
2. **Keep CLI tier names canonical** (`simple` / `user` / `nested` / `matcher`),
   move the CLI inline schemas into `site/src/lib/schemas/` byte-equivalent (same
   field names, same Zod chains, same reference identity per module scope), and
   retain the **browser-only** tiers (`array`, `ecommerce`, and the current
   browser-`nested` order-shape under a non-colliding name `nestedOrder`) as
   additional canonical entries the CLI bench does not currently consume.

This spec adopts **Path 2**. Rationale: it preserves the perf baseline (B97/B98
thresholds keep passing without re-baselining), retains the browser demo's
richer shapes, and satisfies the card's acceptance — both harnesses import from
one canonical index.

Name collisions handled:

- CLI `simple` (4 plain fields) stays `simple`.
- CLI `user` stays `user`. Browser had no `user`.
- CLI `nested` (uuid + email + nested address + optional billing + tags array +
  string record — the **mixed-features** stress shape `latest.json` /
  `baseline.json` are pinned to) stays `nested`.
- Browser `nested` (an **order** shape: `id` / `total` / `status` /
  `customer.address`) is renamed `nestedOrder` to avoid collision; it remains a
  browser-tier entry and is **not** part of the CLI perf gate.
- CLI matcher tier (`CompanySchema` + `UserSchema` with `employer` relation +
  person/internet/location matchers) becomes the canonical `matcher` entry.
- Browser `flat` (10 fields with realistic constraints) is **deleted**: it
  overlaps `simple` in intent but is not a perf-gated shape, and its browser
  demo job is covered by `simple` + `user` once those are imported into the
  browser runners. Removed in the same change so `/bench`'s "flat" segmented-
  control option migrates to "simple".
- Browser `array` and `ecommerce` keep their names; they are extended browser
  entries.

### See also

- Item card: `wiki/backlog/doing/B70-site-unify-cli-browser-schemas.md`.
- `wiki/site/architecture.md` — site stack, the `schemas/` location.
- `wiki/architecture.md` — rules D1, D4, D10, D16, D17, D20.
- `wiki/research/reports/zod-mock-ecosystem-survey.md` (B83) — recommends
  adding `zod-schema-faker` and `zocker` runners; gated on B70 picking the
  canonical schema-set shape so those runners have a target import path. New
  schema shapes the survey names (discriminated-union-heavy, refine-heavy) are
  deferred to a B70-B follow-up (see Open questions).
- `wiki/research/reports/2026-05-13-gen-bench-bench-latest-results.md` —
  historical bench snapshot that pins the `simple` / `user` / `nested` tier
  names the CLI baseline is built on.
- B97 spec (`wiki/specs/B97-fix-eager-bindgenerators-perf-regression.md`) —
  introduces the matcher tier; the schemas this spec promotes MUST stay
  byte-equivalent to the schemas B97-R6 pinned.
- B98 spec (`wiki/specs/B98-perf-memory-regression-suite.md`) — the
  comparator + baseline + versions-history machinery this spec must not
  disturb.

## Requirements

### B70-R1: Canonical schema location

The system MUST locate the project's bench-and-demo schema set in a single
directory, `site/src/lib/schemas/`, with one canonical entry per schema
re-exported from `site/src/lib/schemas/index.ts`; the CLI bench
(`site/bench/perf.test.ts`, `site/bench/regression.bench.ts`,
`site/bench/perf-thresholds.test.ts`) and the browser bench (the `/bench` route
via `site/src/lib/runners/*`) MUST consume schemas exclusively by import from
this directory, with **no inline schema definitions** remaining in
`site/bench/*.ts` or `site/src/lib/runners/*.ts`.

- Scenario: no inline schemas remain in CLI bench files
  GIVEN the post-change repository
  WHEN a source-text scan of `site/bench/perf.test.ts`,
  `site/bench/regression.bench.ts`, `site/bench/perf-thresholds.test.ts`,
  `site/bench/baseline-matcher.test.ts`, and `site/bench/matcher-tier-shape.test.ts`
  is performed for the regex `z(3|4)?\.object\(\s*\{`
  THEN the only matches MUST be inside a comment or a string literal (no
  top-level `const` schema definitions), and each file MUST import its schemas
  via `from "../src/lib/schemas/..."` (relative path from `site/bench/`).

- Scenario: removing a canonical schema file removes it from both harnesses
  GIVEN the post-change repository
  WHEN `site/src/lib/schemas/<schemaName>.ts` is deleted and only `index.ts` is
  edited to remove the re-export
  THEN `pnpm site:test:unit` MUST report a TypeScript/import error from every
  consumer in `site/bench/` and `site/src/lib/runners/` that referenced the
  removed export, AND no other edit MUST be required to drop the schema from
  both `pnpm site:bench` and `/bench`.

### B70-R2: Dual zod4 + zod3 export per canonical schema

Every canonical schema file under `site/src/lib/schemas/` MUST export both a
zod4 form (named `<schemaName>` or `<schemaName>Schema`, importing from `"zod"`)
and a zod3 parity form (named `<schemaName>3` or `<schemaName>Schema3`,
importing from `"zod3"`); the two forms MUST have identical field names and
field order so the `@anatine/zod-mock` (zod3) runner and the zod4-mock (zod4)
runner exercise the same shape.

- Scenario: each canonical schema file pairs zod4 with zod3
  GIVEN any file `site/src/lib/schemas/<schemaName>.ts` other than `index.ts`
  WHEN the file is parsed
  THEN it MUST import from `"zod"` AND from `"zod3"`, AND export at least one
  zod4 schema constant AND its `3`-suffixed zod3 parity, with matching
  `Object.keys(...shape)` ordering on the two forms.

- Scenario: D16 holds for the unified set
  GIVEN any file under `site/src/lib/schemas/`
  WHEN its import statements are inspected
  THEN every `"zod3"` import MUST be paired with a benchmark/parity use (the
  `<name>3` export pattern); no production runtime path on the site MUST
  consume a `<name>3` export outside the parity-only zod3-mock runner.

- Scenario: matcher-tier schema is zod4-only (relations are a zod4-mock surface)
  GIVEN the canonical `matcher` entry
  WHEN inspected
  THEN it MUST export a zod4 form only; a zod3 parity is **not** required
  because the matcher tier is zod4-mock-specific (relations / matchers are not
  in `@anatine/zod-mock`'s API surface — `perf.test.ts` already gates it as
  zod4-mock-only and `regression-compare.ts` SKIPs the matcher row for legacy
  baselines).

### B70-R3: Module-scope reference identity preserved

Every canonical schema MUST be constructed exactly once at module scope and
re-exported as a named const (D10); consumers MUST receive the same schema
object reference on every import (no inline re-wrapping such as
`schema.optional()` at the call site if the result is then used as a registered
schema identity).

- Scenario: schema identity is stable across imports
  GIVEN any canonical export `S` from `site/src/lib/schemas/`
  WHEN two separate consumers both `import { S } from "$lib/schemas/..."`
  AND each calls `world.registry.pick(S)` against the same world
  THEN both consumers MUST resolve to the same schema reference (`===`
  identical), so `createWorld(...).withSchema(S, ...)` registered by one
  consumer is reachable by the other.

### B70-R4: CLI perf-baseline byte-equivalence (no re-baseline)

The schemas the CLI bench consumes after the unification MUST be field-by-field
**byte-equivalent** to the inline schemas they replace in
`site/bench/perf.test.ts` (the `simple4` / `user4` / `nested4` / `address4`
shapes and the matcher-tier `CompanySchema` / `AddressSchema` / `UserSchema`),
so the existing `site/bench/results/baseline.json` remains a valid reference
without re-baselining; the field set, field types, and Zod constraint chain on
each field MUST match the pre-change shape one-for-one.

- Scenario: simple-tier byte-equivalence
  GIVEN the post-change `site/src/lib/schemas/simple.ts`
  WHEN its zod4 export is inspected
  THEN its `shape` MUST have exactly the keys `["id", "name", "age", "active"]`
  in that order, with `z.string()`, `z.string()`, `z.number()`, `z.boolean()`
  respectively (no `.uuid()`, no `.min()`, no `.max()` — matching `simple4`
  pre-change exactly).

- Scenario: user-tier byte-equivalence
  GIVEN the post-change `site/src/lib/schemas/user.ts`
  WHEN its zod4 export is inspected
  THEN its `shape` MUST have exactly the keys
  `["id", "firstName", "lastName", "email", "age", "role", "bio", "score"]` in
  that order; `id` is `z.string().uuid()`; `email` is `z.string().email()`;
  `age` is `z.int().gte(18).lte(100)`; `role` is
  `z.enum(["admin", "user", "guest"])`; `bio` is `z.string().optional()`;
  `score` is `z.number().min(0).max(1)`.

- Scenario: nested-tier byte-equivalence
  GIVEN the post-change `site/src/lib/schemas/nested.ts`
  WHEN its zod4 export is inspected
  THEN its `shape` MUST have exactly the keys
  `["id", "name", "email", "address", "billingAddress", "tags", "metadata"]`
  in that order; `address` is an inner object with keys
  `["street", "city", "country", "zip"]`; `billingAddress` is the same address
  object made `.optional()`; `tags` is `z.array(z.string())`; `metadata` is
  `z.record(z.string(), z.string())`.

- Scenario: matcher-tier byte-equivalence
  GIVEN the post-change `site/src/lib/schemas/matcher.ts`
  WHEN inspected
  THEN it MUST export `CompanySchema` with keys `["id", "name", "industry"]`,
  `AddressSchema` with keys `["street", "city", "country"]`, and `UserSchema`
  with keys `["id", "fullName", "email", "city", "address", "employerId"]`
  (matching `perf.test.ts` lines 161–180 exactly), each constraint preserved
  (`id` / `employerId` are `.uuid()`, `email` is `.email()`, `address` is the
  inner `AddressSchema`).

- Scenario: regression.bench.ts inline schemas are also replaced byte-equivalently
  GIVEN the post-change `site/bench/regression.bench.ts`
  WHEN inspected
  THEN it MUST import its `simple` / `user` / `address` / `nested` / matcher
  schemas from `site/src/lib/schemas/` (not redefine them inline), AND the
  imported shapes MUST match the inline shapes the file had pre-change
  field-for-field.

- Scenario: perf gate remains green on the unified set
  GIVEN the post-change repository, an unchanged `site/bench/results/baseline.json`,
  and the canonical Node version recorded in `site/bench/baseline.md`
  WHEN `pnpm site:bench` runs end-to-end on a representative host
  THEN the regression-vs-baseline test in `perf.test.ts` MUST report a
  non-`FAIL` verdict (OK or WARN are both acceptable) AND
  `perf-thresholds.test.ts` MUST still pass under the existing tolerances
  (B97-R1 simple-tier avg ≤ 25 µs; B97-R7 matcher tier ≤ pre-fix / 3 ≈
  ≤ 2.33 ms).

### B70-R5: CLI bench imports the canonical schemas

`site/bench/perf.test.ts`, `site/bench/regression.bench.ts`,
`site/bench/perf-thresholds.test.ts`, `site/bench/matcher-tier-shape.test.ts`,
and `site/bench/baseline-matcher.test.ts` MUST import the schemas they
benchmark from `site/src/lib/schemas/` (relative path: `"../src/lib/schemas/..."`);
the matcher-tier-shape source-text grep assertions for the strings
`"CompanySchema"`, `"UserSchema"`, `"fullName"`, `"email"`, `"city"`,
`"address"`, `"employerId"` MUST still pass (the names are preserved through
the import).

- Scenario: perf.test.ts uses the canonical imports
  GIVEN the post-change `site/bench/perf.test.ts`
  WHEN inspected
  THEN it MUST contain at least one
  `import { ... } from "../src/lib/schemas/..."` statement covering
  `simple` / `user` / `nested` / `matcher`, AND its previous top-level
  `const simple4 = ...`, `const user4 = ...`, `const nested4 = ...`,
  `const CompanySchema = ...`, `const AddressSchema = ...`,
  `const UserSchema = ...` definitions MUST be removed.

- Scenario: matcher-tier-shape.test.ts still grep-passes
  GIVEN the post-change `site/bench/perf.test.ts`
  WHEN `site/bench/matcher-tier-shape.test.ts`'s source-text greps run
  (it reads `perf.test.ts` and asserts presence of `CompanySchema`,
  `UserSchema`, `fullName`, `email`, `city`, `address`, `employerId`, and a
  `describe("matcher schema", …)` block)
  THEN every grep assertion MUST still pass; the names survive via the
  `import { CompanySchema, UserSchema } from "..."` line and the describe
  block stays in the bench file.

- Scenario: regression.bench.ts uses the canonical matcher imports
  GIVEN the post-change `site/bench/regression.bench.ts`
  WHEN inspected
  THEN its `tryMatcherTier(...)` helper MUST receive `CompanySchema` /
  `UserSchema` via import (not local re-declaration), so each per-version
  `createWorld(...)` registers the same canonical reference identity that
  `perf.test.ts` registers — guaranteeing identical fork-key derivation
  across the perf gate and the bisect bench.

### B70-R6: Browser bench imports the canonical schemas

`site/src/lib/runners/zod4mock.ts`, `site/src/lib/runners/zodmock.ts`,
`site/src/lib/runners/faker.ts`, and `site/src/lib/runners/ecommerce.ts` MUST
import their schemas exclusively from `site/src/lib/schemas/`; the browser
`/bench` page MUST continue to expose at least the same schema choices users
have today (the segmented control's option list MUST cover the canonical set
that the runners surface).

- Scenario: zod4-mock browser runner uses the canonical set
  GIVEN the post-change `site/src/lib/runners/zod4mock.ts`
  WHEN inspected
  THEN every schema it generates MUST be imported from `$lib/schemas/...` or
  `../schemas/...`; no inline `z.object(...)` definition MUST remain.

- Scenario: zod3 browser runner stays in lockstep with the zod4 runner
  GIVEN the post-change `site/src/lib/runners/zodmock.ts`
  WHEN inspected
  THEN every schema it generates MUST be the `3`-suffixed parity export of a
  schema also imported (un-suffixed) by `zod4mock.ts`; the runner's `SchemaKey`
  union MUST be a subset of the union exported by
  `site/src/lib/schemas/index.ts`.

- Scenario: `/bench` segmented control surfaces the unified set
  GIVEN the post-change `site/src/routes/bench/+page.svelte`
  WHEN the file is inspected
  THEN its `schemaOptions` array values MUST be a subset of the canonical
  schema names exported from `site/src/lib/schemas/index.ts` (concretely:
  the post-change baseline option set is `["simple", "nestedOrder", "array"]`
  — `flat` is dropped because the browser's old 10-field `flatSchema` is
  replaced by the 4-field canonical `simple`; `nested` is intentionally
  CLI-only at first, available for opt-in later).

- Scenario (UI): `/bench` runs against the unified set without errors
  GIVEN the post-change site
  AND a fresh page load of `/bench`
  WHEN the page hydrates and `onMount` triggers the initial `run()`
  THEN the page MUST render the three MetricBadge cards (zod4-mock /
  zod-mock / faker) with finite numeric `ops/sec` values displayed (not
  the dash placeholder) within 5 seconds, AND the BenchChart MUST render at
  least one bar series with non-zero values.

### B70-R7: Canonical index exports the full set

`site/src/lib/schemas/index.ts` MUST exist and re-export every canonical
schema (zod4 + zod3 parity variants and `*Schema` companions such as
`CompanySchema` / `AddressSchema`) under named exports; the file MUST be the
single entry point both CLI bench and browser runners import from.

- Scenario: index exports the canonical names
  GIVEN the post-change `site/src/lib/schemas/index.ts`
  WHEN its exports are enumerated
  THEN the set MUST include at minimum the following named exports:
  `simple`, `simple3`, `user`, `user3`, `nested`, `nested3`, `address`,
  `address3`, `nestedOrder`, `nestedOrder3`, `array` (renamed export of the
  current `arraySchema`), `array3`, `ecommerce` companion exports
  (`userSchema`, `categorySchema`, `productSchema`, `variantSchema`,
  `reviewSchema`, `orderSchema`, and their type aliases), and the matcher tier
  (`CompanySchema`, `AddressSchema` for matcher's address, `UserSchema`).
  Naming collisions between matcher-tier `UserSchema` and ecommerce
  `userSchema` MUST be resolved by keeping the case distinction
  (PascalCase `UserSchema` is matcher's; camelCase `userSchema` is ecommerce's
  — same as the pre-change repo).

- Scenario: removing a canonical name from the index breaks the consumers
  GIVEN the post-change repository
  WHEN a single named export is removed from
  `site/src/lib/schemas/index.ts` (e.g. `array`)
  AND `pnpm site:check` runs
  THEN `pnpm site:check` MUST report a TypeScript error from every
  importing file, so the structural acceptance criterion ("removing a schema
  removes it from both harnesses") is observable as a typecheck failure.

### B70-R8: Schema unit tests cover the unified set

`site/src/lib/schemas/schemas.test.ts` MUST extend its existing per-file
assertions to the new canonical entries (`simple`, `user`, `matcher`,
`nestedOrder`) so a future regression to the shape — adding/removing a field
on the wrong shape, or swapping a constraint — fails a fast unit test before
it reaches the perf gate.

- Scenario: simple schema shape is asserted
  GIVEN the post-change `schemas.test.ts`
  WHEN the test file runs under `pnpm site:test:unit`
  THEN it MUST contain a test that asserts `Object.keys(simple.shape)` equals
  `["id", "name", "age", "active"]` AND a test that asserts `simple3` shares
  the same `Object.keys(...shape)` ordering as `simple`.

- Scenario: user schema shape is asserted
  GIVEN the post-change `schemas.test.ts`
  WHEN the test file runs
  THEN it MUST contain a test that asserts `Object.keys(user.shape)` equals
  `["id", "firstName", "lastName", "email", "age", "role", "bio", "score"]`
  AND that `user3` shares the same field-name ordering.

- Scenario: matcher schemas are asserted
  GIVEN the post-change `schemas.test.ts`
  WHEN the test file runs
  THEN it MUST contain a test that asserts `UserSchema.shape` exposes
  `employerId` (the relation FK), `address` (the nested matcher target), and
  `fullName` / `email` / `city` (the per-namespace matcher targets); AND a
  test that asserts `CompanySchema.shape` exposes `id`, `name`, `industry`.

- Scenario: nestedOrder retains the browser's customer.address shape
  GIVEN the post-change `schemas.test.ts`
  WHEN the test file runs
  THEN it MUST contain a test that asserts
  `nestedOrder.shape.customer.shape.address.shape` has the keys
  `["street", "city", "state", "zip", "country"]` (preserving the previous
  browser-nested demo richness even though the file is renamed).

### B70-R9: No re-baseline; baseline.json and versions.json are not touched

This change is **schema-shape-preserving by construction** (R4); the
implementer MUST NOT regenerate `site/bench/results/baseline.json`,
`site/bench/results/versions.json`, or `site/bench/results/history.json` as
part of this item; any divergence from `baseline.json` under the post-change
schemas MUST be treated as a real perf regression (B97/B98), not as a
"re-baseline opportunity".

- Scenario: baseline.json is unchanged in the diff
  GIVEN the commit landing this item
  WHEN the diff is inspected
  THEN `site/bench/results/baseline.json` MUST be unchanged byte-for-byte
  (no whitespace edit, no float re-render).

- Scenario: versions.json is unchanged in the diff
  GIVEN the commit landing this item
  WHEN the diff is inspected
  THEN `site/bench/results/versions.json` MUST be unchanged byte-for-byte;
  the `schemas: { simple: "...", user: "...", nested: "..." }` documentation
  block MAY be updated in a follow-up card if the canonical files' line
  numbers change, but is **not** edited as part of B70.

## Out of scope

- **Adding new bench runners** (`zod-schema-faker`, `zocker`, `zod-fixture`)
  recommended by B83. The card explicitly gates B69/B70 on B83; B70 produces
  the schema-set shape those runners will import. The runner additions are
  their own follow-up cards (named B70-A or new numbers per backlog
  convention).
- **Adding new schema shapes** the B83 survey called out as future coverage
  gaps (discriminated-union-heavy, refine-heavy, recursive). Deferred to a
  follow-up — they would extend the canonical set, not change the unification
  contract.
- **Re-baselining the perf gate.** R4 + R9 explicitly assert byte-equivalence;
  re-baselining would mean the byte-equivalence promise was broken, which
  would be a B98 regression (handle as such, not as part of B70).
- **Promoting `nested` (the CLI mixed-features shape) to a `/bench` browser
  option.** The browser may opt into it post-B70 in a follow-up, but B70 only
  guarantees the unified set is **available** to both harnesses; surfacing
  which subset each harness shows the user is a separate UX decision.
- **Editing `site/bench/baseline.md`** beyond what R5/R6 require to keep paths
  correct. The refresh workflow it documents stays valid (the comparator is
  shape-blind to schema-source location).
- **Changing the bench harness contract** — `measure()`, `BenchResult`,
  `sampleMemory`, `compareToBaseline`, the threshold values, the writeback
  helpers all stay as-is.
- **Changing `site/src/lib/runners/ecommerce.ts`'s matcher topology** — it
  uses its own `userSchema` (lowercase, ecommerce's user) and that is
  preserved; the matcher tier's `UserSchema` (PascalCase) is a separate
  canonical export.

## Open questions

1. **Browser tier exposure of `user` and `matcher`** — should the `/bench`
   route's segmented control add `"user"` and/or `"matcher"` once the
   canonical set carries them, or stay on `["simple", "nestedOrder", "array"]`
   for B70's scope? **Non-blocking.** Spec proposes: keep B70 to the
   structural unification; expose new tiers via a follow-up card so the UX +
   chart-bar count decision is made separately. The schemas exist in the
   canonical set either way (R7).
2. **Whether `ecommerce` schemas need a zod3 parity** — the
   `runners/ecommerce.ts` file is zod4-only and exercises the relational
   matcher API (a zod4-mock surface); zod3-mock cannot generate it
   equivalently. **Non-blocking.** Spec proposes: omit zod3 parity for
   `ecommerce.ts` (same carve-out R2 applies to `matcher.ts` — zod4-mock-only
   features have no zod3 parity).
3. **`array` schema — keep `arraySchema.length(50)` exactly?** It's a
   primary-array shape (no inner record identity) and the current browser
   bench uses it as a 50-row stress. CLI doesn't bench it. **Non-blocking.**
   Spec proposes: preserve `.length(50)` (no shape change), file under
   `array.ts`, and rename the export from `arraySchema` to `array` (with
   `array3` parity) for naming consistency with the rest of the set. The
   `runners.test.ts` assertion `expect((record as unknown[]).length).toBe(50)`
   stays green.
4. **B83 follow-up coverage shapes (discriminated-union-heavy,
   refine-heavy).** Survey did not produce a hard requirement; it noted them
   as coverage gaps. **Non-blocking.** Spec proposes: defer to a follow-up
   card (provisional name B70-B). Adding them in B70 would change the
   baseline (new tiers ⇒ new rows ⇒ re-baseline) and conflict with R9.
5. **Naming collision risk: matcher-tier `UserSchema` vs ecommerce
   `userSchema`.** The case distinction (PascalCase vs camelCase) is what
   the pre-change repo already relies on (see `perf.test.ts` line 173 vs
   `ecommerce.ts` line 3). **Non-blocking.** Spec proposes: preserve the
   case-distinguished pair via `index.ts`'s named re-export; document the
   distinction inline in `schemas/matcher.ts` (zod4-mock matcher-tier API)
   vs `schemas/ecommerce.ts` (ecommerce demo).
6. **`flat.ts` deletion vs renaming.** Current browser `flatSchema` is a
   10-field shape (uuid/email/role/etc.) — richer than CLI `simple`'s 4
   plain fields. Deleting it (this spec's R6 decision) trades demo richness
   for less duplication. **Non-blocking.** Spec proposes: delete `flat.ts`;
   the richer 8-field `user.ts` covers the realistic-fields demo and
   `simple.ts` covers the primitive-fields demo. If the deletion turns out
   to lose a visible browser-bench distinction the user values, restore
   `flat.ts` in a follow-up; the change is reversible.
