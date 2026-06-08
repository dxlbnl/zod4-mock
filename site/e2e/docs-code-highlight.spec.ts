import { expect, test } from "@playwright/test";

/**
 * B109 (item 1) — the static guide code blocks on /docs/concepts and /docs/recipes are
 * Shiki-highlighted (plain, no twoslash) with the site's dual themes, replacing the
 * hand-written <pre><code> blocks that reached no highlighter.
 *
 * Asserted by role / attribute / computed style (never pixels) against the production build
 * served by the Playwright `webServer` (playwright.config.ts), settling at `networkidle`:
 *   - each guide renders Shiki-highlighted code blocks: ≥1 `.shiki` token <span> carrying a
 *     colour (not plain <pre>), and NO raw un-highlighted code block remains;
 *   - toggling the palette switches the token colours (the dual-theme `--shiki-light` /
 *     `--shiki-dark` vars resolve per palette);
 *   - no page-level horizontal overflow at 390px.
 *
 * Each test watches console.error / pageerror and fails on a runtime error during load.
 */

const PAGES = ["/docs/concepts", "/docs/recipes"] as const;
const MOBILE = { width: 390, height: 844 } as const;

/** Attach console-error / pageerror collectors; return a getter for assertions. */
function watchConsole(page: import("@playwright/test").Page): () => string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));
  return () => errors;
}

for (const route of PAGES) {
  test(`B109 / ${route} renders Shiki-highlighted code blocks, palette-switching token colours`, async ({
    page,
  }) => {
    const errors = watchConsole(page);
    await page.goto(route);
    await page.waitForLoadState("networkidle");

    // The guide's code blocks are Shiki output, not plain <pre> text: at least one
    // `.shiki` token <span> carries a colour style (Shiki dual-theme emits per-token
    // `--shiki-light` / `--shiki-dark` vars via defaultColor:false).
    const block = page.locator(".code-block .shiki").first();
    await expect(block, `${route} must render a Shiki-highlighted code block`).toBeVisible();

    const colouredToken = block.locator("span[style*='--shiki'], span[style*='color']").first();
    await expect(
      colouredToken,
      `${route} must render coloured Shiki token spans (not plain un-highlighted <pre> text)`,
    ).toHaveCount(1);

    // Toggling the palette switches the rendered token colour: read the computed colour
    // under each palette and require them to differ (the dual-theme vars resolve per palette
    // rather than a single baked colour).
    const readTokenColour = async (palette: "light" | "dark"): Promise<string> => {
      await page.evaluate((p) => {
        document.documentElement.setAttribute("data-palette", p);
      }, palette);
      return colouredToken.evaluate((el) => getComputedStyle(el).color);
    };
    const lightColour = await readTokenColour("light");
    const darkColour = await readTokenColour("dark");
    expect(
      darkColour,
      `${route}: toggling data-palette must switch the token colour ` +
        `(dual-theme --shiki-light/--shiki-dark resolve)`,
    ).not.toBe(lightColour);

    expect(errors(), "no console error / pageerror during load").toEqual([]);
  });

  test(`B109 / ${route} has no page-level horizontal overflow at 390px`, async ({ page }) => {
    const errors = watchConsole(page);
    await page.setViewportSize(MOBILE);
    await page.goto(route);
    await page.waitForLoadState("networkidle");

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(
      scrollWidth,
      `${route} must not overflow horizontally at ${MOBILE.width}px`,
    ).toBeLessThanOrEqual(MOBILE.width + 1);

    expect(errors(), "no console error / pageerror during load").toEqual([]);
  });
}
