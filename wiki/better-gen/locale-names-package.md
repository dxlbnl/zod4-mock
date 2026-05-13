# The `locale-names` Package

## Concept

A shared workspace package that contains pre-trained Markov models for every significant cultural name group — Dutch, German, French, Arabic, Turkish, Frisian, Scandinavian, Slavic, and more. Each locale package (`locale-nl`, `locale-de`, `locale-fr`, …) imports only the cultural groups it needs and assembles them with locale-specific weights. Models that are not imported are tree-shaken away.

This separates two concerns that are currently conflated in each locale package:
- **Data** — what names exist and their phonological character (lives in `locale-names`)
- **Distribution** — how often each cultural group appears in a given locale (lives in `locale-nl`, `locale-de`, etc.)

---

## Package Structure

```
packages/
  locale-names/
    src/
      groups/
        dutch/          male.ts  female.ts  last-names.ts
        german/         male.ts  female.ts  last-names.ts
        french/         male.ts  female.ts  last-names.ts
        arabic/         male.ts  female.ts  last-names.ts
        turkish/        male.ts  female.ts  last-names.ts
        english/        male.ts  female.ts  last-names.ts
        frisian/        male.ts  female.ts  last-names.ts
        scandinavian/   male.ts  female.ts  last-names.ts
        spanish/        male.ts  female.ts  last-names.ts
        italian/        male.ts  female.ts  last-names.ts
        slavic/         male.ts  female.ts  last-names.ts
        portuguese/     male.ts  female.ts  last-names.ts
        south-asian/    male.ts  female.ts  last-names.ts
      index.ts          # re-exports all groups
    data/
      training/
        dutch/          male.txt  female.txt  last-names.txt
        german/         ...
        french/         ...
        arabic/         ...
        turkish/        ...
        english/        ...
        frisian/        ...
        scandinavian/   ...
        spanish/        ...
        italian/        ...
        slavic/         ...
        portuguese/     ...
        south-asian/    ...
    scripts/
      fetch-data.ts     # fetches all cultural corpora from their source URLs
      classify.ts       # classifies a mixed corpus into cultural groups
      train.ts          # trains all groups
      verify.ts         # verifies all models
    package.json
```

Each `src/groups/dutch/male.ts` exports a single `MarkovModel` constant. Nothing else.

---

## How Locale Packages Import From It

```typescript
// packages/locale-nl/src/index.ts
import { dutchMale, dutchFemale, dutchLastNames }         from "@zod4-mock/locale-names/groups/dutch";
import { arabicMale, arabicFemale, arabicLastNames }       from "@zod4-mock/locale-names/groups/arabic";
import { turkishMale, turkishFemale, turkishLastNames }    from "@zod4-mock/locale-names/groups/turkish";
import { englishMale, englishFemale, englishLastNames }    from "@zod4-mock/locale-names/groups/english";
import { frenchMale, frenchFemale, frenchLastNames }       from "@zod4-mock/locale-names/groups/french";
import { germanMale, germanFemale, germanLastNames }       from "@zod4-mock/locale-names/groups/german";
import { frisianMale, frisianFemale }                      from "@zod4-mock/locale-names/groups/frisian";

export const nl: LocaleData = {
  person: {
    firstNamesMale: [
      { model: dutchMale,    weight: 68 },
      { model: arabicMale,   weight: 12 },
      { model: turkishMale,  weight:  6 },
      { model: englishMale,  weight:  5 },
      { model: frenchMale,   weight:  4 },
      { model: germanMale,   weight:  3 },
      { model: frisianMale,  weight:  2 },
    ],
    firstNamesFemale: [ /* same groups, different weights */ ],
    lastNames: [
      { model: dutchLastNames,   weight: 72 },
      { model: arabicLastNames,  weight: 10 },
      { model: turkishLastNames, weight:  6 },
      { model: englishLastNames, weight:  5 },
      { model: frenchLastNames,  weight:  4 },
      { model: germanLastNames,  weight:  3 },
    ],
  },
};
```

`locale-de` imports `german`, `dutch`, `french`, `english`, `turkish`, `slavic` — completely different combination, different weights. No duplication.

---

## Cultural Groups and Corpus Sources

### `dutch` — Germanic Dutch

| Type | Source | URL / Notes |
|------|--------|-------------|
| First names | open-nl-data/dutch-names-dataset | `Mannen/Vrouwen > 100` filter to isolate high-frequency core Dutch names |
| First names | Meertens Instituut voornamenbank | meertens.knaw.nl — has etymological origin filters |
| Last names | CBS top-surnames (2007 census) | digitalheir/family-names-in-the-netherlands |

Filter threshold `> 100` drops from 25k → ~2,000–4,000 genuinely common Dutch names, eliminating most multicultural noise.

---

### `german` — Germanic German

| Type | Source | URL / Notes |
|------|--------|-------------|
| First names | GfDS Vornamenliste (annual) | gfds.de/vornamen/ — Gesellschaft für deutsche Sprache |
| First names | davidak/vornamen GitHub | ~5,000 German first names |
| Last names | destatis.de | German Statistical Office surname frequency data |

