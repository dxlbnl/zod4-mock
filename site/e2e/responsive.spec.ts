import { type Page, expect, test } from "@playwright/test";

/**
 * B114 — Site responsive / mobile-first pass + fluid docs reading width
 * (spec: wiki/specs/B114-site-responsive-mobile-first.md).
 *
 * One Playwright test per requirement ID (B114-R1 .. B114-R7), named
 * `B114-R<k> / <scenario>`, asserting the observable THEN by role / text /
 * bounding-box (never pixel screenshots — see .claude/practices/browser-testing.md
 * and accessibility.md). Runs against the production build served by the
 * Playwright `webServer` (playwright.config.ts: `pnpm build && pnpm preview`),
 * settling at `networkidle` like the B75 smoke suite so hydration-mounted
 * widgets (the DocPage "On this page" rail derived in onMount, CodeMirror, the
 * <Nav> drawer) are present before assertion.
 *
 * Named viewports (from the spec's Breakpoints table):
 *   mobile  390 × 844   (≤767 — also the <Nav> hamburger boundary)
 *   tablet  768 × 1024
 *   desktop 1440 × 900  (≥1024)
 *
 * RED expectation: none of these responsive behaviours exist yet. The docs
 * `+layout.svelte` `.docs-layout` grid is a fixed `220px 1fr` two-column that
 * does NOT reflow; DocPage's `.doc-grid` is `minmax(0,1fr) 200px` collapsing to
 * one column only below 720px (not a <details> TOC); the section sidebar never
 * becomes a <details>; and the prose track measures ~420px at 1440 (far below
 * the 600–760px comfortable band). Each assertion below therefore fails because
 * the responsive reflow / wider prose / <details> sidebar+TOC are absent. That
 * is the correct red. R8 is NOT a separate test — it rides the existing suites
 * staying green under `pnpm site:test:e2e`.
 */

const MOBILE = { width: 390, height: 844 } as const;
const TABLET = { width: 768, height: 1024 } as const;
// B114 three-step reflow: the right "On this page" TOC rail returns at ≥1024.
// DESKTOP_MIN is the smallest desktop width (the 3-column threshold); DESKTOP is
// the wide reference viewport used by the original B114-R3/R5 scenarios.
const DESKTOP_MIN = { width: 1024, height: 900 } as const;
const DESKTOP = { width: 1440, height: 900 } as const;

const GETTING_STARTED = "/docs/getting-started";
const CONCEPTS = "/docs/concepts";
const API = "/docs/api";

async function settle(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await page.waitForLoadState("networkidle");
}

// ── B114-R1: single readable column on mobile, TOC collapses below ──────────

test("B114-R1 / docs page single-column on mobile", async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await settle(page, GETTING_STARTED);

  // The Container's inner content width — the prose body must span (near) all of it.
  // We compare the prose body width to the width of the docs content column wrapper
  // it lives in, which on mobile should be ~full content width (not a 1fr track beside
  // a 200px rail).
  const prose = page.locator(".doc-prose-body");
  await expect(prose).toBeVisible();
  const proseBox = await prose.boundingBox();
  expect(proseBox).not.toBeNull();

  // The grid that carves content + rail. On a single-column mobile reflow the prose
  // should fill (within 24px) the width of that grid container.
  const grid = page.locator(".doc-grid");
  const gridBox = await grid.boundingBox();
  expect(gridBox).not.toBeNull();
  expect(Math.abs(gridBox!.width - proseBox!.width)).toBeLessThanOrEqual(24);

  // The docs section sidebar must NOT be a left column beside the content: its right
  // edge is at or left of the prose's left edge (or it has been pulled into the R2
  // disclosure, in which case it still must not sit as a left column).
  const sidebar = page.locator('aside[aria-label="Documentation navigation"]');
  const sidebarBox = await sidebar.boundingBox();
  expect(sidebarBox).not.toBeNull();
  expect(sidebarBox!.x + sidebarBox!.width).toBeLessThanOrEqual(proseBox!.x + 1);
});

