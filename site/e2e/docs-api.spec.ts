import { expect, test } from "@playwright/test";

/**
 * B102 — structured /docs/api view driven by the generated manifest
 * (spec: wiki/specs/B102-docs-structured-api-parity-guard.md).
 *
 * These are the UI scenarios for B102-R4 (per-symbol <SignatureBlock> + TOC) and
 * B102-R5 (<ParameterTable> for parameterised symbols, none for type-only symbols).
 * One test per requirement ID, asserting the observable THEN by role / text (never
 * pixels), against the production build served by the Playwright `webServer`
 * (playwright.config.ts), settling at `networkidle` like the B75 smoke suite so
 * hydration-mounted widgets are present before assertion.
 *
 * RED expectation: `/docs/api` is still the B100 link-only stub — its body is just a
 * paragraph linking to the canonical reference, with no per-symbol SignatureBlock, no
 * right-rail TOC entries per symbol, and no ParameterTable. Every assertion below fails
 * because the rebuilt, manifest-driven page is absent. That is the correct red.
 */

const API = "/docs/api";

test("B102-R4 / docs-api renders a per-symbol structured view with TOC", async ({ page }) => {
  await page.goto(API);
  await page.waitForLoadState("networkidle");

  // The API reference page title (h1 from <DocPage title="API Reference">).
  await expect(page.getByRole("heading", { level: 1, name: /API Reference/i })).toBeVisible();

  // No longer the B100 stub: the link-only body's canonical-reference link is gone.
  await expect(page.getByRole("link", { name: /canonical reference/i })).toHaveCount(0);

  // A representative symbol's extracted signature renders inside a <code> element.
  // `generate` is a value export; its signature text must contain its name and params.
  const generateSig = page.locator("code", { hasText: /generate/ }).first();
  await expect(generateSig).toBeVisible();
  await expect(generateSig).toContainText("generate");

  // The right-rail TOC ("On this page") contains a navigable link targeting `generate`.
  // <DocPage> renders the rail as an <aside aria-label="On this page">.
  const toc = page.getByRole("complementary", { name: /On this page/i });
  await expect(toc.getByRole("link", { name: /generate/i }).first()).toHaveAttribute(
    "href",
    /#generate/,
  );

  // The right-rail TOC must stay on-screen: a horizontal-overflow regression
  // (a signature/table establishing an intrinsic min-width on the prose column)
  // pushes the rail far off the right edge. Assert it sits within the viewport.
  await expect(toc).toBeInViewport();
  const viewport = page.viewportSize();
  const box = await toc.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x).toBeLessThanOrEqual(viewport!.width);
});

test("B102-R4 / docs-api content never overlaps or clips against the TOC", async ({ page }) => {
  // Measured the way the designer reproduced the defect: at a 1440-wide viewport the
  // content grid track is narrow and a wide ParameterTable / SignatureBlock used to
  // overflow it to the right, painting over the right-rail TOC and clipping long
  // signatures off-page. Guard both: (1) no horizontal overlap between any
  // representative content block and the TOC aside; (2) representative blocks fit
  // within their own width (or scroll inside a bounded container) rather than clip.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(API);
  await page.waitForLoadState("networkidle");

  const toc = page.getByRole("complementary", { name: /On this page/i });
  const tocBox = await toc.boundingBox();
  expect(tocBox).not.toBeNull();

  // (1) Every param-table and signature block must sit entirely left of the TOC —
  // its right edge must not cross the TOC's left edge (a 1px tolerance for rounding).
  const blocks = page.locator(".param-table, .sig");
  const count = await blocks.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const b = await blocks.nth(i).boundingBox();
    expect(b).not.toBeNull();
    expect(b!.x + b!.width).toBeLessThanOrEqual(tocBox!.x + 1);
  }

  // (2) A representative signature must not be clipped off-page: its painted box stays
  // left of the TOC, and if its content is wider than the box it must be a horizontal
  // scroll container (reachable by scrolling) rather than silently clipped.
  const sig = page.locator(".sig").first();
  const sigMetrics = await sig.evaluate((el) => ({
    rightEdge: el.getBoundingClientRect().right,
    clientWidth: el.clientWidth,
    scrollWidth: el.scrollWidth,
    overflowX: getComputedStyle(el).overflowX,
  }));
  expect(sigMetrics.rightEdge).toBeLessThanOrEqual(tocBox!.x + 1);
  if (sigMetrics.scrollWidth > sigMetrics.clientWidth) {
    expect(sigMetrics.overflowX).toBe("auto");
  }
});

test("B102-R5 / parameterised symbols render a ParameterTable; type-only symbols do not", async ({
  page,
}) => {
  await page.goto(API);
  await page.waitForLoadState("networkidle");

  // The parameterised symbol `generate` renders a <table> within its section, whose
  // body lists the declared parameter names in declared order (schema, then options).
  const generateSection = page
    .getByRole("region", { name: /generate/i })
    .or(page.locator("section", { has: page.locator("code", { hasText: "generate" }) }))
    .first();

  const paramTable = generateSection.getByRole("table").first();
  await expect(paramTable).toBeVisible();

  const rowText = await paramTable.locator("tbody tr").allInnerTexts();
  const joined = rowText.join("\n");
  expect(joined).toMatch(/schema/);
  expect(joined).toMatch(/options/);
  const schemaIdx = rowText.findIndex((r) => /schema/.test(r));
  const optionsIdx = rowText.findIndex((r) => /options/.test(r));
  expect(schemaIdx).toBeGreaterThanOrEqual(0);
  expect(optionsIdx).toBeGreaterThan(schemaIdx);

  // A type-only symbol (`Currency`) has no parameters → no <table> in its block.
  const currencySection = page
    .getByRole("region", { name: /Currency/i })
    .or(page.locator("section", { has: page.locator("code", { hasText: "Currency" }) }))
    .first();
  await expect(currencySection.getByRole("table")).toHaveCount(0);
});
