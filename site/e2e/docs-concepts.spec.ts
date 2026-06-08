import { type Page, expect, test } from "@playwright/test";

/**
 * B121 — Docs: replace the Concepts option/ctx <table>s with the non-table
 * heading-per-member (definition-list) layout, mobile-first.
 * (card: wiki/backlog/doing/B121-concepts-tables-to-non-table.md)
 *
 * Maintainer directive: the docs site must not use <table> for option/config/
 * parameter data — "no place in a mobile-first docs site". The /docs/concepts
 * page currently renders two hand-written <table>s: an "Options" table under
 * <h3>Options</h3> and a `ctx`-object table under <h2>The ctx object</h2>.
 * Both must become a non-table heading-per-member layout (the proven /docs/api
 * presentation), each entry = name + type/value + a full-width description.
 *
 * One Playwright test per requirement ID (B121-R1 .. B121-R3), named
 * `B121-R<k> / <scenario>`, asserting the observable THEN by role / text /
 * attribute (never pixels — see .claude/practices/browser-testing.md). Runs
 * against the production build served by the Playwright `webServer`
 * (playwright.config.ts: `pnpm build && pnpm preview`), settling at
 * `networkidle` like the B114/B75 suites so the prerendered /docs/concepts HTML
 * and any hydration are present before assertion.
 *
 * STABLE HOOKS the implementer must provide on the new non-table component
 * (e.g. site/src/lib/docs/widgets/DefinitionList.svelte):
 *   - the entry container carries `[data-deflist]`
 *   - each entry's name/term element carries `[data-term]` with the term as
 *     its (trimmed) text, so a definition entry is addressable by its term.
 * The Options section's container is additionally scoped via `[data-deflist]`
 * sitting in the heading region of <h3>Options</h3>; the ctx section's via the
 * heading region of <h2>The ctx object</h2>.
 *
 * RED expectation: both sections are still <table>s and no `[data-deflist]` /
 * `[data-term]` hooks exist. R1/R2 therefore fail on the still-present <table>
 * and the missing non-table entries; R3 fails because the two sections do not
 * yet use the non-table container. That is the correct red — not a selector
 * typo (the assertions key on the same heading text the page renders today).
 */

const CONCEPTS = "/docs/concepts";
const MOBILE = { width: 390, height: 844 } as const;

// Real terms read off the current Concepts page (the source of truth for these
// names is site/src/routes/docs/concepts/+page.svelte).
const OPTION_TERMS = [
  "seed",
  "locale",
  "optionalProbability",
  "defaultArrayLength",
  "generators",
  "recursionLimit",
] as const;

// The ctx-object terms, as the term text the [data-term] element should carry.
const CTX_TERMS = [
  "ctx.gen",
  "ctx.prng",
  "ctx.source",
  "ctx.related",
  "ctx.registry",
  "ctx.fieldPath",
] as const;

async function settle(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await page.waitForLoadState("networkidle");
}

// Attach console.error / pageerror watchers; return a getter for the collected
// messages so each test can assert the page rendered cleanly (browser-testing
// practice: a console error on the path is a finding).
function watchErrors(page: Page): () => string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return () => errors;
}

/**
 * Resolve the section "region": the block of DOM from a heading up to (but not
 * including) the next heading of the same-or-higher level. We approximate it
 * with the nearest ancestor that also contains the heading's following content,
 * by locating the heading and then querying within the DocPage prose body but
 * scoped to elements that sit between this heading and the next sibling heading.
 *
 * Practically: the Options data lives directly after <h3>Options</h3> and the
 * ctx data directly after <h2>The ctx object</h2>. We assert on the table /
 * deflist that is the *first* such element following each heading by walking the
 * DOM in-page and tagging the matched container, then locate it by a temporary
 * data attribute. This keeps the assertion bound to the heading region, not to
 * a global page query that could match the wrong section.
 */
