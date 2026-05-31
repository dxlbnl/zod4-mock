# B40: BUG — `ctx.gen.<ns>.<fn>()` ignores the configured locale (Markov models silently fall back to `defaultLocale`)

## Context

`WorldImpl.bindGenerators` ([src/world.ts:565-587](../../src/world.ts)) wraps
each locale-aware helper in a Proxy that binds the field PRNG but **drops the
`GeneratorContext`** that `makeFieldCtx` ([src/world.ts:599-628](../../src/world.ts))
otherwise builds with `locale: this.options.locale ?? defaultLocale`. Every
helper of the shape `fn(prng, ctx?: GeneratorContext)` — and the small set of
helpers with extra positional args before `ctx` (`word.words`,
`word.paragraph`, `commerce.price`) — therefore sees `ctx === undefined` and
falls back to `defaultLocale.word` / `defaultLocale.person` / etc.

The bug is silent: output looks plausible (real-ish English words from
`defaultLocale.word.nouns` such as `"Element"`, `"Object"`, `"Unit"`) so the
mismatch is usually only caught when a user compares against the locale they
configured. The canonical repro is the snippet from GitHub issue #23
(re-pinned verbatim under B40-R1).

Resolution direction A from the issue body is adopted (see the **Decision**
section below): bind the active `GeneratorContext` (the one
`makeFieldCtx` already constructs) into the proxy, and inject it as a default
`ctx` argument when the caller does not pass one. The existing
`helper(prng, ctx?)` signature is preserved across every namespace; the
adopted formula is `(...args) => fn(prng, args[0] ?? boundCtx, ...args.slice(1))`
for the dominant `(prng, ctx?)` shape, generalised through a small per-helper
ctx-slot table for the three helpers whose `ctx` is not at index 1 (see
B40-R3). No helper signature changes. The published `BoundGenerators`
type-mapping in [src/types.ts](../../src/types.ts) (which strips the
leading `prng: Prng` argument via `BoundModule<T>`) is **unchanged** —
omitting `ctx` was already legal at the type level; the fix only changes the
**runtime** binding so the omission no longer silently falls back to the
default locale.

> In this page, the keywords MUST, MUST NOT, SHOULD, and MAY are used as
> defined in RFC 2119 — they mark genuine requirements, not emphasis.

### Helper inventory (surveyed)

The implementer survey of `src/generators/data/*.ts` (counted in B40-R3 and
B40-R4) yields three call-shape buckets:

1. **`(prng, ctx?: GeneratorContext)`** — the dominant shape. ~50 helpers
   across `word`, `person`, `location`, `commerce`, `company`, `finance`,
   `date`, `color`, `phone`, `internet` namespaces. Every helper that reads
   `ctx?.locale ?? defaultLocale` falls into this bucket. Examples:
   `word.{noun,adjective,verb,adverb,conjunction,interjection,preposition,sentence,sample}`,
   `internet.{email,exampleEmail,username,displayName,domainWord}`,
   `location.{street,buildingNumber,streetAddress,secondaryAddress,zipCode,city,state,county,country,countryCode,continent,language,timeZone,direction,cardinalDirection,ordinalDirection}`,
   `commerce.{department,productAdjective,productMaterial,productName,product,productDescription}`,
   `company.{name,buzzAdjective,buzzNoun,buzzVerb,buzzPhrase,catchPhraseAdjective,catchPhraseDescriptor,catchPhraseNoun,catchPhrase}`,
   `finance.{currencyCode,currencyName,currencySymbol,currencyNumericCode,accountName,transactionType,transactionDescription,iban,bic,creditCardNumber}`,
   `date.{month,weekday,timeZone}`, `color.colorName`, `phone.number`,
   `person.{lastName,suffix,jobTitle,jobArea,jobType,jobDescriptor,gender,bio}`.
2. **`(prng, genderOrCtx?: Gender | GeneratorContext)`** — the
   `person.firstName`/`middleName`/`fullName`/`prefix` family
   ([src/generators/data/person.ts:62,92,96,101](../../src/generators/data/person.ts)).
   The discriminator is `typeof gOrCtx === "object"` inside `extractGender`
   ([person.ts:23-30](../../src/generators/data/person.ts)). Treated as the
   dominant shape for binding (B40-R3 rule 1): a passed string `Gender` wins,
   omitted → `boundCtx` injected.
