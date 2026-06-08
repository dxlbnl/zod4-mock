/**
 * B109 — the site's custom dual Shiki theme, replacing GitHub's themes so docs code
 * highlighting matches the maintainer's reference look. Build-time only (D13-exempt:
 * imported solely by the build-time highlight scripts + svelte.config.js).
 *
 * Authored as plain `.js` (JSDoc-typed, no `any`) because `svelte.config.js` is loaded
 * directly by Node (no tsx/esbuild), so it cannot import a `.ts` module; the three `.ts`
 * build scripts import this same `./shiki-theme.js` (tsx resolves it fine).
 *
 * The hexes below MIRROR the `@dxlbnl/ui` phosphor (dark) / paper (light) palette tokens
 * this site already loads (see `app.css`'s `@layer dxlbnl`): so if a token value changes
 * upstream, re-sync the matching hex here. Restrained + amber-accented; NO italic; no
 * scope colors beyond this list (that's the look the maintainer likes). Anything not
 * listed falls through to `fg`.
 *
 * Token → palette mapping (phosphor / paper):
 *  - bg          --bg-sunken   #070908 / #dfdbce
 *  - fg          --ink         #d6e2dc / #14110b
 *  - comments    --ink-faint   #7a8580 / #5f5a4a
 *  - keywords    --amber       #ffb347 / #a04e00
 *  - constants   --amber       #ffb347 / #a04e00
 *  - functions   --cyan        #7cc7d1 / #030304
 *  - strings                   #7ec8a0 / #2d7a50
 *  - parameters  --ink-dim     #a4b0a9 / #3f3b30
 *  - punctuation --ink-dim     #a4b0a9 / #3f3b30
 */

/**
 * @typedef {object} Palette
 * @property {string} bg
 * @property {string} fg
 * @property {string} comment
 * @property {string} keyword
 * @property {string} constant
 * @property {string} func
 * @property {string} string
 * @property {string} parameter
 * @property {string} punctuation
 */

/** @type {Palette} */
const PHOSPHOR = {
  bg: "#070908", // --bg-sunken
  fg: "#d6e2dc", // --ink
  comment: "#7a8580", // --ink-faint
  keyword: "#ffb347", // --amber
  constant: "#ffb347", // --amber
  func: "#7cc7d1", // --cyan
  string: "#7ec8a0",
  parameter: "#a4b0a9", // --ink-dim
  punctuation: "#a4b0a9", // --ink-dim
};

/** @type {Palette} */
const PAPER = {
  bg: "#dfdbce", // --bg-sunken
  fg: "#14110b", // --ink
  comment: "#5f5a4a", // --ink-faint
  keyword: "#a04e00", // --amber
  constant: "#a04e00", // --amber
  func: "#030304", // --cyan
  string: "#2d7a50",
  parameter: "#3f3b30", // --ink-dim
  punctuation: "#3f3b30", // --ink-dim
};

/**
 * @param {string} name
 * @param {"dark" | "light"} type
 * @param {Palette} p
 * @returns {import("shiki").ThemeRegistrationRaw}
 */
function buildTheme(name, type, p) {
  return {
    name,
    type,
    fg: p.fg,
    bg: p.bg,
    settings: [
      {
        scope: ["comment", "punctuation.definition.comment"],
        settings: { foreground: p.comment },
      },
      {
        scope: ["keyword", "storage", "storage.type", "storage.modifier", "keyword.control"],
        settings: { foreground: p.keyword },
      },
      {
        scope: ["constant", "constant.numeric", "constant.language", "variable.other.constant"],
        settings: { foreground: p.constant },
      },
      {
        scope: [
          "entity.name.function",
          "support.function",
          "meta.function-call entity",
          "markup.underline.link",
        ],
        settings: { foreground: p.func },
      },
      {
        scope: ["string", "string.quoted", "string.template", "string.interpolated"],
        settings: { foreground: p.string },
      },
      {
        scope: ["variable.parameter"],
        settings: { foreground: p.parameter },
      },
      {
        scope: ["punctuation", "meta.brace", "keyword.operator"],
        settings: { foreground: p.punctuation },
      },
    ],
  };
}

/** @type {import("shiki").ThemeRegistrationRaw} */
export const siteDark = buildTheme("site-phosphor", "dark", PHOSPHOR);
/** @type {import("shiki").ThemeRegistrationRaw} */
export const siteLight = buildTheme("site-paper", "light", PAPER);
