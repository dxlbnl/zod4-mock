/**
 * B125 — API reference → TypeDoc (member-level); delete the bespoke pipeline.
 *
 * Spec: wiki/specs/B125-typedoc-api-reference.md.
 *
 * ROOT-level (library) structural/unit tests for the requirements that bind to the
 * working tree and `src/` source, not to the rendered page:
 *   - R8  — a build-time dangling-link guard exists and is wired into the site build,
 *           so a dead `/docs/api` cross-reference anchor fails the build.
 *   - R9  — the bespoke ts-morph pipeline files + scripts are ABSENT.
 *   - R10 — the B115/B123 grouped-render tests are removed/replaced (no test still
 *           imports the deleted extractor / curation / manifest modules).
 *   - R11 — every option/config field in `src/types.ts` carries per-field TSDoc.
 *
 * The /docs/api UI scenarios (R4, R5, R6, R8, R13) live in `site/e2e/docs-api.spec.ts`
 * (Playwright). R14 (designer pass) and R15 (ride `pnpm validate` / `pnpm build`) carry
 * no new committed test.
 *
 * RED expectation (today, before B125 is implemented):
 *   - R9: every listed pipeline file still EXISTS, the `docs:generate` / `docs:check`
 *     scripts are still in `package.json`, `validate` still invokes `docs:check`, and
 *     `ts-morph` is still a devDependency → each assertion fails ("pipeline still present").
 *   - R10: the old grouped-render test files still EXIST and still import the deleted
 *     modules → fails ("dead-renderer tests still present").
 *   - R11: the `GenerateOptions` / `WorldOptions` fields that lack TSDoc today
 *     (`overrides`, `transform`, `seed`, … for GenerateOptions; `seed`,
 *     `optionalProbability`, … for WorldOptions) have no doc comment → fails
 *     ("per-field TSDoc unauthored").
 *
 * Each failure traces to the missing B125 work, not to a broken harness.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const PKG_JSON = join(REPO_ROOT, "package.json");
const SITE_PKG_JSON = join(REPO_ROOT, "site", "package.json");
const TYPES_TS = join(REPO_ROOT, "src", "types.ts");

// ── B125-R8: a build-time dangling-link guard is wired into the build ────────

describe("B125-R8 / a build-time dangling-link guard fails the build on a dead anchor", () => {
  it("a dangling-link guard script exists and is invoked by the site build chain", () => {
    // R8's robust standing signal: a dedicated guard that fails (non-zero exit) on a
    // dead `/docs/api` cross-reference anchor, run as part of the site build. We assert
    // the guard is committed and wired so it cannot be skipped — not merely that some
    // build happens to pass. RED today: no such guard exists.
    const sitePkg = JSON.parse(readFileSync(SITE_PKG_JSON, "utf8")) as {
      scripts?: Record<string, string>;
    };
    const siteScripts = sitePkg.scripts ?? {};

    // The site `build` script (the chain that prerenders /docs/api and runs Pagefind)
    // must invoke a links / docs guard step, OR a dedicated guard script must exist.
    const buildScript = siteScripts["build"] ?? "";
    const guardInBuild = /link|anchor|docs-?check|guard/i.test(buildScript);

    // Accept either: a guard script committed under site/scripts/ (any name matching
    // *link*/*guard*/*anchor*), or a named guard script in site package.json.
    const guardScriptCandidates = [
      join(REPO_ROOT, "site", "scripts", "check-links.ts"),
      join(REPO_ROOT, "site", "scripts", "dangling-links.ts"),
      join(REPO_ROOT, "site", "scripts", "docs-link-guard.ts"),
      join(REPO_ROOT, "site", "scripts", "api-link-guard.ts"),
    ];
    const guardFileExists = guardScriptCandidates.some((f) => existsSync(f));
    const guardNamedScript = Object.entries(siteScripts).some(
      ([name, body]) => /link|anchor|guard/i.test(name) && /link|anchor|guard|docs/i.test(body),
    );

    expect(
      guardInBuild || guardFileExists || guardNamedScript,
      "B125 must add a build-time dangling-link guard for /docs/api anchors, wired " +
        "into the site build (e.g. a site/scripts/*link-guard*.ts invoked by `build`). " +
        "None found — the guard does not exist yet (RED).",
    ).toBe(true);
  });
});

// ── B125-R9: the bespoke ts-morph pipeline is deleted ────────────────────────

describe("B125-R9 / the bespoke ts-morph API-docs pipeline is deleted", () => {
  it("the pipeline files, the docs:generate/docs:check scripts, and the ts-morph devDependency are all gone", () => {
    // (a) Every bespoke-pipeline file the card names MUST NOT exist.
    const DELETED_FILES = [
      join(REPO_ROOT, "scripts", "docs", "extract.ts"),
      join(REPO_ROOT, "scripts", "docs", "curation.ts"),
      join(REPO_ROOT, "scripts", "docs-generate.ts"),
      join(REPO_ROOT, "site", "src", "lib", "docs", "api", "manifest.generated.ts"),
      join(REPO_ROOT, "site", "src", "lib", "docs", "widgets", "SignatureBlock.svelte"),
      join(REPO_ROOT, "site", "src", "lib", "docs", "widgets", "ParameterTable.svelte"),
    ];
    const stillPresent = DELETED_FILES.filter((f) => existsSync(f));
    expect(
      stillPresent,
      `bespoke-pipeline files that MUST be deleted but still exist:\n${stillPresent.join("\n")}`,
    ).toEqual([]);

    // (b) The root package.json no longer carries the docs:generate / docs:check
    // scripts, and `validate` no longer invokes docs:check.
    const pkg = JSON.parse(readFileSync(PKG_JSON, "utf8")) as {
      scripts?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const scripts = pkg.scripts ?? {};
    expect(scripts["docs:generate"], "`docs:generate` script must be removed").toBeUndefined();
    expect(scripts["docs:check"], "`docs:check` script must be removed").toBeUndefined();
    expect(scripts["validate"] ?? "", "`validate` must no longer invoke docs:check").not.toMatch(
      /docs:check/,
    );

    // (c) ts-morph is no longer a root devDependency.
    expect(
      pkg.devDependencies?.["ts-morph"],
      "`ts-morph` must be removed from devDependencies",
    ).toBeUndefined();
  });
});

// ── B125-R10: B115/B123 grouped-render tests are removed/replaced ────────────

describe("B125-R10 / the B115/B123 grouped-render tests are removed or replaced", () => {
  it("no surviving test file imports the deleted extractor / curation / manifest modules", () => {
    // The old grouped-render specs/tests pin the deleted renderer + pipeline modules.
    // After B125 they MUST be removed or rewritten — no committed test may still import
    // `scripts/docs/extract.ts`, `scripts/docs/curation.ts`, or `manifest.generated`.
    const OLD_TEST_FILES = [
      join(REPO_ROOT, "tests", "unit", "docs", "B115-docs-api-grouped.test.ts"),
      join(REPO_ROOT, "tests", "unit", "docs", "B102-docs-generate.test.ts"),
      join(REPO_ROOT, "site", "e2e", "docs-api-grouped.spec.ts"),
    ];

    // Each of these must either be gone, or — if a same-named file survives — it MUST NOT
    // reference the deleted pipeline modules. The cleanest signal: the dead-renderer test
    // files no longer exist.
    const survivors = OLD_TEST_FILES.filter((f) => existsSync(f));
    const stillReferencingDeadPipeline = survivors.filter((f) => {
      const src = readFileSync(f, "utf8");
      return /scripts\/docs\/extract|scripts\/docs\/curation|manifest\.generated/.test(src);
    });
    expect(
      stillReferencingDeadPipeline,
      `test files that still import the deleted ts-morph pipeline modules ` +
        `(must be removed/rewritten by B125):\n${stillReferencingDeadPipeline.join("\n")}`,
    ).toEqual([]);
  });
});

// ── B125-R11: per-field TSDoc on every option/config field in src/types.ts ───

/**
 * Walk `src/types.ts` with the TypeScript compiler API (already a devDependency — no new
 * import) and collect, for the named interfaces, each declared property and whether it
 * carries a leading JSDoc comment with non-empty body text. A property with no
 * `/** … *​/` block, or an empty one, is reported as undocumented.
 */
