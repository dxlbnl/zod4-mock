# Sibling-Aware Generation

## The Core Insight

When generating an object field-by-field, values already produced earlier in the same object are available to subsequent generators. A `username` field that appears after `firstName` and `lastName` can _read_ those values instead of inventing new ones. A `prefix` that comes after `gender` can be grammatically correct for that gender. A `creditCardNumber` that comes after `creditCardIssuer` can start with the right digit for that issuer.

This makes generated objects coherent — the pieces fit together — rather than just individually plausible.

## The Mechanism Already Exists

`GeneratorContext.current` is the partial object being built. As each field is generated it is written into `result`, and the very next field's context receives the updated `result` as `ctx.current`. So if a schema has fields in this order:

```typescript
const PersonSchema = z.object({
  gender:    z.string(),   // generated 1st
  firstName: z.string(),   // ctx.current.gender is available here
  lastName:  z.string(),   // ctx.current.gender + firstName are available here
  email:     z.string(),   // ctx.current.gender + firstName + lastName are all available here
});
```

`firstName` already reads gender today — `person.ts`'s `extractGender()` looks at `ctx.current["gender"]` and `ctx.current["geslacht"]`. This is the established pattern; we just need to apply it more broadly and systematically.

---

## The Ordering Constraint

**`ctx.current` only contains fields generated before the current field, in Zod schema definition order.**

This is the fundamental limitation. If a schema defines `email` before `firstName`, the email generator cannot see the firstName. Crucially, this means sibling awareness is only reliable for fields the user has intentionally ordered — and we cannot silently change generation order without breaking determinism.

The practical guidance for users:

> Put "source" fields (gender, firstName, lastName, manufacturer) before "derived" fields (email, username, prefix, model) in your Zod schema definition.

We should document this constraint prominently in the API reference.

---

## Markov Chains: Two Models or One?

**Two models per name type is the right answer.**

Male and female name corpora have different character-level statistics. "James", "Robert", "William" share phoneme patterns; "Alice", "Emma", "Charlotte" share different ones. A single model trained on both produces statistically averaged names — output like "Alames" or "Jalia" that read as neither clearly masculine nor feminine.

Three models per locale, per name type:

| Model | Trained on | Used when |
|-------|-----------|-----------|
| `enFirstNamesMaleModel` | Male name corpus | `gender` normalises to `"male"` |
| `enFirstNamesFemaleModel` | Female name corpus | `gender` normalises to `"female"` |
| `enFirstNamesModel` | Combined corpus | gender unknown or `"neutral"` |

At runtime, `firstName()` picks the model from `ctx.current`:

```typescript
export function firstName(prng: Prng, ctx?: GeneratorContext): string {
  const g = extractGender(ctx);
  const model =
    g === "male"   ? ctx!.locale.person.firstNamesMaleModel   :
    g === "female" ? ctx!.locale.person.firstNamesFemaleModel :
                     ctx!.locale.person.firstNamesModel;
  return generateMarkovWord(prng, model);
}
```

The training split is natural — the SSA baby names file already has a gender column. The combined model is simply both corpora merged, not a new training effort.

---

## The Sibling Lookup Helper

Key names in schemas vary: `"firstName"`, `"first_name"`, `"firstname"`, `"voornaam"`. A normalised lookup helper covers all of them without a combinatorial list of field names:

```typescript
// src/generators/data/sibling.ts
export function siblingString(ctx: GeneratorContext, ...candidates: string[]): string | undefined {
  if (!ctx.current) return undefined;
  for (const [key, val] of Object.entries(ctx.current)) {
    if (typeof val !== "string") continue;
    const norm = key.toLowerCase().replace(/[^a-z]/g, "");
    for (const c of candidates) {
      if (norm === c.toLowerCase().replace(/[^a-z]/g, "")) return val;
    }
  }
  return undefined;
}
```

Usage in `username`:

```typescript
export function username(prng: Prng, ctx?: GeneratorContext): string {
  const fn = (ctx ? siblingString(ctx, "firstName", "first_name", "voornaam") : undefined)
    ?? firstName(prng, ctx);
  const ln = (ctx ? siblingString(ctx, "lastName", "last_name", "achternaam", "surname") : undefined)
    ?? lastName(prng);

  return prng.random() < 0.5
    ? `${fn.toLowerCase()}.${ln.toLowerCase().replace(/\s/g, "")}`
    : `${fn.toLowerCase()}${prng.int(10, 99)}`;
}
```

If the object has a `firstName` field already generated, the username references it. If not, it generates one fresh. No behaviour change for schemas that don't have these sibling fields.

