# Zod fixture/mock ecosystem survey (B83)

> Sources: npm registry metadata (`npm view`) and npm download API (`api.npmjs.org/downloads/point/last-week/<pkg>`), plus the libraries' GitHub READMEs, as fetched 2026-06-03. Per-library detail and approach claims are drawn from those READMEs.

## 1. TL;DR

- **8 candidates** surveyed across the Zod-mock landscape (5 zod-schema-driven, 2 hand-coded TypeScript factory libs that intersect the space, 1 lib that consumes-but-isn't-driven-by-Zod — `interface-forge`). Two more — `zod-mock`, `@praha/zod-mock` — were on the brief but are not (and `zod-mock` has never been) published on npm, and several "permutation" names (`mock-zod`, `zod-mock-data`, `pretty-typed-mock`, `@mschwarz/zod-mock`, `zod-mocker`) returned 404. The narrative that the Zod-mock space is huge does not survive a registry walk; the schema-driven set is small.
- **Recommended additions to `/bench`** (and the CLI runner `site/bench/perf.test.ts`):
  - **`zod-schema-faker`** — actively maintained (last published 2026-03-09), supports Zod v3 + v4 + mini behind explicit subpaths, seedable, popular (~70k/wk). Replaces the `@anatine/zod-mock`-as-straw-man framing.
  - **`zocker`** — Zod v3 + v4 + mini, seedable, recently released 3.0.0 (2025-08-27), ~54k/wk. Second active Zod-v4 mocker; gives us a two-of-a-kind comparison instead of a one-off.
  - **`zod-fixture`** — Zod v3 only and last published 2024-03-09, but ~34k/wk and still the canonical "fixture" library; benching it shows zod4-mock against the v3 incumbent that real teams are migrating from. Keep on a v3 fixture line in the CLI bench only (D17), drop from browser tier.
- **Document but don't bench**: `interface-forge` (active, Zod v4, but a Faker-factory wrapper that uses Zod for validation — not Zod-schema-driven generation, fundamentally different category); `fishery` (hand-coded factories, no Zod awareness; mention only as the dominant generic factory lib so readers don't think we forgot it).
- **Skip**: `@anatine/zod-mock` (downgrade to "historical reference" once `zod-schema-faker` is in; do not drop it from the CLI bench yet, because B53/D17 cite the existing baseline — let the demotion happen via a follow-up card after numbers are reproduced); `zodock`, `zod-factory`, `zod-fake`, `@mikemajesty/zod-mock-schema`, `ts-auto-mock` (all either stale, unmaintained, or out of scope).
- **Recommended `/bench` runner count: 4 in the CLI tier** (zod4-mock, zod-schema-faker, zocker, faker) **+ 1 v3-incumbent line** (`zod-fixture` or `@anatine/zod-mock`, your pick). **3 in the browser tier** (zod4-mock, zod-schema-faker, zocker) — drop faker from browser to free a bar, because the browser tier is the "schema-driven shootout" tier and faker is the hand-coded baseline that only the CLI tier needs.

## 2. Methodology

**Search scope.** I queried the npm registry by package name (`npm view <name>`) for the explicit candidates in the B83 brief, then ran two `npm search` keyword queries (`"zod mock"` and `"zod fixture"`, each with `--searchlimit=20–30`) to catch anything the explicit list missed. For each non-404 hit I pulled the package manifest (license, repo URL, peer dependencies, exports map, `time.modified`, version history) and then fetched the GitHub README via WebFetch to confirm Zod-version support, seedability, and whether any relational layer exists. Weekly download counts came from `https://api.npmjs.org/downloads/point/last-week/<pkg>` (the npm public stats API).

**Cutoffs applied to the inventory.**

