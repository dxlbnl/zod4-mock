# Zod v4 Schema Coverage Checklist

This file catalogs every Zod v4 schema type, modifier, and validator so we can audit
`zod4-mock` for coverage gaps.

Status legend: ✅ supported · ❌ not supported · ⚠️ partial · ❓ unknown

---

## Primitive types

| Schema          | Status | Notes |
| --------------- | ------ | ----- |
| `z.string()`    | ❓     |       |
| `z.number()`    | ❓     |       |
| `z.boolean()`   | ❓     |       |
| `z.bigint()`    | ❓     |       |
| `z.date()`      | ❓     |       |
| `z.symbol()`    | ❓     |       |
| `z.null()`      | ❓     |       |
| `z.undefined()` | ❓     |       |
| `z.any()`       | ❓     |       |
| `z.unknown()`   | ❓     |       |
| `z.never()`     | ❓     |       |
| `z.void()`      | ❓     |       |
| `z.nan()`       | ❓     |       |

---

## String validators / formats

These can be applied as methods on `z.string()` or as top-level `z.*()` shortcuts.

### Length & pattern

| Validator          | Status | Notes |
| ------------------ | ------ | ----- |
| `.min(n)`          | ❓     |       |
| `.max(n)`          | ❓     |       |
| `.length(n)`       | ❓     |       |
| `.regex(pattern)`  | ❓     |       |
| `.includes(str)`   | ❓     |       |
| `.startsWith(str)` | ❓     |       |
| `.endsWith(str)`   | ❓     |       |

### Case / normalization transforms

| Validator                         | Status | Notes                     |
| --------------------------------- | ------ | ------------------------- |
| `.trim()`                         | ❓     | transform, not constraint |
| `.toLowerCase()` / `.lowercase()` | ❓     |                           |
| `.toUpperCase()` / `.uppercase()` | ❓     |                           |
| `.normalize()`                    | ❓     | Unicode normalization     |

### Semantic formats

| Format                                   | Status | Notes                    |
| ---------------------------------------- | ------ | ------------------------ |
| `.email()` / `z.email()`                 | ❓     |                          |
| `.url()` / `z.url()`                     | ❓     |                          |
| `z.httpUrl()`                            | ❓     | http/https only          |
| `.uuid()` / `z.uuid()`                   | ❓     | any version              |
| `z.uuidv4()`                             | ❓     |                          |
| `z.uuidv6()`                             | ❓     |                          |
| `z.uuidv7()`                             | ❓     |                          |
| `z.uuidv8()`                             | ❓     |                          |
| `z.guid()`                               | ❓     | alias for uuid           |
| `.ip()` / `z.ip()`                       | ❓     | v4 or v6                 |
| `z.ipv4()`                               | ❓     |                          |
| `z.ipv6()`                               | ❓     |                          |
| `z.cidr()` / `z.cidrv4()` / `z.cidrv6()` | ❓     |                          |
| `.e164()` / `z.e164()`                   | ❓     | phone numbers            |
| `.emoji()`                               | ❓     |                          |
| `.base64()` / `z.base64()`               | ❓     |                          |
| `z.base64url()`                          | ❓     |                          |
| `.hex()`                                 | ❓     |                          |
| `.jwt()` / `z.jwt()`                     | ❓     |                          |
| `.nanoid()`                              | ❓     |                          |
| `.cuid()`                                | ❓     |                          |
| `.cuid2()`                               | ❓     |                          |
| `.ulid()`                                | ❓     |                          |
| `.mac()`                                 | ❓     | MAC address              |
| `.hostname()`                            | ❓     |                          |
| `.hash()`                                | ❓     |                          |
| `z.stringbool()`                         | ❓     | env-style boolean string |

### ISO date/time formats

| Format             | Status | Notes                  |
| ------------------ | ------ | ---------------------- |
| `z.iso.date()`     | ❓     | `YYYY-MM-DD`           |
| `z.iso.time()`     | ❓     | `HH:MM:SS[.ms]`        |
| `z.iso.datetime()` | ❓     | full ISO 8601 datetime |
| `z.iso.duration()` | ❓     | ISO 8601 duration      |

---

## Number validators

