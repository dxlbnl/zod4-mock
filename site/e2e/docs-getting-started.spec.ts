import { expect, test } from "@playwright/test";

/**
 * B127 — Rewrite Getting Started: one full example + self-contained variations, not steps
 * (spec: wiki/specs/B127-getting-started-rewrite.md).
 *
 * The contract is a content/UI rewrite, observable on the prerendered
 * `/docs/getting-started` page served by the Playwright `webServer`
 * (playwright.config.ts), settled at `networkidle`. One test per requirement id,
 * named `B127-R<k> / <scenario>`, asserting the observable THEN by role / text /
 * href / attribute (never pixels). Each test watches console.error / pageerror.
 *
 * RED today: the page is the old B101 step-based version — numbered "Step N" sections,
 * hand-written <pre><code> (no Shiki, no type-links), a leading <SpeedClaim> ("user tier
 * 3.2×"), "Zod v4 — not v3" copy, and derive/transform/localize sections. So:
 *   - R1: the first code block is a plain <pre><code>, not a Shiki-highlighted <CodeSample>.
 *   - R2: "Step N" framing is present, and there is only 1 <CodeSample> ([data-sample]).
 *   - R3: the seeded-world / matchers / relations examples are plain <pre>, not CodeSamples.
 *   - R4: with no CodeSamples for those, there are no /docs/api# type-links beyond the lead.
 *   - R5: <SpeedClaim> ("3.2×" / "user tier") and "not v3" copy are present.
 *   - R6: derive (`from:`) / transform / localize sections are present.
 *
 * NOTE for the implementer — stable hooks the page must provide so these tests bind
 * without brittleness (see report):
 *   - Each of the lead + the three required variations is a `<CodeSample>` (rendered as
 *     `figure.code-sample[data-sample]`), so the page exposes ≥4 `[data-sample]` blocks.
 *   - Sample ids expected in samples.ts: `getting-started-lead` (already exists) plus a
 *     seeded-world variation whose `source` calls `createWorld({ seed: … })`, a matchers
 *     variation (`withSchema(…, { matchers: { … } })`), and a relations variation
 *     (`withSchema(…, { relations: { … } })` + `ctx.related(…)`).
 *   - The seeded-world variation has a stable section heading matching /seed/i and adjacent
 *     prose explaining the seed; matchers + relations sections have headings matching
 *     /matcher/i and /relation/i respectively.
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

// ── B127-R1 ─────────────────────────────────────────────────────────────────

test("B127-R1 / the page leads with a Shiki-highlighted <CodeSample>, not a plain <pre>", async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.goto(GETTING_STARTED);
  await page.waitForLoadState("networkidle");

  // Scope to the prose body so the lead is the first *content* code block, not any
  // chrome. A <CodeSample> renders as `figure.code-sample[data-sample]` (CodeSample.svelte).
  const proseBody = page.locator(".doc-prose-body");

  // The FIRST code block in the body must be a <CodeSample> region — and specifically NOT
  // a bare <pre><code> the way the old page leads. Enumerate every code-bearing block
  // (CodeSamples + plain <pre>) in document order; the first one must be a data-sample.
  const firstCodeBlock = proseBody.locator("[data-sample], pre").first();
  await expect(firstCodeBlock, "the page must lead its body with a code block").toBeVisible();
  await expect(
    firstCodeBlock,
    "the FIRST code block must be a <CodeSample> ([data-sample]), not a plain <pre><code>",
  ).toHaveAttribute("data-sample", /.+/);

  // That lead sample must be Shiki-highlighted: ≥1 token <span> carrying a colour
  // (Shiki dual-theme emits `--shiki-light`/`--shiki-dark`; defaultColor:false). A plain
  // un-highlighted <pre> has no such coloured token span.
  const leadSample = proseBody.locator("[data-sample]").first();
  const colouredToken = leadSample.locator("span[style*='--shiki'], span[style*='color']").first();
  await expect(
    colouredToken,
    "the lead sample must render coloured Shiki token spans (Shiki-highlighted, not plain <pre>)",
  ).toHaveCount(1);

  expect(errors(), "no console error / pageerror during load").toEqual([]);
});

// ── B127-R2 ─────────────────────────────────────────────────────────────────

test("B127-R2 / no 'Step N' framing, and ≥4 <CodeSample> blocks (1 lead + ≥3 variations)", async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.goto(GETTING_STARTED);
  await page.waitForLoadState("networkidle");

  const proseBody = page.locator(".doc-prose-body");

  // No "Step N" framing anywhere in the page body — neither headings nor inline labels.
  // The old page used "## Step 1 — …" .. "## Step 7 — …"; the rewrite must carry none.
  await expect(
    proseBody.getByText(/\bstep\s*\d/i),
    "the page must NOT present examples as numbered 'Step N' sections",
  ).toHaveCount(0);

  // One lead + at least three variation samples, each a self-contained <CodeSample>.
  const sampleCount = await proseBody.locator("[data-sample]").count();
  expect(
    sampleCount,
    "the page must render ≥4 <CodeSample> blocks (1 lead + ≥3 variations)",
  ).toBeGreaterThanOrEqual(4);

  // Each sample is referenced by a distinct id (no duplicate [data-sample] values).
  const ids = await proseBody
    .locator("[data-sample]")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-sample") ?? ""));
  expect(
    new Set(ids).size,
    "each <CodeSample> must reference a distinct sample id registered in samples.ts",
  ).toBe(ids.length);

  expect(errors(), "no console error / pageerror during load").toEqual([]);
});

// ── B127-R3 ─────────────────────────────────────────────────────────────────

test("B127-R3 / variations cover a seeded world (createWorld), matchers, and relations", async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.goto(GETTING_STARTED);
  await page.waitForLoadState("networkidle");

  const proseBody = page.locator(".doc-prose-body");

  // The seeded-world variation is a <CodeSample> whose rendered source calls
  // `createWorld(` with a `seed`. Shiki tokenizes the source into spans, so the visible
  // text of the sample contains both `createWorld` and `seed`.
  const seededSample = proseBody
    .locator("[data-sample]")
    .filter({ hasText: "createWorld" })
    .filter({ hasText: /seed/ })
    .first();
  await expect(
    seededSample,
    "a seeded-world variation must be a <CodeSample> whose source calls createWorld({ seed: … })",
  ).toHaveCount(1);

  // Adjacent prose explains the seed plainly (the options primer, not "Step 2"): the page
  // body mentions the same seed yielding the same data.
  await expect(
    proseBody.getByText(/same seed/i).first(),
    "prose must explain the seed plainly (same seed → same data)",
  ).toBeVisible();

  // A matchers variation: a <CodeSample> whose source uses `matchers`.
  const matchersSample = proseBody.locator("[data-sample]").filter({ hasText: "matchers" }).first();
  await expect(
    matchersSample,
    "a matchers variation must be a <CodeSample> (withSchema(…, { matchers: { … } }))",
  ).toHaveCount(1);

  // A relations variation: a <CodeSample> whose source uses `relations` + `ctx.related`.
  const relationsSample = proseBody
    .locator("[data-sample]")
    .filter({ hasText: "relations" })
    .filter({ hasText: "related" })
    .first();
  await expect(
    relationsSample,
    "a relations variation must be a <CodeSample> (withSchema(…, { relations }) + ctx.related)",
  ).toHaveCount(1);

  expect(errors(), "no console error / pageerror during load").toEqual([]);
});

// ── B127-R4 ─────────────────────────────────────────────────────────────────

test("B127-R4 / the page samples carry ≥1 real /docs/api type-link and zero dead links", async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.goto(GETTING_STARTED);
  await page.waitForLoadState("networkidle");

  const samples = page.locator(".doc-prose-body [data-sample]");

  // Collect every twoslash-emitted type-link in the page's samples (an <a> targeting a
  // /docs/api anchor). The B126 join must actually yield links here — a 0-link result is
  // the silent-fail mode. (Mirrors the B126 docs-samples.spec.ts R3 assertion shape.)
  const typeLinks = samples.locator("a[href*='/docs/api#']");
  const linkCount = await typeLinks.count();
  expect(
    linkCount,
    "≥1 type token in the page's samples must render as a resolved /docs/api type-link",
  ).toBeGreaterThan(0);

  // The B127 variations must themselves yield documented type-links — not just the
  // pre-existing lead sample's `generate`. The spec (B127-R4 scenario) names `createWorld`
  // in the seeded-world variation: it must render as an <a> into /docs/api#createWorld.
  // This binds R4 to the *added* variations: today, with only the lead sample present,
  // there is no `createWorld` token on the page, so this fails for the right reason.
  const createWorldLink = samples.locator("a[href*='/docs/api#createWorld']").first();
  await expect(
    createWorldLink,
    "the seeded-world variation's `createWorld` token must link to /docs/api#createWorld",
  ).toHaveCount(1);

  // Harvest each type-link's anchor, then assert every target exists on /docs/api (zero
  // dead). Build the unique anchor set first.
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
    const escaped = anchor.replace(/\./g, "\\.");
    const target = page.locator(`#${escaped}, [id='${anchor}']`).first();
    await expect(
      target,
      `every emitted sample type-link's anchor must exist on /docs/api; missing: #${anchor}`,
    ).toHaveCount(1);
  }

  expect(errors(), "no console error / pageerror during load").toEqual([]);
});

// ── B127-R5 ─────────────────────────────────────────────────────────────────

test("B127-R5 / no SpeedClaim boast and no v3-vs-v4 disclaimer copy", async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto(GETTING_STARTED);
  await page.waitForLoadState("networkidle");

  const proseBody = page.locator(".doc-prose-body");

  // No <SpeedClaim> on the page: its rendered markers are the "3.2×" value and the
  // "user tier" StatCard label. Neither may appear.
  await expect(
    proseBody.getByText("3.2×"),
    "the page must not render the SpeedClaim '3.2×' boast",
  ).toHaveCount(0);
  await expect(
    proseBody.getByText(/user tier/i),
    "the page must not render the SpeedClaim 'user tier' label",
  ).toHaveCount(0);

  // No v3-vs-v4 disclaimer copy (a bare `zod@^4` mention is allowed; the disparaging
  // "not v3" framing is gone).
  await expect(
    proseBody.getByText(/not\s+v3/i),
    "the page must not carry 'not v3' disclaimer copy",
  ).toHaveCount(0);

  expect(errors(), "no console error / pageerror during load").toEqual([]);
});

// ── B127-R6 ─────────────────────────────────────────────────────────────────

test("B127-R6 / derive / transform / localize sections are absent from the page", async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.goto(GETTING_STARTED);
  await page.waitForLoadState("networkidle");

  const proseBody = page.locator(".doc-prose-body");

  // No dedicated derive / transform / localize section headings (old Steps 5–7).
  await expect(
    proseBody.getByRole("heading", { name: /derive|transform|localize|localization/i }),
    "Getting Started must not carry derive / transform / localize section headings",
  ).toHaveCount(0);

  // And the strongest observable: none of those examples' tell-tale source appears on the
  // page — no `from:`-derived-schema block, no `transform:` block, no `@zod4-mock/locale-*`
  // install/usage. These read directly off the rendered sample text.
  await expect(
    proseBody.getByText(/transform:/),
    "no transform: example block on Getting Started",
  ).toHaveCount(0);
  await expect(
    proseBody.getByText(/@zod4-mock\/locale-/),
    "no locale-package example on Getting Started",
  ).toHaveCount(0);

  expect(errors(), "no console error / pageerror during load").toEqual([]);
});
