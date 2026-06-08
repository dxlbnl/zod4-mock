import { expect, test } from "@playwright/test";

/**
 * B128 — docs search: visible, working, styled input (supersedes B104's modal UI).
 * (spec: wiki/specs/B128-docs-search-visible-input.md)
 *
 * These run against the production build served by the Playwright `webServer`
 * (playwright.config.ts: `pnpm build && pnpm preview`). This matters: Pagefind
 * indexes the *built* prerendered `/docs` HTML and writes `/pagefind/` into the
 * served static dir, so any search-hit assertion is only meaningful after a full
 * build — `vite dev` never emits the index. The B104 engine (index build + concept
 * synonyms) is KEPT unchanged; B128 supersedes only the query UI.
 *
 * One test per requirement ID, named `B128-R<k> / <scenario>`, asserting the
 * observable THEN by role / text / href (never pixels).
 *
 * Stable hooks the implementer is expected to provide on the NEW visible-input UI:
 *   - input:        a `role="searchbox"` (or `type="search"`) input with an
 *                   accessible name matching /search/i, VISIBLE on load inside a
 *                   `[data-docs-search]` container in the docs chrome — NOT inside a
 *                   `[role="dialog"]`/Modal that must be opened first.
 *   - results list: a `[data-docs-search-results]` region beneath the input.
 *   - result link:  each hit is an `a[href^="/docs/"]` inside that results region.
 *
 * Real docs terms used (must exist in the built /docs prose & concept index):
 *   - `determinism` — appears in /docs/concepts prose and as <DefRef term="determinism">.
 *   - `matcher`     — concept term; `field resolver` is its configured synonym (concepts.ts).
 *
 * RED expectation: today the search is a `@dxlbnl/ui` Button ("Search") that opens a
 * `@dxlbnl/ui` Modal, mounted in the ROOT layout's `.header-tools` — there is no
 * always-visible searchbox in the docs chrome and no `[data-docs-search-results]`
 * region without first clicking the button. Therefore every test below fails as a
 * clean assertion miss (no visible input / no results region), not a harness crash.
 */

const DOCS_ROUTE = "/docs/concepts";

/** A visible searchbox in the docs chrome — bound to the stable hook + role. */
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

// ── B128-R1: a visible, non-modal search input is present on load ─────────────

test("B128-R1 / a visible searchbox is present in the docs chrome without opening a modal", async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (err) => pageErrors.push(err));

  await page.goto(DOCS_ROUTE);
  await page.waitForLoadState("networkidle");

  // The input is visible on load — no prior click, not gated behind a "Search" button.
  const input = visibleSearchInput(page);
  await expect(
    input,
    "no visible searchbox ([data-docs-search] role=searchbox /search/i) on /docs/concepts — search is still a button→modal",
  ).toBeVisible();

  // It is NOT inside a modal/dialog: the input must not require opening a [role=dialog].
  const dialogInput = page.getByRole("dialog").getByRole("searchbox", { name: /search/i });
  await expect(
    dialogInput,
    "the search input is rendered inside a [role=dialog]/Modal — B128 requires an always-visible input, not a modal",
  ).toHaveCount(0);

  expect(
    pageErrors,
    `pageerror(s) on /docs load: ${pageErrors.map((e) => e.message).join("; ")}`,
  ).toEqual([]);
});

// ── B128-R2 / B128-R5: typing returns navigable linked results (the regression) ─

test("B128-R2 / B128-R5 / typing a real docs term renders linked results that navigate", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: Error[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err));

  await page.goto(DOCS_ROUTE);
  await page.waitForLoadState("networkidle");

  const input = visibleSearchInput(page);
  await input.fill("determinism");

  // A styled results region appears beneath the input with at least one /docs link.
  const results = resultsRegion(page);
  await expect(
    results,
    "no [data-docs-search-results] region appeared after typing — results do not render under the visible input",
  ).toBeVisible();

  const resultLink = results.locator('a[href^="/docs/"]').first();
  await expect(
    resultLink,
    "search for `determinism` returned no result linking to a /docs route in the results region",
  ).toBeVisible();

  // The load-bearing regression: activating the result navigates to a /docs route.
  await resultLink.click();
  await expect(page).toHaveURL(/\/docs\//);

  expect(
    pageErrors,
    `pageerror(s) during search: ${pageErrors.map((e) => e.message).join("; ")}`,
  ).toEqual([]);
});

// ── B128-R3: concept-filter summary preserved (B104-R7 intent on the new input) ─