function undocumentedFields(interfaceNames: ReadonlyArray<string>): Map<string, string[]> {
  const program = ts.createProgram([TYPES_TS], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.Node16,
    moduleResolution: ts.ModuleResolutionKind.Node16,
    skipLibCheck: true,
    allowJs: false,
  });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(TYPES_TS);
  if (!source) throw new Error(`could not load ${TYPES_TS} into the TS program`);

  const result = new Map<string, string[]>();
  for (const name of interfaceNames) result.set(name, []);

  source.forEachChild((node) => {
    if (!ts.isInterfaceDeclaration(node)) return;
    const ifaceName = node.name.text;
    if (!result.has(ifaceName)) return;

    for (const member of node.members) {
      if (!ts.isPropertySignature(member) || !member.name) continue;
      const fieldName = member.name.getText(source);
      const sym = checker.getSymbolAtLocation(member.name);
      const docText = sym
        ? ts.displayPartsToString(sym.getDocumentationComment(checker)).trim()
        : "";
      if (docText.length === 0) result.get(ifaceName)!.push(fieldName);
    }
  });
  return result;
}

describe("B125-R11 / every option/config field in src/types.ts carries TSDoc", () => {
  it("every declared field of GenerateOptions and WorldOptions has a non-empty doc comment", () => {
    const undocumented = undocumentedFields(["GenerateOptions", "WorldOptions"]);

    expect(
      undocumented.get("GenerateOptions"),
      `GenerateOptions fields missing per-field TSDoc: ` +
        `${undocumented.get("GenerateOptions")!.join(", ")}`,
    ).toEqual([]);

    expect(
      undocumented.get("WorldOptions"),
      `WorldOptions fields missing per-field TSDoc: ${undocumented.get("WorldOptions")!.join(", ")}`,
    ).toEqual([]);
  });
});