test("B114-R1 / TOC is a collapsed disclosure below the content on mobile", async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await settle(page, GETTING_STARTED);

  const prose = page.locator(".doc-prose-body");
  const proseBox = await prose.boundingBox();
  expect(proseBox).not.toBeNull();

  const toc = page.locator('aside[aria-label="On this page"]');
  const tocBox = await toc.boundingBox();
  expect(tocBox).not.toBeNull();

  // Positioned BELOW the prose, never beside it as a right column.
  expect(tocBox!.y).toBeGreaterThan(proseBox!.y);

  // Rendered as a collapsed <details>: a <summary> is present, and the disclosure is
  // not open by default (the link list has no visible bounding box).
  const details = toc.locator("details").first();
  await expect(details).toHaveCount(1);
  await expect(details.locator("summary").first()).toBeVisible();
  await expect(details).not.toHaveAttribute("open", /.*/);

  // Activating the summary reveals the TOC links: an in-page #-anchor link gains a
  // non-zero bounding box.
  await details.locator("summary").first().click();
  const anchor = toc.locator('a[href^="#"]').first();
  await expect(anchor).toBeVisible();
  const anchorBox = await anchor.boundingBox();
  expect(anchorBox).not.toBeNull();
  expect(anchorBox!.width).toBeGreaterThan(0);
  expect(anchorBox!.height).toBeGreaterThan(0);
});

// ── B114-R2: sidebar is a <details> disclosure at the top on mobile ─────────

test("B114-R2 / sidebar is a collapsed disclosure at the top of the content on mobile", async ({
  page,
}) => {
  await page.setViewportSize(MOBILE);
  await settle(page, CONCEPTS);

  const prose = page.locator(".doc-prose-body");
  const proseBox = await prose.boundingBox();
  expect(proseBox).not.toBeNull();

  // The docs section navigation MUST be wrapped in a collapsed <details> disclosure —
  // the distinguishing feature versus today's always-present left-column <aside>. Scope
  // the disclosure to the one that actually owns the docs-navigation region so the
  // site-nav hamburger drawer (a separate <details summary="≡"> from @dxlbnl/ui <Nav>)
  // cannot satisfy this. `navDetails` is the <details> that contains the docs aside.
  const nav = page.locator('aside[aria-label="Documentation navigation"]');
  const navDetails = page
    .locator("details", { has: page.locator('aside[aria-label="Documentation navigation"]') })
    .first();
  await expect(navDetails).toHaveCount(1);

  // The disclosure (its <details>/<summary>) sits ABOVE the prose content.
  const navBox = await navDetails.boundingBox();
  expect(navBox).not.toBeNull();
  expect(navBox!.y).toBeLessThanOrEqual(proseBox!.y);

  // Collapsed by default with a visible <summary> control; the SIDEBAR links are
  // collapsed (no visible box) until the summary is activated.
  const summary = navDetails.locator("summary").first();
  await expect(summary).toBeVisible();
  await expect(navDetails).not.toHaveAttribute("open", /.*/);
  await expect(nav.getByRole("link", { name: "Getting Started" })).toBeHidden();

  // Activating the single summary reveals the docs nav links: the Getting Started
  // sidebar link then has a non-zero bounding box.
  await summary.click();
  const navLink = nav.getByRole("link", { name: "Getting Started" }).first();
  await expect(navLink).toBeVisible();
  const linkBox = await navLink.boundingBox();
  expect(linkBox).not.toBeNull();
  expect(linkBox!.width).toBeGreaterThan(0);
  expect(linkBox!.height).toBeGreaterThan(0);
});

// ── B114-R3: columns return at tablet and desktop ──────────────────────────

test("B114-R3 / three columns at desktop", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await settle(page, GETTING_STARTED);

  const prose = page.locator(".doc-prose-body");
  const proseBox = await prose.boundingBox();
  expect(proseBox).not.toBeNull();

  // Sidebar is a left column: its right edge is at or left of the prose's left edge.
  const sidebar = page.locator('aside[aria-label="Documentation navigation"]');
  const sidebarBox = await sidebar.boundingBox();
  expect(sidebarBox).not.toBeNull();
  expect(sidebarBox!.x + sidebarBox!.width).toBeLessThanOrEqual(proseBox!.x);

  // "On this page" rail is a right column: its left edge is at or right of the prose's
  // right edge (1px tolerance).
  const toc = page.locator('aside[aria-label="On this page"]');
  const tocBox = await toc.boundingBox();
  expect(tocBox).not.toBeNull();
  expect(tocBox!.x).toBeGreaterThanOrEqual(proseBox!.x + proseBox!.width - 1);
});