test("B128-R3 / searching a concept term surfaces a concept summary with a page count", async ({
  page,
}) => {
  await page.goto(DOCS_ROUTE);
  await page.waitForLoadState("networkidle");

  const input = visibleSearchInput(page);
  await input.fill("determinism");

  // A concept affordance distinct from the plain prose list: a "Concepts" summary
  // referencing the term together with a page count (e.g. "determinism (3 pages)").
  // Mirrors B104-R7's assertion shape, retargeted at the visible-input UI.
  const conceptSummary = page
    .getByText(/concepts?/i)
    .filter({ hasText: /determinism/i })
    .or(page.getByText(/determinism/i).filter({ hasText: /\(\d+\s*pages?\)/i }));

  await expect(
    conceptSummary.first(),
    "no concept-filter summary (text /concepts?/i + determinism + page count) appeared in the new search UI",
  ).toBeVisible();
});

// ── B128-R2 (regression) / clicking a hit scrolls to the matched sub-heading ──

test("B128-R2 / clicking a search hit scrolls to the matched heading (sub_result anchor)", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: Error[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err));

  await page.goto(DOCS_ROUTE);
  await page.waitForLoadState("networkidle");

  // `determinism` matches the `## Determinism` section on /docs/concepts. With the
  // prerendered headings now carrying build-time ids, Pagefind's top sub_result
  // anchors that section, so the hit href gains a `#determinism` fragment.
  const input = visibleSearchInput(page);
  await input.fill("determinism");

  const results = resultsRegion(page);
  await expect(results).toBeVisible();

  // The top hit linking to /docs/concepts must carry an anchored fragment.
  const hit = results.locator('a[href*="/docs/concepts#"]').first();
  await expect(
    hit,
    "the top /docs/concepts hit has no `#fragment` — sub_result anchors are missing (heading ids absent from prerendered HTML)",
  ).toBeVisible();
  const href = await hit.getAttribute("href");
  expect(href, "search hit href").toMatch(/\/docs\/concepts#.+/);
  const fragment = href!.split("#")[1]!;

  await hit.click();

  // (a) the URL gained the `#` fragment.
  await expect(page).toHaveURL(new RegExp(`/docs/concepts#${fragment}$`));

  // (b) the target heading exists and is scrolled into view (near the top of the
  // viewport), proving the build-time id let the in-page anchor resolve.
  const target = page.locator(`#${fragment}`);
  await expect(target, `heading #${fragment} must exist in the served HTML`).toHaveCount(1);
  const box = await target.boundingBox();
  expect(box, "target heading has no layout box").not.toBeNull();
  const viewport = page.viewportSize();
  expect(box!.y, "matched heading is not scrolled near the top of the viewport").toBeLessThan(
    (viewport?.height ?? 720) * 0.5,
  );

  expect(
    pageErrors,
    `pageerror during scroll-to-anchor: ${pageErrors.map((e) => e.message).join("; ")}`,
  ).toEqual([]);
  expect(
    consoleErrors,
    `console.error during scroll-to-anchor: ${consoleErrors.join("; ")}`,
  ).toEqual([]);
});

// ── B128-R4: keyboard-operable (Escape dismisses) + SSR-safe (no load error) ──

test("B128-R4 / Escape dismisses the results and the input stays focusable; no error on load", async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (err) => pageErrors.push(err));

  await page.goto(DOCS_ROUTE);
  await page.waitForLoadState("networkidle");

  // SSR-safe: the widget must not throw at module load on a prerendered /docs route.
  expect(
    pageErrors,
    `pageerror on /docs load (SSR/module-load): ${pageErrors.map((e) => e.message).join("; ")}`,
  ).toEqual([]);

  const input = visibleSearchInput(page);

  // Keyboard-operable: focus and type via the keyboard, results open.
  await input.focus();
  await expect(input, "the visible search input did not take keyboard focus").toBeFocused();
  await page.keyboard.type("determinism");

  const results = resultsRegion(page);
  await expect(
    results,
    "results did not open after keyboard typing into the visible input",
  ).toBeVisible();

  // Escape dismisses the results list; the input remains present/usable.
  await page.keyboard.press("Escape");
  await expect(results, "pressing Escape did not dismiss the results list").toBeHidden();
  await expect(input, "the search input disappeared after Escape").toBeVisible();

  expect(
    pageErrors,
    `pageerror during keyboard interaction: ${pageErrors.map((e) => e.message).join("; ")}`,
  ).toEqual([]);
});