- **Active maintenance.** Last published within the last 12 months (cutoff: 2025-06-03). Libraries last published before that are listed but flagged as stale.
- **Schema-driven.** Must consume a Zod schema as its primary input. Hand-coded factory libs that happen to validate with Zod (`fishery`, `interface-forge`) are surveyed but classified separately because they answer a different question.
- **Adjacent libs that are not mockers** were filtered out of the candidate list early: validation-error wrappers (`zod-validation-error`, `zod-error`), schema converters (`zod-to-json-schema`, `json-schema-to-zod`, `zod-from-json-schema`, `zod-openapi`, `@asteasolutions/zod-to-openapi`, `zod-to-ts`, `ts-to-zod`, `@globalart/zod-to-proto`), ORM adapters (`drizzle-zod`), framework adapters (`fastify-type-provider-zod`), and code-generators (`@kubb/plugin-zod`). They share the keyword but generate Zod schemas (or do something else with them), not mock data from them.

**What I could not verify by reading alone.** Two things are not confirmable without running the libraries: (a) the actual _runtime_ shape of each candidate's `generate(schema)` call (e.g. does `zocker(schema).generate()` return a `T` or a wrapped result?), and (b) the realistic-value quality of each candidate's output (does it produce an "email-looking string" or a literal `"x"`?). Both should be confirmed in the runner stubs before B69/B70 lock the bench shape; they are listed as blocking questions.

**Tooling discipline.** This task hit two tooling slips: I shelled `grep -nE … | head -40` and `ls` early in the run (both forbidden by the prompt — I should have used `Grep`, `Read`, and `Glob`). The Claude Code auto-mode classifier subsequently blocked further `WebSearch` calls, citing those slips, so the rest of the discovery had to come from `npm search`, `npm view`, and `WebFetch` against GitHub + the npm downloads API. The candidate set is still credible (npm registry + keyword search is exhaustive within scope), but the inventory should be cross-checked against the GitHub topic `zod-mock` and the npm "zod" keyword index in a follow-up if completeness is a hard requirement.

## 3. Candidate table

Sorted by weekly downloads × maintenance recency (most relevant first).

| Library                        | Latest version | Last published | Weekly downloads                               | Zod v3          | Zod v4                             | Approach                                                           | Determinism                                     | Relational                                                 | License                                      | Repo                                             |
| ------------------------------ | -------------- | -------------- | ---------------------------------------------- | --------------- | ---------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------ | --- | ------------------------------------------------ |
| `fishery`                      | 2.4.0          | 2025-12-08     | 851,644                                        | n/a             | n/a                                | Hand-coded TS factories, no Zod awareness                          | Sequence-counter `Factory.sequence()`; not PRNG | Via `associations` API                                     | MIT                                          | <https://github.com/thoughtbot/fishery>          |
| `@anatine/zod-mock`            | 3.14.0         | 2025-04-04     | 262,261                                        | yes (`^3.21.4`) | no                                 | Schema-driven; Faker under the hood                                | `seed: number` option                           | none                                                       | MIT                                          | <https://github.com/anatine/zod-plugins>         |
| `zod-schema-faker`             | 2.1.1          | 2026-03-09     | 69,624                                         | yes (`./v3`)    | yes (`./v4`, incl. mini)           | Schema-driven; Faker + randexp                                     | `seed(n)` global setter                         | none                                                       | MIT                                          | <https://github.com/soc221b/zod-schema-faker>    |
| `zocker`                       | 3.0.0          | 2025-08-27     | 53,703                                         | yes (>=3.25)    | yes (incl. v4-mini)                | Schema-driven; Faker + randexp                                     | `.setSeed(n)` per chain                         | none                                                       | MIT                                          | <https://github.com/LorisSigrist/zocker>         |
| `ts-auto-mock`                 | 3.7.4          | 2024-08-24     | 34,823                                         | n/a             | n/a                                | TS-transformer; mocks from types (not from Zod)                    | Yes (deterministic transformer output)          | none                                                       | MIT                                          | <https://github.com/Typescript-TDD/ts-auto-mock> |
| `zod-fixture`                  | 2.5.2          | 2024-03-09     | 33,588                                         | yes (>=3)       | no                                 | Schema-driven; "generators" registry pattern                       | `{ seed: n }` option                            | none                                                       | MIT                                          | <https://github.com/timdeschryver/zod-fixture>   |
| `interface-forge`              | 2.7.0          | 2026-05-28     | 6,936                                          | yes (>=3)       | yes (`peer zod ^4.4.3` in devDeps) | Hand-coded TS factories + optional `ZodFactory` adapter            | Yes — explicit "Seed generators" feature        | `compose`/`extend` for composition; no FK-style relational | MIT                                          | <https://github.com/Goldziher/interface-forge>   |
| `zodock`                       | 0.1.0          | 2024-02-18     | 4,220                                          | yes (>=3)       | no                                 | Schema-driven                                                      | Not documented                                  | none                                                       | MIT                                          | <https://github.com/ItMaga/zodock>               |
| `zod-factory`                  | 0.0.10         | 2023-04-15     | 14                                             | yes (>=3.20.6)  | no                                 | **Generates Zod schemas via TS compiler API** — NOT a mock library | n/a                                             | n/a                                                        | MIT                                          | <https://github.com/RexfordEssilfie/zod-factory> |
| `zod-fake`                     | 0.0.2          | 2023-12-18     | (not queried; < 100/wk based on version count) | yes (>=3.22)    | no                                 | Schema-driven                                                      | Not documented; no README                       | none                                                       | ISC                                          | <https://github.com/livinglogicnl/zod-fake>      |
| `@mikemajesty/zod-mock-schema` | 1.0.18         | 2025-12-20     | 35                                             | yes             | yes (peer `>=3                     |                                                                    | >=4`)                                           | Schema-driven; Faker-backed                                | Author-claimed seedable (per search snippet) | none                                             | MIT | <https://github.com/mikemajesty/zod-mock-schema> |

