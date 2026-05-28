---
"zod4-mock": minor
---

Registry reads (`all` / `pick` / `filter` / `find`) and `world.get` now return `z.infer<T>` — the output shape that the generators actually produce — instead of `input<T>`. Predicates passed to `filter`/`find` likewise accept `z.infer<T>`. Writes stay permissive: `registry.store`, matcher returns, and `GenerateOptions.overrides` still accept `input<T>`. Mirrors `z.coerce`'s input/output asymmetry; consumers holding a normal `z.infer<typeof Schema>` no longer need to cast at the registry boundary. Non-breaking in practice — code that ignored the previous `input<T>` typing or cast through it keeps working. (closes #7, #16)
