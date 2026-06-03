---
id: B68
title: Investigate Wiktionary nl noun-gender as a data source for B58-B
type: research
priority: low
flags: [review]
created: 2026-06-02
predecessor: B58-B
report: wiki/research/text-generation/wiktionary-nl-noun-gender.md
---

## Description

B58-B (Dutch inflection) is blocked on Q-3 — the OpenTaal genus-tagged corpus does not
exist. WebFetch against `github.com/OpenTaal/opentaal-wordlist` (2026-06-02) confirmed
OpenTaal ships word forms only, no `de`/`het` tagging. B58-B's card surfaced four
follow-up paths; this research item evaluates the most promising one: **Wiktionary Dutch
noun categories**.

Wiktionary categorises Dutch noun entries by their grammatical gender via the `de-woord`
and `het-woord` (and `meerderwoord` / `onzijdig-woord`) category tags. The data exists in
the runtime backing the wiki. The questions for this research item:

1. **Access path**. What's the cheapest viable mechanism to pull bulk `(noun, gender)`
   pairs at script time?
   - MediaWiki XML dump (full Dutch Wiktionary; multi-GB; needs parsing).
   - Wikidata SPARQL endpoint (`P31` instance-of `noun` + `P5185` grammatical-gender
     property; structured data; rate-limited).
   - Wiktionary REST / Action API (per-entry; ~150K Dutch nouns; too slow for one-shot).
   - Pre-parsed third-party mirror (e.g. `kaikki.org/dictionary/Dutch`, which provides
     ZIM/JSON dumps; license — pass-through Wiktionary CC-BY-SA).

2. **Data shape after parsing**. For each viable access path, what's the expected
   entry count, freshness, and completeness? B58-B's card estimated ~3000 entries
   (matched to its existing `nouns` corpus); the actual count from Wiktionary is likely
   ≥ 50K. Implementation card decides how to filter.

3. **License**. Wiktionary is CC-BY-SA 3.0 (and 4.0 for newer content). The project's
   permissive-only stance accepts CC-BY-SA (locale-nl already uses OpenTaal BSD/GPL; the
   attribution requirement is honoured by the data-file header per the B46/B48 license bar).
   Verify CC-BY-SA actually applies to category-tag derivatives (not just full-page text).

4. **Bundle-size impact**. The B58-B card estimated ~5 KB OTW for ~3000 entries (~13 KB
   raw). For a 50K-entry corpus the OTW estimate scales linearly to ~85 KB OTW under the
   B50 baseline. Decide a target count (`nounsWithGender` could ship top-N most-common
   matched against the existing `nouns` corpus).

5. **B58-B unblock path**. If Wiktionary is viable, the implementation card (B58-B's
   pipeline) gets a clean `de`/`het` mapping. If not viable, B58-B should rescope to drop
   R8 (adjective `-e` agreement) and ship verb conjugation + plurals only — that path
   was surfaced on the B58-B card as the alternative.

## Deliverable

`wiki/research/text-generation/wiktionary-nl-noun-gender.md`. Per-access-path feasibility

- license + bundle-size estimate + a recommendation:

* **A**: viable access path X → file B58-B unblocking note + name the path
* **B**: not viable from Wiktionary → recommend B58-B rescope (drop R8, ship R1–R7 + R9–R12)
* **C**: other (e.g. fold the gender-tagging into a much smaller curated list)

## Out of scope

- Actually fetching the data (that's the B58-B implementation card's job — this is
  research only).
- Pursuing alternative sources besides Wiktionary (CBG Meertens, BabelNet, etc. — the
  B58-B card already flagged those; this research focuses on Wiktionary because it's
  the only one with both bulk-fetchability AND a permissive license).
- Any code change in `packages/locale-nl/` or `src/` — pure analysis report.

## Notes

- **Predecessor**: B58-B (blocked) — this research's outcome unblocks or rescopes it.
- **Sibling**: B49 (Dutch surname ACCEPT) — similar pattern: spike licensing + bulk-fetch
  viability before committing to an implementation that ships shifted data.
- **No urgency**. B58-B is low priority and B58-A already shipped the English inflection
  half. Dutch verb conjugation + plurals are still a real win even without adjective
  agreement.
- `flags: [review]` — the recommendation (A / B / C) needs maintainer sign-off before
  any B58-B work resumes.
