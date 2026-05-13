# Name Origin Distribution

## The Problem with a Single Registry Model

The Dutch civil registry contains every name ever registered in the Netherlands, regardless of cultural origin. With a threshold of `Mannen > 5`, the current corpus has 25,143 male entries including:

- Dutch/Germanic core names: `Jan`, `Piet`, `Maarten`, `Emma`
- Moroccan/Arabic names: `Mohammed`, `Ibrahim`, `Abdel`, `Youssef` (~200+ entries)
- Surinamese/Indian names: `Soerinderpersad`, `Shailinderkumar`, `Radjinderpersad`
- Historical formal names: `Aalbertus`, `Aalderikus`, `Sieuwerhardus`
- Modern English names: `Jayden`, `Kevin`, `Ryan`

Feeding all of these into one Markov model produces exactly the "Risharoumas" / "Kiyannyoan" failures seen in the verify output: the model learns bigram transitions from linguistically incompatible name sets and chains them together arbitrarily.

The fix isn't to filter to one "pure" set — that throws away legitimate diversity. The fix is to **train separate models per cultural origin** and let the locale define how often each one is drawn from.

---

## The Architecture: Per-Origin Models + Locale Weights

Each origin is trained as an independent, linguistically homogeneous Markov model. The locale provides an array of `(model, weight)` pairs. At generation time, a weighted pick selects which origin pool to sample from.

```typescript
// src/locales/types.ts
interface NameOriginSet {
  model:  MarkovModel;
  weight: number;   // relative probability — does not need to sum to 100
}

interface LocaleData {
  person: {
    firstNamesMale:   NameOriginSet[];
    firstNamesFemale: NameOriginSet[];
    lastNames:        NameOriginSet[];
  };
}
```

The `nl` locale definition:

```typescript
// packages/locale-nl/src/index.ts
export const nl: LocaleData = {
  person: {
    firstNamesMale: [
      { model: dutchMaleModel,    weight: 68 },
      { model: arabicMaleModel,   weight: 12 },
      { model: turkishMaleModel,  weight:  6 },
      { model: englishMaleModel,  weight:  5 },
      { model: frenchMaleModel,   weight:  4 },
      { model: germanMaleModel,   weight:  3 },
      { model: frisianMaleModel,  weight:  2 },
    ],
    firstNamesFemale: [
      { model: dutchFemaleModel,   weight: 68 },
      // ...
    ],
    lastNames: [
      { model: dutchLastNamesModel,   weight: 72 },
      { model: arabicLastNamesModel,  weight: 10 },
      // ...
    ],
  },
};
```

The weights reflect the actual demographic distribution of names in Dutch databases — not the population percentage, but the *name frequency distribution* in a Dutch context. Adjust them empirically after running `pnpm verify`.

---

## Model Sharing Across Locales

The same origin models are imported by multiple locale packages. The `germanMaleModel` is used in both `nl` and `de` — just with very different weights.

```
packages/
  locale-nl/
    src/
      models/          # models trained specifically for Dutch registry data
        dutch-male.ts
        arabic-male.ts
        turkish-male.ts
        frisian-male.ts
      index.ts         # assembles the locale with weights
  locale-de/
    src/
      models/
        german-male.ts
        dutch-male.ts    # separate corpus, German-registered Dutch-origin names
      index.ts
  locale-fr/
    src/
      models/
        french-male.ts
        breton-male.ts
        alsatian-male.ts
      index.ts
```

Each locale package is responsible for sourcing and training the corpus subsets relevant to it. There is no shared model package — `dutch-male.ts` in `locale-nl` and `dutch-male.ts` in `locale-de` may come from different source datasets and have different frequency profiles.

---

## Origin Sets per Locale

### `nl` — Netherlands

| Origin | Description | Corpus source |
|--------|-------------|--------------|
| `dutch` | Germanic Dutch names, high-frequency only (Mannen/Vrouwen > 100) | `open-nl-data/dutch-names-dataset` filtered |
| `arabic` | Moroccan and Egyptian Arabic names | Baby name databases filtered to Arabic-script origin |
| `turkish` | Turkish-origin names | Turkish Statistical Institute / curated list |
| `english` | English/American names common in NL | SSA or ONS top-500, cross-referenced |
| `french` | French-origin names (common in southern NL) | INSEE top-500 |
| `german` | German-origin names (common near German border) | Statistisches Bundesamt top-500 |
| `frisian` | Frisian regional names | Meertens Instituut — specifically Frisian name list |

### `de` — Germany

| Origin | Weight | Corpus source |
|--------|:------:|--------------|
| `german` | 80 | Gesellschaft für deutsche Sprache Vornamenliste |
| `english` | 8 | SSA / ONS top-1000 |
| `turkish` | 5 | Same as nl/turkish |
| `french` | 4 | Same as nl/french |
| `dutch` | 3 | Dutch-specific names common in German registration |

