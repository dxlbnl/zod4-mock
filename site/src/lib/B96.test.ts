/**
 * B96 — Finish the @dxlbnl/ui migration (static structural invariants).
 *
 * Each test maps to one requirement ID from
 * wiki/specs/B96-site-finish-dxlbnl-layout-migration.md. The migration is
 * behaviour-neutral, so the contract is a set of objectively checkable
 * invariants over the post-migration `site/src/` tree:
 *
 *   B96-R1 — zero `var(--space-*)` references remain.
 *   B96-R2 — zero legacy `.t-*` class applications remain in `.svelte` markup.
 *   B96-R4 — zero reads of the gen-bench legacy alias tokens remain.
 *   B96-R5 — app.css drops the alias block, `.t-*` classes, and dead
 *            `.btn`/`.seg`/`.kbd` component classes, while preserving the
 *            `@layer dxlbnl, site;` declaration + the two @dxlbnl/ui token
 *            imports (D21).
 *
 * Other requirements ride existing nets, not new committed tests:
 *   B96-R3 / B96-R7 — verified by the reviewer + per-page designer pass
 *                     (parse-based "composes a primitive" assertions are
 *                     brittle and intentionally not committed here).
 *   B96-R6 — rides the existing B75 Playwright smoke (`site/e2e/smoke.spec.ts`,
 *            `pnpm site:test:e2e`).
 *   B96-R8 — rides `pnpm validate` / `pnpm site:check` / `pnpm site:test:component`.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SITE_ROOT = join(REPO_ROOT, "site");
const SITE_SRC = join(SITE_ROOT, "src");
const APP_CSS = join(SITE_SRC, "lib", "styles", "app.css");

function readText(absPath: string): string {
  return readFileSync(absPath, "utf8");
}

function walkFiles(dir: string, exts: readonly string[]): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full, exts));
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

// When scanning production sources for banned-string assertions, drop the
// test/story files — otherwise these tests read their own detection literals
// (the banned tokens/class names) and self-collide.
const TEST_OR_STORY_SUFFIXES = [".test.ts", ".test.tsx", ".stories.svelte", ".stories.ts"] as const;

function isTestOrStoryFile(path: string): boolean {
  return TEST_OR_STORY_SUFFIXES.some((s) => path.endsWith(s));
}

function walkProductionFiles(dir: string, exts: readonly string[]): string[] {
  return walkFiles(dir, exts).filter((p) => !isTestOrStoryFile(p));
}

function rel(absPath: string): string {
  return relative(REPO_ROOT, absPath);
}

describe("B96-R1 / no legacy spacing token remains", () => {
  it("no file under site/src references a var(--space-*) token", () => {
    // app.css (the alias source) is included on purpose: R1 forbids the token
    // everywhere, including the stylesheet that currently defines/consumes it.
    const files = walkProductionFiles(SITE_SRC, [".svelte", ".css", ".ts"]);
    const offenders: string[] = [];
    for (const file of files) {
      if (/var\(\s*--space-/.test(readText(file))) {
        offenders.push(rel(file));
      }
    }
    expect(
      offenders,
      `these files still reference var(--space-*): ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});

describe("B96-R2 / no legacy .t-* type class applied in markup", () => {
  it("no .svelte file under site/src applies a t-* class in a class attribute", () => {
    const LEGACY_T_CLASSES = [
      "t-title",
      "t-small",
      "t-caption",
      "t-label",
      "t-large",
      "t-base",
      "t-micro",
      "t-mono",
      "t-num",
    ] as const;

    // Match a class= attribute (static or `class:`-style / `class={...}`) whose
    // value contains one of the legacy names as a whole token. We only scan
    // `.svelte` markup; the app.css *definitions* are R5's concern, not R2's.
    const svelteFiles = walkProductionFiles(SITE_SRC, [".svelte"]);
    const offenders: string[] = [];
    for (const file of svelteFiles) {
      const content = readText(file);
      // Find every class attribute value and test it for a legacy token.
      const classAttrs = content.match(/class(?:Name)?\s*=\s*(?:"[^"]*"|'[^']*'|\{[^}]*\})/g) ?? [];
      for (const attr of classAttrs) {
        for (const cls of LEGACY_T_CLASSES) {
          // word-boundary on both sides so `t-base` does not match `not-base`.
          if (new RegExp(`(?<![\\w-])${cls}(?![\\w-])`).test(attr)) {
            offenders.push(`${rel(file)} → ${attr.trim()}`);
          }
        }
      }
    }
    expect(
      offenders,
      `these .svelte files still apply a legacy t-* class: ${offenders.join(" ; ")}`,
    ).toEqual([]);
  });
});

describe("B96-R4 / no legacy compat-alias token is read", () => {
  it("no file under site/src (outside the app.css alias definitions) reads a legacy alias token via var()", () => {
    const LEGACY_ALIAS_VARS = [
      "--bg-base",
      "--text-primary",
      "--border",
      "--accent",
      "--font-sans",
      "--font-mono",
      "--t-quick",
      "--t-normal",
    ] as const;

    const files = walkProductionFiles(SITE_SRC, [".svelte", ".css", ".ts"]);
    const offenders: string[] = [];
    for (const file of files) {
      // app.css is the alias *definition* site (`--accent: var(--amber)`); R5
      // deletes that block. R4 only forbids *reads* elsewhere — so skip app.css
      // here to avoid double-counting its own definitions.
      if (file === APP_CSS) continue;
      const content = readText(file);
      for (const v of LEGACY_ALIAS_VARS) {
        if (new RegExp(`var\\(\\s*${v}\\s*[),]`).test(content)) {
          offenders.push(`${rel(file)} → var(${v})`);
        }
      }
      // The --syn-* shiki aliases: any var(--syn-…) read is a legacy read.
      if (/var\(\s*--syn-/.test(content)) {
        offenders.push(`${rel(file)} → var(--syn-*)`);
      }
    }
    expect(
      offenders,
      `these files still read a legacy alias token: ${offenders.join(" ; ")}`,
    ).toEqual([]);
  });
});

describe("B96-R5 / app.css drops alias block, .t-* classes, and dead component classes (D21 preserved)", () => {
  it("app.css contains no --space-/alias declarations, no .t-* definitions, no .btn/.seg/.kbd selectors, and still declares @layer dxlbnl, site; first + imports both @dxlbnl/ui token files", () => {
    const appCss = readText(APP_CSS);

    // (a) The legacy compat-alias :root block is gone — no alias declarations.
    const bannedDeclarations = [
      "--space-",
      "--bg-base",
      "--text-primary",
      "--border:",
      "--syn-",
    ] as const;
    for (const decl of bannedDeclarations) {
      expect(appCss.includes(decl), `app.css must not declare ${decl} (legacy compat alias)`).toBe(
        false,
      );
    }

    // (b) The legacy .t-* type-scale class definitions are gone.
    const legacyTypeSelectors = [
      ".t-large",
      ".t-title",
      ".t-base",
      ".t-small",
      ".t-label",
      ".t-caption",
      ".t-micro",
      ".t-mono",
      ".t-num",
    ] as const;
    for (const sel of legacyTypeSelectors) {
      expect(
        new RegExp(`\\${sel}(?![\\w-])`).test(appCss),
        `app.css must not define the legacy type class ${sel}`,
      ).toBe(false);
    }

    // (c) The gen-bench-inherited component classes are gone.
    const deadComponentSelectors = [".btn", ".seg", ".kbd"] as const;
    for (const sel of deadComponentSelectors) {
      expect(
        new RegExp(`\\${sel}(?![\\w-])`).test(appCss),
        `app.css must not define the legacy component class ${sel}`,
      ).toBe(false);
    }

    // (d) D21 preserved: @layer dxlbnl, site; is the first at-rule, and both
    // @dxlbnl/ui token CSS files are still imported.
    const firstAtRule = appCss.match(/@[a-z-]+[^;{]*[;{]/)?.[0] ?? "";
    expect(firstAtRule, "the first at-rule in app.css must be @layer dxlbnl, site;").toMatch(
      /@layer\s+dxlbnl\s*,\s*site\s*;/,
    );
    expect(appCss, "app.css must still import @dxlbnl/ui/tokens/tokens.css").toMatch(
      /@import\s+["'][^"']*@dxlbnl\/ui\/tokens\/tokens\.css["']/,
    );
    expect(appCss, "app.css must still import @dxlbnl/ui/tokens/typography.css").toMatch(
      /@import\s+["'][^"']*@dxlbnl\/ui\/tokens\/typography\.css["']/,
    );
  });
});
