---
id: B49
title: Refetch Dutch surnames from CBS / Meertens NFB (strict B48-R5 closure)
type: research
priority: low
flags: [review]
created: 2026-06-01
---

## Description

B48 Phase 2 ([wiki/backlog/done/B48-replace-markov-with-real-wordlists.md](../done/B48-replace-markov-with-real-wordlists.md)) shipped Dutch surnames as the **Phase 1 migrated corpus** (854 surnames, Meertens-NFB-derived 2007 top-1000 — already in-repo from the deleted `packages/locale-names/`). The B48-R5 spec requires Dutch surnames to be **refetched from CBS (Statistics Netherlands) or Meertens directly** at script time — that obligation was _not_ discharged in B48 because:

- CBS (`opendata.cbs.nl`) does not publish a bulk Dutch-surname dataset. Their surname work covers per-name frequency lookups via NFB-Statline integration, which was discontinued.
- Meertens NFB (`cbgfamilienamen.nl`) ships data as a paginated HTML browser UI, not as a JSON/CSV.

The implementer surfaced the deviation in the locale-nl fetch script header + B48 changeset body. The reviewer accepted the deviation rather than blocking B48, with the recommendation to file this follow-up.

The shipped data is genuine Meertens-attributable Dutch surname material — just not freshly refetched in the B48 commit. B49 closes the strict R5 obligation.

## Scope

Investigate sources for a bulk-fetchable Dutch surname list with proper licensing:

1. **CBS direct contact**: ask CBS for a one-time dataset export with a documented license. They have the data internally; the question is whether they'll publish it for open re-use.
2. **Meertens NFB scrape**: a one-time scrape of the cbgfamilienamen.nl HTML pages with explicit license review (Meertens terms vary by collection). Output: a JSON/CSV that gets committed under `packages/locale-nl/data/` with provenance.
3. **Alternative public-domain Dutch surname lists**: search for academic / open-data publications (DBNL, university linguistic corpora, government open-data portals beyond CBS).
4. **Accept current state**: if the cost-vs-benefit doesn't justify the refetch, formally amend B48-R5 wording to allow the migrated corpus as the canonical source.

## Deliverable

`wiki/research/text-generation/dutch-surname-sources.md`: per-source feasibility + licensing analysis, then a recommendation (refetch from Meertens, refetch from CBS, ship a different corpus, or accept current state). If the recommendation is to refetch: estimated entry count + bundle-size impact (the current 854 entries → likely 5k–50k under a real fetch).

## Notes

- **No urgency**. B48 shipped real Dutch surname data; quality is acceptable for mock-data purposes. This item formalizes the strict spec closure.
- **Predecessor**: B48 (commits `8315357` Phase 1 + `617d8f5` Phase 2).
- **Related**: B46 spike ([wordlist-sourcing-spike.md](../../research/text-generation/wordlist-sourcing-spike.md)) §2 had flagged Q-S2 (license-undeclared digitalheir mirror) — that's the source B48 explicitly forbade. B49 picks up the licensed-source question.
- `flags: [review]` — refetch direction has licensing implications; user signs off before any data-shipping change.
- **No GitHub issue** filed. The B48 changeset documents the deviation; if a downstream user files an issue about Dutch surname quality, link it here.