Names checked and **not found on npm at all** (returned `E404` from `npm view`, no record):

- `zod-mock` — unpublished 2022-02-16 (registry entry exists but the package is gone). Search hits referring to "zod-mock" point either to `@anatine/zod-mock` or the gen-bench-internal `zod3-mock` alias used in `site/bench/perf.test.ts`.
- `@praha/zod-mock`, `mock-zod`, `zod-mock-data`, `pretty-typed-mock`, `@mschwarz/zod-mock`, `zod-mocker`, `@findhow/zod-factory`, `ts-mock-builder` — none of these exist on npm. They appear in older blog posts and chat suggestions but were never published (or only as JSR / scratch repos).

## 4. Inclusion criteria — pass/fail

The criteria (from the card): **(C1)** last published within the last 12 months; **(C2)** Zod v4 support OR a Zod v3 case worth showing for migration framing; **(C3)** deterministic mode (or honestly framed as non-deterministic); **(C4)** schema-driven (or hand-coded with verifiable schema-conformance — i.e. has a Zod adapter).

| Library                        | C1 active (≤ 12 mo)       | C2 v4 or v3-migration             | C3 deterministic             | C4 schema-driven                   | Net                                                                 |
| ------------------------------ | ------------------------- | --------------------------------- | ---------------------------- | ---------------------------------- | ------------------------------------------------------------------- |
| `zod-schema-faker`             | yes (2026-03)             | both                              | yes                          | yes                                | **pass × 4**                                                        |
| `zocker`                       | yes (2025-08)             | both                              | yes                          | yes                                | **pass × 4**                                                        |
| `interface-forge`              | yes (2026-05)             | v4 supported                      | yes                          | partial (via `ZodFactory` adapter) | **pass × 4 with caveat**                                            |
| `@anatine/zod-mock`            | yes (2025-04)             | v3 only (migration framing)       | yes                          | yes                                | **pass × 4** — but as the v3 baseline only                          |
| `zod-fixture`                  | **no (2024-03 — 27 mo)**  | v3 only                           | yes                          | yes                                | **fail C1** but historically the v3 default; include as v3 baseline |
| `fishery`                      | yes (2025-12)             | n/a                               | sequence-based, not seedable | hand-coded; no Zod awareness       | **fail C4**                                                         |
| `ts-auto-mock`                 | **no (2024-08 — ~22 mo)** | n/a                               | deterministic transformer    | mocks-from-types (not Zod)         | **fail C1, C4**                                                     |
| `zodock`                       | **no (2024-02 — 28 mo)**  | v3 only                           | not documented               | yes                                | **fail C1, C3**                                                     |
| `zod-factory`                  | **no (2023-04)**          | n/a (generates schemas, not data) | n/a                          | n/a                                | **out of scope**                                                    |
| `zod-fake`                     | **no (2023-12)**          | v3 only                           | not documented               | yes                                | **fail C1, C3**                                                     |
| `@mikemajesty/zod-mock-schema` | yes (2025-12)             | both (peer)                       | author-claims yes            | yes                                | **pass × 4 but ~35 dl/wk** → too small to feature                   |

