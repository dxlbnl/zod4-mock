# Key-Based Field Heuristics

The key-based generator fires **after matchers and before schema-based generation**. It inspects the field name and, when it recognises the pattern, produces a semantically meaningful value — no matcher required.

---

## How it works

1. The field name is lowercased for matching.
2. The table below is consulted. The first matching rule wins.
3. If no rule matches, `undefined` is returned and the caller falls through to schema-based generation.

All matching is **case-insensitive**. A field named `CreatedAt`, `created_at`, or `CREATEDAT` all match the `createdAt` rule.

Some rules are **schema-type-gated**: date rules fire regardless of the Zod type, but string rules only fire when the field schema is `z.string()` (or derived), and number rules only fire for `z.number()`.

---

## Complete heuristics table

### Identity

| Pattern          | Condition     | Generated value         |
| ---------------- | ------------- | ----------------------- |
| Exactly `id`     | string schema | UUID (RFC 4122 v4)      |
| Ends with `id`   | string schema | UUID                    |
| Ends with `uuid` | string schema | UUID                    |
| Exactly `email`  | string schema | Realistic email address |

Examples: `userId`, `customerId`, `orderId`, `fileUuid`, `email`

### Person names

| Pattern                            | Condition     | Generated value          |
| ---------------------------------- | ------------- | ------------------------ |
| `firstname`, `first_name`          | string schema | First name               |
| `lastname`, `last_name`, `surname` | string schema | Last name                |
| `fullname`, `full_name`            | string schema | Full name (first + last) |
| `name` _(not containing `file`)_   | string schema | Full name (first + last) |

Examples: `firstName`, `lastName`, `fullName`, `authorName`, `name`

> `filename` does **not** match the `name` rule and falls through to schema-based generation.

### Contact & address

| Pattern                                | Condition     | Generated value                               |
| -------------------------------------- | ------------- | --------------------------------------------- |
| `phone`, `phonenumber`, `phone_number` | string schema | Phone with country code, e.g. `+31 612345678` |
| `street`, `streetname`, `street_name`  | string schema | Street + house number                         |
| `city`                                 | string schema | City name                                     |
| `postalcode`, `zipcode`, `postal_code` | string schema | Postal code, e.g. `1234 AB`                   |
| `country`                              | string schema | Country name                                  |
| `url`, `website`, `homepage`           | string schema | HTTPS URL                                     |

### Free text & codes

| Pattern                               | Condition     | Generated value                         |
| ------------------------------------- | ------------- | --------------------------------------- |
| `title`                               | string schema | Short title phrase                      |
| `description`, `bio`, `notes`, `note` | string schema | Lorem text (10–30 words)                |
| `comment`, `content`, `body`, `text`  | string schema | Lorem text (10–30 words)                |
| `message`, `summary`, `transcript`    | string schema | Lorem text (10–30 words)                |
| `sku`                                 | string schema | Code like `AB-1234`                     |
| `vatnumber`, `vat_number`             | string schema | Dutch VAT number, e.g. `NL123456789B01` |

### Dates

Date rules are **type-aware** — they return a `Date` object, an ISO string, or a numeric timestamp depending on the Zod schema type.

| Pattern                                | Generated value       |
| -------------------------------------- | --------------------- |
| `createdat`, `updatedat`, `deletedat`  | Random date 2020–2025 |
| `publishedat`, `startedat`, `endedat`  | Random date 2020–2025 |
| `issuedat`, `periodstart`, `periodend` | Random date 2020–2025 |
| `invoicedate`, `duedate`               | Random date 2020–2025 |
| Ends with `at`                         | Random date 2020–2025 |
| Ends with `date`                       | Random date 2020–2025 |
| Starts with `date`                     | Random date 2020–2025 |

Examples: `createdAt`, `updatedAt`, `publishedAt`, `startDate`, `endDate`, `dateOfBirth`, `invoiceDate`

### Numbers

Number rules only fire when the field schema is `z.number()` (or derived, e.g., `.int()`).

| Pattern                              | Generated value                                                   |
| ------------------------------------ | ----------------------------------------------------------------- |
| Ends with `cents`, `price`, `amount` | Delegates to schema-based (respects `.int()`, `.min()`, `.max()`) |
| Exactly `total`                      | Delegates to schema-based                                         |
| `wordcount`, `word_count`            | Integer in [50, 5000]                                             |
| `quantity`                           | Integer in [1, 100]                                               |
| `position`                           | Integer in [0, 100]                                               |
| `count`                              | Integer in [0, 50]                                                |

The `cents`/`price`/`amount`/`total` entries delegate to schema-based generation so your Zod constraints (e.g., `.int().min(1).max(1_000_000)`) are still respected.

---

## Overriding a built-in heuristic

**Option A — Matcher in `withSchema`** (field-specific, highest priority):

```ts
.withSchema(OrderSchema, OrderSubject, {
  email: (s) => `orders+${s.orderId}@mycompany.com`,
})
```

**Option B — `world.withGenerators`** (world-wide, overrides built-ins):

```ts
world.withGenerators({
  email: (_schema, ctx) => `user${ctx.prng.int(1, 999)}@internal.example.com`,
});
```

Custom generators registered via `withGenerators` or `WorldOptions.generators` take priority over the built-in heuristics.

---

## Adding domain-specific generators

Two ways to register custom generators:

**At world creation** — applied to every schema in the world:

```ts
const world = createWorld({
  seed: 42,
  generators: {
    durationS: (_schema, ctx) => ctx.prng.int(30, 3600),
    vendorCode: (_schema, ctx) => `V-${ctx.prng.int(1000, 9999)}`,
  },
});
```

**Via `.withGenerators()`** — same effect, additive (does not remove prior generators):

```ts
world.withGenerators({
  unitPriceCents: (_schema, ctx) => ctx.prng.int(1, 500) * 100,
});
```

Keys are matched case-insensitively against field names, just like the built-in table.

---

## Using the `generators` namespace

The built-in primitive generators are exported as the `generators` object. Compose them inside your custom generators for consistent output:

```ts
import { generators } from "zod4-mock";

world.withGenerators({
  displayName: (_schema, ctx) =>
    `${generators.person.firstName(ctx.prng)} ${generators.person.lastName(ctx.prng)}`,

  invoiceId: (_schema, ctx) => `INV-${generators.string.uuid(ctx.prng).slice(0, 8).toUpperCase()}`,

  excerpt: (_schema, ctx) => generators.word.words(ctx.prng, 15),
});
```

See [API Reference — generators namespace](api-reference.md#generators-namespace) for the full signature table.

---

## Important notes

- **Field names are matched after lowercasing** — the original field key casing is irrelevant.
- **Date heuristics are type-aware** — a field named `createdAt` will produce:
  - `z.date()` (or none) → a `Date` object.
  - `z.string()` → an ISO 8601 string.
  - `z.number()` → a Unix timestamp (milliseconds).
- **Other heuristics are schema-type-gated** — `quantity`, `count`, etc. only fire for `z.number()` fields. On a `z.string()` field named `quantity`, the key heuristic is skipped and schema-based generation produces a string.
- **`name` does not match `filename`** — the `name` rule explicitly excludes keys containing `file`.
- **Custom generators take priority** — any key registered via `WorldOptions.generators` or `.withGenerators()` overrides the built-in table.

For the `KeyGenerator` type signature and `GeneratorContext` fields, see the [API Reference](api-reference.md#keygenerator).