async function sectionContainerKind(
  page: Page,
  headingText: string,
): Promise<{ hasTable: boolean; hasDeflist: boolean; terms: string[] }> {
  return page.evaluate((heading) => {
    const norm = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim();
    const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"));
    const start = headings.find((h) => norm(h.textContent).startsWith(heading));
    if (!start) return { hasTable: false, hasDeflist: false, terms: [] };

    const startLevel = Number(start.tagName.slice(1));
    // Collect the nodes that belong to this section: everything after `start`
    // until the next heading at the same or higher level.
    const section: Element[] = [];
    let node = start.nextElementSibling;
    while (node) {
      if (/^H[1-6]$/.test(node.tagName)) {
        const lvl = Number(node.tagName.slice(1));
        if (lvl <= startLevel) break;
      }
      section.push(node);
      node = node.nextElementSibling;
    }

    const within = (el: Element, sel: string) => el.matches(sel) || el.querySelector(sel) !== null;

    const hasTable = section.some((el) => within(el, "table"));
    const hasDeflist = section.some((el) => within(el, "[data-deflist]"));

    const termEls: Element[] = [];
    for (const el of section) {
      if (el.matches("[data-term]")) termEls.push(el);
      termEls.push(...Array.from(el.querySelectorAll("[data-term]")));
    }
    const terms = termEls.map((el) => norm(el.textContent));
    return { hasTable, hasDeflist, terms };
  }, headingText);
}

// ── B121-R1: the Options section is non-table ───────────────────────────────

test("B121-R1 / Options section renders as a non-table definition list", async ({ page }) => {
  const errors = watchErrors(page);
  await settle(page, CONCEPTS);

  const section = await sectionContainerKind(page, "Options");

  // The Options heading must use the non-table layout: no <table> in its region,
  // and a [data-deflist] container instead.
  expect(section.hasTable, "Options section must contain no <table>").toBe(false);
  expect(section.hasDeflist, "Options section must use the [data-deflist] container").toBe(true);

  // Each known option name still appears as a [data-term] entry.
  for (const term of OPTION_TERMS) {
    expect(section.terms, `Options must list "${term}" as a [data-term] entry`).toContain(term);
  }

  expect(errors(), "no console errors on /docs/concepts").toEqual([]);
});

// ── B121-R2: the ctx-object section is non-table ────────────────────────────

test("B121-R2 / ctx object section renders as a non-table definition list", async ({ page }) => {
  const errors = watchErrors(page);
  await settle(page, CONCEPTS);

  const section = await sectionContainerKind(page, "The ctx object");

  expect(section.hasTable, "ctx section must contain no <table>").toBe(false);
  expect(section.hasDeflist, "ctx section must use the [data-deflist] container").toBe(true);

  // Each ctx property still appears as a [data-term] entry. We match by prefix
  // so `ctx.related` covers a rendered `ctx.related(name)` term text.
  for (const term of CTX_TERMS) {
    const found = section.terms.some((t) => t.startsWith(term));
    expect(found, `ctx section must list a [data-term] entry for "${term}"`).toBe(true);
  }

  expect(errors(), "no console errors on /docs/concepts").toEqual([]);
});

// ── B121-R3: mobile-first — no overflow + the two sections use the non-table
//    container (which fits 390px) ─────────────────────────────────────────────

test("B121-R3 / Concepts is mobile-usable at 390px with the non-table layout", async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(MOBILE);
  await settle(page, CONCEPTS);

  // No page-level horizontal overflow at 390px.
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth, "no horizontal overflow at 390px").toBeLessThanOrEqual(MOBILE.width + 1);

  // The mobile-first guarantee is pinned to the two sections using the non-table
  // [data-deflist] container (which fits the viewport), NOT a <table>.
  const options = await sectionContainerKind(page, "Options");
  const ctx = await sectionContainerKind(page, "The ctx object");
  expect(options.hasTable, "Options section is non-table on mobile").toBe(false);
  expect(options.hasDeflist, "Options section uses [data-deflist] on mobile").toBe(true);
  expect(ctx.hasTable, "ctx section is non-table on mobile").toBe(false);
  expect(ctx.hasDeflist, "ctx section uses [data-deflist] on mobile").toBe(true);

  // The [data-deflist] containers fit within the viewport width (no entry
  // container wider than the screen — the mobile-readability guarantee).
  const widths = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-deflist]")).map(
      (el) => el.getBoundingClientRect().width,
    ),
  );
  expect(widths.length, "at least one [data-deflist] container present").toBeGreaterThan(0);
  for (const w of widths) {
    expect(w, "[data-deflist] container fits within 390px").toBeLessThanOrEqual(MOBILE.width + 1);
  }

  expect(errors(), "no console errors on /docs/concepts at 390px").toEqual([]);
});