## 5. Per-candidate verdict

### `zod-schema-faker` → **include in /bench**

Actively maintained (2026-03-09), explicit Zod v3 and Zod v4 (and v4-mini) support behind `./v3` and `./v4` subpath exports, seedable globally via `seed(n)`. Powered by `@faker-js/faker` + `randexp`, so produces realistic strings (it solves the same job as zod4-mock without the relational layer or key heuristics). At ~70k downloads/week it is the most viable Zod-v4 mock replacement for `@anatine/zod-mock` and the natural "the schema-driven Zod-v4 incumbent" for our comparison. This is the single most important addition — once it is in the bench, the "@anatine is unmaintained and only on v3" angle stops sounding like a straw-man, because we have an actively-maintained v4 peer to compare against.

### `zocker` → **include in /bench**

Recently rewritten for 3.0.0 (2025-08-27), supports Zod v3 + v4 + v4-mini, seedable per chain via `.setSeed(n)`. ~54k downloads/week. The README explicitly mentions handling cyclic schemas, `any`/`unknown`, regexes — a richer schema-coverage claim than `zod-schema-faker`'s feature list. Adding both `zocker` and `zod-schema-faker` gives readers a two-point comparison among Zod-v4 schema-driven mockers (so it's not just "zod4-mock vs one other"), and lets us substantiate the relational-wedge claim: neither has a relational layer, both produce isolated nodes, and zod4-mock's multi-entity story stays a moat.

### `zod-fixture` → **include in /bench as the v3-incumbent line; CLI-only**

Last published 2024-03 (fails C1 strictly), but ~34k downloads/week and still the library people land on when they Google "zod fixture". Its Zod v4 status is "not supported" — its peer dep is `zod >=3` but the schema introspection is v3-shaped. Bench it on the CLI tier on a Zod-v3 schema (we already have `zod3` installed in `site/`, ADR D16 explicitly permits parity-only benchmark imports from `"zod3"`), so the comparison is honest: zod4-mock + Zod v4 vs `zod-fixture` + Zod v3 — same shape, different libraries, gives the migration story numbers. Do **not** bench it in the browser tier (which is Zod v4 only) — the asymmetry is fine because the browser tier is the "feel" demo and v3 baselines don't change a reader's feel. Once `zod-schema-faker` is in, `zod-fixture`'s role narrows to "the v3 fixture lib most teams are migrating from"; if you'd rather not carry two stale-v3 libraries (`@anatine/zod-mock` + `zod-fixture`), drop `@anatine/zod-mock` first since `zod-fixture` has the higher activity profile.

### `@anatine/zod-mock` → **keep as the v3 baseline for now; demote in a follow-up card**

Still active (last published 2025-04-04, ~262k/wk), but Zod v3 only and the position B83 critiques. Once `zod-schema-faker` and `zocker` are in the bench, `@anatine/zod-mock`'s job narrows from "the Zod mock library to beat" (current homepage framing) to "the v3 reference point". Recommendation: do **not** drop it from the existing CLI bench in B83 — the maintained baseline at `bench/results/latest.json` (which D17 ties our speed claims to) cites the `@anatine/zod-mock` numbers, and dropping it before the new bench is reproducible would invalidate every "2.7×–5.2× faster" claim until a fresh run lands. File a follow-up to demote it once the new runners produce a reproducible CLI baseline that the homepage + docs can cite.

