import { expect, test } from "@playwright/test";

/**
 * B101 — rebuilt /docs/getting-started + /docs/concepts content suite
 * (spec: wiki/specs/B101-docs-rebuild-getting-started-concepts.md).
 *
 * These are the UI scenarios for B101-R1 .. B101-R7: each page is rebuilt from a
 * link-only B100 stub into a bespoke <DocPage> authored on the B100 primitives
 * (<InstallBlock>, <SpeedClaim>, <Playground>, <RelatedShowcase>, <DefRef>) with
 * prose ported from docs/getting-started.md and docs/concepts.md.
 *
 * One test per requirement ID, named `B101-R<k> / <scenario>`, asserting the
 * observable THEN by role / text / href / attribute (never pixels). The suite
 * runs against the production build served by the Playwright `webServer`
 * (see playwright.config.ts), matching the B75 smoke settle point
 * (`networkidle`) so hydration-mounted widgets (Playground/CodeMirror) settle
 * before assertion.
 *
 * RED expectation: both routes are still B100 stubs (link-only bodies whose only
 * content is a `/canonical reference/i` link; no InstallBlock / SpeedClaim /
 * Playground / RelatedShowcase / DefRef). Every assertion below therefore fails
 * because the rebuilt content is absent — that is the correct red.
 */

const GETTING_STARTED = "/docs/getting-started";
const CONCEPTS = "/docs/concepts";

// ── Getting Started ────────────────────────────────────────────────────────

test("B101-R1 / getting-started renders as a DocPage with authored prose", async ({ page }) => {
  await page.goto(GETTING_STARTED);
  await page.waitForLoadState("networkidle");

  // h1 from <DocPage title="Getting Started">.
  await expect(page.getByRole("heading", { level: 1, name: "Getting Started" })).toBeVisible();

  // No longer the stub: the link-only body's `/canonical reference/i` link is gone.
  await expect(page.getByRole("link", { name: /canonical reference/i })).toHaveCount(0);

  // B127 rewrite: the page leads with one complete example, then variations — so a
  // narrative section heading from the rewritten body is present.
  await expect(page.getByRole("heading", { name: /One complete example/i }).first()).toBeVisible();
});

test("B101-R2 / getting-started leads with an InstallBlock for `zod4-mock zod`", async ({
  page,
}) => {
  await page.goto(GETTING_STARTED);
  await page.waitForLoadState("networkidle");

  // The install command names both packages.
  await expect(page.getByText("zod4-mock zod").first()).toBeVisible();

  // The PM switcher exposes a real `pnpm` tab.
  await expect(page.getByRole("tab", { name: "pnpm" })).toBeVisible();

  // The default (pnpm) visible command starts with `pnpm add zod4-mock zod`.
  await expect(page.getByText(/^pnpm add zod4-mock zod/)).toBeVisible();
});

test("B101-R3 / getting-started carries no un-cited speed superlative", async ({ page }) => {
  await page.goto(GETTING_STARTED);
  await page.waitForLoadState("networkidle");

  // B127 removed the <SpeedClaim> boast from this page (its citation line and the
  // "3.2×" / "user tier" markers are asserted-absent by docs-getting-started.spec.ts
  // R5). The standing D17/D20 honest-framing guard stays: no un-cited superlative.
  await expect(page.getByText(/\bfastest\b/i)).toHaveCount(0);
  await expect(page.getByText(/faster than the alternatives/i)).toHaveCount(0);
});

