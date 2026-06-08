import { expect, test } from "@playwright/test";

/**
 * B104 — Pagefind docs search ENGINE suite
 * (spec: wiki/specs/B104-docs-pagefind-search-ui.md).
 *
 * These are the engine / build-output scenarios for B104. They run against the
 * production build served by the Playwright `webServer` (playwright.config.ts:
 * `pnpm build && pnpm preview`). This matters: Pagefind indexes the *built*
 * prerendered HTML and writes `/pagefind/` into the served static dir, so any
 * search-hit assertion is only meaningful after a full build — `vite dev` never
 * emits the index. The B75 harness already builds before serving.
 *
 * B128 supersedes B104's button→Modal *UI* with a visible search input mounted in
 * the docs sidebar (see docs-search-input.spec.ts). The B104 *engine* contract is
 * KEPT: the build emits a served `/pagefind/` bundle (B104-R2), a query returns a
 * linked `/docs` hit that navigates (B104-R5), and a concept term surfaces its
 * concept-filter summary (B104-R7, the synonym/concept manifest from concepts.ts).
 * The assertions below are retargeted from the removed modal trigger/overlay onto
 * the new always-visible input — the engine coverage is unchanged.
 *
 * One test per requirement ID, named `B104-R<k> / <scenario>`, asserting the
 * observable THEN by role / text / href (never pixels).
 */

const DOCS_ROUTE = "/docs/concepts";

/** The visible searchbox in the docs chrome (B128 input that replaced the modal). */
function visibleSearchInput(page: import("@playwright/test").Page) {
  return page
    .locator("[data-docs-search]")
    .getByRole("searchbox", { name: /search/i })
    .first();
}

/** The styled results region beneath the input. */
function resultsRegion(page: import("@playwright/test").Page) {
  return page.locator("[data-docs-search-results]").first();
}

// ── B104-R2 / B104-R3: the build emits a served Pagefind index ────────────────

test("B104-R2 / the built site serves a /pagefind/ index bundle", async ({ page }) => {
  // The Pagefind step writes `/pagefind/pagefind.js` (its JS entry) into the served
  // static dir. A 200 on that asset is the lightest robust signal that the index
  // step ran during `pnpm build` and produced a served index covering the docs HTML.
  const response = await page.request.get("/pagefind/pagefind.js");
  expect(
    response.status(),
    "GET /pagefind/pagefind.js must be 200 — the build did not emit a served Pagefind index",
  ).toBe(200);
});

// ── B104-R5: typing queries the index and returns a linked docs hit ───────────

test("B104-R5 / typing a docs term returns a result linking to a /docs route", async ({ page }) => {
  await page.goto(DOCS_ROUTE);
  await page.waitForLoadState("networkidle");

  // B128: type straight into the always-visible input (no modal to open first).
  const input = visibleSearchInput(page);
  await input.fill("determinism");

  // At least one result hit references the term and links to a /docs/... route.
  // Pagefind queries resolve asynchronously, so the locator auto-waits for the
  // results region to render results.
  const results = resultsRegion(page);
  const resultLink = results.locator('a[href^="/docs/"]', { hasText: /determinism/i }).first();
  await expect(
    resultLink,
    "search for `determinism` returned no result linking to a /docs route",
  ).toBeVisible();

  // Activating the result navigates to a /docs route.
  await resultLink.click();
  await expect(page).toHaveURL(/\/docs\//);
});

// ── B104-R4 (a11y): the input is keyboard-focusable; Escape closes results ────

test("B104-R4 / the search input is focusable and Escape closes the results", async ({ page }) => {
  await page.goto(DOCS_ROUTE);
  await page.waitForLoadState("networkidle");

  // B128: the searchbox is always visible (no trigger to open an overlay). A
  // keyboard user focuses it directly and types; results open.
  const input = visibleSearchInput(page);
  await input.focus();
  await expect(input, "the visible search input is not focusable").toBeFocused();
  await page.keyboard.type("determinism");

  const results = resultsRegion(page);
  await expect(results, "results did not open after typing into the input").toBeVisible();

  // Escape dismisses the results region; the input stays present + usable.
  await page.keyboard.press("Escape");
  await expect(results, "pressing Escape did not close the search results").toBeHidden();
  await expect(input, "the search input disappeared after Escape").toBeVisible();
});

// ── B104-R4 (theming): the Paper/light results region is a light surface ──────

test("B104-R4 / in Paper (light) mode the open results region has a light background", async ({
  page,
}) => {
  await page.goto(DOCS_ROUTE);
  await page.waitForLoadState("networkidle");

  // Switch to the Paper (light) palette the way the app does — data-palette on <html>.
  await page.evaluate(() => document.documentElement.setAttribute("data-palette", "paper"));

  const input = visibleSearchInput(page);
  await input.fill("determinism");

  const results = resultsRegion(page);
  await expect(results).toBeVisible();

  // B128: the styled results region fills with a Paper-light token surface
  // (var(--bg-rail) in the site layer). Read its computed background and assert it
  // is light (high perceived luminance) — guarding the dark-on-dark AA regression
  // that the removed modal panel suffered.
  const bg = await results.evaluate((el) => getComputedStyle(el).backgroundColor);
  const nums = bg.match(/[\d.]+/g)?.map(Number) ?? [];
  const [r, g, b] = nums;
  expect(
    r !== undefined && g !== undefined && b !== undefined,
    `could not parse the results background-color: ${bg}`,
  ).toBe(true);
  // Perceived luminance > 128 ⇒ a light surface in the Paper palette.
  const luminance = 0.299 * (r ?? 0) + 0.587 * (g ?? 0) + 0.114 * (b ?? 0);
  expect(
    luminance,
    `the Paper results region background ${bg} is not a light surface (luminance ${luminance})`,
  ).toBeGreaterThan(128);
});

// ── B104-R7: concept-filter summary surfaced from a <DefRef> term ─────────────

test("B104-R7 / searching a concept term surfaces a concept summary with a page count", async ({
  page,
}) => {
  await page.goto(DOCS_ROUTE);
  await page.waitForLoadState("networkidle");

  const input = visibleSearchInput(page);
  await input.fill("determinism");

  // A concept affordance distinct from the plain prose list: a "Concepts:" summary
  // referencing the term together with a page count (e.g. "determinism (3 pages)").
  const conceptSummary = page
    .getByText(/concepts?/i)
    .filter({ hasText: /determinism/i })
    .or(page.getByText(/determinism/i).filter({ hasText: /\(\d+\s*pages?\)/i }));

  await expect(
    conceptSummary.first(),
    "no concept-filter summary (text /concepts?/i + determinism + page count) appeared",
  ).toBeVisible();
});