test("B114-R3 / sidebar is a column at tablet", async ({ page }) => {
  await page.setViewportSize(TABLET);
  await settle(page, CONCEPTS);

  const prose = page.locator(".doc-prose-body");
  const proseBox = await prose.boundingBox();
  expect(proseBox).not.toBeNull();

  // The mobile single-column reflow is no longer in effect: sidebar sits left of content.
  const sidebar = page.locator('aside[aria-label="Documentation navigation"]');
  const sidebarBox = await sidebar.boundingBox();
  expect(sidebarBox).not.toBeNull();
  expect(sidebarBox!.x + sidebarBox!.width).toBeLessThanOrEqual(proseBox!.x);
});

// ── B114-R3 (tablet regression) — three-step reflow: at 768 the section sidebar
//    returns as a column but the right TOC rail must NOT (it stays collapsed-below
//    so the prose track is readable). Guards the tablet gap where bringing back both
//    sidebar AND TOC rail crushed the prose to ~165px. ─────────────────────────────

test("B114-R3 / tablet keeps prose readable with TOC collapsed-below (no right rail)", async ({
  page,
}) => {
  await page.setViewportSize(TABLET);
  await settle(page, CONCEPTS);

  const prose = page.locator(".doc-prose-body");
  const proseBox = await prose.boundingBox();
  expect(proseBox).not.toBeNull();

  // The prose track is readable at tablet — not crushed to a sliver by a second
  // 200px TOC rail competing with the section sidebar. A sane minimum: ≥480px.
  expect(proseBox!.width).toBeGreaterThanOrEqual(480);

  // The "On this page" TOC is NOT a right-hand side rail at tablet: it sits BELOW
  // the prose content as the collapsed <details> disclosure, not beside it.
  const toc = page.locator('aside[aria-label="On this page"]');
  const tocBox = await toc.boundingBox();
  expect(tocBox).not.toBeNull();
  expect(tocBox!.y).toBeGreaterThan(proseBox!.y);
  // Collapsed-below: the disclosure is not open by default (a user-toggleable
  // <details>), so its link list has no laid-out side-rail box.
  const details = toc.locator("details").first();
  await expect(details).toHaveCount(1);
  await expect(details).not.toHaveAttribute("open", /.*/);
});

// ── B114-R3 (desktop 1024 regression) — the full three-column layout returns at
//    the ≥1024 threshold: the TOC rail is present as a right column AND its links
//    are role-exposed (genuinely `open` <details>, not merely CSS-visible). ────────

test("B114-R3 / three columns return at desktop 1024", async ({ page }) => {
  await page.setViewportSize(DESKTOP_MIN);
  await settle(page, GETTING_STARTED);

  const prose = page.locator(".doc-prose-body");
  const proseBox = await prose.boundingBox();
  expect(proseBox).not.toBeNull();

  // Sidebar is a left column.
  const sidebar = page.locator('aside[aria-label="Documentation navigation"]');
  const sidebarBox = await sidebar.boundingBox();
  expect(sidebarBox).not.toBeNull();
  expect(sidebarBox!.x + sidebarBox!.width).toBeLessThanOrEqual(proseBox!.x);

  // "On this page" rail is back as a right column at ≥1024.
  const toc = page.locator('aside[aria-label="On this page"]');
  const tocBox = await toc.boundingBox();
  expect(tocBox).not.toBeNull();
  expect(tocBox!.x).toBeGreaterThanOrEqual(proseBox!.x + proseBox!.width - 1);

  // The TOC links are role-exposed (a closed <details> drops descendants from the
  // a11y tree even when CSS shows them — the rail must be genuinely `open` at ≥1024).
  await expect(toc.getByRole("link").first()).toBeVisible();
});

test("B114-R2/R3 a11y / desktop section-sidebar nav links are role-exposed", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await settle(page, GETTING_STARTED);

  // A closed <details> drops its descendants from the accessibility tree even
  // when CSS forces them visible. On desktop the section sidebar's <details>
  // must be genuinely `open` so its links are role-exposed (not merely visible).
  const nav = page.locator('aside[aria-label="Documentation navigation"]');
  await expect(nav.getByRole("link", { name: "Getting Started" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Concepts" })).toBeVisible();
});

// ── B114-R4: site top nav usable, no overflow on mobile ─────────────────────

test("B114-R4 / nav collapses, no horizontal overflow on mobile", async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await settle(page, "/");

  // No horizontal page scrollbar from the header.
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(MOBILE.width + 1);

  // A hamburger / menu-toggle control is visible in the header (the <Nav> drawer
  // trigger), exposed by accessible name (role=button named menu/navigation).
  const header = page.locator(".site-header");
  const toggle = header
    .getByRole("button", { name: /menu|navigation|open|toggle/i })
    .or(header.locator('button[aria-expanded], button[aria-label*="menu" i]'))
    .first();
  await expect(toggle).toBeVisible();

  // The full inline desktop link list is not laid out across the header row: the "Docs"
  // link is not a visible inline header link on mobile (it lives inside the drawer).
  const inlineDocs = header.getByRole("link", { name: "Docs" });
  await expect(inlineDocs).toBeHidden();
});

test("B114-R4 / desktop nav shows inline links", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await settle(page, "/");

  // The top nav presents its links inline: a "Docs" link is visible in the header
  // without opening a drawer.
  const header = page.locator(".site-header");
  await expect(header.getByRole("link", { name: "Docs" })).toBeVisible();
});

