---
title: Library Comparison
slug: comparison
---

# Library Comparison

## Feature matrix

| Feature | zod4-mock | zod-mock | faker |
| --- | --- | --- | --- |
| Zod v4 schemas | ✓ | ✗ | — |
| Zod v3 schemas | ✗ | ✓ | — |
| Schema-driven output | ✓ | ✓ | ✗ |
| Relational / cross-entity IDs | ✓ | ✗ | ✗ |
| Type-safe output | ✓ | ✓ | ✗ |
| Seeded / deterministic | ✓ | ✗ | ✓ |
| No schema required | ✗ | ✗ | ✓ |
| Handles `.refine()` | partial | ✗ | — |
| Handles discriminated unions | ✓ | partial | — |

## Same shape, three libraries

### Generating a user record

**zod4-mock** (schema-driven, Zod v4):

```typescript
import { generate } from 'zod4-mock';
import { z } from 'zod';

const schema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(60),
  email: z.string().email(),
  age: z.number().int().min(18).max(99)
});

const user = generate(schema);
// TypeScript knows: { id: string; name: string; email: string; age: number }
```

**faker** (manual, no schema):

```typescript
import { faker } from '@faker-js/faker';

const user = {
  id: faker.string.uuid(),
  name: faker.person.fullName(),
  email: faker.internet.email(),
  age: faker.number.int({ min: 18, max: 99 })
};
// No type inference — you maintain the shape manually
```

**@anatine/zod-mock** (schema-driven, Zod v3 only):

```typescript
import { generateMock } from '@anatine/zod-mock';
import { z } from 'zod'; // must be zod v3

const schema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(60),
  email: z.string().email(),
  age: z.number().int().min(18).max(99)
});

const user = generateMock(schema);
// Works — but requires zod v3; no zod v4 support
```

## When to use each

| Use | Library |
| --- | --- |
| You use Zod v4 schemas | **zod4-mock** |
| You need cross-entity referential IDs | **zod4-mock** |
| You use Zod v3 and can't upgrade | **@anatine/zod-mock** |
| You don't have schemas and just need random data | **faker** |
| You need seeded, deterministic output with schemas | **zod4-mock** |

## Performance

Run the [live benchmark →](/bench) to compare ops/sec for your machine and schema type.
zod4-mock is consistently faster than zod-mock on equivalent schemas, with a typical
improvement of **2–4× on flat schemas** and **3–6× on nested schemas**.
