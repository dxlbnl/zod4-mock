import { expect, test } from "@playwright/test";

/**
 * B104 — Pagefind docs search UI suite
 * (spec: wiki/specs/B104-docs-pagefind-search-ui.md).
 *
 * These are the UI / build-output scenarios for B104. They run against the
 * production build served by the Playwright `webServer` (playwright.config.ts:
 * `pnpm build && pnpm preview`). This matters: Pagefind indexes the *built*
 * prerendered HTML and writes `/pagefind/` into the served static dir, so any
 * search-hit assertion is only meaningful after a full build — `vite dev` never
 * emits the index. The B75 harness already builds before serving.
 *
 * One test per requirement ID, named `B104-R<k> / <scenario>`, asserting the
 * observable THEN by role / text / href (never pixels).
 *
 * Observable→requirement mapping (read together with the test-writer report):
 *   - B104-R2/R3 (index emitted, covers prose) ride the index-reachability check
 *     below PLUS the real search-hit result in B104-R5: a search returning a
 *     prose/concept hit IS evidence the build emitted an index that covers the
 *     prose. The standalone check here only asserts `/pagefind/pagefind.js` is
 *     served (the lightest robust index-presence signal) — it does not re-read the
 *     built index dir off disk.
 *
 * RED expectation: `pagefind` is not installed, no Pagefind index step runs in the
 * build, `/docs` is not prerendered, `<DocsSearch>` does not exist, and
 * `site/src/lib/docs/concepts.ts` does not exist. Therefore:
 *   - the `/pagefind/pagefind.js` request 404s (R2/R3 red: index absent),
 *   - no search trigger is in the nav region (R4 red: widget absent),
 *   - no overlay / result / concept affordance appears (R5/R7 red: widget+index absent).
 * Each assertion fails as a clean assertion miss, not a harness crash.
 */

const DOCS_ROUTE = "/docs/concepts";

// ── B104-R4: search trigger present in the nav region on every route ──────────

test("B104-R4 / a search trigger with an accessible name is present in the header on docs + home", async ({
  page,
}) => {
  for (const route of ["/", DOCS_ROUTE]) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");

    // The <DocsSearch> trigger: a button (or searchbox input) with an accessible
    // name matching /search/i, mounted adjacent to <Nav> in the root layout.
    const trigger = page
      .getByRole("button", { name: /search/i })
      .or(page.getByRole("searchbox", { name: /search/i }));

    await expect(
      trigger.first(),
      `no search trigger (accessible name /search/i) found on ${route}`,
    ).toBeVisible();
  }
});

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

// ── B104-R5: search overlay queries the index and returns a linked docs hit ───

test("B104-R5 / typing a docs term returns a result linking to a /docs route", async ({ page }) => {
  await page.goto(DOCS_ROUTE);
  await page.waitForLoadState("networkidle");

  const trigger = page
    .getByRole("button", { name: /search/i })
    .or(page.getByRole("searchbox", { name: /search/i }));
  await trigger.first().click();

  // Type a term that appears in the docs prose (the Concepts page discusses
  // determinism inside its data-pagefind-body container).
  const input = page.getByRole("searchbox").or(page.getByRole("textbox")).first();
  await input.fill("determinism");

  // At least one result hit references the term and links to a /docs/... route.
  // Pagefind queries resolve asynchronously, so the locator auto-waits for the
  // overlay to render results.
  const resultLink = page.locator('a[href^="/docs/"]', { hasText: /determinism/i }).first();
  await expect(
    resultLink,
    "search for `determinism` returned no result linking to a /docs route",
  ).toBeVisible();

  // Activating the result navigates to a /docs route.
  await resultLink.click();
  await expect(page).toHaveURL(/\/docs\//);
});

// ── B104-R4 (a11y): focus enters the searchbox on open; Escape closes ─────────

test("B104-R4 / opening the overlay focuses the search input and Escape closes it", async ({
  page,
}) => {
  await page.goto(DOCS_ROUTE);
  await page.waitForLoadState("networkidle");

  const trigger = page
    .getByRole("button", { name: /search/i })
    .or(page.getByRole("searchbox", { name: /search/i }));
  await trigger.first().click();

  // The keyboard user must land in the searchbox when the overlay opens.
  const searchInput = page.getByRole("searchbox", { name: /search/i }).first();
  await expect(
    searchInput,
    "the search input is not focused after opening the overlay",
  ).toBeFocused();

  // Escape dismisses the overlay (the searchbox is no longer visible).
  await page.keyboard.press("Escape");
  await expect(searchInput, "pressing Escape did not close the search overlay").toBeHidden();
});

// ── B104-R4 (theming): the Paper/light overlay panel is a light surface ───────

test("B104-R4 / in Paper (light) mode the open overlay panel has a light background", async ({
  page,
}) => {
  await page.goto(DOCS_ROUTE);
  await page.waitForLoadState("networkidle");

  // Switch to the Paper (light) palette the way the app does — data-palette on <html>.
  await page.evaluate(() => document.documentElement.setAttribute("data-palette", "paper"));

  const trigger = page
    .getByRole("button", { name: /search/i })
    .or(page.getByRole("searchbox", { name: /search/i }));
  await trigger.first().click();

  const searchInput = page.getByRole("searchbox", { name: /search/i }).first();
  await expect(searchInput).toBeVisible();

  // The @dxlbnl/ui Modal panel (`.modal-inner`) fills with var(--overlay); the
  // site-side Paper override makes that a light translucent surface. Read the panel's
  // computed background and assert it is light (high perceived luminance) — guarding
  // the override so the dark-on-dark AA regression cannot return.
  const panel = page.locator(".modal-inner").first();
  const bg = await panel.evaluate((el) => getComputedStyle(el).backgroundColor);
  const nums = bg.match(/[\d.]+/g)?.map(Number) ?? [];
  const [r, g, b] = nums;
  expect(
    r !== undefined && g !== undefined && b !== undefined,
    `could not parse the panel background-color: ${bg}`,
  ).toBe(true);
  // Perceived luminance > 128 ⇒ a light surface (Paper override ≈ rgb(245,242,234)).
  const luminance = 0.299 * (r ?? 0) + 0.587 * (g ?? 0) + 0.114 * (b ?? 0);
  expect(
    luminance,
    `the Paper overlay panel background ${bg} is not a light surface (luminance ${luminance})`,
  ).toBeGreaterThan(128);
});

// ── B104-R7: concept-filter summary surfaced from a <DefRef> term ─────────────

test("B104-R7 / searching a concept term surfaces a concept summary with a page count", async ({
  page,
}) => {
  await page.goto(DOCS_ROUTE);
  await page.waitForLoadState("networkidle");

  const trigger = page
    .getByRole("button", { name: /search/i })
    .or(page.getByRole("searchbox", { name: /search/i }));
  await trigger.first().click();

  const input = page.getByRole("searchbox").or(page.getByRole("textbox")).first();
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
