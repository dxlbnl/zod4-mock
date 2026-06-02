---
"zod4-mock": patch
---

- `world.generate(S, { locale })` now threads the per-call locale into matcher `ctx.locale` and `ctx.gen.*`, so locale callbacks like `loc.formatSentence` fire when reached from a matcher.
