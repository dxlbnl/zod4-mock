# Methods Inventory

Complete catalogue of every generator method — what exists, what's missing, and how each one should be produced. Legend: ✅ exists · 🔧 exists but needs improvement · ❌ missing.

The generation strategy column describes the _source_ of the output, not the implementation detail. "Locale list" means a curated real-data array in the locale. "Compose" means built from other generators. "Algorithmic" means computed purely from the PRNG.

---

## `person`

| Method                | Status | Generation strategy                                                                                    |
| --------------------- | :----: | ------------------------------------------------------------------------------------------------------ |
| `firstName(gender?)`  |   ✅   | Markov model trained on locale name corpus                                                             |
| `lastName()`          |   ✅   | Markov model trained on locale name corpus                                                             |
| `middleName(gender?)` |   ✅   | → `firstName`                                                                                          |
| `fullName(gender?)`   |   ✅   | Compose: `firstName` + `lastName`, word order from locale                                              |
| `prefix(gender?)`     |   ✅   | Locale list (short, closed set)                                                                        |
| `suffix()`            |   ✅   | Locale list (Jr., Sr., III)                                                                            |
| `gender()`            |   ✅   | Locale list                                                                                            |
| `sex()`               |   ✅   | Locale list                                                                                            |
| `zodiacSign()`        |   ✅   | Locale list                                                                                            |
| `jobTitle()`          |   ✅   | Locale list                                                                                            |
| `jobArea()`           |   ✅   | Locale list                                                                                            |
| `jobType()`           |   ✅   | Locale list (Lead, Senior, Junior…)                                                                    |
| `jobDescriptor()`     |   ✅   | Locale list                                                                                            |
| `bio()`               |   🔧   | Compose: templates from `jobType` + `jobTitle` + `jobArea` (see [Generator Reuse](generator-reuse.md)) |
| `age()`               |   ❌   | Algorithmic: `prng.int(18, 80)`                                                                        |
| `nationality()`       |   ❌   | Locale list ("Dutch", "American", "German"…)                                                           |
| `avatar()`            |   ❌   | Compose: `https://avatars.${domainName}/u/${prng.int(1, 9999)}.jpg`                                    |

---

## `internet`

| Method             | Status | Generation strategy                                                                                                   |
| ------------------ | :----: | --------------------------------------------------------------------------------------------------------------------- |
| `email()`          |   ✅   | Compose: `username` + `@` + `domainName`                                                                              |
| `exampleEmail()`   |   ✅   | Compose: `username` + `@voorbeeld.{suffix}`                                                                           |
| `username()`       |   ✅   | Compose: `firstName` + `.` + `lastName` _or_ `firstName` + number                                                     |
| `displayName()`    |   ✅   | Compose: `firstName` + `lastName`                                                                                     |
| `password(len?)`   |   ✅   | Algorithmic: random from character set                                                                                |
| `domainName()`     |   ✅   | Compose: `domainWord` + `.` + `domainSuffix`                                                                          |
| `domainWord()`     |   🔧   | Compose: weighted pick from `TECH_WORDS` / company prefixes / Markov word (see [Generator Reuse](generator-reuse.md)) |
| `domainSuffix()`   |   ✅   | Locale list (.com, .nl, .io…)                                                                                         |
| `url()`            |   🔧   | Compose: `https://` + `domainName` + `/` + `urlPath`                                                                  |
| `urlPath()`        |   ❌   | Locale list of common path segments ("products", "dashboard", "blog"…)                                                |
| `slug()`           |   ❌   | Compose: 2–4 words from `adjective` + `noun`, hyphenated                                                              |
| `avatar()`         |   ❌   | Compose: `https://${domainName}/avatars/${prng.int(1, 9999)}.jpg`                                                     |
| `protocol()`       |   ✅   | Locale list                                                                                                           |
| `ipv4()`           |   ✅   | Algorithmic: 4 × `prng.int(0, 255)`                                                                                   |
| `ipv6()`           |   ✅   | Algorithmic: 8 × hex16                                                                                                |
| `ip()`             |   ✅   | → `ipv4`                                                                                                              |
| `port()`           |   ✅   | Algorithmic: `prng.int(1, 65535)`                                                                                     |
| `mac()`            |   ✅   | Algorithmic: 6 × hex byte                                                                                             |
| `userAgent()`      |   ✅   | Composes OS + browser version strings inline                                                                          |
| `httpMethod()`     |   ✅   | Locale list                                                                                                           |
| `httpStatusCode()` |   ✅   | Fixed list of common codes                                                                                            |
| `httpStatusText()` |   ❌   | Map from `httpStatusCode`: 200 → "OK", 404 → "Not Found"…                                                             |
| `jwt()`            |   🔧   | Algorithmic: 3 × base64url segments (not hex — see [Generator Reuse](generator-reuse.md))                             |
| `jwtAlgorithm()`   |   ✅   | Fixed list                                                                                                            |
| `emoji()`          |   ✅   | Fixed list                                                                                                            |
| `locale()`         |   ❌   | Fixed list of BCP-47 locale tags ("en-US", "nl-NL", "de-DE"…)                                                         |

