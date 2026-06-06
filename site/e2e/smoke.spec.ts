import { type Page, expect, test } from "@playwright/test";

/**
 * B75 — Page-navigation smoke suite (spec: wiki/specs/B75-site-playwright-smoke.md).
 *
 * Loads every shipped route in a real browser (served by the Playwright `webServer`)
 * and fails the route's test when it emits a `console.error` or a `pageerror`
 * (uncaught exception / unhandled promise rejection) during load. This is a smoke
 * suite, not a functional one: it asserts "the route loads without runtime errors",
 * not feature behaviour.
 *
 * R7 (provable red-state) — this suite is only meaningful if it can go red. To verify
 * the error-collection path locally, temporarily add `console.error('boom')` (or
 * `throw new Error('boom')`) to any route's `+page.svelte`/`onMount`, run the suite,
 * and observe a non-zero exit with the failure attributed to that route; then revert.
 * Do NOT commit such a fault — it is a manual verification aid only.
 */

/**
 * R1/R8 — the explicit route table is the contract for "which routes are smoke-tested".
 * Every navigable top-level `+page.svelte` route under `site/src/routes/` lives here;
 * a newly shipped route MUST be added so it is not silently left un-smoke-tested
 * (R8 drift-guard policy: this maintained constant is the single place to update).
 */
export const ROUTE_TABLE = [
  "/",
  "/bench",
  "/showcase",
  "/comparison",
  "/explorer",
  "/docs",
  "/docs/getting-started",
  // B101-R9 — the rebuilt Concepts page joins the smoke route table so it is
  // guarded against load-time console.error / pageerror / SSR-500 regressions.
  "/docs/concepts",
  // B102-R4 — the rebuilt structured /docs/api view joins the smoke route table so it
  // is guarded against load-time console.error / pageerror / SSR-500 regressions.
  "/docs/api",
] as const;

/**
 * Attach `console` (error-level only) and `pageerror` listeners BEFORE navigation so
 * transient load-time signals are captured (R2/R3/R5). Returns the live collections.
 */
function collectRuntimeErrors(page: Page): {
  consoleErrors: string[];
  pageErrors: string[];
} {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  // `pageerror` fires for uncaught exceptions AND unhandled promise rejections (R3).
  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  return { consoleErrors, pageErrors };
}

for (const route of ROUTE_TABLE) {
  test(route, async ({ page }) => {
    // R2/R3: listeners must be attached before goto to catch load-time errors.
    const { consoleErrors, pageErrors } = collectRuntimeErrors(page);

    await page.goto(route);

    // R5: wait for a defined settle state so a still-loading page is not asserted
    // clean and errors firing mid-hydration are still captured before assertion.
    await page.waitForLoadState("networkidle");

    // R1 scenario 2 (UI): one representative route proves the page rendered content
    // (visible, non-empty body text) — it did not blank-screen.
    if (route === "/") {
      await expect(page.locator("body")).not.toBeEmpty();
      const bodyText = (await page.locator("body").innerText()).trim();
      expect(bodyText.length).toBeGreaterThan(0);
    }

    // R2: no console error during load. R3: no unhandled rejection / pageerror.
    // Failure messages include the route path and the captured error text.
    expect(consoleErrors, `console errors on ${route}: ${consoleErrors.join(" | ")}`).toEqual([]);
    expect(
      pageErrors,
      `pageerror / unhandled rejections on ${route}: ${pageErrors.join(" | ")}`,
    ).toEqual([]);
  });
}
