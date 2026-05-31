# Generator Reuse & Composition

Generators should compose each other rather than duplicating data or logic. This page documents every existing cross-module dependency, identifies current weak spots, and proposes better composition patterns.

## Current Composition Graph

```
word.ts
  └── noun(), adjective()
        ├── internet.ts   domainWord(), url()
        └── commerce.ts   productName(), productDescription()

person.ts
  └── firstName(), lastName()
        ├── internet.ts   username(), displayName(), email()
        └── company.ts    name()

word.ts + person.ts
  └── sentence() → person.ts bio()
```

This is a healthy start. The problems below are places where that composition breaks down or is weaker than it should be.

---

## Problem 1: `domainWord` generates Dutch pseudo-words

**Current:**

```typescript
export function domainWord(prng: Prng): string {
  return noun(prng)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
```

`noun()` returns a Dutch phoneme-constructed pseudo-word like `"sloecht"` or `"blonk"`. This does not look like a real domain component.

**What real domain words look like:** `"nexus"`, `"alpha"`, `"kernel"`, `"platform"`, `"nova"`, `"apex"`, `"delta"`.

These already exist in the codebase — `TECH_WORDS` in `word.ts` contains exactly this vocabulary (NATO phonetic alphabet + tech terms). Company prefixes in `company.ts` (`"Nexus"`, `"Apex"`, `"Nova"`, `"Quantum"`) are another perfect source.

**Proposed composition:**

```typescript
export function domainWord(prng: Prng): string {
  const strategy = prng.int(0, 2);
  if (strategy === 0) {
    // Tech words: "alpha", "kernel", "network", "layer" — feel like real domains
    return prng.pick(TECH_WORDS);
  }
  if (strategy === 1) {
    // Company prefix, lowercased: "nexus", "quantum", "apex"
    return prng.pick(COMPANY_PREFIXES).toLowerCase();
  }
  // Fallback: Markov-generated word (after Markov implementation)
  return noun(prng)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
```

This makes `domainName()`, `url()`, and `email()` all look immediately more realistic with zero new data.

---

## Problem 2: `url()` path segment is also a pseudo-word

**Current:**

```typescript
export function url(prng: Prng): string {
  return `https://${domainName(prng)}/${domainWord(prng)}`;
}
```

The path (`/sloecht`) looks wrong for a URL. Real URL paths look like `/products`, `/dashboard`, `/user/profile`, `/articles/getting-started`.

**Proposed:** Use `department()`, `buzzNoun()`, or a small curated list of common path segments, slugified:

```typescript
const URL_PATHS = [
  "products",
  "dashboard",
  "profile",
  "settings",
  "articles",
  "docs",
  "api",
  "blog",
  "about",
  "contact",
  "search",
  "help",
  "orders",
  "invoices",
  "reports",
  "users",
  "admin",
  "status",
] as const;

export function urlPath(prng: Prng): string {
  // Simple static path, or compose with a slug
  return prng.pick(URL_PATHS);
}

export function url(prng: Prng): string {
  return `https://${domainName(prng)}/${urlPath(prng)}`;
}
```

This also gives us a standalone `urlPath()` generator useful for path fields in schemas.

---

## Problem 3: `userAgent()` has embedded OS and browser data that nothing else can use

**Current:** OS strings and browser strings are inline template literals inside `userAgent()`. They're not reusable.

**Proposed:** Extract into a dedicated `system.ts` module:

```typescript
// src/generators/data/system.ts

export function platform(prng: Prng): "windows" | "macos" | "linux" | "ios" | "android" {
  return prng.pick(["windows", "macos", "linux", "ios", "android"]);
}

export function browser(prng: Prng): "chrome" | "firefox" | "safari" | "edge" {
  return prng.pick(["chrome", "firefox", "safari", "edge"]);
}

export function userAgent(prng: Prng): string {
  // Compose using platform() and browser()
}

