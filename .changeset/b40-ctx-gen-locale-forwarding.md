---
"zod4-mock": patch
---

Fix `ctx.gen.<ns>.<fn>()` silently falling back to `defaultLocale` instead of honouring the world's configured `locale`. Previously, matcher calls like `ctx.gen.word.noun()` produced English Markov / `TECH_WORDS` output even when the world was created with a non-default locale — the `bindGenerators` proxy only forwarded the per-field PRNG, so the `ctx?` parameter every locale-aware helper accepts was always `undefined`.

The fix injects the active `GeneratorContext` into the proxy as the default `ctx` argument for every helper whose signature accepts one. Helpers that don't take ctx (e.g. `ctx.gen.internet.ip()`, `ctx.gen.string.uuid()`) are unaffected. Users who already adopted the documented workaround (`ctx.gen.word.noun(ctx)`) continue to work without modification — explicit ctx still wins.

For `person.firstName(genderOrCtx?)`, `person.middleName`, `person.fullName`, and `person.prefix`, locale forwarding only kicks in when the caller passes **no** arguments — the Gender-string and explicit-ctx forms are preserved verbatim. The Gender-string-without-locale case is left for the follow-up `bindGenerators` rewrite (B36).

(closes #23)
