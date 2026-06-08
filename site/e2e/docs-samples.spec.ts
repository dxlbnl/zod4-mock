import { expect, test } from "@playwright/test";

/**
 * B126 — Code samples → Shiki + Twoslash (spec: wiki/specs/B126-twoslash-code-samples.md).
 *
 * The UI scenarios (asserted by role / href / attribute, never pixels) against the
 * production build served by the Playwright `webServer` (playwright.config.ts), settling
 * at `networkidle`:
 *   - B126-R3 — a documented type token in a guide sample renders as an <a> whose href
 *               resolves to that symbol's /docs/api entry (`/docs/api#generate` or the
 *               model's equivalent anchor); the target exists on /docs/api; ≥1 such
 *               resolved type-link exists AND every emitted type-link's anchor exists
 *               (zero dead — excludes both the silent-zero-link and the dangling failure
 *               modes).
 *   - B126-R5 — a transformer-routed sample renders syntax-highlighted via Shiki with the
 *               site's dual theme: ≥1 token <span> carrying a colour style (not plain
 *               <pre> text), and toggling the palette switches token colours (the
 *               `--shiki-light` / `--shiki-dark` vars resolve per palette).
 *
 * The guide page under test is Getting Started, whose lead sample imports and calls
 * `generate` from `zod4-mock` (B126 migrates that lead sample to the transformer-routed
 * mechanism — Q2 recommendation). Each test watches console.error / pageerror.
 *
 * RED today: the guide samples are hand-written <pre><code> reaching NO highlighter — no
 * Shiki token spans, no twoslash <a> type-links — so every assertion below fails because
 * the B126 mechanism is absent.
 */

const GETTING_STARTED = "/docs/getting-started";
const API = "/docs/api";

/** Attach console-error / pageerror collectors; return a getter for assertions. */
function watchConsole(page: import("@playwright/test").Page): () => string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));
  return () => errors;
}

