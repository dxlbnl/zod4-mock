import { type Page, expect, test } from "@playwright/test";

/**
 * B132 — Docs: replace the Schema-coverage <table>s with a non-table pip-list
 * layout (no <table> in the docs site).
 * (card: wiki/backlog/doing/B132-schema-coverage-tables-detable.md)
 *
 * Maintainer directive: the docs site must not use <table>, and the earlier
 * bordered chip-grid "looks horrible". The /docs/zod4-schema-coverage page is a
 * status matrix (Schema → Status → Notes) rendered as 18 hand-written <table>s.
 * Every one becomes the <CoverageList> pip-list: each row = a small colored status
 * pip + the schema (mono) + the caveat/note surfaced inline (dim) when present.
 *
 * Asserts no <table> remains, that [data-coverage] lists with [data-coverage-item]
 * rows render (spot-checking real schemas across statuses via [data-status]), a
 * caveat note is surfaced, no page-level horizontal overflow at 390px, and no
 * console errors. Runs against the production build served by the Playwright
 * webServer, settling at networkidle.
 */

const COVERAGE = "/docs/zod4-schema-coverage";
const MOBILE = { width: 390, height: 844 } as const;

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

// ── B132-R1: no <table>; [data-coverage] pip-lists with status rows ──────────

test("B132-R1 / schema-coverage renders as non-table status pip-lists", async ({ page }) => {
  const errors = watchErrors(page);
  await settle(page, COVERAGE);

  const tableCount = await page.locator("table").count();
  expect(tableCount, "no <table> may remain on /docs/zod4-schema-coverage").toBe(0);

  const coverageCount = await page.locator("[data-coverage]").count();
  expect(coverageCount, "page renders [data-coverage] pip-lists").toBeGreaterThan(0);

  const rowCount = await page.locator("[data-coverage-item]").count();
  expect(rowCount, "page renders [data-coverage-item] rows").toBeGreaterThan(0);

  // Spot-check real schemas across statuses. Each row carries the schema text
  // and a [data-status] attribute.
  const rows = await page.evaluate(() => {
    const norm = (s: string | null) => (s ?? "").replace(/\s+/g, " ").trim();
    return Array.from(document.querySelectorAll("[data-coverage-item]")).map((el) => ({
      text: norm(el.textContent),
      status: el.getAttribute("data-status"),
    }));
  });

  const supported = rows.find((c) => c.text.includes("z.string()"));
  expect(supported, "z.string() row present").toBeTruthy();
  expect(supported?.status, "z.string() is supported").toBe("supported");

  const unsupported = rows.find((c) => c.text.includes("z.httpUrl()"));
  expect(unsupported, "z.httpUrl() row present").toBeTruthy();
  expect(unsupported?.status, "z.httpUrl() is unsupported").toBe("unsupported");

  expect(errors(), "no console errors on /docs/zod4-schema-coverage").toEqual([]);
});

// ── B132-R2: caveats/notes are surfaced ──────────────────────────────────────

test("B132-R2 / a caveat note is surfaced in the pip-list", async ({ page }) => {
  await settle(page, COVERAGE);

  const notedCount = await page.locator("[data-coverage-notes]").count();
  expect(notedCount, "page surfaces noted rows ([data-coverage-notes])").toBeGreaterThan(0);

  // `.safe()` is a real ⚠️ partial row carrying the note "Handled contextually".
  const notesText = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-coverage-notes]"))
      .map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim())
      .join("\n"),
  );
  expect(notesText, "the .safe() caveat note is surfaced").toContain("Handled contextually");
});

// ── B132-R3: mobile-first — no horizontal overflow at 390px ──────────────────

test("B132-R3 / schema-coverage is mobile-usable at 390px", async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize(MOBILE);
  await settle(page, COVERAGE);

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, "no horizontal overflow at 390px").toBe(clientWidth);

  expect(errors(), "no console errors on /docs/zod4-schema-coverage at 390px").toEqual([]);
});