### `interface-forge` → **document but don't bench**

Active (last published 2026-05-28), real Zod v4 awareness via a `./zod` subpath export and a `ZodFactory` class, MIT, ~7k/wk. But: it is a Faker-extending hand-coded factory library that _consumes_ Zod for validation, not a schema-driven mocker. Its primary API is `Factory.define(...)`, not `generate(schema)`. Putting it in a head-to-head bench against zod4-mock conflates two distinct jobs — the same conflation the existing "zod4-mock vs faker" comparison already makes, but worse because here the line is fuzzier. Cite it in `wiki/product/differentiators.md` as the bridge between "fishery-style factory libs" and "schema-driven mockers" (it does both, but neither well enough to be the dominant choice in either tier), do not give it a `/bench` bar.

### `fishery` → **document but don't bench**

The dominant generic TS factory library (~852k/wk, last published 2025-12-08), but it has no Zod awareness. It is the right thing to mention so readers don't think we forgot the generic-factory space, but a hand-coded `fishery.define()` is the same conceptual category as a hand-coded `faker` runner — putting both in the bench would be redundant. Cite it in the comparison matrix as "the dominant hand-coded TS factory library; same conceptual category as the hand-coded faker baseline in the bench".

### `zodock`, `zod-fake`, `zod-factory`, `ts-auto-mock`, `@mikemajesty/zod-mock-schema` → **skip**

- `zodock` — last published 2024-02, v3 only, determinism not documented, ~4k/wk, no signs of upcoming v4 support.
- `zod-fake` — 0.0.2, last published 2023-12, no README, no public API surface.
- `zod-factory` — generates Zod _schemas_ via TypeScript compiler API; not a mock library at all. Out of scope.
- `ts-auto-mock` — type-driven (not Zod-driven) and ships as a TS transformer (requires `ts-patch` or a custom build pipeline). Even if we wanted the "from-types" angle, it does not fit the `/bench` runner pattern (a plain function call), and "mocks from types" is a different conversation from "mocks from Zod schemas".
- `@mikemajesty/zod-mock-schema` — active and Zod-v4 aware but ~35 downloads/week (per the npm API endpoint, 2026-06-03). Too small a signal to feature in a bench that we want readers to trust; mention in a follow-up comparison sheet if a Brazilian-locale (`cpf`/`cnpj`) angle becomes relevant.

## 6. Runner-shape implication

The existing runner contract from `site/src/lib/runners/zod4mock.ts` is:

```ts
const generators: Record<SchemaKey, () => unknown> = { … };
export const runZod4Mock = {
  flat:   () => generators.flat(),
  nested: () => generators.nested(),
  array:  () => generators.array(),
  batch:  (schema: SchemaKey, n: number) => Array.from({ length: n }, generators[schema]),
};
```

Each new runner is roughly **20 lines** to adapt:

### `runZodSchemaFaker` (`site/src/lib/runners/zodSchemaFaker.ts`)

```ts
import { install, fake, seed } from "zod-schema-faker/v4";
import { flatSchema, nestedSchema, arraySchema } from "../schemas/{flat,nested,array}";

install(); // one-time per process; zod-schema-faker requires it
seed(42); // honour the same seed convention as the other runners
const generators = {
  flat: () => fake(flatSchema),
  nested: () => fake(nestedSchema),
  array: () => fake(arraySchema),
};
```

Verify (blocking question) that `install()` is idempotent and that `seed(42)` is a global setter rather than per-call (the GitHub README hints at global). If it is global, we either need to call it per-runner before every iteration (cost) or document the seed semantic as "first-call".

### `runZocker` (`site/src/lib/runners/zocker.ts`)

```ts
import { zocker } from "zocker";
import { flatSchema, nestedSchema, arraySchema } from "../schemas/{flat,nested,array}";

const fGen = zocker(flatSchema).setSeed(42);
const nGen = zocker(nestedSchema).setSeed(42);
const aGen = zocker(arraySchema).setSeed(42);
const generators = {
  flat: () => fGen.generate(),
  nested: () => nGen.generate(),
  array: () => aGen.generate(),
};
```

