/**
 * B126 — Code samples → Shiki + Twoslash (type-checked, clickable type-links into
 * the /docs/api reference). Spec: wiki/specs/B126-twoslash-code-samples.md.
 *
 * ROOT-level (library) structural + build-tooling unit tests for the requirements
 * that bind to the working tree, `package.json`, and the build-time twoslash highlight
 * step — not to the rendered page (the /docs/api UI scenarios B126-R3/R5 live in
 * `site/e2e/docs-samples.spec.ts`; the guard regression B126-R6 lives in
 * `tests/unit/docs/B126-sample-link-guard.test.ts`).
 *
 * One test per requirement id, named `B126-R<k> / <scenario>` (minimal — no exhaustive
 * enumeration). Each test fails today because the B126 mechanism is absent:
 *   - R1: `@shikijs/twoslash` + `twoslash` are not yet devDependencies; the twoslash
 *     transformer is not yet wired into the existing Shiki call.
 *   - R2: the build-time twoslash highlight step / module does not exist yet, so a broken
 *     sample cannot fail the build (the import target is missing → RED on import).
 *   - R4: the src-aligned token→declaration resolution mechanism does not exist yet.
 *   - R7: a warm reused twoslasher program does not exist yet.
 *
 * INTENDED MODULE PATHS pinned for the implementer (Q1 — non-blocking; the spec
 * recommends a build-time highlight step + a `<CodeSample>` component):
 *   - Build-time highlight module: `site/scripts/twoslash-highlight.ts`, exporting:
 *       * `highlightSample(source: string): Promise<string>` — Shiki+Twoslash highlight
 *         of one TS sample to static HTML; THROWS (rejects) on a twoslash/TS diagnostic,
 *         naming the diagnostic.
 *       * `createSampleHighlighter(): { highlightSample(source): Promise<string> }` — a
 *         warm, reusable highlighter whose twoslasher/program is constructed once
 *         (B126-R7). (If the implementer instead exports a module-scope warm instance,
 *         adjust the R7 test's construction probe accordingly.)
 *   - Build-time `<CodeSample>` component (Q1 option b): `site/src/lib/docs/widgets/CodeSample.svelte`.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const SITE_ROOT = join(REPO_ROOT, "site");
const SITE_PKG_JSON = join(SITE_ROOT, "package.json");
const ROOT_PKG_JSON = join(REPO_ROOT, "package.json");
const SVELTE_CONFIG = join(SITE_ROOT, "svelte.config.js");

// The intended build-time highlight module the implementer creates (Q1). Imported
// dynamically inside the R2/R4/R7 tests so the whole suite doesn't fail to load when
// the module is still absent — instead each test fails with a clear "module missing".
const TWOSLASH_HIGHLIGHT_MODULE = join(SITE_ROOT, "scripts", "twoslash-highlight.ts");

// ── B126-R1: build-time devDeps, slotted into the existing Shiki call ────────

describe("B126-R1 / @shikijs/twoslash + twoslash are build-time devDeps wired into the existing Shiki call", () => {
  it("both deps are devDependencies (not dependencies), no src/ or client runtime imports them, and a playground fence still yields its base64 placeholder", () => {
    const sitePkg = JSON.parse(readFileSync(SITE_PKG_JSON, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const rootPkg = JSON.parse(readFileSync(ROOT_PKG_JSON, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    for (const dep of ["@shikijs/twoslash", "twoslash"]) {
      // Present as a build-time devDependency of the site package…
      expect(
        sitePkg.devDependencies?.[dep],
        `'${dep}' must be a site devDependency (build-time only, D13-exempt)`,
      ).toBeDefined();
      // …and NOT a runtime dependency of the site or the shipped library.
      expect(
        sitePkg.dependencies?.[dep],
        `'${dep}' must NOT be a site runtime dependency`,
      ).toBeUndefined();
      expect(
        rootPkg.dependencies?.[dep],
        `'${dep}' must NOT be a shipped-library dependency`,
      ).toBeUndefined();
    }

    // D13: nothing twoslash may enter the shipped library `src/` or any client-bundled
    // runtime module (`$lib`/`+page.svelte`). Scan those trees for a twoslash import.
    const importHit = /["']@shikijs\/twoslash["']|["']twoslash["']/;
    const scanForImport = (root: string, exts: ReadonlyArray<string>): string[] => {
      const offenders: string[] = [];
      const walk = (dir: string): void => {
        let entries: import("node:fs").Dirent[];
        try {
          entries = readdirSync(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const e of entries) {
          const full = join(dir, e.name);
          if (e.isDirectory()) {
            if (e.name === "node_modules" || e.name === ".svelte-kit") continue;
            walk(full);
          } else if (
            exts.some((x) => e.name.endsWith(x)) &&
            importHit.test(readFileSync(full, "utf8"))
          ) {
            offenders.push(full);
          }
        }
      };
      walk(root);
      return offenders;
    };

    // Shipped library src/ — must never import twoslash.
    const srcOffenders = scanForImport(join(REPO_ROOT, "src"), [".ts"]);
    expect(
      srcOffenders,
      `no src/ library module may import twoslash (D13):\n${srcOffenders.join("\n")}`,
    ).toEqual([]);

    // Client-bundled site runtime: $lib + routes (.svelte / runtime .ts). Build-time
    // tooling lives under site/scripts/ + svelte.config.js (excluded from this scan).
    const libOffenders = [
      ...scanForImport(join(SITE_ROOT, "src", "lib"), [".svelte", ".ts"]),
      ...scanForImport(join(SITE_ROOT, "src", "routes"), [".svelte"]),
    ];
    expect(
      libOffenders,
      `no client-bundled $lib/route runtime module may import twoslash (D13):\n${libOffenders.join("\n")}`,
    ).toEqual([]);
  });
});

// ── B126-R7: a warm twoslasher program is reused across samples ──────────────
//
// Probe the construction count by mocking the `twoslash` package the build-time
// highlighter imports (`import { createTwoslasher } from "twoslash"`). `vi.mock` rewrites
// that bare-specifier import for EVERY importer (including the dynamically-imported
// highlight module), so a named-binding import is intercepted where a `vi.spyOn` over the
// live ESM namespace cannot rebind it. The factory delegates to the real implementation
// and only counts how many times the warm highlighter constructs a twoslasher.
const twoslashProbe = vi.hoisted(() => ({ constructions: 0 }));
vi.mock("twoslash", async (importOriginal) => {
  const actual = await importOriginal<typeof import("twoslash")>();
  return {
    ...actual,
    createTwoslasher: (...args: Parameters<typeof actual.createTwoslasher>) => {
      twoslashProbe.constructions += 1;
      return actual.createTwoslasher(...args);
    },
  };
});

describe("B126-R7 / one warm twoslasher program services all samples in a build", () => {
  it("the highlighter constructs the twoslasher/program once and reuses it across multiple highlight calls", async () => {
    // RED today: the build-time highlight module does not exist, so the import rejects.
    expect(
      existsSync(TWOSLASH_HIGHLIGHT_MODULE),
      `the build-time twoslash highlight module must exist at ${TWOSLASH_HIGHLIGHT_MODULE} ` +
        `(B126 Q1: a build-time Shiki+Twoslash highlight step)`,
    ).toBe(true);

    const mod = (await import(TWOSLASH_HIGHLIGHT_MODULE)) as {
      createSampleHighlighter?: () => { highlightSample: (s: string) => Promise<string> };
    };
    expect(
      typeof mod.createSampleHighlighter,
      "twoslash-highlight.ts must export createSampleHighlighter() returning a warm reusable highlighter",
    ).toBe("function");

    // A warm highlighter built once must highlight several samples without rebuilding its
    // twoslasher/program per sample. The mocked `createTwoslasher` factory counts every
    // construction across the three highlight calls on ONE highlighter.
    twoslashProbe.constructions = 0;
    const hl = mod.createSampleHighlighter!();
    const sample = `import { generate } from "zod4-mock";\nimport { z } from "zod";\nconst U = z.object({ id: z.string() });\nconst u = generate(U);`;
    await hl.highlightSample(sample);
    await hl.highlightSample(sample);
    await hl.highlightSample(sample);

    // Exactly one construction across three highlight calls: ==1 (not 0) proves the mock
    // actually intercepts the implementation's `createTwoslasher` import (so the probe isn't
    // vacuous), and (not 3) proves the twoslasher is warm-reused, not built per sample. A
    // per-call-construction implementation would record 3 here and fail (B126-R7).
    expect(
      twoslashProbe.constructions,
      "a warm highlighter must construct its twoslasher program exactly ONCE for many samples (B126-R7)",
    ).toBe(1);
    // The first real twoslash type-check against Zod v4's heavy types is slow (seconds),
    // and slower still under the full parallel `pnpm test` run. Give this twoslash-backed
    // test a generous-but-bounded budget so it does not flake on the default 5000ms while
    // keeping unrelated fast tests strict (no global testTimeout change).
  }, 30000);
});

// ── B126-R2: a sample that does not type-check fails the build ───────────────

describe("B126-R2 / a docs sample that does not type-check fails the build", () => {
  it("highlightSample throws (naming the diagnostic) on an undefined symbol, and succeeds for a valid sample", async () => {
    // RED today: the highlight module is absent → import fails → the type-check seam
    // does not exist, so a broken sample CANNOT fail the build.
    expect(
      existsSync(TWOSLASH_HIGHLIGHT_MODULE),
      `the build-time twoslash highlight module must exist at ${TWOSLASH_HIGHLIGHT_MODULE}`,
    ).toBe(true);

    const mod = (await import(TWOSLASH_HIGHLIGHT_MODULE)) as {
      highlightSample?: (s: string) => Promise<string>;
    };
    expect(
      typeof mod.highlightSample,
      "twoslash-highlight.ts must export highlightSample(source) for the build-time type-check",
    ).toBe("function");

    // A broken sample: references an undefined symbol (`UserSchema` never declared).
    // The twoslash type-check MUST fail (reject), and the failure MUST name the
    // offending symbol/diagnostic — not silently emit highlighted HTML.
    const broken = `import { generate } from "zod4-mock";\nconst users = generate(UserSchema);`;
    let rejected = false;
    let message = "";
    try {
      await mod.highlightSample!(broken);
    } catch (err) {
      rejected = true;
      message = err instanceof Error ? err.message : String(err);
    }
    expect(rejected, "a sample referencing an undefined symbol MUST fail the build").toBe(true);
    expect(message, "the failure must name the offending symbol / twoslash diagnostic").toMatch(
      /UserSchema|Cannot find name|diagnostic/i,
    );

    // A valid sample using the real `zod4-mock` types against an in-sample schema MUST
    // type-check cleanly and emit highlighted output.
    const valid = `import { generate } from "zod4-mock";\nimport { z } from "zod";\nconst User = z.object({ id: z.string(), email: z.string() });\nconst users = generate(z.array(User));`;
    const html = await mod.highlightSample!(valid);
    expect(typeof html, "a valid sample emits highlighted HTML").toBe("string");
    expect(html.length, "highlighted output is non-empty").toBeGreaterThan(0);
    // Real twoslash type-checks (broken + valid sample) against Zod v4's heavy types are
    // slow under the full parallel `pnpm test` run — bound the budget per-test rather than
    // loosen the global testTimeout.
  }, 30000);
});

// ── B126-R4: the token→declaration resolution is src-aligned ─────────────────

describe("B126-R4 / a resolved token declaration points into src/, matching TypeDoc sources", () => {
  it("the twoslash program resolves `zod4-mock` token declarations to a src/ fileName, not node_modules/dist", async () => {
    // RED today: the resolution mechanism is absent (module missing). The implementer
    // must configure the twoslash program's tsconfig `paths` so `zod4-mock` resolves to
    // the same `./src/index.ts` view TypeDoc uses (site/typedoc.tsconfig.json), so a
    // token's declaration fileName matches the TypeDoc `sources.fileName` shape (`src/…`)
    // and the file:line join actually yields links.
    expect(
      existsSync(TWOSLASH_HIGHLIGHT_MODULE),
      `the build-time twoslash highlight module must exist at ${TWOSLASH_HIGHLIGHT_MODULE}`,
    ).toBe(true);

    const mod = (await import(TWOSLASH_HIGHLIGHT_MODULE)) as {
      resolveTokenDeclaration?: (
        source: string,
        token: string,
      ) => Promise<{ fileName: string; line: number } | null>;
    };
    expect(
      typeof mod.resolveTokenDeclaration,
      "twoslash-highlight.ts must export resolveTokenDeclaration(source, token) returning the " +
        "token's declaration {fileName,line} (the src-vs-dist join key)",
    ).toBe("function");

    const sample = `import { generate } from "zod4-mock";\nimport { z } from "zod";\nconst U = z.object({ id: z.string() });\nconst u = generate(U);`;
    const decl = await mod.resolveTokenDeclaration!(sample, "generate");

    expect(
      decl,
      "`generate`'s declaration must resolve (non-null) — a 0-link join is the silent-fail mode",
    ).not.toBeNull();
    const fileName = decl!.fileName.replace(/\\/g, "/");
    // The join key must point into the package src/, exactly like TypeDoc's
    // `sources.fileName` (e.g. `src/index.ts`) — NOT node_modules or dist.
    expect(
      fileName,
      `resolved declaration fileName must point into src/, got: ${fileName}`,
    ).toMatch(/(^|\/)src\//);
    expect(fileName, "resolved declaration must NOT point into node_modules").not.toMatch(
      /node_modules/,
    );
    expect(fileName, "resolved declaration must NOT point into dist").not.toMatch(/(^|\/)dist\//);
    // resolveTokenDeclaration runs a real twoslash/TS program over Zod v4's heavy types —
    // slow under the full parallel `pnpm test` run. Bound the budget per-test rather than
    // loosen the global testTimeout.
  }, 30000);
});

// ── B126-R1 (cont.): the playground branch of the existing highlighter is intact ─

describe("B126-R1 / the twoslash transformer extends the existing Shiki call without breaking the playground branch", () => {
  it("a playground-meta fence still returns its data-playground base64 placeholder (D18 preserved)", async () => {
    // The existing highlighter lives in site/svelte.config.js. B126 adds the twoslash
    // transformer to the NON-playground dual-theme codeToHtml branch; the
    // `meta.includes("playground")` branch MUST still short-circuit to the base64
    // placeholder (twoslash must NOT run over a playground fence).
    //
    // RED expectation: after B126 the highlighter still honours the playground branch.
    // Today this is structurally present, so to keep this test load-bearing for B126 we
    // assert BOTH that the playground branch is intact AND that the twoslash transformer
    // has been wired into the highlighter file — the latter is absent today (RED).
    const config = readFileSync(SVELTE_CONFIG, "utf8");

    // Playground branch intact (D18): the base64 placeholder path survives.
    expect(
      config,
      "the mdsvex highlighter must keep its playground base64-placeholder branch (D18)",
    ).toMatch(/data-playground=/);
    expect(config, 'the playground branch keys on meta.includes("playground")').toMatch(
      /includes\(["']playground["']\)/,
    );

    // The twoslash transformer must be wired into the SAME existing Shiki call (a
    // transformer add, not a new pipeline). RED today: no twoslash transformer is
    // referenced from the highlighter path.
    expect(
      /transformerTwoslash|@shikijs\/twoslash|twoslash/i.test(config),
      "B126 must slot the twoslash transformer into the existing Shiki highlighter " +
        "(site/svelte.config.js and/or the build-time codeToHtml path) — none referenced yet (RED)",
    ).toBe(true);
  });
});
