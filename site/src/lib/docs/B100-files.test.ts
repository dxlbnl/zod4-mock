/**
 * B100 — file-presence and structural assertions.
 *
 * Each test maps to one requirement ID from
 * wiki/specs/B100-docs-primitive-library-chrome-landing.md.
 *
 * D13 carve-out: shipped runtime code MUST NOT use `node:*`. Tests are
 * exempt (the rule explicitly exempts tests + build scripts). This file
 * uses `node:fs` to assert deletions, route stubs, layout markup, and ADR
 * text — all checks that don't need a browser runtime.
 *
 * Note on B100-R12: this test asserts the ADR text in wiki/decisions.md
 * (which the implementer writes). The companion one-line Rule in
 * wiki/architecture.md is added by the manager at item-close time; we do
 * not assert that here so we don't tie the implementer's red→green
 * transition to a manager-owned step.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const SITE_ROOT = join(REPO_ROOT, "site");
const SITE_SRC = join(SITE_ROOT, "src");
const WIKI = join(REPO_ROOT, "wiki");

function readText(absPath: string): string {
  return readFileSync(absPath, "utf8");
}

describe("B100-R10 / layout consumes typed sidebar manifest (no legacy `nav` array)", () => {
  it("site/src/routes/docs/+layout.svelte imports SIDEBAR from $lib/docs/sidebar and contains no `const nav = [` literal", () => {
    const layoutPath = join(SITE_SRC, "routes", "docs", "+layout.svelte");
    expect(existsSync(layoutPath), "site/src/routes/docs/+layout.svelte must exist").toBe(true);
    const layout = readText(layoutPath);

    // The layout must consume the typed manifest.
    expect(
      /from\s+["']\$lib\/docs\/sidebar(?:\.js)?["']/.test(layout) ||
        /from\s+["']\$lib\/docs\/sidebar\.ts["']/.test(layout),
      "+layout.svelte must import from $lib/docs/sidebar",
    ).toBe(true);
    expect(/\bSIDEBAR\b/.test(layout), "+layout.svelte must reference the SIDEBAR export").toBe(
      true,
    );

    // The legacy hand-rolled `const nav = [` literal must be gone.
    expect(
      layout.includes("const nav = ["),
      "+layout.svelte must not contain `const nav = [` (legacy nav literal removed)",
    ).toBe(false);
  });
});

describe("B100-R11 / `/docs` landing replaces the 307 redirect", () => {
  it("site/src/routes/docs/+page.ts is gone and site/src/routes/docs/+page.svelte renders a card-grid landing", () => {
    expect(
      existsSync(join(SITE_SRC, "routes", "docs", "+page.ts")),
      "site/src/routes/docs/+page.ts must be deleted (no more 307 redirect)",
    ).toBe(false);

    const landing = join(SITE_SRC, "routes", "docs", "+page.svelte");
    expect(existsSync(landing), "site/src/routes/docs/+page.svelte must exist").toBe(true);

    const src = readText(landing);
    // Landing is a <DocPage> wrapping cards for the four SIDEBAR groups.
    expect(/DocPage/.test(src), "+page.svelte must render a <DocPage>").toBe(true);
    expect(
      /SIDEBAR/.test(src),
      "+page.svelte must consume the SIDEBAR manifest to render the card-grid",
    ).toBe(true);
  });
});

describe("B100-R12 / D18 successor ADR landed in wiki/decisions.md", () => {
  it("wiki/decisions.md carries an ADR entry naming <Playground> as the reference implementation, with the SSR-safe editor mounting rule and a note that D18 (original) still applies to mdsvex routes", () => {
    const decisions = readText(join(WIKI, "decisions.md"));

    // The normative rule text appears verbatim inside the entry.
    expect(
      decisions.includes("Any docs primitive that mounts an editor"),
      "wiki/decisions.md must contain the D18 successor rule text",
    ).toBe(true);

    // The entry follows the ADR shape (## D<n>: heading + Decision + Rule added/changed).
    // Slice the file from the matching rule text back to the nearest preceding `## D` heading
    // so we don't accidentally match an earlier entry.
    const ruleIdx = decisions.indexOf("Any docs primitive that mounts an editor");
    expect(ruleIdx).toBeGreaterThan(-1);
    const headerIdx = decisions.lastIndexOf("\n## D", ruleIdx);
    expect(
      headerIdx,
      "the rule text must live inside an ADR entry headed `## D<n>:`",
    ).toBeGreaterThan(-1);
    const adrEntry = decisions.slice(headerIdx);

    expect(/\n## D\d+:/.test(adrEntry.slice(0, 40))).toBe(true);
    expect(adrEntry).toMatch(/\*\*Decision\*\*/);
    expect(adrEntry).toMatch(/\*\*Rule added\/changed\*\*/);
    expect(
      adrEntry.includes("Playground"),
      "the ADR must name `<Playground>` as the reference implementation",
    ).toBe(true);
    expect(
      /mdsvex|\+page\.md/.test(adrEntry),
      "the ADR must note D18 (original) still applies to mdsvex / +page.md routes",
    ).toBe(true);
  });
});

