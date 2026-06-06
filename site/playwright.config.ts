import { defineConfig, devices } from "@playwright/test";

/**
 * B75 — Playwright smoke-suite config (spec: wiki/specs/B75-site-playwright-smoke.md).
 *
 * A dedicated `@playwright/test` project, separate from the vitest browser-mode
 * Storybook runner in `vite.config.ts` (R6 isolation). `testDir: "e2e"` is what keeps
 * the smoke specs outside the vitest globs (`src/**`, `*.stories.*`), so
 * `pnpm site:test:unit` / `pnpm site:test:component` never collect them and this runner
 * never collects a Storybook test.
 *
 * `webServer` builds and serves the production app (R4: no manual server start), so the
 * smoke suite exercises the same SSR + prerendered output that ships and catches
 * SSR-only faults (a `window`-at-module-load regression `vite dev` would mask). The
 * build runs inside the server command, hence the generous timeout.
 */

// vite preview default; distinct from `vite dev` (5173) so the two don't collide.
const PORT = 4173;

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    // The production build runs here, so allow ample startup time.
    timeout: 180_000,
  },
});
