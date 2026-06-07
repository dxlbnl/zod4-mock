/**
 * B102 — Structured /docs/api + docs:generate parity guard (HYBRID: TSDoc → manifest).
 *
 * Spec: wiki/specs/B102-docs-structured-api-parity-guard.md.
 *
 * One test per requirement ID. These are the ROOT-level (library) tests covering the
 * TSDoc source-of-truth, the build-time extractor, the curation layer, the generator
 * script, idempotency, package scripts, and the parity guard. The /docs/api UI scenarios
 * (B102-R4, B102-R5) live in `site/e2e/docs-api.spec.ts` (Playwright). B102-R10 (the D5
 * ADR + CLAUDE.md sync) is reviewer-verified — no committed test here (see spec §R10).
 *
 * RED expectation: the hybrid machinery does not exist yet —
 *   - the fresh TSDoc on every public export is not authored (R1);
 *   - the extractor module `scripts/docs/extract.ts` is absent (R2/R3);
 *   - the curation module `scripts/docs/curation.ts` is absent (R3);
 *   - `scripts/docs-generate.ts` is absent (R6/R7);
 *   - the `docs:generate` / `docs:check` package scripts are absent (R8);
 *   - the parity guard has nothing to run (R9).
 * Every failure below traces to that missing machinery, not to a broken harness. The
 * extractor is imported via its OWN module path (not `ts-morph` directly), so a
 * not-yet-installed `ts-morph` surfaces as "extractor module absent" rather than a bare
 * dependency-import error.
 */

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const SRC_INDEX = join(REPO_ROOT, "src", "index.ts");
const EXTRACT_MODULE = join(REPO_ROOT, "scripts", "docs", "extract.ts");
const CURATION_MODULE = join(REPO_ROOT, "scripts", "docs", "curation.ts");
const GENERATE_SCRIPT = join(REPO_ROOT, "scripts", "docs-generate.ts");
const API_REFERENCE = join(REPO_ROOT, "docs", "api-reference.md");
const PKG_JSON = join(REPO_ROOT, "package.json");

/**
 * The public export surface of src/index.ts — the "Export-surface ground truth" from the
 * B102 spec. Value exports (11, incl. the `generators` namespace) and type-only exports
 * (20). The phantom `PrimarySchemaOpts` / `DerivedSchemaOpts` are NOT here; `data` IS.
 */
const VALUE_EXPORTS = [
  "generate",
  "createWorld",
  "createPrng",
  "fieldSeed",
  "generateFromSchema",
  "generateFromKey",
  "data",
  "DEFAULT_KEY_MAP",
  "DEFAULT_KEY_PATTERNS",
  "extend",
  "generators",
] as const;

const TYPE_EXPORTS = [
  "PrngGen",
  "KeyPattern",
  "World",
  "WorldOptions",
  "Registry",
  "GeneratorContext",
  "BoundGenerators",
  "Prng",
  "KeyGenerator",
  "SchemaOpts",
  "MatcherCtx",
  "DeepPartial",
  "GenerateOptions",
  "SchemaKeyMap",
  "ExplainResult",
  "FieldExplanation",
  "RelationExplanation",
  "WorldTrace",
  "TraceNode",
  "TraceField",
  "TraceEdge",
  "TraceResolution",
  "LocaleData",
  "LastNamePrefix",
  "Currency",
] as const;

const ALL_EXPORTS = [...VALUE_EXPORTS, ...TYPE_EXPORTS];

/**
 * Resolve, via the TypeScript compiler API (already a devDependency — no new import), the
 * leading JSDoc comment text for each public export name reachable from src/index.ts. A
 * symbol with no `/** … *​/` block maps to an empty string. This avoids depending on the
 * not-yet-added `ts-morph`, so R1's RED is "TSDoc unauthored", never "dependency missing".
 */
function readExportDocs(): Map<string, string> {
  const program = ts.createProgram([SRC_INDEX], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.Node16,
    moduleResolution: ts.ModuleResolutionKind.Node16,
    skipLibCheck: true,
    allowJs: false,
  });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(SRC_INDEX);
  if (!source) {
    throw new Error(`could not load ${SRC_INDEX} into the TS program`);
  }
  const moduleSymbol = checker.getSymbolAtLocation(source);
  if (!moduleSymbol) {
    throw new Error("src/index.ts has no module symbol");
  }

  const docs = new Map<string, string>();
  for (const exported of checker.getExportsOfModule(moduleSymbol)) {
    let symbol = exported;
    if (symbol.flags & ts.SymbolFlags.Alias) {
      symbol = checker.getAliasedSymbol(symbol);
    }
    const parts = symbol.getDocumentationComment(checker);
    docs.set(exported.getName(), ts.displayPartsToString(parts).trim());
  }
  return docs;
}