---

### `french` — Romance French

| Type | Source | URL / Notes |
|------|--------|-------------|
| First names | INSEE prénoms dataset | insee.fr/fr/statistiques/2540004 — excellent quality, annual, with frequency |
| Last names | INSEE noms de famille | Same source, surname distribution data |

INSEE is the gold standard — frequency data back to 1900, full population coverage, freely downloadable CSV.

---

### `arabic` — Arabic transliterated

| Type | Source | URL / Notes |
|------|--------|-------------|
| First names | bzeekhan/arabic-names-dataset | GitHub — Arabic first names in ASCII transliteration |
| First names | zacanger/arabic-names | GitHub — additional Arabic name list |
| Last names | Moroccan-specific | Haut-Commissariat au Plan (HCP) Morocco surname data |

Note: Arabic names in Dutch/French/Belgian registries use Dutch/French transliteration conventions, not formal Arabic romanization. Sourcing from Dutch/French-registered Arabic name data is more accurate than sourcing from a pure Arabic list.

---

### `turkish` — Turkish

| Type | Source | URL / Notes |
|------|--------|-------------|
| First names | ozdemirburak/turkish-names | GitHub — well-maintained Turkish name list |
| First names | TÜİK (Turkish Statistical Institute) | tuik.gov.tr — official frequency data |
| Last names | ozdemirburak/turkish-names | Same repo includes surnames |

---

### `english` — Anglo-Saxon/modern English

| Type | Source | URL / Notes |
|------|--------|-------------|
| First names | SSA Baby Names | ssa.gov/oact/babynames/ — top-1000 by decade |
| First names | ONS England & Wales | ons.gov.uk — annual statistics |
| Last names | US Census Bureau surnames | census.gov/topics/population/genealogy/data |

---

### `frisian` — Regional Frisian

| Type | Source | URL / Notes |
|------|--------|-------------|
| First names | Meertens Instituut | nvb-frisian filter — specifically Frisian names |
| First names | Fryske Akademy | fryske-akademy.nl — Frisian cultural institute |

Frisian names are phonologically distinct from Dutch (hard consonants, diphthongs: Wierd, Rienk, Tjerkje, Yttje). A small model (~300–500 names) captures this well.

---

### `scandinavian` — Danish, Norwegian, Swedish, Finnish

| Type | Source | URL / Notes |
|------|--------|-------------|
| First names | Danmarks Statistik | dst.dk — Danish name statistics |
| First names | SSB Norway | ssb.no — Norwegian name statistics |
| First names | SCB Sweden | scb.se — Swedish name statistics |
| Last names | Combined from above | Mix of patronymic (-sen, -son) and geographic surnames |

Scandinavian names form a coherent linguistic group for Markov purposes and can initially be combined into one model. Split into per-language models later if quality demands it.

---

### `spanish` — Romance Spanish/Catalan

| Type | Source | URL / Notes |
|------|--------|-------------|
| First names | INE Spain | ine.es — Instituto Nacional de Estadística |
| Last names | INE Spain | Same source |

---

### `italian` — Romance Italian

| Type | Source | URL / Notes |
|------|--------|-------------|
| First names | ISTAT Italy | istat.it — annual nomi più frequenti |
| Last names | ISTAT Italy | Same source |

---

### `portuguese` — Romance Portuguese

| Type | Source | URL / Notes |
|------|--------|-------------|
| First names | INE Portugal | ine.pt |
| First names | IBGE Brazil | ibge.gov.br — for Brazilian Portuguese flavor |

---

### `slavic` — Polish, Czech, Slovak, Croatian, etc.

| Type | Source | URL / Notes |
|------|--------|-------------|
| First names | GUS Poland | stat.gov.pl — Polish name statistics |
| First names | ČSÚ Czech Republic | czso.cz |
| Last names | GUS Poland + ČSÚ Czech | Combined for initial model |

Slavic names share enough phonological patterns (consonant clusters, -ski/-cki/-ić endings) to work as a combined model initially. Split by sub-group if needed.

---

### `south-asian` — Hindi/Sanskrit, Punjabi, Bengali origin

| Type | Source | URL / Notes |
|------|--------|-------------|
| First names | Census India | censusindia.gov.in — partial name frequency data |
| First names | Various GitHub datasets | Multiple Hindi/Sanskrit baby name lists |
| Last names | Regional surname lists | Curated from multiple Indian census sources |

These names appear in NL primarily through Surinamese immigration (Dutch colonial history). The Surinamese-Dutch variants (Koemar, Persad, Baldewsing) differ orthographically from Indian variants but share the same Markov phonology.

---

## Classifying Mixed Corpora

When you have a registry dump with mixed origins and need to split it, three complementary approaches:

### Approach 1: Frequency threshold (no classification needed)

The simplest and most reliable method. High-frequency names in a Dutch registry are almost always Dutch-origin; low-frequency names are predominantly minority-origin.