---

## `location`

| Method                | Status | Generation strategy                                      |
| --------------------- | :----: | -------------------------------------------------------- |
| `street()`            |   ✅   | Locale list of street name components                    |
| `buildingNumber()`    |   ✅   | Algorithmic: number + optional letter                    |
| `streetAddress()`     |   ✅   | Compose: `street` + `buildingNumber` (order from locale) |
| `secondaryAddress()`  |   ✅   | Locale list (apt, floor, unit…)                          |
| `zipCode()`           |   ✅   | Locale-specific pattern (NL: `1234 AB`)                  |
| `city()`              |   ✅   | Locale list                                              |
| `state()`             |   ✅   | Locale list                                              |
| `county()`            |   ✅   | Locale list                                              |
| `country()`           |   ✅   | Locale list                                              |
| `countryCode()`       |   ✅   | Locale list (ISO 3166-1 alpha-2)                         |
| `continent()`         |   ✅   | Fixed list                                               |
| `language()`          |   ✅   | Locale list                                              |
| `latitude()`          |   ✅   | Algorithmic: `prng.random() * 180 - 90`                  |
| `longitude()`         |   ✅   | Algorithmic: `prng.random() * 360 - 180`                 |
| `altitude()`          |   ❌   | Algorithmic: `prng.random() * 8000` (meters)             |
| `timeZone()`          |   ✅   | Locale list                                              |
| `direction()`         |   ✅   | Locale list                                              |
| `cardinalDirection()` |   ✅   | Locale list (N, S, E, W)                                 |
| `ordinalDirection()`  |   ✅   | Locale list (NE, SW…)                                    |

---

## `word` / `lorem`

| Method           | Status | Generation strategy                                                                              |
| ---------------- | :----: | ------------------------------------------------------------------------------------------------ |
| `noun()`         |   🔧   | Markov model (replace phoneme combinatorics)                                                     |
| `adjective()`    |   🔧   | Markov model                                                                                     |
| `verb()`         |   🔧   | Locale closed list (auxiliary verbs) → open verbs via Markov                                     |
| `adverb()`       |   🔧   | Derive from adjective via morphological rule (`quickly` ← `quick`)                               |
| `conjunction()`  |   ✅   | Locale closed list — keep as real words                                                          |
| `preposition()`  |   ✅   | Locale closed list — keep as real words                                                          |
| `interjection()` |   ✅   | Locale list                                                                                      |
| `word()`         |   ✅   | → `noun`                                                                                         |
| `words(n)`       |   ✅   | Compose: `n` × `noun` joined by space                                                            |
| `sentence()`     |   🔧   | Compose: phrase structure grammar (see [Word Generation](../text-generation/word-generation.md)) |
| `paragraph(n?)`  |   ✅   | Compose: `n` × `sentence`                                                                        |
| `lines(n?)`      |   ❌   | Compose: `n` × `sentence` joined by `\n`                                                         |
| `text()`         |   ❌   | Compose: 2–4 `paragraph` joined by `\n\n`                                                        |
| `slug()`         |   ❌   | Compose: 3–5 nouns/adjectives lowercased + hyphenated                                            |
| `sample()`       |   ✅   | Compose: sentence or short paragraph                                                             |

