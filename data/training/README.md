# Training Corpora

This directory holds **raw wordlist files** used to train the Markov models in
`src/generators/data/markov/`. The trained model `.ts` files are committed; the
source text files are **not committed** (they are too large for the repo, and
some have licence restrictions that require attribution rather than redistribution).

Download the files below and place them in the matching paths before running
`pnpm train-markov`.

---

## English (`en/`)

### `en/first-names-male.txt` and `en/first-names-female.txt`

**Source:** SSA Baby Names — https://www.ssa.gov/oact/babynames/limits.html

Download `yob2023.txt` (national data, one year file). Then split by sex:

```bash
# Male names
awk -F, '$2=="M"{print $1}' yob2023.txt | sort -u > data/training/en/first-names-male.txt

# Female names
awk -F, '$2=="F"{print $1}' yob2023.txt | sort -u > data/training/en/first-names-female.txt
```

The file is in the public domain (US government data).

### `en/last-names.txt`

**Source:** US Census 2010 Surnames — https://www.census.gov/topics/population/genealogy/data/2010_surnames.html

Download `Names_2010Census.csv`. Extract the name column (skip header):

```bash
awk -F, 'NR>1{print $1}' Names_2010Census.csv | tr '[:upper:]' '[:lower:]' | sort -u \
  > data/training/en/last-names.txt
```

Public domain (US Census Bureau data).

### `en/nouns.txt` and `en/adjectives.txt`

**Source:** WordNet 3.1 — https://wordnet.princeton.edu/download/current-version

Download and extract `WordNet-3.1.tar.bz2`. Then extract lemmas:

```bash
# Nouns: first lemma from each synset in data.noun
grep -v '^  ' wordnet-3.1/dict/data.noun | grep -v '^$' \
  | awk '{print $5}' | tr '_' ' ' | sort -u | head -5000 \
  > data/training/en/nouns.txt

# Adjectives: first lemma from each synset in data.adj
grep -v '^  ' wordnet-3.1/dict/data.adj | grep -v '^$' \
  | awk '{print $5}' | tr '_' ' ' | sort -u | head -2000 \
  > data/training/en/adjectives.txt
```

WordNet is released under the Princeton WordNet License (permissive, requires attribution).

---

## Dutch (`nl/`)

### `nl/first-names-male.txt` and `nl/first-names-female.txt`

**Source:** Meertens Instituut — https://www.meertens.knaw.nl/nvb/

Download the top-1000 male and female name lists (CSV) from the Voornamenbank.
Extract just the name column, one per line.

### `nl/last-names.txt`

**Source:** CBS (Statistics Netherlands) — https://www.cbs.nl/

The 2007 top-10000 surnames list is available from various mirrors. One
public copy is on the OpenTaal wordlist; filter for POS tag `N` (noun/name).

### `nl/nouns.txt` and `nl/adjectives.txt`

**Source:** OpenTaal 2.20G — https://github.com/OpenTaal/opentaal-wordlist

Download `wordlist.txt`. Filter by part-of-speech tag if available, or use the
full wordlist and let the trainer pick up the distributional patterns:

```bash
# Nouns (rough heuristic: words starting uppercase that aren't names)
grep -E '^[A-Za-z]+$' wordlist.txt | sort -u | head -5000 \
  > data/training/nl/nouns.txt

# Adjectives (words ending in -e, -elijk, -ig, -baar, -loos — rough)
grep -E '(elijk|ig|baar|loos)$' wordlist.txt | sort -u | head -2000 \
  > data/training/nl/adjectives.txt
```

OpenTaal is licensed under BSD/GPL.

---

## Training commands

After placing all files above, run:

```bash
# English first names
pnpm train-markov --input data/training/en/first-names-male.txt \
  --output src/generators/data/markov/en-first-names-male.ts \
  --name enFirstNamesMaleModel

pnpm train-markov --input data/training/en/first-names-female.txt \
  --output src/generators/data/markov/en-first-names-female.ts \
  --name enFirstNamesFemaleModel

pnpm train-markov --input data/training/en/last-names.txt \
  --output src/generators/data/markov/en-last-names.ts \
  --name enLastNamesModel

pnpm train-markov --input data/training/en/nouns.txt \
  --output src/generators/data/markov/en-nouns.ts \
  --name enNounsModel

pnpm train-markov --input data/training/en/adjectives.txt \
  --output src/generators/data/markov/en-adjectives.ts \
  --name enAdjectivesModel

# Dutch first names
pnpm train-markov --input data/training/nl/first-names-male.txt \
  --output src/generators/data/markov/nl-first-names-male.ts \
  --name nlFirstNamesMaleModel

pnpm train-markov --input data/training/nl/first-names-female.txt \
  --output src/generators/data/markov/nl-first-names-female.ts \
  --name nlFirstNamesFemaleModel

pnpm train-markov --input data/training/nl/last-names.txt \
  --output src/generators/data/markov/nl-last-names.ts \
  --name nlLastNamesModel

pnpm train-markov --input data/training/nl/nouns.txt \
  --output src/generators/data/markov/nl-nouns.ts \
  --name nlNounsModel

pnpm train-markov --input data/training/nl/adjectives.txt \
  --output src/generators/data/markov/nl-adjectives.ts \
  --name nlAdjectivesModel
```

## Verification

```bash
pnpm verify-markov --model src/generators/data/markov/en-first-names-male.ts --count 30
pnpm verify-markov --model src/generators/data/markov/nl-nouns.ts --count 30
```
