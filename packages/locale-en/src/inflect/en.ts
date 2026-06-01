/**
 * @module @zod4-mock/locale-en/inflect/en
 *
 * English inflection rules — pluralisation, conjugation, adverb derivation.
 *
 * All transforms are pure JS string manipulation (D13 isomorphism — no
 * `node:*`, no `Buffer`, no `Intl.PluralRules`). The functions consume zero
 * PRNG state (D4 / D10) and depend on no host-locale data.
 *
 * Provenance:
 *   - Rule set distilled from Quirk et al. *A Comprehensive Grammar of the
 *     English Language* (sibilant `+es`, `-y → -ies`, `-fe/-f → -ves`) and
 *     Murphy's *English Grammar in Use* (verb 3ps / gerund / past, adverb
 *     `-ly` / `-ily` / `-ically`).
 *   - Irregular tables seeded from the Wiktionary "English irregular verbs"
 *     compilation (CC-BY-SA) plus common irregular plurals from Quirk et al.
 *
 * Only the irregular entries observed by the B58-A scenarios ship in the
 * initial landing; the tables are expanded incrementally in follow-up cards.
 */

/** Word ends in a vowel ∈ {a, e, i, o, u}. */
function endsInVowel(s: string): boolean {
  const last = s.charAt(s.length - 1);
  return last === "a" || last === "e" || last === "i" || last === "o" || last === "u";
}

// ---------------------------------------------------------------------------
// Pluralisation (R1)
// ---------------------------------------------------------------------------

const IRREGULAR_PLURAL: Readonly<Record<string, string>> = {
  child: "children",
  foot: "feet",
  mouse: "mice",
  man: "men",
  woman: "women",
  tooth: "teeth",
  goose: "geese",
  person: "people",
  ox: "oxen",
};

const UNCHANGED_PLURAL: ReadonlySet<string> = new Set([
  "sheep",
  "deer",
  "fish",
  "aircraft",
  "series",
  "species",
]);

/**
 * Pluralise an English noun. Returns the input unchanged for irregular
 * unchanged-plural nouns (`sheep`, `deer`, …).
 *
 * @example
 *   pluralize("cat");   // "cats"
 *   pluralize("city");  // "cities"
 *   pluralize("box");   // "boxes"
 *   pluralize("child"); // "children"
 *   pluralize("sheep"); // "sheep"
 */
export function pluralize(noun: string): string {
  if (UNCHANGED_PLURAL.has(noun)) return noun;
  const irreg = IRREGULAR_PLURAL[noun];
  if (irreg !== undefined) return irreg;
  // `-y` after consonant → `-ies` (`city → cities`); after vowel → `+s` (`day → days`).
  if (noun.endsWith("y") && noun.length >= 2 && !endsInVowel(noun.slice(0, -1))) {
    return `${noun.slice(0, -1)}ies`;
  }
  // `-fe` → `-ves` (`knife → knives`).
  if (noun.endsWith("fe")) return `${noun.slice(0, -2)}ves`;
  // `-f` → `-ves` (`leaf → leaves`).
  if (noun.endsWith("f")) return `${noun.slice(0, -1)}ves`;
  // Sibilants: `-s`, `-x`, `-z`, `-ch`, `-sh` → `+es` (`box → boxes`).
  if (
    noun.endsWith("s") ||
    noun.endsWith("x") ||
    noun.endsWith("z") ||
    noun.endsWith("ch") ||
    noun.endsWith("sh")
  ) {
    return `${noun}es`;
  }
  // `-o` after consonant → `-oes` (`potato → potatoes`); after vowel → `+s` (`radio → radios`).
  if (noun.endsWith("o") && noun.length >= 2 && !endsInVowel(noun.slice(0, -1))) {
    return `${noun}es`;
  }
  return `${noun}s`;
}

// ---------------------------------------------------------------------------
// Conjugation (R2)
// ---------------------------------------------------------------------------

export type ConjugationForm = "3ps" | "past" | "gerund" | "participle";

