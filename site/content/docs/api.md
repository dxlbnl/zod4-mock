---
title: API Reference
slug: api
---

# API Reference

## `generate(schema, options?)`

```typescript
import { generate } from 'zod4-mock';

generate(schema: ZodType, options?: GenerateOptions): z.infer<typeof schema>
```

### Options

| Option | Type     | Default     | Description                                                    |
| ------ | -------- | ----------- | -------------------------------------------------------------- |
| `seed` | `number` | `undefined` | Deterministic seed — same seed always produces the same output |

```typescript
const user = generate(userSchema, { seed: 42 });
const sameUser = generate(userSchema, { seed: 42 });
// user deep-equals sameUser ✓
```

## Supported Zod types

| Type                                  | Generated value                        |
| ------------------------------------- | -------------------------------------- |
| `z.string()`                          | Random word or phrase                  |
| `z.string().min(n).max(m)`            | String of length within range          |
| `z.string().email()`                  | Realistic email address                |
| `z.string().uuid()`                   | UUID v4                                |
| `z.string().url()`                    | `https://` URL                         |
| `z.number()`                          | Float                                  |
| `z.number().int()`                    | Integer                                |
| `z.number().min(n).max(m)`            | Number within range                    |
| `z.boolean()`                         | `true` or `false`                      |
| `z.date()`                            | `Date` object                          |
| `z.enum([...])`                       | Random element of the enum             |
| `z.literal(val)`                      | The literal value                      |
| `z.object({...})`                     | Recursively generated object           |
| `z.array(item)`                       | Array of generated items               |
| `z.tuple([...])`                      | Tuple with each position generated     |
| `z.union([...])`                      | One of the union members               |
| `z.discriminatedUnion('type', [...])` | One variant, with correct discriminant |
| `z.optional(schema)`                  | Value or `undefined`                   |
| `z.nullable(schema)`                  | Value or `null`                        |
| `z.record(key, val)`                  | Object with generated key/value pairs  |

## String format heuristics

`zod4-mock` inspects string constraints to generate semantically appropriate values:

| Constraint          | Example output                     |
| ------------------- | ---------------------------------- |
| `.email()`          | `alice.smith@example.com`          |
| `.uuid()`           | `3f6e1a2b-c3d4-5e6f-…`             |
| `.url()`            | `https://example.com/path`         |
| `.min(2).max(50)`   | String within that character range |
| `.regex(/^\d{4}$/)` | String matching the pattern        |

## Playground

Try any Zod expression:

```typescript playground
z.object({
  id: z.string().uuid(),
  product: z.object({
    name: z.string(),
    price: z.number().min(0.01).max(9999.99),
    inStock: z.boolean(),
  }),
  tags: z.array(z.string()).min(1).max(5),
  status: z.enum(["active", "archived", "draft"]),
});
```