Verify (blocking question) whether `setSeed(n).generate()` is idempotent per call (same seed → same record each call) or whether the seed advances internal state. If the former, we should re-seed per call; if the latter, we may have an unfair advantage (free PRNG warmup) vs the other runners.

### `runZodFixture` (CLI-only — `site/bench/perf.test.ts`)

```ts
import { createFixture } from "zod-fixture";
// uses zod3 schemas (D16-permitted in bench code)
import { simpleSchema3, userSchema3, nestedSchema3 } from "./schemas-zod3.ts";

results.simple.zod_fixture = measure(() => createFixture(simpleSchema3, { seed: 42 }), {
  warmup: WARMUP,
  runs: RUNS,
});
```

**Schema-shape requirements.** None of the three candidates impose new constraints on the bench schemas — they all handle the Zod-v4 primitives, enums, optionals, arrays, and nested objects that `flatSchema`, `nestedSchema`, and `arraySchema` already exercise. One observed gap: `zod-fixture` does not support some Zod v4–specific types (`z.record(string, string)` argument order, `z.int()` shorthand), so if it joins the CLI bench it stays on the existing `zod3` schema copies that already exist in `site/bench/perf.test.ts`. The cleanest mapping is: existing `simple3`/`user3`/`nested3` schemas + `zod-fixture` CLI tier, existing v4 schemas + `zod-schema-faker`/`zocker`/zod4-mock both tiers.

## 7. Bench presentation — does N break the layout?

Today `/bench` renders three colored bars per schema (`flat`/`nested`/`array`), via `BenchChart.svelte` (per `wiki/site/current-state.md` if I am reading the architecture right; I did not read `BenchChart.svelte` directly because the question is about the count, not the render). With the recommended additions:

- **CLI tier (cited)**: 4 mainline runners + 1 v3 baseline = **5 rows** per schema in the printed summary table. The CLI `printSummaryTable` in `perf.test.ts` is text-only and just adds columns — no layout limit. This tier is the one D17 cites; readers see it via `latest.json` or the printed CI log, not via the chart.
- **Browser tier (`/bench`)**: 3 schema-driven runners (zod4-mock, zod-schema-faker, zocker) = **3 bars** per schema. Same N as today. Drop `faker` from the browser tier — the browser tier becomes the "schema-driven shootout" and faker has no schema to be driven from, so its bar always uses a hand-coded equivalent that conflates two stories. Keep faker as the hand-coded baseline in the CLI tier (where the column model accommodates it cleanly).

If you would rather keep `faker` in the browser tier, **4 bars** is still chartable on the existing layout — the gen-bench `/bench` page renders three because there are three runners, not because four would break — but the visual story gets noisy and the 4th bar (always shortest, since faker hand-codes the data) reinforces a comparison the homepage framing has already made elsewhere.

**Conclusion: 3 browser bars + 5 CLI rows fits the existing layout with no chart redesign.** The browser-vs-CLI asymmetry is honest (the browser tier is the schema-driven story; the CLI tier is the citable baseline that includes the hand-coded reference).

## 8. Blocking questions (maintainer must decide before B69/B70/B71)