describe("B100-R13 / stub routes exist for every not-yet-rebuilt doc page", () => {
  it("each of the four remaining stub routes ships a +page.svelte that references DocPage and points at the listed canonical docs/<file>.md", () => {
    // B102 rebuilt /docs/api into the structured, manifest-driven view, so it is
    // no longer a stub and no longer carries a canonical link to docs/api-reference.md.
    // It is intentionally absent from this not-yet-rebuilt list.
    // B103 rebuilt /docs/key-heuristics, /docs/recipes, and /docs/zod4-schema-coverage
    // onto the B100 primitives (prose ported verbatim from the matching docs/*.md), so
    // they are no longer link-only stubs and are dropped from this list. (B118 later
    // removed the /docs/bugs route entirely.)
    const stubs: ReadonlyArray<{ route: string; canonical: string }> = [
      { route: "concepts", canonical: "docs/concepts.md" },
      { route: "getting-started", canonical: "docs/getting-started.md" },
      { route: "relational", canonical: "docs/api-reference.md#relations" },
      { route: "comparison", canonical: "docs/api-reference.md" },
    ];

    for (const { route, canonical } of stubs) {
      const path = join(SITE_SRC, "routes", "docs", route, "+page.svelte");
      expect(existsSync(path), `site/src/routes/docs/${route}/+page.svelte must exist`).toBe(true);

      const src = readText(path);
      expect(/DocPage/.test(src), `${route}/+page.svelte must render a <DocPage>`).toBe(true);
      expect(
        src.includes(canonical),
        `${route}/+page.svelte must include a canonical link to ${canonical}`,
      ).toBe(true);
    }
  });
});

describe("B100-R14 / mdsvex glob page + content/docs sources deleted", () => {
  it("site/src/routes/docs/[slug]/* and site/content/docs/*.md are removed", () => {
    const mustNotExist = [
      join(SITE_SRC, "routes", "docs", "[slug]", "+page.svelte"),
      join(SITE_SRC, "routes", "docs", "[slug]", "+page.ts"),
      join(SITE_ROOT, "content", "docs", "api.md"),
      join(SITE_ROOT, "content", "docs", "comparison.md"),
      join(SITE_ROOT, "content", "docs", "getting-started.md"),
      join(SITE_ROOT, "content", "docs", "relational.md"),
    ];
    for (const path of mustNotExist) {
      expect(existsSync(path), `${path} must be deleted`).toBe(false);
    }
  });
});

describe("B100-R15 / Pagefind data attributes primed on chrome + prose container", () => {
  it("site/src/routes/docs/+layout.svelte applies data-pagefind-ignore to its <aside> chrome", () => {
    const layoutPath = join(SITE_SRC, "routes", "docs", "+layout.svelte");
    expect(existsSync(layoutPath), "site/src/routes/docs/+layout.svelte must exist").toBe(true);
    const layout = readText(layoutPath);

    // The <aside> sidebar carries data-pagefind-ignore so B104 search doesn't index nav.
    expect(
      /<aside\b[^>]*\bdata-pagefind-ignore\b/.test(layout),
      "+layout.svelte's <aside> must carry data-pagefind-ignore",
    ).toBe(true);
  });
});
