import { expect, test } from "@playwright/test";

/**
 * B103 — rebuilt /docs/key-heuristics + /docs/recipes + /docs/zod4-schema-coverage +
 * /docs/bugs content suite (spec: wiki/specs/B103-docs-port-remaining-pages.md).
 *
 * These are the UI scenarios for B103-R1 .. B103-R7: each route is rebuilt from a
 * link-only B100 stub into a bespoke <DocPage> authored on the B100 primitives, with
 * prose ported verbatim from the matching docs/*.md (key-heuristics, recipes,
 * zod4-schema-coverage, bugs). Recipes and Key Heuristics additionally embed at least
 * one <Playground> (B103-R5 / B103-R6).
 *
 * One test per requirement ID, named `B103-R<k> / <scenario>`, asserting the observable
 * THEN by role / text (never pixels), mirroring B101's docs-content.spec.ts. The suite
 * runs against the production build served by the Playwright `webServer`
 * (see playwright.config.ts), settling on `networkidle` (the B75 smoke settle point) so
 * hydration-mounted widgets (Playground/CodeMirror) settle before assertion.
 *
 * RED expectation: all four routes are still B100-R13 stubs — each a <DocPage> whose
 * body is a single paragraph linking to the canonical docs/<file>.md (a
 * `/canonical reference/i` link), with no ported section headings and no <Playground>.
 * Every assertion below therefore fails because the rebuilt content is absent — that is
 * the correct red ("pages are still stubs").
 */

const KEY_HEURISTICS = "/docs/key-heuristics";
const RECIPES = "/docs/recipes";
const SCHEMA_COVERAGE = "/docs/zod4-schema-coverage";
const BUGS = "/docs/bugs";

const ALL_FOUR = [KEY_HEURISTICS, RECIPES, SCHEMA_COVERAGE, BUGS] as const;

// ── B103-R1: Key Heuristics ──────────────────────────────────────────────────

test("B103-R1 / key-heuristics renders as a DocPage with ported prose", async ({ page }) => {
  await page.goto(KEY_HEURISTICS);
  await page.waitForLoadState("networkidle");

  // h1 from <DocPage title="Key Heuristics">.
  await expect(page.getByRole("heading", { level: 1, name: "Key Heuristics" })).toBeVisible();

  // No longer the stub: the link-only body's `/canonical reference/i` link is gone.
  await expect(page.getByRole("link", { name: /canonical reference/i })).toHaveCount(0);

  // At least one ported section heading from docs/key-heuristics.md
  // ("## How it works" / "## Pattern generators").
  await expect(
    page.getByRole("heading", { name: /How it works|Pattern generators/i }).first(),
  ).toBeVisible();
});

// ── B103-R2: Recipes ─────────────────────────────────────────────────────────

test("B103-R2 / recipes renders as a DocPage with ported prose", async ({ page }) => {
  await page.goto(RECIPES);
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { level: 1, name: "Recipes" })).toBeVisible();

  await expect(page.getByRole("link", { name: /canonical reference/i })).toHaveCount(0);

  // At least one ported section heading from docs/recipes.md
  // ("## Ad-hoc generation" / "## Reproducible test data").
  await expect(
    page.getByRole("heading", { name: /Ad-hoc generation|Reproducible test data/i }).first(),
  ).toBeVisible();
});

// ── B103-R3: Schema Coverage ─────────────────────────────────────────────────

test("B103-R3 / zod4-schema-coverage renders as a DocPage with the ported support matrix", async ({
  page,
}) => {
  await page.goto(SCHEMA_COVERAGE);
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { level: 1, name: "Schema Coverage" })).toBeVisible();

  await expect(page.getByRole("link", { name: /canonical reference/i })).toHaveCount(0);

  // At least one ported section heading from docs/zod4-schema-coverage.md
  // ("## Primitive types" / "## Collection types").
  await expect(
    page.getByRole("heading", { name: /Primitive types|Collection types/i }).first(),
  ).toBeVisible();
});

// ── B103-R4: Known Bugs ──────────────────────────────────────────────────────

test("B103-R4 / bugs renders as a DocPage with ported prose", async ({ page }) => {
  await page.goto(BUGS);
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { level: 1, name: "Known Bugs" })).toBeVisible();

  await expect(page.getByRole("link", { name: /canonical reference/i })).toHaveCount(0);

  // At least one ported section heading from docs/bugs.md ("## Resolved").
  await expect(page.getByRole("heading", { name: /Resolved/i }).first()).toBeVisible();
});

// ── B103-R5: Recipes embeds a Playground ─────────────────────────────────────

test("B103-R5 / recipes embeds a Playground that mounts after hydration", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto(RECIPES);
  await page.waitForLoadState("networkidle");

  // <Playground> defers CodeMirror to onMount (D22): a `.cm-editor` appears only after
  // client-side hydration. The locator's visibility assertion gives hydration time.
  await expect(page.locator(".cm-editor").first()).toBeVisible();

  // The B75 smoke assertion for this route stays green.
  expect(consoleErrors).toHaveLength(0);
});

// ── B103-R6: Key Heuristics embeds a Playground ──────────────────────────────

test("B103-R6 / key-heuristics embeds a Playground that mounts after hydration", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto(KEY_HEURISTICS);
  await page.waitForLoadState("networkidle");

  await expect(page.locator(".cm-editor").first()).toBeVisible();

  expect(consoleErrors).toHaveLength(0);
});

// ── B103-R7: no un-cited speed superlative on any rebuilt page ────────────────

test("B103-R7 / no un-cited speed superlative on any rebuilt page", async ({ page }) => {
  for (const route of ALL_FOUR) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");

    // D17/D20 honest framing: no visible un-cited superlative anywhere on the page.
    await expect(
      page.getByText(/\bfastest\b/i),
      `un-cited "fastest" superlative found on ${route}`,
    ).toHaveCount(0);
    await expect(
      page.getByText(/faster than the alternatives/i),
      `un-cited "faster than the alternatives" superlative found on ${route}`,
    ).toHaveCount(0);
  }
});