---

## `company`

| Method                    | Status | Generation strategy                                                                                           |
| ------------------------- | :----: | ------------------------------------------------------------------------------------------------------------- |
| `name()`                  |   🔧   | Compose: multiple formats using `lastName`, company prefixes, `buzzNoun` (add tech-style format)              |
| `buzzPhrase()`            |   ✅   | Compose: `buzzVerb` + `buzzAdjective` + `buzzNoun`, word order from locale                                    |
| `buzzVerb()`              |   🔧   | Locale list → derive from lemmas via [Conjugation Compression](../text-generation/conjugation-compression.md) |
| `buzzAdjective()`         |   ✅   | Locale list                                                                                                   |
| `buzzNoun()`              |   ✅   | Locale list                                                                                                   |
| `catchPhrase()`           |   ✅   | Compose: `catchPhraseAdjective` + `catchPhraseDescriptor` + `catchPhraseNoun`                                 |
| `catchPhraseAdjective()`  |   ✅   | Locale list                                                                                                   |
| `catchPhraseDescriptor()` |   ✅   | Locale list                                                                                                   |
| `catchPhraseNoun()`       |   ✅   | Locale list                                                                                                   |
| `industry()`              |   ❌   | Locale list ("Software", "Finance", "Healthcare", "Retail", "Manufacturing"…)                                 |
| `registrationNumber()`    |   ❌   | Locale-specific: NL → `KvK ${prng.int(10000000, 99999999)}`, US → EIN format                                  |

---

## `commerce`

| Method                 | Status | Generation strategy                                                                    |
| ---------------------- | :----: | -------------------------------------------------------------------------------------- |
| `productName()`        |   🔧   | Compose: `productAdjective` + `productMaterial` + `noun`, combination rule from locale |
| `productAdjective()`   |   ✅   | Locale list                                                                            |
| `productMaterial()`    |   ✅   | Locale list                                                                            |
| `productDescription()` |   🔧   | Compose: `productName` + locale sentence template                                      |
| `product()`            |   ✅   | → `productName`                                                                        |
| `department()`         |   ✅   | Locale list                                                                            |
| `price(min?, max?)`    |   🔧   | Algorithmic: `(random * range).toFixed(2)`, formatted by locale                        |
| `isbn()`               |   ✅   | Algorithmic: 978- + 10 digits (could add proper check digit)                           |
| `upc()`                |   ✅   | Algorithmic: 12 digits                                                                 |
| `ean()`                |   ❌   | Algorithmic: 13-digit EAN with valid check digit                                       |

---

## `finance`

