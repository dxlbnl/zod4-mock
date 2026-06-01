---
id: B59
title: Dutch surname data — re-attribute to CBS upstream (B48-R5 ACCEPT closure)
type: chore
priority: low
flags: [review]
created: 2026-06-01
predecessor: B49
report: wiki/research/text-generation/dutch-surname-sources.md
---

## Description

ACCEPT-path closure for [B48-R5](../../specs/B48-replace-markov-with-real-wordlists.md)
per the [B49 research report](../../research/text-generation/dutch-surname-sources.md).
**No data change** — three small text edits across three files that tighten the
provenance / license claim on the existing 854-entry Dutch surname corpus from
`fair-use` to a B46/B48-grade attribution naming the CBS upstream publication.

The B49 report established that:

- Refetching from CBS Maatwerk would cost 2–6 weeks initial reply with uncertain
  outcome on re-identifiability grounds.
- A Meertens NFB scrape fails the license bar (their terms scope use to "personal
  use and scientific research"; bulk redistribution not covered).
- Under B51 Zipf-default `s = 0.7` the top ~300 entries carry ~50% of draws; tail
  expansion past ~2K is invisible at default config.
- The 854-entry corpus already traces to CBS's 2007 Familienamen Top-1000
  publication; `digitalheir` is **0×** in `packages/locale-nl/` (the B48 commit
  already removed any mirror reference).

The open hole is the **license claim**: the data-file header currently says
`(Meertens-NFB-derived; redistribution under fair-use)`, which is weaker than the
B46/B48 license-bar. B59 closes that hole by citing CBS upstream + CC-BY-4.0.

## Decisions (locked in from B49 review, 2026-06-01)

- **B49 Q-1** — ACCEPT (no refetch).
- **B49 Q-4** — In-place B48-R5 edit with `(amended per B49 — 2026-06-01)` marker
  (not a separate appended note).
- **B49 Q-5** — No changeset for this comment-only / spec-amendment change. If
  release tooling rejects, file as `patch`.

## Preliminary acceptance

- **R1** — Update the data-file header in
  [`packages/locale-nl/src/data/last-names.ts:1-6`](../../../packages/locale-nl/src/data/last-names.ts).
  Replace the current `Source:` line:

  ```
  * Source: Phase 1 migration from prior locale-names Dutch slice (2007 NL top-1000 survey) (Meertens-NFB-derived; redistribution under fair-use).
  ```

  with a B46/B48-grade attribution naming:
  - **Source URL**: the CBS Statistics Netherlands 2007 Familienamen Top-1000
    publication. **Implementer verifies the canonical CBS URL at write time**
    (the B49 report intentionally left this as
    `[CBS-publication-URL — verify at chore implementer time]`).
  - **License**: CC-BY-4.0 per CBS open-data terms.
    **Implementer verifies CBS's retroactive-CC-BY-4.0 applicability at write
    time** (B49 Q-2 — read `cbs.nl/nl-nl/over-ons/open-data`; if CC-BY-4.0 does
    not apply retroactively to the 2007 publication, cite the original
    Statistisch Bulletin / Yearbook terms instead).
  - **Retrieval date**: the original 2007 CBS release date.
  - **Entry count**: 854 (unchanged).

- **R2** — Update the script header NOTE in
  [`packages/locale-nl/scripts/fetch-data.ts:16-28`](../../../packages/locale-nl/scripts/fetch-data.ts).
  Two exact phrase swaps:
  - `"Best-effort — see NOTE below."` → `"ACCEPTED per B49 — re-evaluate when CBS publishes a bulk surname table."`
  - `"A CBS/Meertens bulk refetch is filed as a follow-up enhancement."` →
    `"A CBS/Meertens bulk refetch remains the long-term aspiration (B49 ACCEPT; re-evaluate if CBS Open Data publishes a bulk surname table)."`

  Surrounding paragraph (license-status framing) unchanged. Script logic
  unchanged.

- **R3** — Amend B48-R5 wording in
  [`wiki/specs/B48-replace-markov-with-real-wordlists.md:141-154`](../../specs/B48-replace-markov-with-real-wordlists.md)
  per the B49 report §1.4 proposal: replace **only** the sentence
  _"The Dutch surname source MUST be refetched from CBS (Statistics Netherlands)
  or Meertens directly under their published open-data terms"_ with the
  amended-text trace-to-CBS-publication wording from
  [B49 report §1.4](../../research/text-generation/dutch-surname-sources.md).
  **Preserve verbatim** the digitalheir-forbid sentence, the first-name source
  sentence, and the fetch-script-header-comment sentence. Add the
  `(amended per B49 — 2026-06-01)` marker per Q-4.

- **R4** — `pnpm validate` green (typecheck + test + lint + fmt:check). No
  behavioural change is possible from this card; existing tests pass without
  modification.

## Reviewer checklist (in addition to R1–R4)

- **B49 Q-2 verification**: did the implementer cite a CBS publication URL that
  resolves? Did the CC-BY-4.0 retroactive applicability check pass against
  `cbs.nl/nl-nl/over-ons/open-data`? If CC-BY-4.0 was rejected, did they cite
  the 2007 Statistisch Bulletin / Yearbook terms instead?
- **Verbatim preservation**: confirm R3's amended R5 still includes the
  digitalheir-forbid sentence and the other untouched sentences byte-identical.
- **No `digitalheir` reference introduced**: Grep `packages/locale-nl/` for
  `digitalheir` after the edit — must remain 0×.

## Out of scope

- **Refetching from CBS Maatwerk** — explicitly rejected (Q-1); months of wait
  for ~0 default-config realism gain under Zipf `s = 0.7`.
- **Scraping cbgfamilienamen.nl** — fails the license bar.
- **Long-tail trim of existing `lastNames` corpus** — B49 Q-6 deferred.
- **Broader header license-bar audit across all locale data files** —
  B49 Q-7 deferred.

## Notes

- **Predecessor**: B49 report. All verbatim wordings are pinned in that report
  (header at §0.2 step a, R5 at §1.4, script NOTE at §1.4 / §2 step 2).
- **Trivial-chore-gate analysis**: 3 files, 3 small text edits, **0 design
  choices** (the report locked them in), **0 behavioural change**. This card
  **could** be inline-folded under the gate, but it's filed as a `chore` with
  `[review]` because:
  - Q-2 verification (CBS retroactive CC-BY-4.0) is a maintainer-facing decision
    the reviewer needs to confirm.
  - The amendment touches a published spec page; a review-gated commit is
    cleaner than an inline mv.

  If the maintainer prefers to fold inline, the gate justifies it.

- **Tests / minimum**: per [[feedback-minimal-tests]] and
  [[feedback-tests-test-behavior]] — **no test file**. R1–R3 are reviewer-eyeball
  comment / spec-text edits with no observable behaviour; R4 is a `pnpm validate`
  green check.
- **Changeset**: none per Q-5. The change is comment-only on the data file +
  comment-only on the script + wiki-spec-only on R5. If release tooling rejects
  publish without a changeset, file as `patch` (`zod4-mock` + `locale-nl`).
- **No GitHub issue** filed.
- **No new standing constraint** — falls under the existing B46/B48 license-bar
  precedent per B49 report §6.
- `flags: [review]` — Q-2 CBS retroactive CC-BY-4.0 needs maintainer sign-off
  via the reviewer checklist.
