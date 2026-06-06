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

test("B101-R1 / getting-started renders as a DocPage with ported prose", async ({ page }) => {
  await page.goto(GETTING_STARTED);
  await page.waitForLoadState("networkidle");

  // h1 from <DocPage title="Getting Started">.
  await expect(page.getByRole("heading", { level: 1, name: "Getting Started" })).toBeVisible();

  // No longer the stub: the link-only body's `/canonical reference/i` link is gone.
  await expect(page.getByRole("link", { name: /canonical reference/i })).toHaveCount(0);

  // At least one ported narrative heading from docs/getting-started.md
  // ("## Step 1 — Generate without any setup").
  await expect(page.getByRole("heading", { name: /Generate without/i }).first()).toBeVisible();
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

test("B101-R3 / getting-started SpeedClaim cites the CLI baseline, no un-cited superlative", async ({
  page,
}) => {
  await page.goto(GETTING_STARTED);
  await page.waitForLoadState("networkidle");

  // The <SpeedClaim source=…> citation line is visible.
  await expect(page.getByText("site/bench/results/latest.json")).toBeVisible();

  // No un-cited superlative prose anywhere on the page (D17/D20 honest framing).
  await expect(page.getByText(/\bfastest\b/i)).toHaveCount(0);
  await expect(page.getByText(/faster than the alternatives/i)).toHaveCount(0);
});

test("B101-R4 / getting-started embeds a Playground that mounts after hydration", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto(GETTING_STARTED);
  await page.waitForLoadState("networkidle");

  // <Playground> defers CodeMirror to onMount (D22): a `.cm-editor` appears only
  // after client-side hydration. waitFor gives hydration time to mount it.
  const playground = page.locator(".playground").first();
  await expect(playground.locator(".cm-editor").first()).toBeVisible();

  // The initialCode must satisfy SchemaPlayground.buildExecutable: the widget
  // evaluates it cleanly to a real generated value. A bad initialCode (e.g. a
  // trailing `);` from a multi-line `const x = generate(...)`) surfaces a
  // SyntaxError in the widget's own output bar — not the console — so guard the
  // visible output directly.
  await expect(playground.locator(".error")).toHaveCount(0);
  await expect(playground.locator(".output")).toBeVisible();
  // A sign of real generated output: the `email` field from step1Code's schema.
  await expect(playground.locator(".output")).toContainText("email");

  // The B75 smoke assertion for this route stays green.
  expect(consoleErrors).toHaveLength(0);
});

test("B101-R5 / getting-started embeds a RelatedShowcase demo link", async ({ page }) => {
  await page.goto(GETTING_STARTED);
  await page.waitForLoadState("networkidle");

  const demoLink = page.getByRole("link", { name: /see the full demo/i }).first();
  await expect(demoLink).toBeVisible();
  await expect(demoLink).toHaveAttribute("href", /^\/showcase#(review|order|user|product)$/);
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