| Method                       | Status | Generation strategy                                                                   |
| ---------------------------- | :----: | ------------------------------------------------------------------------------------- |
| `amount(min?, max?)`         |   ✅   | Algorithmic                                                                           |
| `currencyCode()`             |   ✅   | Locale list (ISO 4217)                                                                |
| `currencyName()`             |   ✅   | Locale list                                                                           |
| `currencySymbol()`           |   ✅   | Locale list                                                                           |
| `currencyNumericCode()`      |   ✅   | Locale list                                                                           |
| `accountNumber(len?)`        |   ✅   | Algorithmic: N digits                                                                 |
| `accountName()`              |   ✅   | Locale list                                                                           |
| `transactionType()`          |   ✅   | Locale list                                                                           |
| `transactionDescription()`   |   ✅   | Locale list                                                                           |
| `iban()`                     |   🔧   | Algorithmic: locale-specific format (NL hardcoded → locale-driven prefix + bank code) |
| `bic()`                      |   🔧   | Algorithmic: locale-specific (NL hardcoded → locale-driven)                           |
| `creditCardNumber()`         |   ✅   | Algorithmic: 4 × 4-digit groups                                                       |
| `creditCardCVV()`            |   ✅   | Algorithmic: 3 digits                                                                 |
| `creditCardIssuer()`         |   ✅   | Fixed list                                                                            |
| `creditCardExpirationDate()` |   ❌   | Algorithmic: `MM/YY` in the future (1–4 years out)                                    |
| `pin(len?)`                  |   ✅   | Algorithmic: N digits                                                                 |
| `routingNumber()`            |   ✅   | Algorithmic: 9 digits                                                                 |
| `bitcoinAddress()`           |   ✅   | Algorithmic: base-58 after `prng.bytes()` refactor                                    |
| `ethereumAddress()`          |   ✅   | Algorithmic: 0x + 40 hex chars                                                        |
| `litecoinAddress()`          |   ✅   | Algorithmic: L + 33 base-58 chars                                                     |

---

## `date`

| Method                        | Status | Generation strategy                                                                 |
| ----------------------------- | :----: | ----------------------------------------------------------------------------------- |
| `anytime()`                   |   ✅   | Algorithmic: range 2000–2030                                                        |
| `between(start, end)`         |   ✅   | Algorithmic                                                                         |
| `betweens(start, end, n?)`    |   ✅   | Algorithmic: N sorted dates                                                         |
| `past(years?)`                |   ✅   | Algorithmic                                                                         |
| `future(years?)`              |   ✅   | Algorithmic                                                                         |
| `recent(days?)`               |   ✅   | Algorithmic                                                                         |
| `soon(days?)`                 |   ✅   | Algorithmic                                                                         |
| `birthdate(minAge?, maxAge?)` |   ✅   | Algorithmic                                                                         |
| `month()`                     |   ✅   | Locale list                                                                         |
| `weekday()`                   |   ✅   | Locale list                                                                         |
| `timeZone()`                  |   ✅   | Locale list                                                                         |
| `unixTimestamp()`             |   ❌   | Algorithmic: `Math.floor(Date / 1000)` from `anytime()`                             |
| `duration()`                  |   ❌   | Algorithmic: ISO 8601 duration "PT1H30M" — `PT${prng.int(0,23)}H${prng.int(0,59)}M` |

---

## `vehicle`

| Method           | Status | Generation strategy                                   |
| ---------------- | :----: | ----------------------------------------------------- |
| `manufacturer()` |   ✅   | Fixed list (brand names — locale-independent)         |
| `model()`        |   ✅   | Fixed list                                            |
| `vehicle()`      |   ✅   | Compose: `manufacturer` + `model`                     |
| `color()`        |   🔧   | Locale list (Dutch names → should be locale-driven)   |
| `fuel()`         |   ✅   | Locale list                                           |
| `vin()`          |   ✅   | Algorithmic: 17 chars from valid VIN alphabet         |
| `vrm()`          |   ✅   | Locale-specific format (NL: `AB-123-C`)               |
| `bicycle()`      |   ✅   | Fixed list (Dutch brands — partially locale-specific) |

---

## `phone`

| Method     | Status | Generation strategy                                          |
| ---------- | :----: | ------------------------------------------------------------ |
| `number()` |   🔧   | Locale-specific format (NL hardcoded → locale-driven prefix) |
| `imei()`   |   ✅   | Algorithmic: 15 digits (could add Luhn check digit)          |

---

## `string`

| Method               | Status | Generation strategy                                      |
| -------------------- | :----: | -------------------------------------------------------- |
| `uuid()`             |   ✅   | Algorithmic: `prng.bytes(16)` after refactor (v4 format) |
| `nanoid(len?)`       |   ✅   | Algorithmic: `prng.bytes(n)` → base-62 alphabet          |
| `alphanumeric(len?)` |   ✅   | Algorithmic                                              |
| `hexadecimal(len?)`  |   ✅   | Algorithmic: `prng.bytes(n/2)` after refactor            |