3. **Helpers with one or more positional args BETWEEN `prng` and `ctx?`** —
   exactly three across the codebase:
   - `word.words(prng, count = 3, ctx?)` ([word.ts:85](../../src/generators/data/word.ts))
   - `word.paragraph(prng, sentenceCount = 3, ctx?)` ([word.ts:123](../../src/generators/data/word.ts))
   - `commerce.price(prng, min = 1, max = 1000, ctx?)` ([commerce.ts:44](../../src/generators/data/commerce.ts))

   These three require the proxy to inject `boundCtx` at the correct
   trailing index (B40-R3 rule 2 — per-helper ctx-slot table).

4. **No ctx at all** — pure prng-only helpers (`internet.{ip,ipv4,ipv6,port,mac,httpMethod,httpStatusCode,jwtAlgorithm,jwt,emoji,protocol,url,userAgent,urlPath,domainName,password}`,
   `string.{uuid,alphanumeric,hexadecimal,nanoid}`,
   `finance.{amount,accountNumber,pin,creditCardCVV,creditCardIssuer,routingNumber,bitcoinAddress,ethereumAddress,litecoinAddress}`,
   `date.{anytime,between,betweens,past,future,recent,soon,birthdate}`,
   `vehicle.*`, `system.*`, `person.{sex,sexType,zodiacSign}`,
   `color.{colorHex,colorRgb,colorHsl}`, `location.{latitude,longitude}`,
   `phone.imei`, `commerce.{isbn,upc}`, `finance.iban`'s helper-internal calls).
   These helpers MUST be left untouched by the fix (B40-R4).

### Decision

Adopted **direction A** as described in GitHub issue #23, generalised to the
three-bucket helper shape above. The other two options are rejected:

- **B** (rewrite every call-site to `(...args) => fn(prng, args[0] ?? boundCtx, ...args.slice(1))`)
  was the issue body's expansion of A and is what A actually becomes once
  bucket-3 helpers are accounted for. There is no separate B in practice — the
  spec adopts the unified formula at B40-R3.
- **C** (add a dedicated `ctx.gen.locale` slot the helpers read internally)
  is rejected: it requires touching **every** locale-aware helper to read
  `ctx.gen.locale` instead of `ctx.locale`, introduces a second locale slot
  alongside the existing `ctx.locale` (two sources of truth — a regression of
  D8's "one source per concept" framing), and provides no benefit over A for
  the call-site experience. Recorded under Out of scope.

The current Proxy-based `bindGenerators` is preserved (the surgical bug fix);
the eager-rebuild refactor proposed by [B36](../backlog/inbox/B36-bind-generators-eager.md)
is **NOT** folded in here — B36 is a behaviour-neutral chore that lands AFTER
B40 and builds on top of it (the eager rebuild gives each helper its own
wrapper, which makes the per-helper ctx-slot table unnecessary — but that
clean-up is B36's payload, not B40's).

### Architecture Rules compliance

- D1 — no `any` introduced. The current `bindGenerators` already carries two
  `Record<string, any>` types (flagged by B36); B40 leaves them as-is (B36
  removes them). Any **new** code MUST NOT introduce additional `any` — the
  per-helper ctx-slot table is typed as `Record<string, Record<string, number>>`
  (or equivalent strongly-typed shape).
- D4 — PRNG determinism is unaffected: `boundCtx` carries the existing
  `fieldPrng`, the same one `makeFieldCtx` already injects. No new PRNG forks,
  no counter advances.
- D5 — `docs/api-reference.md` MUST be updated in the same step (B40-R8).
- D6 — regression test MUST be added (B40-R7).
- D8 — registry-vs-return parity unaffected (the fix is in the matcher
  callback's data, not the registry write path).
- D9 — cache neutrality unaffected (no new cache reads/writes).

Item card: [wiki/backlog/doing/B40-ctx-gen-ignores-locale.md](../backlog/doing/B40-ctx-gen-ignores-locale.md).
Closes GitHub issue [#23](https://github.com/dxlbnl/zod4-mock/issues/23).

## Requirements

### B40-R1: `ctx.gen.word.noun()` resolves against the configured locale

When a world is created with a non-default `locale` and a matcher calls
`ctx.gen.word.noun()` with no positional arguments, the helper MUST receive
the configured locale via its `ctx` parameter so the noun is sampled from the
configured locale's `nounModel` (or its `nouns` array fallback) — **not**
from `defaultLocale.word`.

This is the canonical repro from GitHub issue #23 (re-pinned verbatim as the
regression scenario per D6). The requirement applies to every helper of the
form `fn(prng, ctx?: GeneratorContext)` whose body reads
`ctx?.locale ?? defaultLocale` — `word.noun` is the diagnostic surface because
its `nl`-locale output (Markov-generated Dutch words) is visibly disjoint
from `defaultLocale.word.nouns` (`["thing", "object", "item", "element",
"unit", "piece", "part", "section", "system", "process", "value", "result",
"matter", "concept", "subject", "factor"]` — all lowercase English; the
helper capitalises before returning, yielding `"Thing"`, `"Object"`, …).

- Scenario: `ctx.gen.word.noun()` with `locale: nl` produces Markov-Dutch
  GIVEN

  ```ts
  import { z } from "zod";
  import { createWorld } from "zod4-mock";
  import { nl } from "@zod4-mock/locale-nl";

  const Item = z.object({ id: z.uuid(), label: z.string() });
  const world = createWorld({ seed: 1, locale: nl });
  world.withSchema(Item, {
    matchers: {
      label: (ctx) => ctx.gen.word.noun(),
    },
  });
  ```

  WHEN

  ```ts
  const labels = Array.from({ length: 5 }, () => world.generate(Item, { store: false }).label);
  ```

  is executed
  THEN
  - every `labels[i]` is a `string`;
  - **none** of `labels` is contained in the capitalised
    `defaultLocale.word.nouns` set
    `["Thing","Object","Item","Element","Unit","Piece","Part","Section","System","Process","Value","Result","Matter","Concept","Subject","Factor"]`
    (the test asserts the absence of an `defaultEnglishCapitalisedNouns.has(label)` hit
    for every label produced — i.e. the configured `nl` locale clearly won
    over `defaultLocale`).
  - the labels are deterministic for `seed: 1` (re-running with the same seed
    produces the same five values — B40 MUST NOT introduce PRNG drift).

### B40-R2: explicit `ctx` at the call-site keeps winning (backwards-compat for the issue #23 workaround)

When a matcher passes `ctx` explicitly to a helper that already accepts
`ctx?: GeneratorContext` — the workaround documented in the GitHub issue
body, `ctx.gen.word.noun(ctx)` — the **caller's** `ctx` MUST be used by the
helper, **not** the bound default. Existing user code that adopted the
workaround MUST continue to produce byte-identical output after the fix lands
(no behaviour drift for workaround-using consumers).

- Scenario: workaround precedence preserved
  GIVEN the same `Item` schema, world and `nl` locale as B40-R1, with two
  separate worlds A and B (each `createWorld({ seed: 1, locale: nl })`,
  fresh `withSchema(Item, ...)`):
  ```ts
  // A — uses the bound default (the fix)
  worldA.withSchema(Item, {
    matchers: { label: (ctx) => ctx.gen.word.noun() },
  });
  // B — uses the explicit-ctx workaround
  worldB.withSchema(Item, {
    matchers: { label: (ctx) => ctx.gen.word.noun(ctx) },
  });
  ```
  WHEN
  ```ts
  const a = Array.from({ length: 5 }, () => worldA.generate(Item, { store: false }).label);
  const b = Array.from({ length: 5 }, () => worldB.generate(Item, { store: false }).label);
  ```
  THEN `a` deep-equals `b` — the bound default and the explicit pass-through
  produce identical values (both reach the helper with the same `nl`-locale
  ctx, the same `fieldPrng`, and therefore the same Markov sample).

### B40-R3: every locale-aware helper receives the bound `GeneratorContext` by default

`bindGenerators` MUST inject the active `GeneratorContext` (the one
`makeFieldCtx` builds — i.e. `{ locale: options.locale ?? defaultLocale, prng,
gen, source, registry, fieldPath, optionalProbability, related, generate,
recursionLimit, current, locale }`) as a default `ctx` argument for every
helper that accepts a `ctx?: GeneratorContext` parameter, **unless** the
caller already supplies a `ctx`-shaped value at the helper's ctx-slot
position.

The adopted runtime rule (covering all three call-shape buckets surveyed
above):

1. **Bucket 1 — `(prng, ctx?: GeneratorContext)`** (the dominant shape). The
   adapter is `(...args) => fn(prng, args[0] ?? boundCtx, ...args.slice(1))`.
   - Caller omits all args (`ctx.gen.word.noun()`) → `args[0] === undefined`
     → `args[0] ?? boundCtx === boundCtx` → helper sees `(prng, boundCtx)`.
   - Caller passes ctx (`ctx.gen.word.noun(ctx)`) → `args[0] === ctx` →
     `args[0] ?? boundCtx === ctx` → helper sees `(prng, ctx)` (B40-R2).
   - Caller passes a non-ctx value (e.g. `Gender` string to
     `person.firstName("male")`) → `args[0] === "male"` → helper sees
     `(prng, "male")` — preserves the bucket-2 discriminator inside
     `extractGender`.
2. **Bucket 3 — helpers with `ctx?` at a trailing index > 1**
   (`word.words(prng, count, ctx?)`, `word.paragraph(prng, sentenceCount, ctx?)`,
   `commerce.price(prng, min, max, ctx?)`). The adapter MUST inject
   `boundCtx` at the helper's declared ctx-slot index when the caller has not
   already supplied one. The implementer maintains a small typed
   ctx-slot table — exactly three entries — e.g.
   ```ts
   const CTX_SLOT: Readonly<Record<string, Readonly<Record<string, number>>>> = {
     word: { words: 2, paragraph: 2 },
     commerce: { price: 3 },
   };
   ```
   and the per-namespace adapter for any helper listed there is
   `(...args) => {
  const slot = CTX_SLOT[ns]?.[name];
  if (slot !== undefined && args[slot] === undefined) {
    const padded = [...args];
    while (padded.length < slot) padded.push(undefined);
    padded[slot] = boundCtx;
    return fn(prng, ...padded);
  }
  return fn(prng, ...args);
}`. No `any` MAY appear in the table or its lookup.
3. **Bucket 4 — pure prng-only helpers** (no `ctx?` parameter). Untouched
   (B40-R4). The bucket-1 adapter's trailing-arg behaviour (`fn(prng, undefined, ...)`)
   has no effect on these helpers because JS positional-arg overflow is a
   no-op for unread parameters.

The bound `GeneratorContext` MUST be the **same** `ctx` object
`makeFieldCtx` constructs — i.e. it MUST carry the same `fieldPrng`,
`fieldPath`, `current`, `related`, `registry`, `locale` and `source` the
matcher's `ctx` carries. Concretely: `bindGenerators` MUST be called with the
already-built `ctx`, not with a freshly-allocated locale wrapper.
The order of construction is therefore: `makeFieldCtx` builds the ctx
object, passes it (or its `{ prng, locale, current, source, registry,
fieldPath, related, generate, recursionLimit, optionalProbability }`) to
`bindGenerators`, and `bindGenerators` captures it in the closure for the
per-helper adapter to inject. Implementations MAY pass a narrower
"`GeneratorContext`-shaped subset" (e.g. `{ locale, current }`) as the
injected default — but the **minimum** field the helpers depend on is
`locale`, and `username`/`email`/`bio`/`creditCardNumber`/`displayName`
additionally depend on `current` (for `siblingString` lookups), so the
narrowing is at most "drop `gen`/`generate`/`registry`/`related`/`fieldPath`/
`recursionLimit`/`optionalProbability`/`source`"; if in doubt, **pass the
full ctx** — the issue body recommends exactly this.

- Scenario: bucket-1 helpers in `word`/`internet`/`location`/`company`/`finance`/`commerce` honour the locale
  GIVEN a world `createWorld({ seed: 1, locale: nl })` and a matcher that
  exercises one helper from each affected namespace through `ctx.gen.<ns>.<fn>()`
  (no args), e.g.

  ```ts
  const Probe = z.object({
    adj: z.string(),
    streetName: z.string(),
    cityName: z.string(),
    pno: z.string(),
    iban: z.string(),
    dept: z.string(),
    coName: z.string(),
    month: z.string(),
  });
  world.withSchema(Probe, {
    matchers: {
      adj: (ctx) => ctx.gen.word.adjective(),
      streetName: (ctx) => ctx.gen.location.street(),
      cityName: (ctx) => ctx.gen.location.city(),
      pno: (ctx) => ctx.gen.phone.number(),
      iban: (ctx) => ctx.gen.finance.iban(),
      dept: (ctx) => ctx.gen.commerce.department(),
      coName: (ctx) => ctx.gen.company.name(),
      month: (ctx) => ctx.gen.date.month(),
    },
  });
  ```

  WHEN `world.generate(Probe, { store: false })` is called
  THEN every produced field is drawn from the `nl` locale's corresponding
  table — i.e. `dept` is one of `nl.commerce.departments`, `cityName` is one
  of `nl.address.cities` (or a constructed name using `nl.address.cityPrefixes`/
  `nl.address.streetNames`/`nl.address.cityCores`), `pno` matches the
  Dutch phone format `/^0[1-9][0-9]?-/` (per the existing
  `tests/unit/generators/domains/localization.test.ts`), `iban` starts with
  `nl.address.ibanPrefix` (`"NL"`), `month` is one of `nl.date.months`, and
  `coName` includes a `nl.company.prefixes`/`nl.company.suffixes` morpheme.
  The test fixture lists the expected per-field membership set explicitly
  per helper (no fuzzy assertions).

- Scenario: bucket-3 helpers `word.words`, `word.paragraph`, `commerce.price` honour the locale
  GIVEN a world `createWorld({ seed: 1, locale: nl })` and a matcher

  ```ts
  matchers: {
    blurb:    (ctx) => ctx.gen.word.words(5),         // count = 5, ctx injected at index 2
    intro:    (ctx) => ctx.gen.word.paragraph(2),     // sentenceCount = 2, ctx injected at index 2
    priceTag: (ctx) => ctx.gen.commerce.price(1, 100), // min/max passed, ctx injected at index 3
  }
  ```

  WHEN one record is generated
  THEN
  - `blurb` is composed of five Dutch nouns (Markov-sampled from
    `nl.word.nounModel`) — none of the five space-separated tokens is in
    the `defaultLocale.word.nouns` capitalised set;
  - `intro` is composed of two sentences whose articles/prepositions/
    conjunctions come from `nl.word.articles`/`prepositions`/`conjunctions`
    (each of which is disjoint from the equivalent `defaultLocale`
    arrays — the spec relies on the existing locale fixtures);
  - `priceTag` matches `/^€[0-9]+,[0-9]{2}$/` (the Dutch comma decimal
    separator from `nl.commerce.formatPrice`) and **not**
    `/^\$[0-9]+\.[0-9]{2}$/` (the default-locale dot separator). This pins
    `commerce.price`'s ctx-slot binding (index 3) and demonstrates that the
    `min`/`max` args passed positionally before ctx are still honoured.

- Scenario: bucket-2 `person.firstName` keeps its `Gender`-or-`ctx` discriminator
  GIVEN a world `createWorld({ seed: 1, locale: nl })`
  WHEN three matchers exercise the discriminator:
  ```ts
  matchers: {
    nameDefault: (ctx) => ctx.gen.person.firstName(),        // args[0] undefined → boundCtx
    nameMale:    (ctx) => ctx.gen.person.firstName("male"),  // args[0] === "male" → string wins
    nameCtx:     (ctx) => ctx.gen.person.firstName(ctx),     // args[0] === ctx   → ctx wins
  }
  ```
  THEN
  - `nameDefault` is a `nl`-locale first name (drawn from
    `nl.person.firstNamesMale`/`firstNamesFemale`'s Markov models — the
    helper randomly picks male or female because `extractGender(boundCtx)`
    has no sibling gender field to read);
  - `nameMale` is a `nl`-locale **male** first name (the `"male"` string is
    preserved at `args[0]`, the discriminator inside `extractGender` resolves
    it to `"male"`, and `firstName` selects from `nl.person.firstNamesMale`)
    — but **the locale is still `nl`** even though `args[0]` is a non-ctx
    value, because the helper's own `(ctx?.locale ?? defaultLocale)` lookup
    falls back to `defaultLocale` here (no ctx reached it). This scenario
    documents the **known residual** for bucket-2 helpers: when a caller
    passes the Gender-string form, the locale does **NOT** flow through —
    the caller must use the workaround `ctx.gen.person.firstName(ctx)` or
    refactor to the ctx-form. The residual is recorded under Open questions
    (non-blocking) — fixing it requires either a per-helper bucket-2 adapter
    or merging into B36's eager rewrite;
  - `nameCtx` is a `nl`-locale first name (matches the workaround
    precedence rule B40-R2). The implementer MAY relax this assertion if a
    later iteration plumbs ctx through bucket-2 — the requirement here is
    that the workaround continues to work, not that the Gender-string form
    must also forward the locale.

### B40-R4: helpers that take no `ctx` MUST be unaffected

Pure prng-only helpers (helpers whose signature is `(prng: Prng, ...rest)`
with no `GeneratorContext` parameter) MUST behave identically before and
after this change. The bucket-1 adapter's trailing-arg expansion
(`fn(prng, args[0] ?? boundCtx, ...args.slice(1))`) is safe for these
helpers because, when the caller omits all args, the injected `boundCtx`
lands at an unused positional slot and JavaScript ignores extra positional
arguments. When the caller passes a numeric/string arg
(`ctx.gen.string.alphanumeric(12)`), the formula evaluates to
`fn(prng, 12 ?? boundCtx, ...[])` = `fn(prng, 12)` — byte-identical to the
pre-fix call.

The complete bucket-4 inventory (enumerated from the survey, MUST be
re-asserted by the regression test as "produces values determined only by
PRNG state, unchanged by `locale: nl`"):
`internet.{ip,ipv4,ipv6,port,mac,httpMethod,httpStatusCode,jwtAlgorithm,jwt,emoji,protocol,url,userAgent,urlPath,domainName,password}`,
`string.{uuid,alphanumeric,hexadecimal,nanoid}`,
`finance.{amount,accountNumber,pin,creditCardCVV,creditCardIssuer,routingNumber,bitcoinAddress,ethereumAddress,litecoinAddress}`,
`date.{anytime,between,betweens,past,future,recent,soon,birthdate}`,
`vehicle.{manufacturer,type,model,vehicle,color,fuel,vin,vrm,bicycle}`,
`system.{platform,browser,semver,fileExtension,mimeType,fileName,filePath}`,
`person.{sex,sexType,zodiacSign}`,
`color.{colorHex,colorRgb,colorHsl}`,
`location.{latitude,longitude}`,
`phone.imei`,
`commerce.{isbn,upc}`.

- Scenario: prng-only helpers produce identical output regardless of locale
  GIVEN two seed-matched worlds `createWorld({ seed: 1 })` and
  `createWorld({ seed: 1, locale: nl })`, and a schema
  `z.object({ uid: z.string(), code: z.string(), addr: z.string(), pcc: z.string(), ip: z.string() })`
  whose matchers are
  ```ts
  matchers: {
    uid:  (ctx) => ctx.gen.string.uuid(),
    code: (ctx) => ctx.gen.string.alphanumeric(12),
    addr: (ctx) => ctx.gen.finance.bitcoinAddress(),
    pcc:  (ctx) => ctx.gen.finance.pin(4),
    ip:   (ctx) => ctx.gen.internet.ipv4(),
  }
  ```
  WHEN one record is generated in each world
  THEN the two records deep-equal (every field is byte-identical) — the
  configured locale has no observable effect on bucket-4 helpers, before or
  after the fix.

### B40-R5: the `defaultLocale` fallback path remains intact when no `locale` is configured

When a world is created with **no** `locale` option (`createWorld({ seed })`)
and a matcher calls a bucket-1/bucket-3 helper, the helper MUST receive a
`ctx` whose `locale` is the package's `defaultLocale` (the minimal English
locale exported from `src/default-locale.ts`). The fix MUST NOT regress the
no-locale path: every value previously produced by an unconfigured world
remains byte-identical.

- Scenario: no-locale world keeps producing `defaultLocale` values
  GIVEN a baseline world `createWorld({ seed: 7 })` and the same schema +
  matchers from B40-R1's scenario (calling `ctx.gen.word.noun()` for the
  `label` field)
  WHEN `world.generate(Item, { store: false }).label` is computed five times
  in a row (seed-deterministic)
  THEN every produced label is **in** the capitalised `defaultLocale.word.nouns`
  set
  `["Thing","Object","Item","Element","Unit","Piece","Part","Section","System","Process","Value","Result","Matter","Concept","Subject","Factor"]` —
  i.e. the no-locale world still resolves to `defaultLocale`, matching the
  pre-fix output exactly. The test pins this list as a string-set membership
  check (no exact-string equality across releases, since per-seed values may
  vary if `defaultLocale.word.nouns` is reordered in an unrelated change).

### B40-R6: `defaultLocale` remains the safety-net inside the helpers themselves

Every bucket-1/bucket-3 helper's existing `(ctx?.locale ?? defaultLocale)`
fallback expression MUST stay in place — the proxy fix ensures `ctx?.locale`
is populated, but the helpers' own defensive fallback MUST continue to
protect against (i) third-party callers that construct a `GeneratorContext`
without a `locale` field, and (ii) `generators.*` calls made **outside** the
proxy (e.g. tests that import `generators.location.city(prng)` directly with
no ctx — see `tests/unit/generators/domains/localization.test.ts` line 45,
which calls `generators.phone.number(prng, nlCtx)` with an explicit ctx, and
line 32 etc. for the prng-only form).

- Scenario: direct helper call with no ctx still resolves to `defaultLocale`
  GIVEN `generators.word.noun` imported directly from
  `src/generators/data/word.ts` (or from the `generators` namespace at
  `src/index.ts`) and an ad-hoc PRNG `const prng = createPrng(1);`
  WHEN `generators.word.noun(prng)` is invoked with no ctx argument
  THEN the returned value is a capitalised entry from
  `defaultLocale.word.nouns` (the helper's own `?? defaultLocale` fallback
  protects the direct-call path). This scenario protects existing
  `tests/unit/generators/domains/localization.test.ts` style call shapes
  against accidental breakage by the proxy fix.

### B40-R7: regression test for the #23 repro (D6)

A new regression test file MUST be added at
`tests/unit/core/ctx-gen-locale-forwarding.test.ts` (or, if the implementer
prefers, alongside the existing localization suite at
`tests/unit/generators/domains/localization.test.ts` as a new
`describe("ctx.gen locale forwarding (B40)")` block — the directory choice
is the implementer's; the **test name** is fixed). The file MUST contain
**at minimum** one `it("regression #23 — ctx.gen.word.noun() honours nl locale", …)`
test that re-pins the canonical issue-#23 snippet verbatim (the GIVEN/WHEN
of B40-R1) and asserts the THEN of B40-R1 (no label appears in the
capitalised `defaultLocale.word.nouns` set, all labels are strings,
determinism check on seed reuse).

The test MUST fail on `main` (current code drops ctx → labels come from
`defaultLocale.word.nouns` → the absence assertion is violated) and pass
after the fix. The implementer MUST capture the failing run as evidence
("RED") in the implementer report before writing the fix.

- Scenario: regression test asserts the absence of default-locale leakage
  GIVEN the test file as written
  WHEN `pnpm test tests/unit/core/ctx-gen-locale-forwarding.test.ts`
  (or the equivalent vitest invocation) is run against the current `main`
  branch
  THEN the regression test fails — at least one of the five generated
  `labels` is in the capitalised `defaultLocale.word.nouns` set (today, all
  five do).
  AND when the same test is run after the fix lands, it passes — no label
  is in the default-locale set, every label is a string, and the values
  are deterministic across two seed-matched runs.

### B40-R8: `docs/api-reference.md` documents the locale forwarding (D5 — same step)

Per D5, the API reference MUST be updated in the same change that lands the
fix. The update MUST include:

- A one-paragraph note in the existing `**`gen`**` subsection of the
  `MatcherCtx` documentation (the section at
  [docs/api-reference.md:705-715](../../docs/api-reference.md)) stating that
  locale-aware helpers automatically receive the world's configured locale
  through `ctx.gen.<ns>.<fn>()` calls — i.e. callers no longer need the
  `ctx.gen.word.noun(ctx)` workaround for the dominant
  `(prng, ctx?)` shape. The note MUST mention the three bucket-3 helpers
  (`word.words`, `word.paragraph`, `commerce.price`) that work as well.
- An explicit caveat for the bucket-2 `person.firstName`/`middleName`/
  `fullName`/`prefix` family: when called with a `Gender` string
  (`ctx.gen.person.firstName("male")`), the locale is NOT auto-forwarded —
  callers wanting both a fixed gender AND the configured locale must use
  the workaround `ctx.gen.person.firstName(ctx)` (which reads the sibling
  `gender`/`geslacht` field via `extractGender`'s ctx branch) or omit the
  arg entirely.
- A cross-link to issue #23 and the new spec page is **not** required —
  user-facing docs MUST stay focused on the API contract.

- Scenario: `docs/api-reference.md` carries the locale-forwarding note
  GIVEN the B40 change applied
  WHEN `docs/api-reference.md` is read
  THEN the section near the `**`gen`** — generators namespace …` heading
  contains the literal substring `locale` (appearing in a sentence that
  describes auto-forwarding through `ctx.gen.<ns>.<fn>()`) AND the literal
  substring `ctx.gen.person.firstName(ctx)` (the bucket-2 caveat's
  workaround snippet) AND the literal substring `ctx.gen.word.noun()` (the
  default-shape example).

### B40-R9: changeset entry

A changeset file MUST be added at
`.changeset/b40-ctx-gen-locale-forwarding.md` with frontmatter
`"zod4-mock": patch`. The summary MUST:

- Reference closing GitHub issue #23 (literal substring `#23`).
- State the user-visible effect in one sentence ("matchers that call
  `ctx.gen.<ns>.<fn>()` now receive the world's configured locale by
  default — Markov-backed locales like `@zod4-mock/locale-nl` finally flow
  through; the explicit `ctx.gen.word.noun(ctx)` workaround is no longer
  needed for the dominant call shape").
- Note the bucket-2 (`person.firstName("male")`) residual is unchanged.

The bump kind is **patch**: this is a bug fix that corrects previously-broken
behaviour. The contract for default-locale (no `locale` option) users is
**unchanged** (B40-R5 / B40-R6). The fix surfaces previously-silent breakage
for users on non-default locales — those users were already producing wrong
output, so the new output is a correction, not a breaking change.
`BoundGenerators`'s public type-mapping is unchanged
([src/types.ts:43-53](../../src/types.ts) `BoundModule<T>` already strips
the leading `prng` argument and leaves `ctx` as a still-optional trailing
parameter; the runtime now honours that optional parameter's intent), so no
type-level breaking change attaches to the fix.

- Scenario: changeset present and well-formed
  GIVEN the B40 change applied
  WHEN `.changeset/b40-ctx-gen-locale-forwarding.md` is read
  THEN the file starts with the frontmatter block exactly
  `---\n"zod4-mock": patch\n---\n`, the body mentions `ctx.gen` and
  `locale`, the body contains the literal substring `#23`, and the body
  notes that the default-locale path is unchanged.

## Out of scope

- **Direction B and Direction C from issue #23.** B collapses into A under
  the survey (there is no separate "more aggressive currying" — it is the
  same formula); C (a dedicated `ctx.gen.locale` slot the helpers read
  internally) is rejected because it requires touching every helper, splits
  locale across two ctx paths, and provides no call-site benefit. Recorded
  here so the trade-off is preserved for future readers.
- **Bucket-2 `Gender`-string locale forwarding.** When a matcher calls
  `ctx.gen.person.firstName("male")` (or the other three bucket-2 helpers
  with a string `Gender` argument), the locale does NOT auto-forward in
  this change. Fixing it requires either (a) a per-helper bucket-2 adapter
  that swaps `boundCtx` in at the right slot when `args[0]` is a string
  (changes call-shape semantics — observable for any third-party code that
  inspects `arguments.length`), or (b) folding into B36's eager rewrite
  (where each helper is wrapped individually and ctx can be injected at the
  right slot without a generic adapter). Tracked as part of B36's scope; an
  explicit follow-up MAY be filed via `/intake` if B36 slips.
- **`BoundGenerators` type-shape change.** The current mapping
  `BoundModule<T>` already strips the leading `prng` argument from each
  helper's signature, leaving `ctx?` as an optional trailing parameter at
  the call-site. The fix preserves this shape exactly — no type-level
  breaking change attaches. A follow-up that tightens the type to mark
  `ctx?` as **internally bound** (so editor completion no longer suggests
  it as an opt-in argument) is left for a separate item, since it would
  affect every documented `ctx.gen.<ns>.<fn>(ctx)` workaround call site.
- **Refactoring helper signatures to `(opts: { prng, ctx, … })`.** Too
  invasive; would touch every locale package's helper imports and break
  every external consumer that calls `generators.*` directly. Out of scope.
- **Helpers that take a third or later positional argument BEFORE `ctx?`.**
  None found in the survey beyond the three bucket-3 entries
  (`word.words`/`word.paragraph`/`commerce.price`). The fix's bucket-3
  branch is exhaustive for the current helper inventory.
- **The B36 eager-bind refactor.** Replaces the Proxy with a per-namespace
  static object built once per `makeFieldCtx`. Behaviour-neutral cleanup
  that lands **after** B40 (B36 builds on the fix; folding them creates a
  larger, harder-to-review item).
- **PRNG / counter accounting in `bindGenerators`.** The fix injects no
  new PRNG forks, advances no counter, and writes no cache; D4 / D9 hold
  vacuously. No additional invariants to test beyond the existing
  determinism check inside B40-R1's "deterministic for `seed: 1`" assertion.

## Open questions

- **Bucket-2 `person.firstName("male")` residual — Non-blocking.** The
  `Gender`-string call shape does NOT pick up the configured locale in B40.
  Documented (B40-R3 third scenario; B40-R8 caveat). Fixing it requires a
  per-helper bucket-2 adapter or the B36 eager rewrite. Recorded under
  Out of scope as part of B36's scope; B40 proceeds.
- **Narrowing the injected `ctx` to a subset — Non-blocking.** B40-R3
  permits the implementer to pass either the full `GeneratorContext` or a
  narrower subset as the bound default, as long as `locale` and `current`
  are present (since `siblingString` reads `current`). Recommendation:
  pass the full ctx (the issue body recommends exactly this). Recorded,
  proceeds.
- **Per-helper ctx-slot table location — Non-blocking.** The bucket-3
  table (`{ word: { words: 2, paragraph: 2 }, commerce: { price: 3 } }`)
  MAY live inline in `bindGenerators`, in a sibling
  `src/generators/data/ctx-slot.ts` file, or as a const next to the helper
  metadata in `src/generators/data/index.ts`. Implementer's choice — the
  three entries are small enough that "inline in `bindGenerators`" is
  acceptable. Recorded, proceeds.

No blocking open questions remain; the spec can advance to `test-writer`.
