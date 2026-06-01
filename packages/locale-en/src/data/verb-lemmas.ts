/**
 * Base-form (infinitive) verb lemmas for English locale generation.
 *
 * Source: top-common-English-verbs list distilled from public-domain
 * corpora summaries (Oxford 3000 + COCA top-frequency verbs). Frequency-
 * sorted, most-common first; entries are bare infinitives in lowercase.
 *
 * Consumers (e.g. `sentence()` in the main library) pick an entry and
 * apply `inflect.en.conjugate(lemma, form)` to derive 3ps / past / gerund /
 * participle forms at generation time.
 *
 * Entries: 60.
 */

export const verbLemmas: readonly string[] = [
  "make",
  "run",
  "walk",
  "take",
  "give",
  "go",
  "come",
  "see",
  "find",
  "think",
  "know",
  "want",
  "look",
  "use",
  "work",
  "call",
  "try",
  "ask",
  "need",
  "feel",
  "become",
  "leave",
  "put",
  "mean",
  "keep",
  "let",
  "begin",
  "seem",
  "help",
  "talk",
  "turn",
  "start",
  "show",
  "hear",
  "play",
  "move",
  "live",
  "believe",
  "bring",
  "happen",
  "write",
  "sit",
  "stand",
  "lose",
  "pay",
  "meet",
  "include",
  "continue",
  "set",
  "learn",
  "change",
  "lead",
  "watch",
  "follow",
  "stop",
  "create",
  "speak",
  "read",
  "allow",
  "add",
];