// ── B102-R1: fresh TSDoc on every public export ──────────────────────────────

describe("B102-R1 / fresh TSDoc on every public export in src/", () => {
  it("every public export carries a non-empty TSDoc description, every value export has an @example", () => {
    const docs = readExportDocs();

    const missingDescription = ALL_EXPORTS.filter((name) => {
      const doc = docs.get(name);
      return doc === undefined || doc.length === 0;
    });
    expect(
      missingDescription,
      `public exports missing a TSDoc description: ${missingDescription.join(", ")}`,
    ).toEqual([]);

    // Every value export (incl. the `generators` namespace) must carry an @example.
    // The fresh TSDoc authored in R1 must therefore contain at least one `@example` per
    // value export. RED today: the current src has only the two pre-existing example
    // blocks (generate, generators), far fewer than the 11 value exports require.
    const indexSource = readFileSync(SRC_INDEX, "utf8");
    const exampleCount = (indexSource.match(/@example/g) ?? []).length;
    expect(
      exampleCount,
      `expected at least one @example per value export (${VALUE_EXPORTS.length}); found ${exampleCount}`,
    ).toBeGreaterThanOrEqual(VALUE_EXPORTS.length);
  });
});

// ── B102-R2: extractor reads TSDoc + real signatures into a manifest ─────────

describe("B102-R2 / build-time extractor → generated manifest", () => {
  it("manifest covers the real export surface, with non-empty extracted signatures", async () => {
    expect(
      existsSync(EXTRACT_MODULE),
      `extractor module absent at scripts/docs/extract.ts (RED: machinery not built; ` +
        `ts-morph, if chosen, not yet added)`,
    ).toBe(true);

    const mod = (await import(EXTRACT_MODULE)) as {
      buildManifest: () => Promise<ReadonlyArray<ManifestSymbol>> | ReadonlyArray<ManifestSymbol>;
    };
    expect(typeof mod.buildManifest, "extractor must export buildManifest()").toBe("function");

    const manifest = await mod.buildManifest();
    const names = manifest.map((s) => s.name).sort();

    // Coverage: manifest name set === real export surface (phantoms absent, `data` present).
    expect(new Set(names)).toEqual(new Set(ALL_EXPORTS));
    expect(names).not.toContain("PrimarySchemaOpts");
    expect(names).not.toContain("DerivedSchemaOpts");
    expect(names).toContain("data");

    // Every symbol carries a non-empty extracted signature (from the real types).
    const emptySig = manifest.filter((s) => !s.signature || s.signature.trim().length === 0);
    expect(
      emptySig.map((s) => s.name),
      "symbols with an empty extracted signature",
    ).toEqual([]);

    // The signature is the real type, not a hand-typed string: generate's signature names
    // `generate`, its `schema` parameter and an `options` parameter.
    const gen = manifest.find((s) => s.name === "generate");
    expect(gen, "manifest must contain `generate`").toBeDefined();
    expect(gen?.signature).toMatch(/generate/);
    expect(gen?.signature).toMatch(/schema/);
    expect(gen?.signature).toMatch(/options/);
  });
});

interface ManifestSymbol {
  name: string;
  kind: "function" | "type" | "namespace" | "object";
  signature: string;
  description: string;
  examples: ReadonlyArray<string>;
  since: string;
  seeAlso: ReadonlyArray<string>;
  parameters?: ReadonlyArray<{ name: string; type: string; default?: string; description: string }>;
}

// ── B102-R3: curation layer orders/groups by name, owns no prose ─────────────