test("B126-R3 / a generate token links to its /docs/api entry, with ≥1 real link and zero dead links", async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.goto(GETTING_STARTED);
  await page.waitForLoadState("networkidle");

  // Locate the transformer-routed code samples on the guide page. B126 renders them as a
  // code-sample region (a `.code-sample` / `[data-sample]` wrapper around the Shiki
  // output) — distinct from the interactive `.playground` (CodeMirror) widget, which
  // B126 must NOT route through twoslash.
  const samples = page.locator("[data-sample], .code-sample, figure.shiki, .shiki");
  await expect(
    samples.first(),
    "the guide must render at least one transformer-routed code sample",
  ).toBeVisible();

  // Collect every twoslash-emitted type-link in the samples: an <a> whose href targets a
  // /docs/api anchor. These are the clickable type tokens.
  const typeLinks = samples.locator("a[href*='/docs/api#']");
  const linkCount = await typeLinks.count();
  expect(
    linkCount,
    "≥1 type token in a sample must render as a resolved /docs/api type-link " +
      "(the src-vs-dist join must actually yield links — a 0-link result is the silent-fail mode)",
  ).toBeGreaterThan(0);

  // The `generate` token specifically must be a clickable link into the API reference.
  const generateLink = samples.locator("a[href*='/docs/api#generate']").first();
  await expect(
    generateLink,
    "the `generate` token must be an <a> linking to /docs/api#generate (or the model's equivalent)",
  ).toHaveCount(1);

  // Harvest every type-link's anchor, then assert each target element exists on /docs/api
  // (zero dead links). Build the unique anchor set first.
  const hrefs = await typeLinks.evaluateAll((els) =>
    els
      .map((el) => (el as HTMLAnchorElement).getAttribute("href") ?? "")
      .map((h) => h.split("#")[1])
      .filter((a): a is string => Boolean(a)),
  );
  const anchors = Array.from(new Set(hrefs));
  expect(anchors.length, "the harvested type-link anchor set is non-empty").toBeGreaterThan(0);

  await page.goto(API);
  await page.waitForLoadState("networkidle");
  for (const anchor of anchors) {
    // The anchor target must exist on /docs/api (escape `.` in member anchors for the
    // id selector). A missing target is a dead link — disallowed.
    const escaped = anchor.replace(/\./g, "\\.");
    const target = page.locator(`#${escaped}, [id='${anchor}']`).first();
    await expect(
      target,
      `every emitted sample type-link's anchor must exist on /docs/api; missing: #${anchor}`,
    ).toHaveCount(1);
  }

  // The `generate` type-link must be GENUINELY clickable — nothing may overlay the glyph.
  // The minimal renderer (B126 maintainer decision) emits NO `.twoslash-popup-*` markup, so
  // the `<a>` is the only thing at its own location. The pre-fix regression (rendererRich's
  // always-visible popup overlaying the token so only a force-click navigated) is excluded
  // here: assert the element at the link's centre IS the <a> (no covering element), then a
  // NORMAL (non-force) click at the link centre navigates to /docs/api#generate.
  await page.goBack();
  await page.waitForLoadState("networkidle");
  await generateLink.scrollIntoViewIfNeeded();

  // 1) The element at the link's own centre point is the <a> itself (or a descendant token
  //    span inside it) — NOT a covering element, and specifically NOT a twoslash popup.
  const hit = await generateLink.evaluate((a) => {
    const r = a.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const onLink = el ? a === el || a.contains(el) : false;
    const popup = el?.closest('.twoslash-popup-container, [class*="twoslash-popup"]') != null;
    return { onLink, popup, tag: el?.tagName ?? null, cls: el?.className ?? null };
  });
  expect(
    hit.popup,
    "the `generate` type-link's centre point must NOT hit any twoslash popup " +
      "(the minimal renderer emits no popup markup at all)",
  ).toBe(false);
  expect(
    hit.onLink,
    `the \`generate\` type-link must be the element at its own centre point with nothing ` +
      `covering it (got ${hit.tag}.${hit.cls})`,
  ).toBe(true);

  // 2) A NORMAL (non-force) click at the link centre navigates to the API reference with the
  //    `#generate` hash. No `force`, no corner-position workaround: a covering element would
  //    fail Playwright's actionability check here, so this asserts real clickability.
  await generateLink.click();
  await page.waitForURL("**/docs/api#generate");
  expect(page.url(), "clicking the `generate` link navigates to /docs/api#generate").toContain(
    "/docs/api#generate",
  );

  expect(errors(), "no console error / pageerror during load").toEqual([]);
});

test("B126-R5 / a guide sample renders Shiki dual-theme highlighted, palette-switching token colours", async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.goto(GETTING_STARTED);
  await page.waitForLoadState("networkidle");

  // A transformer-routed sample is coloured token markup, not plain <pre> text: at least
  // one Shiki token <span> carries a colour style. Shiki dual-theme emits per-token
  // `--shiki-light` / `--shiki-dark` CSS custom properties (defaultColor:false), so probe
  // for a token span whose style sets a shiki colour var (or an inline color).
  const sample = page.locator("[data-sample], .code-sample, .shiki").first();
  await expect(sample, "the guide must render a transformer-routed sample").toBeVisible();

  const colouredToken = sample.locator("span[style*='--shiki'], span[style*='color']").first();
  await expect(
    colouredToken,
    "the sample must render coloured Shiki token spans (not plain un-highlighted <pre> text)",
  ).toHaveCount(1);

  // Toggling the palette switches the rendered token colour. The site palette-switches via
  // a `data-palette` attribute on a root element (the dual-theme CSS selects `--shiki-light`
  // vs `--shiki-dark`). Read the computed colour under each palette and require them to
  // differ — proving the dual-theme vars resolve per palette rather than a single baked colour.
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
    "toggling data-palette must switch the token colour (dual-theme --shiki-light/--shiki-dark resolve)",
  ).not.toBe(lightColour);

  expect(errors(), "no console error / pageerror during load").toEqual([]);
});
