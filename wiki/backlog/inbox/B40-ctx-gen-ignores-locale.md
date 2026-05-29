---
id: B40
title: BUG — `ctx.gen.<ns>.<fn>()` ignores the configured locale (Markov models silently fall back to `defaultLocale`)
type: bug
priority: high
flags: [review]
created: 2026-05-29
---

## Description

GitHub issue [#23](https://github.com/dxlbnl/zod4-mock/issues/23). User-classified
**Mid-high** severity — silent: output looks plausible (real-ish English
words), so the bug is usually only caught when somebody specifically inspects
the data or hits a downstream test that depends on locale-specific output.

`WorldImpl.bindGenerators` binds **only the field PRNG** into the
`ctx.gen.<namespace>.<fn>` proxy. The locale-bearing `GeneratorContext` that
`makeFieldCtx` already builds (`{ locale: this.options.locale ?? defaultLocale, …}`)
is dropped on the floor before reaching the helpers. Every helper whose
signature is `fn(prng, ctx?: GeneratorContext)` — `word.{noun,adjective,verb,
adverb,conjunction,interjection,preposition,words,sentence,paragraph,sample}`,
plus equivalent shapes in other namespaces — sees `ctx === undefined` and
falls back to `defaultLocale.word`.

### Repro (from #23)

```ts
import { z } from 'zod';
import { createWorld } from 'zod4-mock';
import { nl } from '@zod4-mock/locale-nl';

const Item = z.object({ id: z.uuid(), label: z.string() });

const world = createWorld({ seed: 1, locale: nl });
world.withSchema(Item, {
  matchers: {
    label: (ctx) => ctx.gen.word.noun(),
  },
});

Array.from({ length: 5 }, () => world.generate(Item, { store: false }).label);
// expected (nl Markov): ["Aanmeerd", "Aagrovijdt", "Aanwaneenden", …]
// actual (TECH_WORDS fallback): ["Element", "Object", "Unit", …]
```

### Root cause (from #23 — verified during /intake by skim)

`src/world.ts`'s `bindGenerators(prng)` Proxy returns
`(...args) => fn(prng, ...args)`. When the matcher calls `ctx.gen.word.noun()`
with no args, the bound function calls `noun(prng /* args=[] */)` — the
second positional `ctx` is undefined. Inside `noun`:

```ts
export function noun(prng, ctx) {
  const w = (ctx?.locale ?? defaultLocale).word;
  return w.nounModel ? sampleMarkov(prng, w.nounModel) : cap(locPick(prng, w.nouns ?? []));
}
```

With `ctx` undefined, `defaultLocale.word` wins. The configured `nl` locale
never reaches `sampleMarkov`.

### Proposed fixes (from #23)

- **A** — bind both prng and ctx in `makeFieldCtx`; `bindGenerators` captures
  ctx (or just `{ locale }`) and forwards it. Small adapter
  `(...args) => fn(prng, args[0] ?? { locale })` preserves the existing
  `helper(prng, ctx)` shape but defaults ctx to the bound one when caller omits.
- **B** — bind `ctx` as the second positional default in `bindGenerators`,
  rewriting the proxy's call shape to `(...args) => fn(prng, args[0] ?? boundCtx, ...args.slice(1))`.
- **C** — add a dedicated `ctx.gen.locale` slot to the proxy and have helpers
  read it internally. More invasive but sidesteps the second-positional-arg
  ambiguity.

Recommend A: minimal change, preserves the explicit `helper(prng, ctx)` shape
that downstream consumers may rely on. spec-writer to confirm against
`packages/locale-core` types and the published `LocaleData` contract.

Flagged `review` — design choice A/B/C needs sign-off.

### Workaround today (from #23)

Pass `ctx` explicitly:

```ts
matchers: {
  label: (ctx) => ctx.gen.word.noun(ctx),   // ← pass ctx through
}
```

Ugly at the call site but localises to matcher code and is trivially
removable once the proxy forwards locale itself.

## Notes

- GitHub issue: [#23](https://github.com/dxlbnl/zod4-mock/issues/23).
- Related: [B36](../inbox/B36-bind-generators-eager.md) (B22's complexity
  proposal #14) — already proposes replacing the `bindGenerators` Proxy with
  an eager-bound object and dropping the two `any`s. **B40 should land
  first**, fixing the locale-forwarding bug; B36 can then build on top with
  the eager rewrite as a behaviour-neutral refactor. Alternatively, fold B40
  into B36 if the spec-writer judges that cleaner — but B36 is already
  classified as a refactor / non-product chore, and B40 is a real
  behaviour-changing bug fix, so keeping them separate respects the
  feature/bug/chore distinction.
- Related: every locale-aware helper in `packages/locale-{core,en,nl,names}/`
  takes the `(prng, ctx?)` signature this bug exposes — verify by grep
  during spec.
- Regression test required (D6) — the #23 repro is the canonical test
  (assert `nl` locale's word output actually flows through, not English).
- Changeset (patch or minor) per spec — likely patch (bug fix surfacing
  previously-hidden non-default-locale misuse; no contract change for
  default-locale users).
