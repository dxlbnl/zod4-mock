/**
 * Shared rule-based name origin classifier.
 * Imported by both fetch-data.ts (inline classification) and classify.ts (CLI tool).
 */

// Each entry is [pattern, origin]. Applied against the lowercase name.
const ORIGIN_RULES: Array<[RegExp, string]> = [
  // Arabic — common prefixes/roots as transliterated in Dutch/Belgian registries
  [/^(mohammed|muhammad|moham|mouhammed|mehdi|mustafa|omar|oussama|youssef|yousuf|younes|yassin|yasmine|walid|wassim|souad|said|rachid|radia|moussa|naima|nadia|nour|nassim|najib|miloud|laila|khalid|karim|jawad|jaouad|ismail|hamza|hamid|hakim|hicham|fatima|farid|fadoua|driss|dounia|chaima|bouchra|bilal|aziz|azzedine|ayoub|aymen|amine|ahmed|adil|abderrahim|abdelkrim|abdelhamid|abdelhak|abdelilah|abdelkarim|abdellah|abdellatif|abdelmajid|abdelouahab|abderrahmane|abdessamad|abdessalam|abdoul|abdulaziz|abdulkarim|abdulmalik|abdulmomen|abdulrahman|abubakr|achraf|adnane|aicha|aissa|akram|aladdin|alae|alaeddine|amal|anass|aniss|anwar|aya|aycha|ayesha)/i, "arabic"],
  [/^abdel/i, "arabic"],
  [/(eddine|ouni|oubi|ouri|razi|ddin|dden|oune|aine|aine)$/i, "arabic"],

  // Turkish — common Turkish first name patterns
  [/^(mehmet|memed|murad|murat|tugrul|tugce|tarkan|selin|seda|serkan|serhat|serap|sedef|oguz|nihal|nilufar|nihan|nesrin|nese|melike|melisa|leyla|kubra|koray|kerem|kaya|kadir|gizem|furkan|fikret|ferhat|fatih|esra|erdal|engin|emre|elif|ece|ebru|burak|burcu|berk|banu|bahar|bahadir|aysun|ayse|aylin|ayhan|aydin|aynur|ayfer|arzu|arda|alpay|alper|adem|fatma|feyza|zeynep|hatice|gonca|ceren|duygu|filiz|ozlem|pinar|yeliz|buse|rumeysa|sumeyye|sude|okan|serdar|hakan|orhan|kenan|gokhan|volkan|tayfun|bulent)/i, "turkish"],
  // "Melis" alone is Turkish but "Melissa" is not — match the exact form
  [/^melis$/i, "turkish"],
  [/(oglu|demir|yilmaz|celik|sahin|arslan|tekin|polat|dogan|korkmaz|erdogan|kizil|yildiz|kaplan|ozturk)$/i, "turkish"],

  // Frisian — regionally distinct Frisian first names
  [/^(wierd|wietse|wietske|wybe|yde|ynze|ype|ytsje|ytzen|yttje|zeeger|douwe|durk|eelke|eize|elbrich|epke|fedde|feitze|femke|fenna|fjoerd|fokke|frouke|froukje|geale|geeske|gerben|gosse|gurbe|haye|hedzer|hinke|hiske|hoite|houke|hyke|idske|ike|imke|itske|jabik|janneke|jantsje|jelke|jelmer|jentje|jildert|jildou|jilt|jitske|joast|jorrit|jouke|klaas|klaaske|libbe|lieuwe|maaike|maike|menno|mink|minke|nynke|obe|oebele|oeds|oene|oepke|okke|omke|opke|pier|rein|rienk|rixt|rixtje|ruurd|sies|sijtske|sikke|sjoerd|sjuerd|sjouke|souke|stien|stynke|syb|sybren|sybe|sybolt|tjaard|tjalf|tjalt|tjaltsje|tjibbe|tjitske|tjerk|tjerke|tjitse|ulbe|waling|wiebe)/i, "frisian"],

  // South Asian — names common in Surinamese-Dutch context
  [/(singh|kumar|persad|koemar|baldew|ramdhani|sewdien|ramdhan|narain|mahabier|ramjattan|ramsahai|ramtahal|ramkhelawan|ramnath|ramphal|ramroep|ramdin|sital|lalji|balrak|balram|bisesar|bisnauth|boedhai|dhanpat|dhanraj|soekhai|soekhan|soeltan|soekhoe|soerdjan|sukul)$/i, "south-asian"],
];

/** Returns the cultural origin of a name, or null if it's ambiguous / likely Dutch. */
export function classifyByRule(name: string): string | null {
  const lower = name.toLowerCase();
  for (const [pattern, origin] of ORIGIN_RULES) {
    if (pattern.test(lower)) return origin;
  }
  return null;
}
