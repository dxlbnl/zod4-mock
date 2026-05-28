# Key-Based Field Heuristics

The key-based generator fires **after matchers and per-schema `withKeyMap` / world-level `withGenerators`, and before schema-based generation**. It inspects the field name and, when it recognises the pattern, produces a semantically meaningful value — no matcher required.

This page lists every exact-key entry, every pattern rule, and the Dutch-language aliases that ship in [`src/generators/data/key-map.ts`](../src/generators/data/key-map.ts). Use [`world.explain(schema)`](api-reference.md#worldexplainschema) to inspect what the engine would pick for any given schema.

---

## How it works

The library calls `generateFromKey(key, schema, ctx)`:

1. The field name is **lowercased** for matching (case-insensitive — `CreatedAt`, `created_at`, `CREATEDAT` all match the same rule).
2. The Zod schema is unwrapped to its **leaf type** (`string`, `number`, `date`, …) — `getLeafDef(schema)` strips `optional`, `nullable`, `default`, `readonly`, `catch`, `brand`.
3. `DEFAULT_KEY_MAP[leafType][lowercasedKey]` is consulted first. If an **exact-key entry** exists, it wins.
4. Otherwise the rules in `DEFAULT_KEY_PATTERNS[leafType]` are tried in order; the **first matching pattern** wins.
5. If neither table matches, the key-based generator returns `undefined` and the engine falls through to schema-based generation.

Many rules are **schema-type-gated**: a key like `email` only matches when the field is `z.string()`. A field named `email: z.number()` falls through to schema-based generation (no exact-key fire from `DEFAULT_KEY_MAP.string`).

The full resolution order in `WorldImpl.generateObjectFields` is:

| Step | Identifier in `world.explain` output |
| --- | --- |
| 1. Matcher registered via `world.withSchema(...)` | `matcher:<key>` |
| 2. Per-schema key map registered via `world.withKeyMap(...)` | `key-map:<key>` |
| 3. Custom world-level generator registered via `world.withGenerators(...)` | `custom:<key>` |
| 4. **Exact-key** entry in `DEFAULT_KEY_MAP` | `<namespace>.<fn>` (e.g. `person.firstName`) |
| 5. **Pattern** match in `DEFAULT_KEY_PATTERNS` | `<namespace>.<fn>` plus a leaf-type suffix for dates |
| 6. Schema-based fallback (Zod-introspection) | `schema-based` |

---

## Exact-key generators (string)

These fire when the field is a `z.string()` (or unwrapped to one) and the lowercased field name **exactly matches** the key.

### Person

| Key (case-insensitive) | Generator identifier | Description |
| --- | --- | --- |
| `firstname`, `first_name` | `person.firstName` | First name |
| `lastname`, `last_name`, `surname` | `person.lastName` | Last name |
| `middlename`, `middle_name` | `person.middleName` | Middle name |
| `fullname`, `full_name`, `name` | `person.fullName` | Full name |
| `prefix` | `person.prefix` | Honorific prefix (Mr., Dr., …) |
| `suffix` | `person.suffix` | Name suffix (Jr., III, …) |
| `bio` | `inline:bio` | Lorem text (respects `.min()`/`.max()`) |
| `gender` | `person.gender` | A gender label |
| `sex` | `person.sex` | A sex label |
| `jobtitle`, `job_title` | `person.jobTitle` | Job title |
| `jobarea`, `job_area` | `person.jobArea` | Job area |
| `jobtype`, `job_type` | `person.jobType` | Job type |

### Internet

| Key | Generator identifier | Description |
| --- | --- | --- |
| `email` | `internet.email` | Realistic email |
| `example_email` | `internet.exampleEmail` | `@example.com` email |
| `username` | `internet.username` | Username |
| `displayname`, `display_name` | `internet.displayName` | Display name |
| `password` | `inline:password` | 16-character nanoid |
| `url`, `website`, `homepage` | `internet.url` | HTTPS URL |
| `ip` | `internet.ip` | IPv4 or IPv6 address |
| `ipv4` | `internet.ipv4` | IPv4 address |
| `ipv6` | `internet.ipv6` | IPv6 address |
| `mac` | `internet.mac` | MAC address |
| `useragent`, `user_agent` | `internet.userAgent` | User-Agent string |
| `protocol` | `internet.protocol` | `http` / `https` |
| `domain`, `domainname`, `domain_name` | `internet.domainName` | Domain name |

### Location

| Key | Generator identifier | Description |
| --- | --- | --- |
| `city` | `location.city` | City name |
| `country` | `location.country` | Country name |
| `countrycode`, `country_code` | `location.countryCode` | ISO country code |
| `street`, `streetname`, `street_name` | `location.street` | Street name |
| `address`, `streetaddress`, `street_address` | `location.streetAddress` | Full street address |
| `zipcode`, `postalcode`, `postal_code`, `postcode` | `location.zipCode` | Postal code |
| `state` | `location.state` | State or region |
| `county` | `location.county` | County |
| `timezone`, `time_zone` | `location.timeZone` | IANA time zone |

### Finance

| Key | Generator identifier | Description |
| --- | --- | --- |
| `iban` | `finance.iban` | IBAN |
| `bic` | `finance.bic` | BIC / SWIFT code |
| `accountnumber`, `account_number` | `inline:accountnumber` | Bank account number (respects `.min()`) |
| `creditcard`, `credit_card`, `creditcardnumber`, `credit_card_number` | `inline:creditcard` (and aliases) | Credit-card number |
| `currency`, `currencycode`, `currency_code` | `finance.currencyCode` | ISO currency code |
| `bitcoin` | `finance.bitcoinAddress` | Bitcoin address |
| `ethereum` | `finance.ethereumAddress` | Ethereum address |

### Commerce

| Key | Generator identifier | Description |
| --- | --- | --- |
| `product` | `commerce.product` | Product noun |
| `productname`, `product_name` | `commerce.productName` | Product name |
| `isbn` | `commerce.isbn` | ISBN |
| `upc` | `commerce.upc` | UPC |
| `department` | `commerce.department` | Retail department |
| `material` | `commerce.productMaterial` | Product material |
| `price` | `inline:price` | Price string (respects `.min()`/`.max()`) |
| `sku` | `inline:sku` | Code like `AB-1234` |

### Company

| Key | Generator identifier | Description |
| --- | --- | --- |
| `company`, `companyname`, `company_name` | `company.name` | Company name |
| `buzzword` | `company.buzzPhrase` | Business buzzphrase |
| `catchphrase` | `company.catchPhrase` | Marketing catchphrase |

### Phone

| Key | Generator identifier | Description |
| --- | --- | --- |
| `phone`, `phonenumber`, `phone_number` | `phone.number` | Phone number with country code |
| `imei` | `phone.imei` | IMEI |

### Vehicle

| Key | Generator identifier | Description |
| --- | --- | --- |
| `vin` | `vehicle.vin` | Vehicle Identification Number |
| `vrm` | `vehicle.vrm` | Vehicle Registration Mark (license plate) |
| `vehicle` | `vehicle.vehicle` | Vehicle make + model |
| `manufacturer` | `vehicle.manufacturer` | Vehicle manufacturer |
| `model` | `vehicle.model` | Vehicle model |
| `vehiclecolor`, `vehicle_color` | `vehicle.color` | Vehicle color |
| `fuel` | `vehicle.fuel` | Fuel type |

### Color (CSS / UI)

| Key | Generator identifier | Description |
| --- | --- | --- |
| `color`, `colour` | `color.colorName` | Color name |
| `colorhex`, `color_hex`, `hexcolor`, `hex_color` | `color.colorHex` | Hex color (e.g. `#a1b2c3`) |
| `backgroundcolor`, `background_color`, `textcolor`, `text_color` | `color.colorHex` | Hex color |

### System

| Key | Generator identifier | Description |
| --- | --- | --- |
| `platform`, `os`, `operatingsystem`, `operating_system` | `system.platform` | Operating system |
| `browser` | `system.browser` | Browser name |
| `semver`, `version` | `system.semver` | Semver string |
| `filename`, `file_name` | `system.fileName` | File name |
| `filepath`, `file_path` | `system.filePath` | File path |
| `extension`, `fileextension`, `file_extension` | `system.fileExtension` | File extension |
| `mimetype`, `mime_type`, `contenttype`, `content_type` | `system.mimeType` | MIME type |

### Word & free text

| Key | Generator identifier | Description |
| --- | --- | --- |
| `word` | `word.noun` | A single noun |
| `text`, `description`, `note`, `summary`, `comment`, `body`, `content`, `message` | `inline:<key>` | Lorem text (respects `.min()`/`.max()`) |

---

## Exact-key generators (number)

These fire when the field is a `z.number()` (or unwrapped to one).

| Key | Generator identifier | Description |
| --- | --- | --- |
| `amount` | `inline:amount` | Currency amount (respects `.min()`/`.max()`, default 1 – 10 000) |
| `price` | `inline:price` | Price amount (respects `.min()`/`.max()`, default 1 – 500) |
| `latitude` | `location.latitude` | Latitude in degrees |
| `longitude` | `location.longitude` | Longitude in degrees |
| `port` | `internet.port` | TCP/UDP port number |
| `quantity` | `inline:quantity` | Integer in [1, 100] |
| `count` | `inline:count` | Integer in [0, 50] |
| `age` | `inline:age` | Integer in [18, 90] |
| `year` | `inline:year` | Integer in [1970, 2030] |

---

## Pattern generators

When an exact-key entry does not match, the engine tries pattern rules. Each rule has a `test(lowercasedKey)` function; the **first match wins**.

### Pattern generators (string)

| Match | Identifier | Description |
| --- | --- | --- |
| Exactly `id`, or **ends with** `id`, `uuid`, `guid` | `string.uuid` | UUID (RFC 4122 v4) |
| **Ends with** `name` | `person.fullName` | Full name |
| **Ends with** `url`, `link`, or **starts with** `url` | `internet.url` | HTTPS URL |
| **Ends with** `email` | `internet.email` | Realistic email |
| **Ends with** `at`, `date`, **starts with** `date`, or **ends with** `_on` (excluding `position`) | `date.anytime+toISOString` | ISO 8601 date string |

### Pattern generators (date)

When the field is a `z.date()` (or coerced/unwrapped to one), the date pattern produces a `Date` object.

| Match | Identifier | Description |
| --- | --- | --- |
| **Ends with** `at`, `date`, **starts with** `date`, or **ends with** `_on` (excluding `position`) | `date.anytime` | A `Date` instance |

### Pattern generators (number)

When the field is a `z.number()`, the date pattern produces a Unix timestamp in milliseconds.

| Match | Identifier | Description |
| --- | --- | --- |
| **Ends with** `at`, `date`, **starts with** `date`, or **ends with** `_on` (excluding `position`) | `date.anytime+getTime` | Unix-ms timestamp |

The same key with a different Zod type yields a different output: `createdAt: z.string()` → ISO string; `createdAt: z.date()` → `Date`; `createdAt: z.number()` → ms timestamp.

---

## Localised aliases

The Dutch-language keys live in `DEFAULT_KEY_MAP` **itself** — they are not provided by the locale packages. The locale packages (`@zod4-mock/locale-en`, `@zod4-mock/locale-nl`, `@zod4-mock/locale-names`) supply `LocaleData` (vocabulary, formatters, Markov models), not key maps. Adding a new locale does **not** add new key aliases; those changes happen in `src/generators/data/key-map.ts`.

The Dutch aliases that ship today:

### Strings

| Key | Maps to | Description |
| --- | --- | --- |
| `voornaam` | `person.firstName` | First name |
| `achternaam` | `person.lastName` | Last name |
| `straat` | `location.street` | Street name |
| `stad` | `location.city` | City |
| `land` | `location.country` | Country |
| `kenteken` | `vehicle.vrm` | License plate (VRM) |
| `voertuigkleur` | `vehicle.color` | Vehicle color |
| `kleur` | `color.colorName` | Color name |
| `telefoon` | `phone.number` | Phone number |
| `prijs` | `inline:prijs` | Price string (respects `.min()`/`.max()`) |
| `omschrijving` | `inline:omschrijving` | Description (lorem text, length-aware) |
| `bericht` | `inline:bericht` | Message (lorem text, length-aware) |

### Numbers

| Key | Maps to | Description |
| --- | --- | --- |
| `bedrag` | `inline:bedrag` | Amount (respects `.min()`/`.max()`, default 1 – 10 000) |
| `prijs` | `inline:prijs` | Price (respects `.min()`/`.max()`, default 1 – 500) |

---

## Using `world.explain` to debug a schema

`world.explain(schema)` reports — for each top-level field — which row of this table the engine would pick. It is read-only and PRNG-neutral, so it never disturbs the next `generate` call. See [`world.explain` in the API Reference](api-reference.md#worldexplainschema) for the full type.

```ts
const UserSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  email: z.string(),
  homeAddress: z.string(), // ← does NOT match any exact key
  kind: z.string(),
});

const world = createWorld({ seed: 1 }).withSchema(UserSchema, {
  matchers: { kind: () => "admin" },
});

console.log(world.explain(UserSchema).toString());
// id          → string.uuid      (key-pattern: ends with "id")
// firstName   → person.firstName (exact key: "firstname")
// email       → internet.email   (exact key: "email")
// homeAddress → schema-based     (no key match, no matcher)
// kind        → matcher:kind     (matcher registered via withSchema)
```

The `homeAddress` line is the **near-miss diagnostic**: the field name didn't match any rule, so a random schema-based string will be produced. Renaming it to `address`, or registering a matcher, attaches a realistic generator.

---

## Overriding a built-in heuristic

**Option A — Matcher in `withSchema`** (field-specific, highest priority):

```ts
world.withSchema(OrderSchema, {
  matchers: {
    email: (ctx) => `orders+${ctx.gen.string.uuid()}@mycompany.com`,
  },
});
```

**Option B — `world.withGenerators`** (world-wide, overrides built-ins):

```ts
world.withGenerators({
  email: (_schema, ctx) => `user${ctx.prng.int(1, 999)}@internal.example.com`,
});
```

Custom generators registered via `withGenerators` or `WorldOptions.generators` take priority over the built-in heuristics. Keys are matched case-insensitively.

---

## Adding domain-specific generators

```ts
const world = createWorld({
  seed: 42,
  generators: {
    durationS: (_schema, ctx) => ctx.prng.int(30, 3600),
    vendorCode: (_schema, ctx) => `V-${ctx.prng.int(1000, 9999)}`,
  },
});
```

Or additively via `world.withGenerators({...})`. See [`KeyGenerator`](api-reference.md#keygenerator) for the signature.

---

## Important notes

- **Field names are matched after lowercasing.** Original casing is irrelevant.
- **Date heuristics are type-aware.** A field named `createdAt` produces a `Date`, an ISO string, or a numeric timestamp depending on the Zod schema.
- **Other heuristics are schema-type-gated.** `quantity`, `count`, etc. only fire for `z.number()`; a `z.string()` field named `quantity` falls through to schema-based generation.
- **Custom generators take priority.** Anything registered via `WorldOptions.generators` or `world.withGenerators(...)` overrides the built-in table.
- **`inline:<key>` identifiers** indicate a length-aware or composite inline closure in `DEFAULT_KEY_MAP` (e.g. `bio`, `description`, `sku`, `accountnumber`). The behaviour is documented in the description column.
