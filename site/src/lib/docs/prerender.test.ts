/**
 * B104 — docs-subtree prerender opt-in unit test
 * (spec: wiki/specs/B104-docs-pagefind-search-ui.md).
 *
 * Covers B104-R1 ("Docs routes prerender so their HTML is indexable"). Pagefind
 * indexes prerendered HTML on disk; adapter-vercel routes every path to a
 * serverless function unless the route opts into prerendering, so the `/docs`
 * subtree MUST set `export const prerender = true`. The cleanest committed check
 * is a source assertion that the docs route subtree carries that flag.
 *
 * This runs in the site unit project (node environment), so reading the route
 * module's source via `node:fs` is test-only and D13-exempt.
 *
 * RED until the implementer adds `export const prerender = true` to a docs route
 * boundary module (e.g. site/src/routes/docs/+layout.ts, which does not exist
 * today) — no docs route currently opts into prerendering.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROUTES_DOCS = fileURLToPath(new URL("../../routes/docs/", import.meta.url));

// A `prerender = true` export anywhere on the docs route boundary opts the whole
// subtree in. The boundary module is conventionally the subtree layout; accept any
// of the standard SvelteKit boundary files so the implementer keeps freedom over
// which one carries the flag.
const BOUNDARY_CANDIDATES = ["+layout.ts", "+layout.server.ts", "+page.ts", "+page.server.ts"];

const PRERENDER_TRUE = /export\s+const\s+prerender\s*(?::[^=]+)?=\s*true/;

describe("B104-R1 / docs subtree opts into prerendering", () => {
  it("a docs route boundary module exports `prerender = true`", () => {
    const found = BOUNDARY_CANDIDATES.map((name) => `${ROUTES_DOCS}${name}`).filter((path) =>
      existsSync(path),
    );

    expect(
      found.length,
      `no docs route boundary module exists under ${ROUTES_DOCS} (expected one of ${BOUNDARY_CANDIDATES.join(", ")} to export prerender)`,
    ).toBeGreaterThan(0);

    const opted = found.some((path) => PRERENDER_TRUE.test(readFileSync(path, "utf8")));
    expect(
      opted,
      `none of ${found.join(", ")} export \`prerender = true\` — Pagefind cannot index SSR-only docs output`,
    ).toBe(true);
  });
});