// ── B114-R5: comfortable desktop prose width, TOC + tables don't wrap ───────

test("B114-R5 / prose reading width is in the comfortable band on desktop", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await settle(page, CONCEPTS);

  const prose = page.locator(".doc-prose-body");
  const proseBox = await prose.boundingBox();
  expect(proseBox).not.toBeNull();

  // Comfortable band: 600–760px (≈65–75ch at 16px, 720px target inside it), and at
  // least 150px wider than today's ~420px.
  expect(proseBox!.width).toBeGreaterThanOrEqual(600);
  expect(proseBox!.width).toBeLessThanOrEqual(760);

  // Concepts "Options" <table>: readable, not squeezed. The page must not overflow,
  // and the first body cell (the option-name <code>) renders on a single line — a
  // short option name like `seed` is not broken mid-identifier across two lines.
  const optionsTable = page
    .locator("table", { has: page.getByRole("columnheader", { name: /Option/i }) })
    .first();
  await expect(optionsTable).toBeVisible();

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(DESKTOP.width + 1);

  const seedCell = optionsTable.locator("tbody tr").first().locator("td code").first();
  await expect(seedCell).toHaveText("seed");
  const seedMetrics = await seedCell.evaluate((el) => {
    const cs = getComputedStyle(el);
    const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
    return { height: el.getBoundingClientRect().height, lineHeight };
  });
  // A single text line: rendered height within ~1.6× the line-height (no wrap).
  expect(seedMetrics.height).toBeLessThanOrEqual(seedMetrics.lineHeight * 1.6);
});

test("B114-R5 / TOC entries do not wrap on desktop", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await settle(page, GETTING_STARTED);

  const tocLinks = page.locator('aside[aria-label="On this page"] a');
  const count = await tocLinks.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const link = tocLinks.nth(i);
    const metrics = await link.evaluate((el) => {
      const cs = getComputedStyle(el);
      const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
      return { height: el.getBoundingClientRect().height, lineHeight };
    });
    // Each TOC entry renders on a single line: height ≤ 1.6× its line-height.
    expect(metrics.height).toBeLessThanOrEqual(metrics.lineHeight * 1.6);
  }
});

// ── B114-R6: no horizontal page overflow at any named breakpoint ────────────

test("B114-R6 / no page-level horizontal overflow across breakpoints", async ({ page }) => {
  for (const route of [CONCEPTS, API]) {
    for (const vp of [MOBILE, TABLET, DESKTOP]) {
      await page.setViewportSize(vp);
      await settle(page, route);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth, `${route} @ ${vp.width}×${vp.height}`).toBeLessThanOrEqual(vp.width + 1);
    }
  }
});

// ── B114-R7: the `/` funnel still holds above the fold (D19) ────────────────

test("B114-R7 / funnel intact on mobile", async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await settle(page, "/");

  // Install CTA (to /docs/getting-started) visible.
  await expect(
    page.getByRole("link", { name: "Install" }).and(page.locator('[href="/docs/getting-started"]')),
  ).toBeVisible();

  // Relational-proof exhibit: the heading and at least one highlighted proof ID row.
  await expect(
    page.getByRole("heading", { name: /Cross-entity consistency, out of the box/i }),
  ).toBeVisible();
  await expect(page.locator(".proof-id").first()).toBeVisible();

  // No horizontal page overflow at mobile.
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(MOBILE.width + 1);
});

test("B114-R7 / funnel intact on desktop", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await settle(page, "/");

  await expect(
    page.getByRole("link", { name: "Install" }).and(page.locator('[href="/docs/getting-started"]')),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Cross-entity consistency, out of the box/i }),
  ).toBeVisible();
  await expect(page.locator(".proof-id").first()).toBeVisible();
});