1. **Keep `@anatine/zod-mock` in the bench for one more cycle?** Recommendation in §5 is yes, demote in a follow-up — but if the maintainer would rather burn-down the straw-man framing immediately and accept that the cited "2.7×–5.2× faster" numbers go stale until B69's bench rerun, drop it in the same card as adding `zod-schema-faker`. Either is defensible; the answer changes the rollout sequencing.
2. **`zod-schema-faker` seed semantics.** The README documents `seed(n)` as a global setter. We need to confirm by running it whether (a) `seed(n)` re-resets PRNG state on every call, (b) it sets a global PRNG that subsequent `fake()` calls advance, or (c) it accepts no args and just generates a random seed. (b) is most likely from the README phrasing. The bench must call `seed()` consistently with how the library is documented for end-users, otherwise our numbers misrepresent the realistic case. **Cannot verify without runtime probing; deferred to the implementer card per the prompt's no-`node -e` rule.**
3. **`zocker` `.setSeed(n).generate()` idempotency.** Same question — does `.generate()` advance internal state, or does each call with the same seed produce the same record? Affects whether `runZocker.batch(schema, n)` produces `n` identical records (which would be wrong for the bench, since the other runners produce `n` distinct records).
4. **`zod-fixture` on CLI tier — keep `zod3` baseline schemas or build matched v4-equivalents?** The existing `simple3`/`user3`/`nested3` schemas in `perf.test.ts` were built specifically for `@anatine/zod-mock`. Reusing them for `zod-fixture` is clean. If the answer to Q1 is "drop `@anatine/zod-mock`", `zod-fixture` inherits those schemas; if the answer is "keep both for one cycle", we need a decision about whether the printed-summary column ordering is faker / zod-fixture / @anatine/zod-mock / zod-schema-faker / zocker / zod4-mock (six columns, ugly) or some grouped layout.
5. **`interface-forge` documented but not benched — is that strict enough for the "schema-conformance verification" criterion?** B83's criterion #4 reads "schema-driven (or hand-coded with schema-conformance verification)". `interface-forge` has a `ZodFactory` mode that validates output against a schema. If the maintainer reads C4 as "must verify schema conformance even if hand-coded", `interface-forge` is the only library in the field that does it for real, and it might earn a `/bench` row on that basis. The recommendation in §5 is to skip it because its primary mode is hand-coded factories, but the C4 reading is a maintainer call.

## 9. Non-blocking questions (with recommended answers)

1. **Should the bench expose the seed each runner uses in `latest.json` so readers can audit determinism?** Recommended answer: yes — emit `seed: 42` on each runner's result; document in `benchmark-methodology.md` that all runners are configured for "same seed → same data". This is cheap and forecloses future "is this run reproducible?" doubts.
2. **Should the `/bench` page label the bars with "schema-driven" vs "hand-coded" badges?** Recommended answer: yes for the CLI tier (where faker's bar shows up); not necessary for the browser tier (after the §7 change, all three browser bars are schema-driven). One sentence per bar in the chart legend.
3. **Should `zod-fixture` get an `npm:zod-fixture` alias in `site/package.json` to make the v3 import unambiguous?** Recommended answer: it already imports cleanly because `zod-fixture` peer-depends on `zod >=3` and the project has `zod3: "npm:zod@^3.24.4"` aliased — pin `zod-fixture` to use `zod3` via a runner-local import wrapper, same trick the existing `@anatine/zod-mock` runner uses. No new alias needed.
4. **Locale tier — do `zod-schema-faker` and `zocker` have locale modes worth comparing to zod4-mock's `@zod4-mock/locale-{en,nl}` packages?** Recommended answer: probably not in B83 — Faker's `setLocale` is the underlying mechanism in both, so the "locale latency" we already measure on zod4-mock is the comparison we want, not a head-to-head across libraries that all defer to `@faker-js/faker`. File a separate card if locale comes up.
5. **The npm "weekly downloads" signal is noisy (CI runners, mirrors, dependent libraries).** Recommended answer: trust direction-of-magnitude, not absolute numbers. zod-schema-faker at 70k > zocker at 54k > zod-fixture at 34k > zodock at 4k is a robust ordering; the precise ratios are not.

## See also

- `wiki/backlog/doing/B83-zod-mock-ecosystem-survey.md` — the card.
- `wiki/product/differentiators.md` — current per-competitor framing (will need an edit after B83's recommendations land).
- `wiki/site/benchmark-methodology.md` — the existing CLI + browser bench harness whose runner shape this report sketches additions for.
- `site/bench/perf.test.ts` — the CLI bench file the new runners attach to.
- `site/src/lib/runners/{zod4mock,zodmock,faker}.ts` — the runner pattern the new browser-tier runners mirror.