describe("B102-R3 / hand-maintained curation layer", () => {
  it("manifest emerges in curated order; curation layer carries no signature/description", async () => {
    expect(
      existsSync(CURATION_MODULE),
      `curation module absent at scripts/docs/curation.ts (RED: machinery not built)`,
    ).toBe(true);
    expect(existsSync(EXTRACT_MODULE), `extractor module absent (RED: machinery not built)`).toBe(
      true,
    );

    const curationMod = (await import(CURATION_MODULE)) as {
      CURATION: ReadonlyArray<Record<string, unknown>>;
    };
    const extractMod = (await import(EXTRACT_MODULE)) as {
      buildManifest: () => Promise<ReadonlyArray<ManifestSymbol>> | ReadonlyArray<ManifestSymbol>;
    };

    // The curation layer carries ordering/grouping metadata keyed by name — no prose.
    expect(Array.isArray(curationMod.CURATION)).toBe(true);
    for (const entry of curationMod.CURATION) {
      expect(entry).toHaveProperty("name");
      expect(entry).not.toHaveProperty("signature");
      expect(entry).not.toHaveProperty("description");
    }

    // The manifest's order follows the curation order: the curated name sequence is a
    // subsequence of the manifest's name sequence (in the same relative order).
    const manifest = await extractMod.buildManifest();
    const manifestNames = manifest.map((s) => s.name);
    const curatedNames = curationMod.CURATION.map((e) => String((e as { name: unknown }).name));

    const positions = curatedNames.map((n) => manifestNames.indexOf(n));
    expect(
      positions.every((p) => p >= 0),
      "every curated name appears in the manifest",
    ).toBe(true);
    const ascending = positions.every((p, i) => i === 0 || p > positions[i - 1]!);
    expect(ascending, "manifest order follows the curated order").toBe(true);

    // No public export silently vanishes: every real export appears in the manifest.
    expect(new Set(manifestNames)).toEqual(new Set(ALL_EXPORTS));
  });
});

// ── B102-R6: scripts/docs-generate.ts emits docs/api-reference.md ────────────

describe("B102-R6 / scripts/docs-generate.ts emits docs/api-reference.md from the manifest", () => {
  it("the Exports-overview rows are exactly the manifest symbols (no extras/missing)", async () => {
    expect(
      existsSync(GENERATE_SCRIPT),
      `generator script absent at scripts/docs-generate.ts (RED: machinery not built)`,
    ).toBe(true);

    // Run the generator (write mode) and read the emitted file.
    execFileSync("pnpm", ["docs:generate"], { cwd: REPO_ROOT, stdio: "pipe" });

    const md = readFileSync(API_REFERENCE, "utf8");
    const overviewRows = parseExportsOverview(md);

    const extractMod = (await import(EXTRACT_MODULE)) as {
      buildManifest: () => Promise<ReadonlyArray<ManifestSymbol>> | ReadonlyArray<ManifestSymbol>;
    };
    const manifest = await extractMod.buildManifest();
    const manifestNames = new Set(manifest.map((s) => s.name));

    expect(new Set(overviewRows)).toEqual(manifestNames);
    expect(new Set(overviewRows)).toEqual(new Set(ALL_EXPORTS));
    // Drift correction: phantoms gone, `data` present.
    expect(overviewRows).not.toContain("PrimarySchemaOpts");
    expect(overviewRows).not.toContain("DerivedSchemaOpts");
    expect(overviewRows).toContain("data");
  });
});