export function fileExtension(prng: Prng): string { ... }
export function mimeType(prng: Prng): string { ... }
export function semver(prng: Prng): string { ... }
export function filePath(prng: Prng): string { ... }
export function fileName(prng: Prng): string { ... }
```

Now `platform()` and `browser()` become usable standalone generators, available in the key map for fields like `operatingSystem`, `device`, `clientBrowser`.

---

## Problem 4: `bio()` doesn't know anything about the person

**Current:**

```typescript
export function bio(prng: Prng): string {
  return sentence(prng); // a random Dutch pseudo-sentence
}
```

A bio that doesn't reference the person's job, name, or any context feels hollow.

**Proposed:** Compose with `jobType`, `jobTitle`, and `jobArea` — all of which are already available from the same module:

```typescript
export function bio(prng: Prng): string {
  const templates: [() => string, ...(() => string)[]] = [
    () =>
      `${jobType(prng)} ${jobTitle(prng).toLowerCase()} specialised in ${jobArea(prng).toLowerCase()}.`,
    () =>
      `Works as a ${jobTitle(prng).toLowerCase()} with a focus on ${jobArea(prng).toLowerCase()}.`,
    () => `${prng.int(2, 15)}+ years experience as a ${jobTitle(prng).toLowerCase()}.`,
    () =>
      `${jobDescriptor(prng)} ${jobTitle(prng).toLowerCase()} at the intersection of ${jobArea(prng).toLowerCase()} and ${jobArea(prng).toLowerCase()}.`,
  ];
  return prng.pick(templates)();
}
```

This is immediate upgrade with zero new data — just composing existing generators.

---

## Problem 5: `company.name()` could also use `buzzNoun` as a component

**Current:** Company names are built from `lastName` + suffix, or `prefix` + `lastName`. This ties company names to person surnames.

**Proposed variation:** A third format using buzzwords/tech vocabulary, which is how many modern companies name themselves:

```typescript
export function name(prng: Prng): string {
  const formats: [() => string, ...(() => string)[]] = [
    () => `${lastName(prng)} ${prng.pick(COMPANY_SUFFIXES)}`,
    () => `${lastName(prng)} & ${lastName(prng)}`,
    () => `${prng.pick(COMPANY_PREFIXES)} ${lastName(prng)}`,
    () => `${lastName(prng)} Systemen`,
    // NEW: tech-style naming
    () => `${prng.pick(COMPANY_PREFIXES)}${prng.pick(BUZZ_NOUNS_EN)}`, // "NexusPlatform"
    () => `${prng.pick(TECH_WORDS_CAPITALIZED)} ${prng.pick(COMPANY_SUFFIXES)}`, // "Delta Tech"
  ];
  return prng.pick(formats)();
}
```

This also makes `domainWord` ↔ `company.name` composition richer: a company's domain is naturally derived from its name's prefix.

---

## Problem 6: `vehicle.color()` vs CSS colors

`vehicle.ts` has Dutch color names (`"Rood"`, `"Blauw"`, etc.) as `color()`. There is no generator for CSS/HTML colors used in UI contexts (`"#3a7bd5"`, `"rgb(58, 123, 213)"`, `"coral"`).

These are two different things and shouldn't share a generator. After the color module is added:

- `vehicle.color()` → locale-aware color name (Dutch for `nl`, English for `en`)
- `color.hex()`, `color.rgb()`, `color.name()` → a new `color.ts` module for UI/CSS contexts

---

## Problem 7: `jwt()` uses hex, not base64url

**Current:**

```typescript
export function jwt(prng: Prng): string {
  const segment = (len: number) =>
    Array.from({ length: len }, () => prng.int(0, 15).toString(16)).join("");
  return `${segment(36)}.${segment(64)}.${segment(42)}`;
}
```

Real JWTs are three base64url-encoded segments (header, payload, signature). The hex output looks wrong when users inspect mock data.

**Proposed:** Base64url-encode small deterministic blocks for each segment. The structure matters more than the content:

```typescript
const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".split("") as [
  string,
  ...string[],
];

function base64urlSegment(prng: Prng, len: number): string {
  return Array.from({ length: len }, () => prng.pick(BASE64URL)).join("");
}

export function jwt(prng: Prng): string {
  // header.payload.signature — real character set, realistic lengths
  return `${base64urlSegment(prng, 36)}.${base64urlSegment(prng, 128)}.${base64urlSegment(prng, 43)}`;
}
```

After the `prng.bytes()` implementation, this becomes: one `bytes()` call per segment → base64url encode.

---

## Summary of Proposed New Modules

| New module  | Key generators                                                                                    | Feeds into                                                 |
| ----------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `system.ts` | `platform`, `browser`, `userAgent`, `mimeType`, `fileExtension`, `filePath`, `fileName`, `semver` | key map for OS/browser/file fields                         |
| `color.ts`  | `colorHex`, `colorRgb`, `colorHsl`, `colorName`                                                   | key map for `color`, `backgroundColor`, `textColor` fields |

And one new generator function worth extracting from existing modules:

- `internet.urlPath()` — currently inlined in `url()`; useful standalone

---

See also: [Methods Inventory](methods-inventory.md) · [Word Generation](../text-generation/word-generation.md) · [Localization Architecture](../text-generation/localization.md) · [Back to Index](../overview.md)