---

## `color` — implemented (`src/generators/data/color.ts`)

| Method        | Status | Generation strategy                               |
| ------------- | :----: | ------------------------------------------------- |
| `colorHex()`  |   ✅   | Algorithmic: `#` + `prng.bytes(3)` as 6-char hex  |
| `colorRgb()`  |   ✅   | Algorithmic: `rgb(${r}, ${g}, ${b})` from 3 bytes |
| `colorHsl()`  |   ✅   | Algorithmic: `hsl(${hue}, ${sat}%, ${light}%)`    |
| `colorName()` |   ✅   | Reads from `locale.color.names`                   |

---

## `system` — implemented (`src/generators/data/system.ts`)

| Method                 | Status | Generation strategy                                               |
| ---------------------- | :----: | ----------------------------------------------------------------- |
| `platform()`           |   ✅   | Fixed list: "windows" \| "macos" \| "linux" \| "ios" \| "android" |
| `browser()`            |   ✅   | Fixed list: "chrome" \| "firefox" \| "safari" \| "edge"           |
| `userAgent()`          |   ✅   | Lives in `internet.ts`; composes OS string + browser version      |
| `fileExtension(type?)` |   ✅   | Fixed list by category                                            |
| `mimeType()`           |   ✅   | Map from `fileExtension`                                          |
| `fileName()`           |   ✅   | Compose: `noun` + `.` + `fileExtension`                           |
| `filePath()`           |   ✅   | Compose: directory + `/` + `fileName`                             |
| `semver()`             |   ✅   | Algorithmic: `${major}.${minor}.${patch}`                         |

---

## `git` — new module (optional, high value for dev tooling)

| Method            | Status | Generation strategy                                                    |
| ----------------- | :----: | ---------------------------------------------------------------------- |
| `branch()`        |   ❌   | Compose: `"feat/"` \| `"fix/"` \| `"chore/"` + `noun` + `"-"` + `noun` |
| `commitMessage()` |   ❌   | Compose: conventional commit format — `"fix: ${verb} ${noun}"`         |
| `commitSha()`     |   ❌   | Algorithmic: `hexadecimal(40)`                                         |
| `shortSha()`      |   ❌   | Algorithmic: `hexadecimal(7)`                                          |

---

## Implementation Priority

Sorting by value (realism gain / user impact) vs. effort:

| Priority | Item                                                                                           | Effort  |
| -------- | ---------------------------------------------------------------------------------------------- | ------- |
| 1        | Fix `domainWord`, `url`, `bio`, `jwt` composition                                              | Trivial |
| 2        | Extract `system.ts` (`platform`, `browser`, `fileExtension`, `mimeType`, `fileName`, `semver`) | Low     |
| 3        | `color.ts` (`colorHex`, `colorRgb`, `colorName`)                                               | Low     |
| 4        | `urlPath()`, `slug()`, `httpStatusText()`, `locale()`                                          | Low     |
| 5        | Missing finance: `creditCardExpirationDate`, IBAN/BIC locale-driven                            | Low     |
| 6        | Missing date: `unixTimestamp()`, `duration()`                                                  | Trivial |
| 7        | `company.industry()`, `company.registrationNumber()`                                           | Low     |
| 8        | `word.lines()`, `word.text()`, `word.slug()`                                                   | Trivial |
| 9        | `person.age()`, `person.nationality()`, `person.avatar()`                                      | Trivial |
| 10       | `git` module                                                                                   | Medium  |
| 11       | EAN barcode with check digit                                                                   | Low     |

---

See also: [Generator Reuse](generator-reuse.md) · [Word Generation](../text-generation/word-generation.md) · [Back to Index](../overview.md)