/** Irregular verb forms: `[3ps, past, gerund, participle]`. */
const IRREGULAR_VERB: Readonly<Record<string, readonly [string, string, string, string]>> = {
  // Irregularity is concentrated in the past / participle columns.
  go: ["goes", "went", "going", "gone"],
  do: ["does", "did", "doing", "done"],
  have: ["has", "had", "having", "had"],
  be: ["is", "was", "being", "been"],
  say: ["says", "said", "saying", "said"],
  make: ["makes", "made", "making", "made"],
  take: ["takes", "took", "taking", "taken"],
  see: ["sees", "saw", "seeing", "seen"],
  come: ["comes", "came", "coming", "come"],
  give: ["gives", "gave", "giving", "given"],
  find: ["finds", "found", "finding", "found"],
  think: ["thinks", "thought", "thinking", "thought"],
  write: ["writes", "wrote", "writing", "written"],
  run: ["runs", "ran", "running", "run"],
  get: ["gets", "got", "getting", "gotten"],
  know: ["knows", "knew", "knowing", "known"],
  begin: ["begins", "began", "beginning", "begun"],
  bring: ["brings", "brought", "bringing", "brought"],
  buy: ["buys", "bought", "buying", "bought"],
  hold: ["holds", "held", "holding", "held"],
  leave: ["leaves", "left", "leaving", "left"],
  put: ["puts", "put", "putting", "put"],
  mean: ["means", "meant", "meaning", "meant"],
  keep: ["keeps", "kept", "keeping", "kept"],
  let: ["lets", "let", "letting", "let"],
  hear: ["hears", "heard", "hearing", "heard"],
  lose: ["loses", "lost", "losing", "lost"],
  pay: ["pays", "paid", "paying", "paid"],
  meet: ["meets", "met", "meeting", "met"],
  set: ["sets", "set", "setting", "set"],
  lead: ["leads", "led", "leading", "led"],
  read: ["reads", "read", "reading", "read"],
  sit: ["sits", "sat", "sitting", "sat"],
  stand: ["stands", "stood", "standing", "stood"],
  speak: ["speaks", "spoke", "speaking", "spoken"],
};

/** Regular 3ps form: `+s`; sibilant `+es`; `-y` after consonant `-ies`. */
function regular3ps(verb: string): string {
  if (verb.endsWith("y") && verb.length >= 2 && !endsInVowel(verb.slice(0, -1))) {
    return `${verb.slice(0, -1)}ies`;
  }
  if (
    verb.endsWith("s") ||
    verb.endsWith("x") ||
    verb.endsWith("z") ||
    verb.endsWith("ch") ||
    verb.endsWith("sh") ||
    verb.endsWith("o")
  ) {
    return `${verb}es`;
  }
  return `${verb}s`;
}

/** Regular gerund: drop silent `e`, `-ie → -ying`, else `+ing`. */
function regularGerund(verb: string): string {
  if (verb.endsWith("ie")) return `${verb.slice(0, -2)}ying`;
  if (verb.endsWith("e") && verb.length >= 2) return `${verb.slice(0, -1)}ing`;
  return `${verb}ing`;
}

/** Regular past / participle: `-y → -ied`, `-e → -d`, else `+ed`. */
function regularPast(verb: string): string {
  if (verb.endsWith("y") && verb.length >= 2 && !endsInVowel(verb.slice(0, -1))) {
    return `${verb.slice(0, -1)}ied`;
  }
  if (verb.endsWith("e")) return `${verb}d`;
  return `${verb}ed`;
}

/**
 * Conjugate an English verb to the requested form. Irregular entries from
 * the internal irregular table short-circuit the rule path.
 *
 * @example
 *   conjugate("walk", "3ps");        // "walks"
 *   conjugate("go", "3ps");          // "goes"
 *   conjugate("go", "past");         // "went"
 *   conjugate("make", "gerund");     // "making"
 *   conjugate("write", "participle");// "written"
 */
export function conjugate(verb: string, form: ConjugationForm): string {
  const irreg = IRREGULAR_VERB[verb];
  if (irreg !== undefined) {
    if (form === "3ps") return irreg[0];
    if (form === "past") return irreg[1];
    if (form === "gerund") return irreg[2];
    return irreg[3];
  }
  if (form === "3ps") return regular3ps(verb);
  if (form === "gerund") return regularGerund(verb);
  // "past" and "participle" share the regular `+ed` form.
  return regularPast(verb);
}

// ---------------------------------------------------------------------------
// Adverb derivation (R3)
// ---------------------------------------------------------------------------

const IRREGULAR_ADVERB: Readonly<Record<string, string>> = {
  good: "well",
  fast: "fast",
  hard: "hard",
  late: "late",
  early: "early",
  daily: "daily",
};

/**
 * Derive an English adverb from an adjective. Returns the irregular entry
 * if present; otherwise applies the closed-form `-ly` rules
 * (`-ic → -ically`, `-le → -ly` with silent-`e` drop, `-y → -ily` after
 * consonant, otherwise `+ly`).
 *
 * @example
 *   adverbFromAdjective("easy");     // "easily"
 *   adverbFromAdjective("simple");   // "simply"
 *   adverbFromAdjective("dramatic"); // "dramatically"
 *   adverbFromAdjective("good");     // "well"
 *   adverbFromAdjective("quick");    // "quickly"
 */
export function adverbFromAdjective(adj: string): string {
  const irreg = IRREGULAR_ADVERB[adj];
  if (irreg !== undefined) return irreg;
  // `-ic → -ically` (`dramatic → dramatically`).
  if (adj.endsWith("ic")) return `${adj}ally`;
  // `-le → -ly` (drop the `e`, append `y`: `simple → simply`).
  if (adj.endsWith("le") && adj.length >= 2) return `${adj.slice(0, -1)}y`;
  // `-y` after consonant → `-ily` (`easy → easily`).
  if (adj.endsWith("y") && adj.length >= 2 && !endsInVowel(adj.slice(0, -1))) {
    return `${adj.slice(0, -1)}ily`;
  }
  return `${adj}ly`;
}
