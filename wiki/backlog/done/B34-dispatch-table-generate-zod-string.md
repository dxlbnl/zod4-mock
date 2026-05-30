---
id: B34
title: Refactor — replace `generateZodString`'s 22-arm `else if` chain with a format dispatch table
type: chore
priority: low
flags: []
created: 2026-05-29
---

## Description

`generateZodString` ([src/generators/schema/string.ts:180-238](../../src/generators/schema/string.ts#L180),
59 LOC, ~26 branches) has a 22-arm `else if` chain on `format` strings,
followed by a four-arm chain on check formats. Trivial to read line-by-line
but resists scanning.

Replace the `format` chain with a table at file top:

```ts
const FORMAT_GENERATORS: Record<string, (prng: Prng) => string> = {
  uuid: generateUuid,
  email: generateEmail,
  url: generateUrl,
  // ...
};

function generateZodString(schema: ZodTypeAny, ctx: GeneratorContext): string {
  const format = def(schema).format;
  const gen = format ? FORMAT_GENERATORS[format] : undefined;
  if (gen) return applyModifiers(gen(ctx.prng), checks, ctx.prng);
  // fallback to base string + check loop
}
```

The check-format chain stays a switch (it's order-sensitive). No behaviour
change.

## Notes
- Source: [B22 research report](../../research/reports/codebase-complexity.md), proposed item **#12**.
- Dimensions: 1 #5, 3 #7.
- Size: **S**.