### `fr` — France

| Origin | Weight | Corpus source |
|--------|:------:|--------------|
| `french` | 78 | INSEE prénoms dataset (annual publication) |
| `english` | 10 | SSA / ONS top-1000 |
| `arabic` | 7 | Arabic-origin names in French registry |
| `breton` | 3 | Breton regional names (Office Public de la Langue Bretonne) |
| `basque` | 2 | Basque regional names |

### `be` — Belgium

| Origin | Weight | Corpus source |
|--------|:------:|--------------|
| `french-belgian` | 45 | Statbel prénoms (French community) |
| `dutch-flemish` | 40 | Statbel prénoms (Flemish community) |
| `arabic` | 8 | Same as nl/arabic |
| `german` | 4 | Eupen/Malmedy German-speaking community |
| `english` | 3 | International influence |

---

## Corpus Filtering per Origin

### Dutch-core extraction from the existing corpus

The simplest win: change the frequency threshold in `fetch-data.ts` from `> 5` to `> 100` for the Dutch-core model. This drops from 25k entries to approximately 2,000–4,000 high-frequency names — the names that actually dominate Dutch usage.

```typescript
// fetch-data.ts — two output files from one source
const dutchCore  = names.filter(n => n.Mannen > 100).map(n => n.Voornaam.toLowerCase());
const allFiltered = names.filter(n => n.Mannen > 5).map(n => n.Voornaam.toLowerCase());
```

`dutchCore` becomes the `dutch` origin model. The other origins are sourced separately.

### Length and character filtering

All corpora apply the same filtering before training:
- Remove entries outside `[minWordLen, maxWordLen]` (see [Markov Training Pipeline](markov-training-pipeline.md#recommended-parameters))
- Remove compound entries (hyphens, spaces — treat as two separate names)
- ASCII-lowercase only (accents normalized or stripped)
- Minimum frequency if the source has frequency data

### What to do with Surinamese/Indian names

Names like `Soerinderpersad` are linguistically distinct from both Dutch and Arabic names — they are South Asian names transcribed through Dutch orthography. If the library needs to represent Surinamese-Dutch demographics, train a dedicated `surinamese` or `south-asian` origin model for the `nl` locale. Otherwise, these names are simply excluded by the `maxWordLen` filter.

---

## The Weighted Sampler

```typescript
// src/generators/data/markov/sample.ts (extend existing file)

export function sampleWeighted(prng: Prng, sets: readonly NameOriginSet[]): string {
  const total = sets.reduce((s, m) => s + m.weight, 0);
  const target = prng.random() * total;
  let cumulative = 0;
  for (const { model, weight } of sets) {
    cumulative += weight;
    if (target < cumulative) {
      return sampleMarkov(prng, model);
    }
  }
  // Fallback — floating point rounding
  return sampleMarkov(prng, sets[sets.length - 1]!.model);
}
```

Usage in `person.ts`:

```typescript
export function firstName(prng: Prng, ctx?: GeneratorContext): string {
  const locale = ctx?.locale ?? en;
  const g = extractGender(ctx);
  const sets = g === "female"
    ? locale.person.firstNamesFemale
    : locale.person.firstNamesMale;
  return sampleWeighted(prng, sets);
}
```

The `prng` passed to `sampleWeighted` is already forked per field — no additional forking needed. The model selection and sampling both consume from the same deterministic stream.

---

## Bundle Size Analysis

With ~1,500 names per origin trained at order-2:

| Model | Approx. states | Size (Float32Array) |
|-------|:--------------:|:-------------------:|
| Per origin model (order-2) | ~200–400 | ~25–50 KB |
| 7 origins × 2 genders | ~14 models | ~350–700 KB for `nl` |
| 4 origins × 2 genders (`en`) | ~8 models | ~200–400 KB for `en` |

Compare to a single large all-origins model at order-3: ~3,000 states = ~325 KB. Multiple small homogeneous models at order-2 is competitive, and the quality improvement is substantial.

Tree-shaking applies at the locale level: `locale-de` never imports `arabicMaleModel`, so it is not included in a bundle that only uses the `de` locale.

---

## Last Names Too

The same distribution pattern applies to last names. Dutch last names (`de Vries`, `Jansen`, `Bakker`) are linguistically distinct from Moroccan-Dutch (`Bouazza`, `El Amrani`) and Turkish-Dutch (`Yilmaz`, `Demir`) surnames. A single model mixes these as badly as first names.

The distribution for last names in the `nl` locale would look similar to first names but with different proportions — surname populations shift more slowly than first names.

---

See also: [Markov Training Pipeline](markov-training-pipeline.md) · [Algorithmic Entropy](algorithmic-entropy.md) · [Sibling-Aware Generation](sibling-awareness.md) · [Localization Architecture](localization.md) · [Back to Index](index.md)