/** Parse the `Export` column of the `## Exports overview` markdown table → export names. */
function parseExportsOverview(md: string): string[] {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => /^##\s+Exports overview/i.test(l));
  if (start < 0) return [];
  const names: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^##\s/.test(line)) break; // next section
    const m = line.match(/^\|\s*`([^`]+)`\s*\|/);
    if (m) names.push(m[1]!);
  }
  return names;
}

// ── B102-R7: docs:generate is idempotent ─────────────────────────────────────

describe("B102-R7 / pnpm docs:generate is idempotent", () => {
  it("a second run produces byte-identical docs/api-reference.md", () => {
    expect(
      existsSync(GENERATE_SCRIPT),
      `generator script absent at scripts/docs-generate.ts (RED: machinery not built)`,
    ).toBe(true);

    execFileSync("pnpm", ["docs:generate"], { cwd: REPO_ROOT, stdio: "pipe" });
    const first = readFileSync(API_REFERENCE);
    execFileSync("pnpm", ["docs:generate"], { cwd: REPO_ROOT, stdio: "pipe" });
    const second = readFileSync(API_REFERENCE);

    expect(second.equals(first), "second docs:generate run must produce identical bytes").toBe(
      true,
    );
  });
});

// ── B102-R8: package scripts + validate wiring ───────────────────────────────

describe("B102-R8 / docs:generate + docs:check scripts, docs:check in validate", () => {
  it("root package.json defines docs:generate and docs:check, and validate includes docs:check", () => {
    const pkg = JSON.parse(readFileSync(PKG_JSON, "utf8")) as {
      scripts?: Record<string, string>;
    };
    const scripts = pkg.scripts ?? {};

    expect(scripts["docs:generate"], "missing `docs:generate` script").toBeDefined();
    expect(scripts["docs:check"], "missing `docs:check` script").toBeDefined();
    // docs:check must run in no-write/check mode (a `--check` flag is the spec's shape).
    expect(scripts["docs:check"]).toMatch(/--check/);
    // docs:check must be part of the validate aggregate.
    expect(scripts["validate"], "missing `validate` script").toBeDefined();
    expect(scripts["validate"]).toMatch(/docs:check/);
  });
});

// ── B102-R9: parity guard fails on un-regenerated TSDoc/curation drift ────────

describe("B102-R9 / parity guard catches un-regenerated drift (the load-bearing guard)", () => {
  it("mutating a symbol's TSDoc without regenerating makes docs:check exit non-zero, naming the symbol; regenerating fixes it", () => {
    expect(
      existsSync(GENERATE_SCRIPT),
      `generator script absent at scripts/docs-generate.ts (RED: machinery not built)`,
    ).toBe(true);

    // Work on an isolated copy of the repo's docs-relevant tree so we never dirty the
    // real working tree. We copy the whole repo (excluding node_modules) into a tmpdir
    // and drive the real `tsx` generator there.
    const tmp = mkdtempSync(join(tmpdir(), "b102-parity-"));
    try {
      // Copy src, scripts, docs, package.json, tsconfig, and the lockfile/node_modules
      // by symlink-free reference. node_modules is large; instead we run via the repo's
      // own pnpm bin against the copied package by pointing cwd at the copy but reusing
      // the installed deps through a node_modules symlink.
      for (const entry of ["src", "scripts", "docs", "package.json", "tsconfig.json"]) {
        cpSync(join(REPO_ROOT, entry), join(tmp, entry), { recursive: true });
      }
      // Reuse the installed dependencies.
      writeFileSync(join(tmp, ".npmrc"), "node-linker=hoisted\n", "utf8");
      cpSync(join(REPO_ROOT, "node_modules"), join(tmp, "node_modules"), {
        recursive: true,
        // dereference to avoid broken workspace symlinks; this is a fixture, correctness
        // of the copy matters more than speed for this single guard test.
        dereference: false,
      });

      // Step 0: bring the fixture copy in sync, then confirm docs:check passes (exit 0).
      execFileSync("pnpm", ["docs:generate"], { cwd: tmp, stdio: "pipe" });
      const checkInSync = runDocsCheck(tmp);
      expect(checkInSync.code, `docs:check on an in-sync tree must exit 0`).toBe(0);

      // Step 1: mutate a public export's TSDoc description WITHOUT regenerating.
      const idxPath = join(tmp, "src", "index.ts");
      const src = readFileSync(idxPath, "utf8");
      // Inject a sentinel into generate's JSDoc description so the manifest drifts.
      const SENTINEL = "B102-PARITY-DRIFT-SENTINEL";
      const mutated = src.replace(
        "Zero-config entry point.",
        `Zero-config entry point. ${SENTINEL}.`,
      );
      expect(mutated, "expected to find generate's TSDoc to mutate").not.toBe(src);
      writeFileSync(idxPath, mutated, "utf8");

      // Step 2: docs:check must now fail (non-zero), naming the drifted symbol.
      const drifted = runDocsCheck(tmp);
      expect(drifted.code, "docs:check must exit non-zero on un-regenerated drift").not.toBe(0);
      expect(
        drifted.output,
        "docs:check output must name the drifted symbol (`generate`) and show a diff",
      ).toMatch(/generate/);

      // Step 3: regenerate, then docs:check passes again (exit 0).
      execFileSync("pnpm", ["docs:generate"], { cwd: tmp, stdio: "pipe" });
      const fixed = runDocsCheck(tmp);
      expect(fixed.code, "after regeneration docs:check must exit 0").toBe(0);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 30000);
});

/** Run `pnpm docs:check` in `cwd`, capturing exit code + combined output (never throws). */
function runDocsCheck(cwd: string): { code: number; output: string } {
  try {
    const out = execFileSync("pnpm", ["docs:check"], { cwd, stdio: "pipe" });
    return { code: 0, output: out.toString() };
  } catch (err) {
    const e = err as { status?: number; stdout?: Buffer; stderr?: Buffer };
    const output = `${e.stdout?.toString() ?? ""}\n${e.stderr?.toString() ?? ""}`;
    return { code: e.status ?? 1, output };
  }
}
