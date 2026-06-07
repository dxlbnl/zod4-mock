import { expect, test } from "@playwright/test";

/**
 * B115 — Group the /docs/api reference by category
 * (spec: wiki/specs/B115-docs-api-grouped-by-category.md).
 *
 * UI scenarios for B115-R2 (grouped section headings in curation order), B115-R3
 * (per-symbol `#<name>` anchors survive grouping), and B115-R4 (the right-rail
 * "On this page" TOC reflects the grouping while keeping every per-symbol link).
 * One test per requirement ID, asserting the observable THEN by role / text (never
 * pixels), against the production build served by the Playwright `webServer`,
 * settling at `networkidle` so hydration-mounted widgets (the TOC) are present.
 *
 * The selectors bind to "the groups the curation layer defines", not to the literal
 * final taxonomy names, so a reviewer/designer may rename or reorder groups at the
 * review pass without breaking these tests. The card's concrete proposal names
 * "Getting started" / "Randomness" / "World Explorer" as evaluator-orientable group
 * labels (spec R7 UI scenario) — used only as representative anchors where needed.
 *
 * RED expectation: `/docs/api` renders a FLAT list — one `<h2 id={name}>` per symbol
 * inside <DocPage>, no group section headings, and a flat per-symbol TOC. Every
 * grouped-structure assertion below fails because the grouping render does not exist
 * yet. The per-symbol anchors (R3) and the `#generate` TOC link (R4's B102 carry-over)
 * already exist, so R3 / R4 are RED specifically on their grouped-structure half — the
 * tests below isolate that.
 */

const API = "/docs/api";

/**
 * The set of curated group labels rendered as section headings. Kept here as the
 * card's consolidated proposal; the assertions that follow only require that AT
 * LEAST these representative, evaluator-orientable labels appear as group headings
 * AND that group structure exists distinct from per-symbol headings — robust to a
 * rename of the other groups.
 */
const REPRESENTATIVE_GROUP_LABELS = [/Getting started/i, /Randomness/i, /World Explorer/i];

test("B115-R2 / docs-api renders symbols under group section headings in curation order", async ({
  page,
}) => {
  await page.goto(API);
  await page.waitForLoadState("networkidle");

  // The page is no longer a flat list: a visible group section heading exists for
  // the representative curated groups the card names. These are headings whose text
  // is a GROUP label (e.g. "Getting started"), not a symbol name.
  for (const label of REPRESENTATIVE_GROUP_LABELS) {
    await expect(
      page.getByRole("heading", { name: label }),
      `expected a visible group section heading matching ${label}`,
    ).toBeVisible();
  }

  // Group order follows curation order: "Getting started" (group 1) renders before
  // "World Explorer (trace)" (a later group) in document order.
  const gettingStarted = page.getByRole("heading", { name: /Getting started/i }).first();
  const worldExplorer = page.getByRole("heading", { name: /World Explorer/i }).first();
  const order = await gettingStarted.evaluate(
    (a, b) => {
      const pos = a.compareDocumentPosition(b);
      // DOCUMENT_POSITION_FOLLOWING (4) ⇒ b comes after a.
      return (pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 ? "after" : "before";
    },
    await worldExplorer.elementHandle(),
  );
  expect(order, '"Getting started" group heading must precede "World Explorer"').toBe("after");

  // The `generate` symbol's block renders within / after the first group's heading
  // and before the next group's heading. Assert generate's heading sits after the
  // "Getting started" group heading in document order.
  const generateHeading = page.locator("#generate");
  await expect(generateHeading).toBeVisible();
  const generateAfterGroup = await gettingStarted.evaluate(
    (groupEl, genEl) => {
      const pos = groupEl.compareDocumentPosition(genEl as Node);
      return (pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    },
    await generateHeading.elementHandle(),
  );
  expect(generateAfterGroup, "`generate` must render after its group heading").toBe(true);
});

test("B115-R3 / each symbol keeps its own stable #<name> anchor under the grouped layout", async ({
  page,
}) => {
  await page.goto(API);
  await page.waitForLoadState("networkidle");

  // Per-symbol anchors survive grouping: `#generate` and another symbol's id
  // (`#Currency`) both resolve to an element on the page, so deep links keep working.
  await expect(page.locator("#generate")).toHaveCount(1);
  await expect(page.locator("#Currency")).toHaveCount(1);

  // Navigating to the deep link scrolls that symbol's block into view (the heading
  // carries scroll-margin-top as today) — assert the targeted element is in viewport
  // after the hash navigation.
  await page.goto(`${API}#generate`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#generate")).toBeInViewport();
});

test("B115-R4 / the right-rail On this page TOC reflects the grouping and keeps per-symbol links", async ({
  page,
}) => {
  await page.goto(API);
  await page.waitForLoadState("networkidle");

  const toc = page.getByRole("complementary", { name: /On this page/i });
  await expect(toc).toBeVisible();

  // (a) The grouping is additive: the existing B102-R4 per-symbol link survives —
  // the TOC still contains a navigable link whose href targets `#generate`.
  await expect(toc.getByRole("link", { name: /generate/i }).first()).toHaveAttribute(
    "href",
    /#generate/,
  );

  // (b) RED today: the TOC must now show the group structure — the curated group
  // labels appear as TOC group headings/clusters, not one undifferentiated flat
  // list of per-symbol links. Assert a representative group label is present in the
  // TOC region as text that is NOT itself a per-symbol `#`-link (a group label /
  // cluster heading). The flat TOC has no such group label text today.
  const tocText = (await toc.innerText()).toLowerCase();
  expect(
    tocText,
    'the "On this page" TOC must surface group labels (e.g. "Getting started")',
  ).toContain("getting started");
  expect(
    tocText,
    'the "On this page" TOC must surface group labels (e.g. "World Explorer")',
  ).toContain("world explorer");
});
