---
id: B36
title: Refactor — replace `bindGenerators` Proxy with an eagerly bound object; drop `any`
type: chore
priority: low
flags: []
created: 2026-05-29
---

## Description

`WorldImpl.bindGenerators` ([src/world.ts:472-494](../../src/world.ts#L472),
23 LOC) uses a double Proxy and two `Record<string, any>` types. The Proxy is
correct but heavy, and the `any`s break D1's spirit (D1: code MUST NOT use
`any`).

Replace with an eagerly bound object built once per `makeFieldCtx`:

```ts
private bindGenerators(prng: Prng, locale: LocaleData, ctx: GeneratorContext): BoundGenerators {
  return {
    person: bindNamespace(personGenerators, prng, locale, ctx),
    company: bindNamespace(companyGenerators, prng, locale, ctx),
    internet: bindNamespace(internetGenerators, prng, locale, ctx),
    // ...
  };
}
```

The per-namespace cache is good — keep it. Lose the Proxy machinery and the
two `any` types. SDK consumers of `BoundGenerators` get full type-completion.

## Notes
- Source: [B22 research report](../../research/codebase-complexity.md), proposed item **#14**.
- Dimensions: 3 #10, cross-cutting #5 (`any` slipping in via Proxies).
- Size: **S**.
- D1 hygiene: removes the only two `any` types reachable from `bindGenerators`.