test("B101-R5 / getting-started embeds a RelatedShowcase demo link", async ({ page }) => {
  await page.goto(GETTING_STARTED);
  await page.waitForLoadState("networkidle");

  const demoLink = page.getByRole("link", { name: /see the full demo/i }).first();
  await expect(demoLink).toBeVisible();
  await expect(demoLink).toHaveAttribute("href", /^\/showcase#(review|order|user|product)$/);
});

test("B116 / getting-started 'Where to go next' entries are working /docs links", async ({
  page,
}) => {
  await page.goto(GETTING_STARTED);
  await page.waitForLoadState("networkidle");

  // The "Where to go next" section lists onward docs pages. Each named target
  // MUST be a real anchor pointing at its /docs/* route (B116 regression: the
  // entries used to render as plain text that did not navigate).
  const targets: ReadonlyArray<{ name: RegExp; href: string }> = [
    { name: /^Concepts$/, href: "/docs/concepts" },
    { name: /^API Reference$/, href: "/docs/api" },
    { name: /Key-Based Field Heuristics/, href: "/docs/key-heuristics" },
    { name: /^Recipes$/, href: "/docs/recipes" },
  ];

  // Resolve the site's amber link colour and the grey body inks to compare the
  // *computed* colour against — a class-name mismatch (the `.docs-prose a` rule
  // not matching the real `.doc-prose-body` wrapper) made these links fall back
  // to grey + underline, reading as plain text. Resolving the tokens off the
  // live document means the assertion tracks the design token, not a hard-coded
  // rgb. `--amber` is the intended link colour; `--ink-dim`/`--ink` is the grey
  // body text the broken links rendered as.
  const tokens = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const resolve = (name: string) => {
      const probe = document.createElement("span");
      probe.style.color = cs.getPropertyValue(name).trim();
      document.body.appendChild(probe);
      const rgb = getComputedStyle(probe).color;
      probe.remove();
      return rgb;
    };
    return { amber: resolve("--amber"), inkDim: resolve("--ink-dim"), ink: resolve("--ink") };
  });

  // Scope to the <DocPage> prose body so we assert the actual "Where to go next"
  // prose link, not the section sidebar's same-href `.docs-nav-link` (which has
  // its own grey nav styling and would mask the prose-link colour regression).
  const proseBody = page.locator(".doc-prose-body");

  for (const { name, href } of targets) {
    const link = proseBody.getByRole("link", { name }).first();
    await expect(link, `"${name}" must be an anchor`).toHaveAttribute("href", href);

    // B116 regression: the prose link must carry the site's amber link affordance,
    // not render as grey body text. Assert the *computed* colour resolves to
    // --amber and is NOT the grey body inks. This is the assertion that catches
    // the class-name mismatch the href check alone could not.
    const color = await link.evaluate((el) => getComputedStyle(el).color);
    expect(color, `"${name}" link must render amber, not grey body text`).toBe(tokens.amber);
    expect(color).not.toBe(tokens.inkDim);
    expect(color).not.toBe(tokens.ink);

    // The href resolves: navigating to it lands on the named docs page (a 200,
    // not a 404), proving the link is real and the target route exists.
    const response = await page.goto(href);
    expect(response?.ok(), `${href} must resolve`).toBe(true);
    await page.goBack();
    await page.waitForLoadState("networkidle");
  }
});

// ── Concepts ───────────────────────────────────────────────────────────────

test("B101-R6 / concepts renders as a DocPage with ported prose", async ({ page }) => {
  await page.goto(CONCEPTS);
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { level: 1, name: "Concepts" })).toBeVisible();

  await expect(page.getByRole("link", { name: /canonical reference/i })).toHaveCount(0);

  // At least two ported concept section headings from docs/concepts.md
  // ("## Determinism" and "## The registry").
  await expect(page.getByRole("heading", { name: /Determinism/i }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /registry/i }).first()).toBeVisible();
});

test("B101-R7 / concepts tags each canonical concept with a DefRef Pagefind anchor", async ({
  page,
}) => {
  await page.goto(CONCEPTS);
  await page.waitForLoadState("networkidle");

  for (const term of ["world", "registry", "matcher", "determinism"]) {
    const anchor = page.locator(`[data-pagefind-meta="concept:${term}"]`).first();
    // The DefRef-emitted element exists, is a focusable control, and carries an
    // accessible name including the term.
    await expect(anchor).toBeVisible();
    await expect(anchor).toHaveAccessibleName(new RegExp(term, "i"));
  }
});
