# Zod v4 Schema Coverage Checklist

This file catalogs every Zod v4 schema type, modifier, and validator and audits `zod4-mock` for coverage.

Status legend: ✅ supported · ❌ not supported · ⚠️ partial

---

## Primitive types

| Schema          | Status | Notes |
| --------------- | ------ | ----- |
| `z.string()`    | ✅     |       |
| `z.number()`    | ✅     |       |
| `z.boolean()`   | ✅     |       |
| `z.bigint()`    | ✅     |       |
| `z.date()`      | ✅     |       |
| `z.symbol()`    | ✅     |       |
| `z.null()`      | ✅     |       |
| `z.undefined()` | ✅     |       |
| `z.any()`       | ✅     |       |
| `z.unknown()`   | ✅     |       |
| `z.never()`     | ✅     |       |
| `z.void()`      | ✅     |       |
| `z.nan()`       | ✅     |       |

---

## String validators / formats

These can be applied as methods on `z.string()` or as top-level `z.*()` shortcuts.

### Length & pattern

| Validator          | Status | Notes                                                                   |
| ------------------ | ------ | ----------------------------------------------------------------------- |
| `.min(n)`          | ✅     |                                                                         |
| `.max(n)`          | ✅     |                                                                         |
| `.length(n)`       | ✅     |                                                                         |
| `.regex(pattern)`  | ✅     | Supports simple patterns and character sets natively; falls back safely |
| `.includes(str)`   | ✅     |                                                                         |
| `.startsWith(str)` | ✅     |                                                                         |
| `.endsWith(str)`   | ✅     |                                                                         |

### Case / normalization transforms

| Validator                         | Status | Notes                 |
| --------------------------------- | ------ | --------------------- |
| `.trim()`                         | ✅     |                       |
| `.toLowerCase()` / `.lowercase()` | ✅     |                       |
| `.toUpperCase()` / `.uppercase()` | ✅     |                       |
| `.normalize()`                    | ❌     | Unicode normalization |

### Semantic formats

| Format                                   | Status | Notes                       |
| ---------------------------------------- | ------ | --------------------------- |
| `.email()` / `z.email()`                 | ✅     |                             |
| `.url()` / `z.url()`                     | ✅     |                             |
| `z.httpUrl()`                            | ❌     |                             |
| `.uuid()` / `z.uuid()`                   | ✅     |                             |
| `z.uuidv4()`                             | ✅     |                             |
| `z.uuidv6()`                             | ❌     |                             |
| `z.uuidv7()`                             | ❌     |                             |
| `z.uuidv8()`                             | ❌     |                             |
| `z.guid()`                               | ✅     | alias for uuid              |
| `.ip()` / `z.ip()`                       | ❌     |                             |
| `z.ipv4()`                               | ❌     |                             |
| `z.ipv6()`                               | ❌     |                             |
| `z.cidr()` / `z.cidrv4()` / `z.cidrv6()` | ✅     | cidrv4 and cidrv6 supported |
| `.e164()` / `z.e164()`                   | ✅     |                             |
| `.emoji()`                               | ✅     |                             |
| `.base64()` / `z.base64()`               | ✅     |                             |
| `z.base64url()`                          | ✅     |                             |
| `.hex()`                                 | ❌     |                             |
| `.jwt()` / `z.jwt()`                     | ✅     |                             |
| `.nanoid()`                              | ✅     |                             |
| `.cuid()`                                | ✅     |                             |
| `.cuid2()`                               | ✅     |                             |
| `.ulid()`                                | ✅     |                             |
| `.mac()`                                 | ❌     |                             |
| `.hostname()`                            | ✅     |                             |
| `.hash()`                                | ❌     |                             |
| `z.stringbool()`                         | ❌     |                             |

### ISO date/time formats

| Format             | Status | Notes           |
| ------------------ | ------ | --------------- |
| `z.iso.date()`     | ✅     | `YYYY-MM-DD`    |
| `z.iso.time()`     | ✅     | `HH:MM:SS[.ms]` |
| `z.iso.datetime()` | ✅     |                 |
| `z.iso.duration()` | ✅     |                 |

---

## Number validators

| Validator                     | Status | Notes                |
| ----------------------------- | ------ | -------------------- |
| `.gt(n)`                      | ✅     |                      |
| `.gte(n)` / `.min(n)`         | ✅     |                      |
| `.lt(n)`                      | ✅     |                      |
| `.lte(n)` / `.max(n)`         | ✅     |                      |
| `.positive()`                 | ❌     |                      |
| `.nonnegative()`              | ❌     |                      |
| `.negative()`                 | ❌     |                      |
| `.nonpositive()`              | ❌     |                      |
| `.multipleOf(n)` / `.step(n)` | ✅     |                      |
| `.int()`                      | ✅     |                      |
| `.finite()`                   | ❌     |                      |
| `.safe()`                     | ⚠️     | Handled contextually |

### Numeric format schemas (top-level)

| Schema        | Status | Notes |
| ------------- | ------ | ----- |
| `z.int()`     | ✅     |       |
| `z.float32()` | ❌     |       |
| `z.float64()` | ❌     |       |
| `z.int32()`   | ✅     |       |
| `z.uint32()`  | ❌     |       |
| `z.int64()`   | ❌     |       |
| `z.uint64()`  | ❌     |       |

---

## BigInt validators

