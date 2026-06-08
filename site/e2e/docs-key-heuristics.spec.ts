import { type Page, expect, test } from "@playwright/test";

/**
 * B131 — Docs: replace the Key-heuristics <table>s with the non-table
 * heading-per-member (definition-list) layout, mobile-first.
 * (card: wiki/backlog/doing/B131-key-heuristics-tables-to-deflist.md)
 *
 * Maintainer directive: the docs site must not use <table> — the
 * /docs/key-heuristics page rendered 18 hand-written <table>s (all shaped
 * Key(s) → Generator identifier → Description). Every one becomes the reusable
 * B121 DefinitionList (term = the key(s), value = the generator id, description
 * = the description prose).
 *
 * Mirrors docs-concepts.spec.ts: asserts no <table> remains, that
 * [data-deflist] containers with [data-term] entries render (spot-checking real
 * terms read off the page), no page-level horizontal overflow at 390px, and no
 * console errors. Runs against the production build served by the Playwright
 * webServer, settling at networkidle.
 */

const KEY_HEURISTICS = "/docs/key-heuristics";
const MOBILE = { width: 390, height: 844 } as const;

// Real terms read off site/src/routes/docs/key-heuristics/+page.svelte. The
// [data-term] text is the comma-joined key aliases, so we spot-check by prefix.
const SPOT_TERMS = ["firstname", "email", "city", "iban", "amount"] as const;

async function settle(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await page.waitForLoadState("networkidle");
}

function watchErrors(page: Page): () => string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return () => errors;
}

// ── B131-R1: no <table> + the page uses [data-deflist] / [data-term] ─────────

test("B131-R1 / key-heuristics renders as non-table definition lists", async ({ page }) => {
  const errors = watchErrors(page);
  await settle(page, KEY_HEURISTICS);

  const tableCount = await page.locator("table").count();
  expect(tableCount, "no <table> may remain on /docs/key-heuristics").toBe(0);

  const deflistCount = await page.locator("[data-deflist]").count();
  expect(deflistCount, "page renders [data-deflist] containers").toBeGreaterThan(0);

  const terms = await page.evaluate(() => {
    const norm = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim();
    return Array.from(document.querySelectorAll("[data-term]")).map((el) => norm(el.textContent));
  });
  for (const term of SPOT_TERMS) {
    const found = terms.some((t) => t.startsWith(term));
    expect(found, `key-heuristics must list a [data-term] entry starting with "${term}"`).toBe(
      true,
    );
  }

  expect(errors(), "no console errors on /docs/key-heuristics").toEqual([]);
});

// ── B131-R2: mobile-first — no horizontal overflow at 390px ──────────────────

test("B131-R2 / key-heuristics is mobile-usable at 390px", async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(MOBILE);
  await settle(page, KEY_HEURISTICS);

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, "no horizontal overflow at 390px").toBeLessThanOrEqual(clientWidth + 1);

  expect(errors(), "no console errors on /docs/key-heuristics at 390px").toEqual([]);
});