| Validator                     | Status | Notes                          |
| ----------------------------- | ------ | ------------------------------ |
| `.gt(n)`                      | ❓     |                                |
| `.gte(n)` / `.min(n)`         | ❓     |                                |
| `.lt(n)`                      | ❓     |                                |
| `.lte(n)` / `.max(n)`         | ❓     |                                |
| `.positive()`                 | ❓     | > 0                            |
| `.nonnegative()`              | ❓     | >= 0                           |
| `.negative()`                 | ❓     | < 0                            |
| `.nonpositive()`              | ❓     | <= 0                           |
| `.multipleOf(n)` / `.step(n)` | ❓     |                                |
| `.int()`                      | ❓     |                                |
| `.finite()`                   | ❓     |                                |
| `.safe()`                     | ❓     | within Number.MAX_SAFE_INTEGER |

### Numeric format schemas (top-level)

| Schema        | Status | Notes           |
| ------------- | ------ | --------------- |
| `z.int()`     | ❓     | integer subtype |
| `z.float32()` | ❓     |                 |
| `z.float64()` | ❓     |                 |
| `z.int32()`   | ❓     |                 |
| `z.uint32()`  | ❓     |                 |
| `z.int64()`   | ❓     |                 |
| `z.uint64()`  | ❓     |                 |

---

## BigInt validators

| Validator             | Status | Notes |
| --------------------- | ------ | ----- |
| `.gt(n)`              | ❓     |       |
| `.gte(n)` / `.min(n)` | ❓     |       |
| `.lt(n)`              | ❓     |       |
| `.lte(n)` / `.max(n)` | ❓     |       |
| `.positive()`         | ❓     |       |
| `.nonnegative()`      | ❓     |       |
| `.negative()`         | ❓     |       |
| `.nonpositive()`      | ❓     |       |
| `.multipleOf(n)`      | ❓     |       |

---

## Collection types

### `z.array(schema)`

| Modifier      | Status | Notes |
| ------------- | ------ | ----- |
| `.min(n)`     | ❓     |       |
| `.max(n)`     | ❓     |       |
| `.length(n)`  | ❓     |       |
| `.nonempty()` | ❓     |       |

### `z.tuple([...schemas])`

| Feature             | Status | Notes         |
| ------------------- | ------ | ------------- |
| Fixed-length tuples | ❓     |               |
| `.rest(schema)`     | ❓     | variadic tail |

### `z.object({...})`

| Method                               | Status | Notes               |
| ------------------------------------ | ------ | ------------------- |
| `.extend({...})` / `.safeExtend()`   | ❓     |                     |
| `.merge(schema)`                     | ❓     |                     |
| `.pick({...})`                       | ❓     |                     |
| `.omit({...})`                       | ❓     |                     |
| `.partial()`                         | ❓     | all keys optional   |
| `.partial({...})`                    | ❓     | selective partial   |
| `.required()`                        | ❓     |                     |
| `.deepPartial()`                     | ❓     |                     |
| `.keyof()`                           | ❓     |                     |
| `.catchall(schema)`                  | ❓     |                     |
| `.strict()` / `z.strictObject()`     | ❓     | disallow extra keys |
| `.passthrough()` / `z.looseObject()` | ❓     | allow extra keys    |
| `.strip()`                           | ❓     | default behavior    |

### `z.record(keySchema, valueSchema)`

| Variant                                   | Status | Notes       |
| ----------------------------------------- | ------ | ----------- |
| `z.record(valueSchema)`                   | ❓     | string keys |
| `z.record(keySchema, valueSchema)`        | ❓     | typed keys  |
| `z.partialRecord(keySchema, valueSchema)` | ❓     |             |
| `z.looseRecord()`                         | ❓     |             |

### `z.map(keySchema, valueSchema)`

| Feature   | Status | Notes |
| --------- | ------ | ----- |
| Basic Map | ❓     |       |

### `z.set(schema)`

| Modifier      | Status | Notes |
| ------------- | ------ | ----- |
| `.min(n)`     | ❓     |       |
| `.max(n)`     | ❓     |       |
| `.size(n)`    | ❓     |       |
| `.nonempty()` | ❓     |       |

---

## Enum and literal types

| Schema                    | Status | Notes                    |
| ------------------------- | ------ | ------------------------ |
| `z.enum([...values])`     | ❓     |                          |
| `z.enum().extract([...])` | ❓     |                          |
| `z.enum().exclude([...])` | ❓     |                          |
| `z.nativeEnum(TsEnum)`    | ❓     |                          |
| `z.literal(value)`        | ❓     | single value             |
| `z.literal([...values])`  | ❓     | multiple values (v4 new) |