| Validator             | Status | Notes |
| --------------------- | ------ | ----- |
| `.gt(n)`              | ✅     |       |
| `.gte(n)` / `.min(n)` | ✅     |       |
| `.lt(n)`              | ✅     |       |
| `.lte(n)` / `.max(n)` | ✅     |       |
| `.positive()`         | ❌     |       |
| `.nonnegative()`      | ❌     |       |
| `.negative()`         | ❌     |       |
| `.nonpositive()`      | ❌     |       |
| `.multipleOf(n)`      | ❌     |       |

---

## Collection types

### `z.array(schema)`

| Modifier      | Status | Notes |
| ------------- | ------ | ----- |
| `.min(n)`     | ✅     |       |
| `.max(n)`     | ✅     |       |
| `.length(n)`  | ✅     |       |
| `.nonempty()` | ❌     |       |

### `z.tuple([...schemas])`

| Feature             | Status | Notes |
| ------------------- | ------ | ----- |
| Fixed-length tuples | ✅     |       |
| `.rest(schema)`     | ✅     |       |

### `z.object({...})`

| Method                               | Status | Notes                               |
| ------------------------------------ | ------ | ----------------------------------- |
| `.extend({...})` / `.safeExtend()`   | ✅     | Handled generically via def parsing |
| `.merge(schema)`                     | ✅     |                                     |
| `.pick({...})`                       | ✅     |                                     |
| `.omit({...})`                       | ✅     |                                     |
| `.partial()`                         | ✅     |                                     |
| `.partial({...})`                    | ✅     |                                     |
| `.required()`                        | ✅     |                                     |
| `.deepPartial()`                     | ✅     |                                     |
| `.keyof()`                           | ✅     |                                     |
| `.catchall(schema)`                  | ❌     |                                     |
| `.strict()` / `z.strictObject()`     | ✅     |                                     |
| `.passthrough()` / `z.looseObject()` | ✅     |                                     |
| `.strip()`                           | ✅     |                                     |

### `z.record(keySchema, valueSchema)`

| Variant                                   | Status | Notes |
| ----------------------------------------- | ------ | ----- |
| `z.record(valueSchema)`                   | ✅     |       |
| `z.record(keySchema, valueSchema)`        | ✅     |       |
| `z.partialRecord(keySchema, valueSchema)` | ❌     |       |
| `z.looseRecord()`                         | ❌     |       |

### `z.map(keySchema, valueSchema)`

| Feature   | Status | Notes |
| --------- | ------ | ----- |
| Basic Map | ✅     |       |

### `z.set(schema)`

| Modifier      | Status | Notes               |
| ------------- | ------ | ------------------- |
| `.min(n)`     | ✅     |                     |
| `.max(n)`     | ✅     |                     |
| `.size(n)`    | ✅     | Handled generically |
| `.nonempty()` | ❌     |                     |

---

## Enum and literal types

| Schema                    | Status | Notes |
| ------------------------- | ------ | ----- |
| `z.enum([...values])`     | ✅     |       |
| `z.enum().extract([...])` | ✅     |       |
| `z.enum().exclude([...])` | ✅     |       |
| `z.nativeEnum(TsEnum)`    | ❌     |       |
| `z.literal(value)`        | ✅     |       |
| `z.literal([...values])`  | ❌     |       |

---

## Union and composition types

| Schema                                    | Status | Notes |
| ----------------------------------------- | ------ | ----- |
| `z.union([...schemas])`                   | ✅     |       |
| `z.discriminatedUnion(key, [...schemas])` | ✅     |       |
| `z.intersection(a, b)`                    | ✅     |       |
| `z.pipe(a, b)`                            | ✅     |       |

---

## Special / advanced types

| Schema                          | Status | Notes                         |
| ------------------------------- | ------ | ----------------------------- |
| `z.templateLiteral([...parts])` | ✅     |                               |
| `z.lazy(() => schema)`          | ✅     |                               |
| `z.instanceof(Class)`           | ❌     | Throws UnsupportedSchemaError |
| `z.custom(fn)`                  | ❌     | Throws UnsupportedSchemaError |
| `z.file()`                      | ❌     | Throws UnsupportedSchemaError |
| `z.function()`                  | ❌     | Throws UnsupportedSchemaError |
| `z.json()`                      | ✅     | Generates valid JSON          |
| `z.xor(a, b)`                   | ✅     | Generates from left or right  |

---

## Universal schema methods

These apply to every schema.

| Method                    | Status | Notes                   |
| ------------------------- | ------ | ----------------------- |
| `.optional()`             | ✅     |                         |
| `.nullable()`             | ✅     |                         |
| `.nullish()`              | ✅     |                         |
| `.default(value)`         | ✅     |                         |
| `.prefault(value)`        | ❌     |                         |
| `.catch(value)`           | ✅     |                         |
| `.brand<T>()`             | ❌     |                         |
| `.readonly()`             | ✅     |                         |
| `.array()`                | ✅     |                         |
| `.promise()`              | ✅     | Returns undefined       |
| `.or(schema)`             | ✅     |                         |
| `.and(schema)`            | ✅     |                         |
| `.refine(fn, msg?)`       | ❌     | Runtime validation only |
| `.superRefine(fn)`        | ❌     |                         |
| `.check(fn)`              | ❌     |                         |
| `.transform(fn)`          | ❌     | Runtime mapping only    |
| `.overwrite(fn)`          | ❌     |                         |
| `.preprocess(fn, schema)` | ❌     |                         |
| `.pipe(schema)`           | ✅     |                         |

---

## Sources

- [Zod v4 release notes](https://zod.dev/v4)
- [Zod API reference](https://zod.dev/api)
- [Zod packages/zod](https://zod.dev/packages/zod)
