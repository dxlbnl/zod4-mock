/**
 * B95 — Site foundation on @dxlbnl/ui (structural tests).
 *
 * Each test maps to one requirement ID from
 * wiki/specs/B95-site-foundation-on-dxlbnl-ui.md. UI/runtime scenarios
 * (R3 palette flip, R4 nav rendering, R5 hero rendering) live in the
 * Storybook play-test stories under this directory.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SITE_ROOT = join(REPO_ROOT, "site");
const SITE_SRC = join(SITE_ROOT, "src");

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

// When scanning *production* sources for banned-string assertions, drop
// test/story files — otherwise these tests read their own detection literals
// (the banned strings) and self-collide. R9 still uses the raw walker to
// *find* the retained story files under widgets/.
const TEST_OR_STORY_SUFFIXES = [".test.ts", ".test.tsx", ".stories.svelte", ".stories.ts"] as const;

function isTestOrStoryFile(path: string): boolean {
  return TEST_OR_STORY_SUFFIXES.some((s) => path.endsWith(s));
}

function walkProductionFiles(dir: string, exts: readonly string[]): string[] {
  return walkFiles(dir, exts).filter((p) => !isTestOrStoryFile(p));
}

describe("B95-R1 / @dxlbnl/ui declared in site dependencies", () => {
  it("site/package.json lists @dxlbnl/ui at ^1.1.1 (or a 1.x range satisfying >=1.1.1 <2)", () => {
    const pkg = JSON.parse(readText(join(SITE_ROOT, "package.json"))) as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies).toBeDefined();
    const range = pkg.dependencies?.["@dxlbnl/ui"];
    expect(range, "expected dependencies['@dxlbnl/ui'] to be declared").toBeDefined();
    // Accept any 1.x caret range satisfying >=1.1.1 <2.
    expect(range).toMatch(/^\^1\.(?:[1-9]\d*|[1-9]\d*\.\d+)/);
  });
});

describe("B95-R2 / token migration: library tokens + identity colours + rung tokens", () => {
  it("legacy tokens.css is gone, app.css imports library tokens then identity.css, identity.css defines the three identity colours and the seven dormant rung tokens", () => {
    // Legacy token file deleted.
    expect(
      existsSync(join(SITE_SRC, "lib", "styles", "tokens.css")),
      "site/src/lib/styles/tokens.css must be deleted",
    ).toBe(false);

    // No source file still imports it.
    const srcFiles = walkProductionFiles(SITE_SRC, [".css", ".svelte", ".ts"]);
    for (const file of srcFiles) {
      const content = readText(file);
      expect(
        content.includes("styles/tokens.css") || content.includes("./tokens.css"),
        `${file} must not import the legacy styles/tokens.css`,
      ).toBe(false);
    }

    // app.css imports library tokens + typography, then identity.css.
    const appCssPath = join(SITE_SRC, "lib", "styles", "app.css");
    const appCss = readText(appCssPath);
    const tokensImports =
      appCss.match(/@import\s+["'][^"']*@dxlbnl\/ui\/tokens\/tokens\.css["']/g) ?? [];
    const typeImports =
      appCss.match(/@import\s+["'][^"']*@dxlbnl\/ui\/tokens\/typography\.css["']/g) ?? [];
    expect(
      tokensImports.length,
      "app.css must @import @dxlbnl/ui/tokens/tokens.css exactly once",
    ).toBe(1);
    expect(
      typeImports.length,
      "app.css must @import @dxlbnl/ui/tokens/typography.css exactly once",
    ).toBe(1);
    expect(appCss, "app.css must @import ./identity.css").toMatch(
      /@import\s+["']\.\/identity\.css["']/,
    );
    // identity.css must be imported after the library tokens.
    const tokensIdx = appCss.search(/@dxlbnl\/ui\/tokens\/tokens\.css/);
    const identityIdx = appCss.search(/\.\/identity\.css/);
    expect(identityIdx).toBeGreaterThan(tokensIdx);

    // identity.css present with the three identity colours.
    const identityPath = join(SITE_SRC, "lib", "styles", "identity.css");
    expect(existsSync(identityPath), "site/src/lib/styles/identity.css must exist").toBe(true);
    const identity = readText(identityPath);
    expect(identity).toMatch(/--lib-zod4mock\s*:\s*#a78bfa/i);
    expect(identity).toMatch(/--lib-zodmock\s*:\s*#fbbf24/i);
    expect(identity).toMatch(/--lib-faker\s*:\s*#34d399/i);

    // Dormant resolution-rung tokens reserved for B90.
    expect(identity).toMatch(/Resolution rungs/);
    expect(identity).toMatch(/reserved for B90/i);
    for (const rung of [
      "--rung-matcher",
      "--rung-keymap",
      "--rung-key-based",
      "--rung-schema-based",
      "--rung-override",
      "--rung-default",
      "--rung-absent",
    ]) {
      expect(identity, `identity.css must declare ${rung}`).toMatch(new RegExp(`${rung}\\s*:`));
    }
    // No site/src file consumes any --rung-* token yet.
    for (const file of srcFiles) {
      const content = readText(file);
      expect(
        /var\(\s*--rung-[a-z-]+\s*[),]/.test(content),
        `${file} must not yet consume any --rung-* token`,
      ).toBe(false);
    }
  });
});

describe("B95-R3 / Phosphor default, Paper palette switchable (no html.light selector)", () => {
  it("no .css file under site/src contains a html.light selector", () => {
    const cssFiles = walkProductionFiles(join(SITE_SRC), [".css"]);
    for (const file of cssFiles) {
      const content = readText(file);
      expect(
        /html\.light\b/.test(content),
        `${file} must not contain a html.light selector (palette switch is data-palette only)`,
      ).toBe(false);
    }
  });
});

describe("B95-R6 / legacy primitives swapped, domain widgets live under widgets/", () => {
  it("no source imports the legacy primitives; widgets/ holds the relocated domain widgets; no source imports the old components/ paths", () => {
    const widgetsDir = join(SITE_SRC, "lib", "widgets");
    expect(existsSync(widgetsDir), "site/src/lib/widgets/ must exist").toBe(true);

    const requiredWidgets = [
      "BenchChart.svelte",
      "MetricBadge.svelte",
      "WinnerCallout.svelte",
      "LibraryLegend.svelte",
      "JsonTree.svelte",
      "RelationCallout.svelte",
      "CodePanel.svelte",
      "Editor.svelte",
      "SchemaPlayground.svelte",
      "CodeBlock.svelte",
      "RangeSlider.svelte",
      "SegmentedControl.svelte",
    ];
    const presentWidgets = new Set(
      walkFiles(widgetsDir, [".svelte"]).map((p) => p.split("/").pop()!),
    );
    for (const w of requiredWidgets) {
      expect(presentWidgets.has(w), `expected site/src/lib/widgets/${w} to exist`).toBe(true);
    }
    // The extracted FeatureMatrix cell renderer also moves here.
    const hasCell = [...presentWidgets].some((n) => /FeatureMatrix.*Cell\.svelte$/i.test(n));
    expect(
      hasCell,
      "expected a FeatureMatrix cell-renderer widget under site/src/lib/widgets/",
    ).toBe(true);

    // The legacy primitives must no longer exist as files under components/.
    const legacyPrimitives = [
      ["Primitives", "Button.svelte"],
      ["Surfaces", "SummaryCard.svelte"],
      ["Surfaces", "FeatureMatrix.svelte"],
    ];
    for (const [sub, file] of legacyPrimitives) {
      expect(
        existsSync(join(SITE_SRC, "lib", "components", sub, file)),
        `site/src/lib/components/${sub}/${file} must be removed`,
      ).toBe(false);
    }

    // No source still imports the legacy primitives or the components/ widget paths.
    const banned = [
      "$lib/components/Primitives/Button",
      "$lib/components/Surfaces/SummaryCard",
      "$lib/components/Surfaces/FeatureMatrix",
      "$lib/components/Bench/",
      "$lib/components/Showcase/",
      "$lib/components/Docs/",
      "$lib/components/Primitives/RangeSlider",
      "$lib/components/Primitives/SegmentedControl",
    ];
    const srcFiles = walkProductionFiles(SITE_SRC, [".svelte", ".ts"]);
    for (const file of srcFiles) {
      const content = readText(file);
      for (const needle of banned) {
        expect(content.includes(needle), `${file} must not reference "${needle}"`).toBe(false);
      }
    }
  });
});

describe("B95-R7 / /comparison and /explorer route stubs", () => {
  it("both route files exist and their source contains the phase placeholder copy and a link back to /", () => {
    const comparison = join(SITE_SRC, "routes", "comparison", "+page.svelte");
    const explorer = join(SITE_SRC, "routes", "explorer", "+page.svelte");
    expect(existsSync(comparison), "site/src/routes/comparison/+page.svelte must exist").toBe(true);
    expect(existsSync(explorer), "site/src/routes/explorer/+page.svelte must exist").toBe(true);

    const comparisonSrc = readText(comparison);
    expect(comparisonSrc).toMatch(/Coming in Phase 3/);
    expect(comparisonSrc).toMatch(/from\s+["']@dxlbnl\/ui["']/);
    expect(comparisonSrc).toMatch(/PageHero/);
    expect(comparisonSrc).toMatch(/href=["']\/["']/);

    const explorerSrc = readText(explorer);
    expect(explorerSrc).toMatch(/Coming in Phase 4/);
    expect(explorerSrc).toMatch(/from\s+["']@dxlbnl\/ui["']/);
    expect(explorerSrc).toMatch(/PageHero/);
    expect(explorerSrc).toMatch(/href=["']\/["']/);
  });
});

describe("B95-R8 / /table route and links deleted", () => {
  it("routes/table/ is gone, no /table link exists in site/src or site/content, components/Table/ is gone", () => {
    expect(
      existsSync(join(SITE_SRC, "routes", "table")),
      "site/src/routes/table/ must be deleted",
    ).toBe(false);

    expect(
      existsSync(join(SITE_SRC, "lib", "components", "Table")),
      "site/src/lib/components/Table/ must be deleted",
    ).toBe(false);

    expect(
      existsSync(join(SITE_SRC, "lib", "widgets", "DataTable.svelte")),
      "site/src/lib/widgets/DataTable.svelte must not exist",
    ).toBe(false);

    const targets: string[] = [];
    targets.push(...walkProductionFiles(SITE_SRC, [".svelte", ".ts"]));
    targets.push(...walkProductionFiles(join(SITE_ROOT, "content"), [".md"]));
    for (const file of targets) {
      const content = readText(file);
      // Catch href="/table" and href="/table/something".
      expect(
        /href=["']\/table(?:\/|["'])/.test(content),
        `${file} must not contain a /table href`,
      ).toBe(false);
      // Catch programmatic navigation: goto('/table'), location.href = '/table'.
      expect(
        /['"`]\/table(?:\/|['"`])/.test(content) &&
          /(goto|location\.href|location\.assign|navigate)/.test(content) &&
          // refine: only fail if /table substring appears near a nav call
          new RegExp("(?:goto|location\\.href|location\\.assign|navigate)[^\\n]*['\"`]/table").test(
            content,
          ),
        `${file} must not navigate programmatically to /table`,
      ).toBe(false);
    }
  });
});

describe("B95-R9 / superseded Storybook stories deleted", () => {
  it("foundation + primitive re-export + Table stories are gone; retained widget stories live under widgets/", () => {
    const mustNotExist = [
      ["Foundations", "Color.stories.svelte"],
      ["Foundations", "Spacing.stories.svelte"],
      ["Foundations", "Typography.stories.svelte"],
      ["Primitives", "Button.stories.svelte"],
      ["Primitives", "Input.stories.svelte"],
      ["Surfaces", "SummaryCard.stories.svelte"],
      ["Surfaces", "FeatureMatrix.stories.svelte"],
      ["Table", "DataTable.stories.svelte"],
      ["Table", "TimingBadge.stories.svelte"],
    ];
    for (const [sub, file] of mustNotExist) {
      expect(
        existsSync(join(SITE_SRC, "lib", "components", sub, file)),
        `site/src/lib/components/${sub}/${file} must be deleted`,
      ).toBe(false);
    }
    // Foundations/ directory itself should be gone.
    expect(
      existsSync(join(SITE_SRC, "lib", "components", "Foundations")),
      "site/src/lib/components/Foundations/ must be deleted",
    ).toBe(false);

    // Retained domain-widget stories live alongside the relocated widgets.
    const widgetsDir = join(SITE_SRC, "lib", "widgets");
    const presentStories = new Set(
      walkFiles(widgetsDir, [".stories.svelte"]).map((p) => p.split("/").pop()!),
    );
    const requiredStories = [
      "BenchChart.stories.svelte",
      "MetricBadge.stories.svelte",
      "WinnerCallout.stories.svelte",
      "LibraryLegend.stories.svelte",
      "JsonTree.stories.svelte",
      "RelationCallout.stories.svelte",
      "CodePanel.stories.svelte",
      "Editor.stories.svelte",
      "SchemaPlayground.stories.svelte",
      "RangeSlider.stories.svelte",
      "SegmentedControl.stories.svelte",
    ];
    for (const s of requiredStories) {
      expect(presentStories.has(s), `expected site/src/lib/widgets/${s} to exist`).toBe(true);
    }
  });
});

describe("B95-R10 / root package.json carries the new site test aliases", () => {
  it("root scripts include site:test:unit and site:test:component aliases", () => {
    const rootPkg = JSON.parse(readText(join(REPO_ROOT, "package.json"))) as {
      scripts?: Record<string, string>;
    };
    expect(rootPkg.scripts).toBeDefined();
    expect(
      rootPkg.scripts?.["site:test:unit"],
      "root package.json must expose site:test:unit",
    ).toMatch(/test:unit/);
    expect(
      rootPkg.scripts?.["site:test:component"],
      "root package.json must expose site:test:component",
    ).toMatch(/test:component/);
  });
});