---

## Catalogue of Worthwhile Sibling Relationships

### High value — implement in the initial pass

| Derived field | Reads from sibling | What changes |
|--------------|-------------------|-------------|
| `firstName` | `gender` | Picks gendered Markov model |
| `prefix` | `gender` | `Dhr.` vs `Mevr.` (already works, keep it) |
| `username` | `firstName`, `lastName` | Username derived from actual name in the object |
| `email` | `firstName`, `lastName` | Email derived from actual name (via username) |
| `displayName` | `firstName`, `lastName` | Uses existing values, not new random ones |
| `avatar` | `firstName`, `lastName` | URL slug matches the person's name |
| `age` | `birthdate` | `Math.floor((now - birthdate) / ms_per_year)` — exact match |
| `bio` | `jobTitle`, `jobArea`, `jobType` | Bio references the job already on the object |
| `creditCardNumber` | `creditCardIssuer` | Visa → `4xxx`, Mastercard → `5xxx`, Amex → `34xx`/`37xx` |
| `userAgent` | `platform`, `browser` | Matches the OS/browser fields if present |

### Medium value — implement with locale system

| Derived field | Reads from sibling | What changes |
|--------------|-------------------|-------------|
| `phone` | `countryCode`, `country` | Phone prefix matches country |
| `iban` | `countryCode`, `country` | IBAN prefix matches country |
| `bic` | `countryCode` | BIC country chars match |
| `zipCode` | `countryCode` | Format matches country (US: `12345`, NL: `1234 AB`) |
| `vehicle.model` | `vehicle.manufacturer` | Model list filtered to that manufacturer's actual models |
| `price` | `currency`, `currencyCode` | Format uses the currency's symbol and decimal convention |

### Lower value — consider later

| Derived field | Reads from sibling | What changes |
|--------------|-------------------|-------------|
| `state` | `city` | Would require a large city→state lookup table |
| `city` | `country` | Cities filtered to the country (large dataset) |
| `lastName` | `gender` | Some cultures have gendered surnames — low priority for mock data |
| `nickname` | `firstName` | Shortened or variant of the actual first name |

---

## The Manufacturer → Model Problem

`vehicle.manufacturer` and `vehicle.model` are currently two independent picks from separate flat lists. A `"Tesla"` manufacturer can produce a `"Golf"` model — which is nonsensical.

Sibling awareness solves this with a lookup map:

```typescript
const MANUFACTURER_MODELS: Record<string, [string, ...string[]]> = {
  "Tesla":          ["Model 3", "Model Y", "Model S", "Model X"],
  "Volkswagen":     ["Golf", "Passat", "Tiguan", "Polo"],
  "BMW":            ["X5", "3 Series", "5 Series", "M3"],
  // ...
};

export function model(prng: Prng, ctx?: GeneratorContext): string {
  const mfr = ctx ? siblingString(ctx, "manufacturer") : undefined;
  const specific = mfr ? MANUFACTURER_MODELS[mfr] : undefined;
  return specific ? prng.pick(specific) : prng.pick(MODELS);
}
```

The `MANUFACTURER_MODELS` map is smaller than the current flat `MODELS` list — it replaces it entirely. Bundle-neutral change with a meaningful realism improvement.

---

## What This Is Not

Sibling awareness is **not** the same as matchers or relations:

- **Matchers** are user-defined functions that explicitly control generation of specific fields. Sibling awareness is automatic, library-level, zero-config.
- **Relations** (`ctx.related()`) reference _other schemas_ in the registry — cross-entity consistency. Sibling awareness is within a single object — intra-entity coherence.
- **Two-pass generation** (generate all fields, then re-generate derived ones with full context) was considered but rejected: it changes generation order, breaks determinism for existing seeds, and could create circular dependencies.

---

## Implementation Order

1. `siblingString()` helper in a shared utility location
2. `username`, `email`, `displayName`, `avatar` reading `firstName`/`lastName`
3. `bio` reading `jobTitle`/`jobArea`/`jobType`
4. `creditCardNumber` reading `creditCardIssuer`
5. Gendered Markov models (depends on Markov training pipeline)
6. `vehicle.model` reading `vehicle.manufacturer`
7. Locale-coupled fields (`phone`, `iban`, `zipCode` reading `countryCode`) — after localization refactor

---

See also: [Algorithmic Entropy](../text-generation/algorithmic-entropy.md) · [Markov Training Pipeline](../text-generation/markov-training-pipeline.md) · [Generator Reuse](generator-reuse.md) · [Localization Architecture](../text-generation/localization.md) · [Back to Index](../overview.md)