---

## Union and composition types

| Schema                                    | Status | Notes |
| ----------------------------------------- | ------ | ----- |
| `z.union([...schemas])`                   | ❓     |       |
| `z.discriminatedUnion(key, [...schemas])` | ❓     |       |
| `z.intersection(a, b)`                    | ❓     |       |
| `z.pipe(a, b)`                            | ❓     |       |

---

## Special / advanced types

| Schema                          | Status | Notes             |
| ------------------------------- | ------ | ----------------- |
| `z.templateLiteral([...parts])` | ❓     |                   |
| `z.lazy(() => schema)`          | ❓     | recursive schemas |
| `z.instanceof(Class)`           | ❓     |                   |
| `z.custom(fn)`                  | ❓     | fully custom      |
| `z.file()`                      | ❓     | File/Blob         |
| `z.function()`                  | ❓     | callable schemas  |
| `z.json()`                      | ❓     | any JSON value    |
| `z.xor(a, b)`                   | ❓     | exclusive OR      |

### `z.file()` modifiers

| Modifier            | Status | Notes               |
| ------------------- | ------ | ------------------- |
| `.min(bytes)`       | ❓     |                     |
| `.max(bytes)`       | ❓     |                     |
| `.mime([...types])` | ❓     | MIME type whitelist |

---

## Type coercion

| Schema               | Status | Notes |
| -------------------- | ------ | ----- |
| `z.coerce.string()`  | ❓     |       |
| `z.coerce.number()`  | ❓     |       |
| `z.coerce.boolean()` | ❓     |       |
| `z.coerce.bigint()`  | ❓     |       |
| `z.coerce.date()`    | ❓     |       |

---

## Universal schema methods

These apply to every schema.

| Method                          | Status | Notes                                |
| ------------------------------- | ------ | ------------------------------------ |
| `.optional()`                   | ❓     | `T \| undefined`                     |
| `.nullable()`                   | ❓     | `T \| null`                          |
| `.nullish()`                    | ❓     | `T \| null \| undefined`             |
| `.default(value)`               | ❓     | fills in undefined                   |
| `.prefault(value)`              | ❓     | pre-parse default (v4 new)           |
| `.catch(value)`                 | ❓     | fallback on parse error              |
| `.brand<T>()`                   | ❓     | nominal typing                       |
| `.readonly()`                   | ❓     |                                      |
| `.array()`                      | ❓     | shorthand for `z.array(this)`        |
| `.promise()`                    | ❓     |                                      |
| `.or(schema)`                   | ❓     | shorthand union                      |
| `.and(schema)`                  | ❓     | shorthand intersection               |
| `.refine(fn, msg?)`             | ❓     |                                      |
| `.superRefine(fn)`              | ❓     | deprecated; use `.check()`           |
| `.check(fn)`                    | ❓     | v4 replacement for superRefine       |
| `.transform(fn)`                | ❓     | type-changing transform              |
| `.overwrite(fn)`                | ❓     | non-type-changing transform (v4 new) |
| `.preprocess(fn, schema)`       | ❓     | alias for pipe                       |
| `.pipe(schema)`                 | ❓     |                                      |
| `.meta(obj)` / `.describe(str)` | ❓     | metadata                             |

---

## Error customization

| API                                  | Status | Notes                           |
| ------------------------------------ | ------ | ------------------------------- |
| `error` param (unified, v4)          | ❓     | on any schema                   |
| `message` param (deprecated v3)      | ❓     |                                 |
| `required_error` (deprecated v3)     | ❓     |                                 |
| `invalid_type_error` (deprecated v3) | ❓     |                                 |
| `z.prettifyError(err)`               | n/a    | runtime utility, not generation |

---

## Utility / runtime

These are Zod utilities rather than schema types; they don't need mock generation support but are noted for completeness.

- `z.infer<T>` — extract TypeScript type
- `z.input<T>` / `z.output<T>` — input vs output type
- `z.registry()` / `z.globalRegistry` — metadata registries
- `z.toJSONSchema(schema)` — JSON Schema conversion
- `z.config(locale)` — localization
- `z.locales.*` — built-in locale packs

---

## Sources

- [Zod v4 release notes](https://zod.dev/v4)
- [Zod API reference](https://zod.dev/api)
- [Zod packages/zod](https://zod.dev/packages/zod)