```typescript
const dutchCore  = names.filter(n => n.count > 100);   // ~2,000 names — Dutch core
const allOthers  = names.filter(n => n.count <= 100);  // multicultural diversity pool
```

Train `dutchCore` as the Dutch group. Source other groups from dedicated origin-specific datasets.

### Approach 2: Rule-based pre-filter for obvious cases

Handles clear outliers before any statistical analysis. Apply before either of the other approaches:

```typescript
const ORIGIN_RULES: Array<[RegExp, string]> = [
  [/singh$|kumar$|persad$|koemar$|lal$|ram$|devi$/,                    "south-asian"],
  [/^(mohammed|muhammad|ibrahim|youssef|fatima|amina|ayesha|abdel)/,   "arabic"],
  [/^(mehmet|ahmet|mustafa|fatma|ayse|yilmaz|demir)$/,                 "turkish"],
  [/escu$|anu$|ica$|escu$/,                                             "romanian"],
  [/^(wierd|rienk|tjerk|yttje|sjoerd|douwe|hinke|jitske)$/,            "frisian"],
];

function classifyByRule(name: string): string | null {
  for (const [pattern, origin] of ORIGIN_RULES) {
    if (pattern.test(name)) return origin;
  }
  return null;
}
```

### Approach 3: Character n-gram cosine similarity

For names that rule-based classification can't resolve. Build a reference bigram frequency vector from each known-pure corpus, then compare incoming names against those vectors.

```typescript
type NgramVector = Map<string, number>;

function buildVector(names: string[], n = 2): NgramVector {
  const counts = new Map<string, number>();
  for (const name of names) {
    for (let i = 0; i <= name.length - n; i++) {
      const gram = name.slice(i, i + n);
      counts.set(gram, (counts.get(gram) ?? 0) + 1);
    }
  }
  // L2-normalize
  const total = [...counts.values()].reduce((a, b) => a + b * b, 0) ** 0.5;
  for (const [k, v] of counts) counts.set(k, v / total);
  return counts;
}

function cosineSimilarity(a: NgramVector, b: NgramVector): number {
  let dot = 0;
  for (const [k, v] of a) dot += v * (b.get(k) ?? 0);
  return dot;
}

function classify(name: string, references: Record<string, NgramVector>): string {
  const v = buildVector([name]);
  let best = "unknown", bestScore = -1;
  for (const [origin, ref] of Object.entries(references)) {
    const score = cosineSimilarity(v, ref);
    if (score > bestScore) { bestScore = score; best = origin; }
  }
  return best;
}
```

Build `references` from the pure-origin corpora. Then run `classify(name, references)` on every name in the mixed registry. Confidence is low for short names (3–4 chars) — use a minimum-confidence threshold and discard ambiguous names rather than forcing an assignment.

### Approach 4: NamSor API (for validation / bootstrapping)

NamSor (namsor.com) is a dedicated name-origin classification API with a free tier (~1,000 names/day). Use it to validate the n-gram classifier's output or to bootstrap labels for a small gold-standard test set. Not suitable for classifying 25k names at scale due to rate limits, but excellent for verifying your classifier against a random sample.

---

## Building Incrementally

Don't try to build all 13 groups at once. A realistic roadmap:

**Phase 1 — Dutch + English (covers `locale-nl` and `locale-en` basic needs)**
- `dutch`: filter current corpus to `count > 100`
- `english`: SSA top-1000 per decade

**Phase 2 — Extend nl distribution**
- `arabic`: one GitHub dataset
- `german`: GfDS list
- `frisian`: Meertens Instituut

**Phase 3 — Enable `locale-de`, `locale-fr`**
- Proper `german` corpus from GfDS
- `french` from INSEE

**Phase 4 — Remaining Romance and Slavic**
- `spanish` (INE), `italian` (ISTAT), `portuguese` (INE)
- `scandinavian` (DST/SCB)
- `slavic` (GUS Poland)

**Phase 5 — Rare/regional**
- `south-asian`, `frisian` upgrade, `breton`, `turkish`

---

## Bundle Size

Each model, per group per gender, trained at order-2 on ~1,500–3,000 filtered names:

| Property | Value |
|----------|-------|
| States per model | ~200–500 |
| Chars per model | ~27 |
| Size per model (Float32Array) | ~25–55 KB |
| 13 groups × 3 files (M/F/last) | ~39 models total |
| Full package size | ~1–2 MB |
| Typical locale import (6 groups) | ~450–650 KB |

With tree-shaking, a user who only ever uses `locale-nl` never pays for the `south-asian` or `slavic` models. A user who builds for a single locale pays for ~6–7 groups × 3 = ~18 models ≈ ~450–650 KB — comparable to one medium-sized image.

---

See also: [Name Origin Distribution](name-origin-distribution.md) · [Markov Training Pipeline](markov-training-pipeline.md) · [Localization Architecture](localization.md) · [Back to Index](index.md)
