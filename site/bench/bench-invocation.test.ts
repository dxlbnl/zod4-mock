/**
 * B98-R3 / B98-R10 / B98-R11 — bench invocation invariants.
 *
 * - R3:  perf.test.ts MUST NOT import any zod4-mock-v0* alias. Those aliases
 *        belong to regression.bench.ts (the opt-in bisect tool). The default
 *        `pnpm bench` invocation MUST NOT pick up the alias-bisect file.
 * - R10: The CI workflow runs `pnpm --filter=@zod4-mock/site bench` OR — if no
 *        workflow exists — baseline.md documents the manual gate citing
 *        B98-R5 / B98-R7.
 * - R11: site/package.json's `bench` script is the single existing
 *        invocation (no new `bench:*` sub-commands required to get the
 *        guardrail; an optional `bench:baseline` for B98-R9 is OK and does
 *        not count against this).
 */

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const perfTestPath = join(here, "perf.test.ts");
const sitePkgPath = join(here, "..", "package.json");
const baselineMdPath = join(here, "baseline.md");
const benchVitestConfigPath = join(here, "vitest.config.ts");
const regressionBenchPath = join(here, "regression.bench.ts");
const workflowsDir = join(repoRoot, ".github", "workflows");

// ─── B98-R3 — perf.test.ts must not import old-version aliases ───────────────

describe("B98-R3 / perf.test.ts isolation from version aliases", () => {
  it("B98-R3 / perf.test.ts does not import any zod4-mock-v0* alias", () => {
    const src = readFileSync(perfTestPath, "utf-8");
    // Match `from "zod4-mock-v050"` etc., across single/double quotes.
    const aliasImport = /from\s+["']zod4-mock-v\d+["']/g;
    const matches = src.match(aliasImport);
    expect(matches, `perf.test.ts imports: ${matches?.join(", ")}`).toBeNull();
  });

  it("B98-R3 / the alias-bisect file lives at regression.bench.ts (not .test.ts) so the default bench glob skips it", () => {
    // The default `pnpm --filter=@zod4-mock/site bench` invocation MUST NOT
    // pick up the alias-bisect file. The mechanism: its filename ends in
    // `.bench.ts`, while the bench vitest config's `include` glob only matches
    // `*.test.ts`. A fresh contributor without the `zod4-mock-v0*` alias
    // `node_modules` symlinks can therefore still run `pnpm bench`.
    expect(
      existsSync(regressionBenchPath),
      "bench/regression.bench.ts is missing — the alias-bisect file must exist at this path so the spec's opt-in command resolves",
    ).toBe(true);
    expect(
      existsSync(join(here, "regression.test.ts")),
      "bench/regression.test.ts is present — it would be picked up by the default bench glob and break a fresh contributor without the zod4-mock-v0* alias symlinks (B98-R3 scenario 1). Rename to bench/regression.bench.ts.",
    ).toBe(false);

    const cfgSrc = readFileSync(benchVitestConfigPath, "utf-8");
    const includeMatch = cfgSrc.match(/include\s*:\s*\[([\s\S]*?)\]/);
    expect(includeMatch, "bench/vitest.config.ts has no `include` array").not.toBeNull();
    const includePatterns = Array.from(includeMatch![1]!.matchAll(/["']([^"']+)["']/g)).map(
      (m) => m[1]!,
    );
    const excludeMatch = cfgSrc.match(/exclude\s*:\s*\[([\s\S]*?)\]/);
    const excludePatterns = excludeMatch
      ? Array.from(excludeMatch[1]!.matchAll(/["']([^"']+)["']/g)).map((m) => m[1]!)
      : [];

    const benchFile = "bench/regression.bench.ts";
    const includedByPattern = includePatterns.some(
      (p) => p === benchFile || (p.includes("*") && matchesGlob(p, benchFile)),
    );
    const excludedByPattern = excludePatterns.some(
      (p) => p === benchFile || (p.includes("*") && matchesGlob(p, benchFile)),
    );

    expect(
      includedByPattern && !excludedByPattern,
      `bench/vitest.config.ts would run ${benchFile} in the default bench (include=${includePatterns.join(", ")}; exclude=${excludePatterns.join(", ") || "<none>"}) — the alias-bisect file must not be picked up by the default bench (B98-R3 scenario 1).`,
    ).toBe(false);
  });
});

// Minimal glob matcher: handles `*` (any non-slash chars) and `**` (any chars
// incl. slashes). Sufficient for the include/exclude patterns we emit.
function matchesGlob(pattern: string, path: string): boolean {
  const re =
    "^" +
    pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "::DOUBLESTAR::")
      .replace(/\*/g, "[^/]*")
      .replace(/::DOUBLESTAR::/g, ".*") +
    "$";
  return new RegExp(re).test(path);
}

// ─── B98-R11 — bench script remains the single existing invocation ───────────

describe("B98-R11 / bench script unchanged", () => {
  it("B98-R11 / `bench` script still runs the bench vitest config", () => {
    const pkg = JSON.parse(readFileSync(sitePkgPath, "utf-8")) as {
      scripts: Record<string, string>;
    };
    const script = pkg.scripts.bench;
    expect(script, "site/package.json missing `bench` script").toBeTruthy();
    expect(script).toContain("vitest");
    expect(script).toContain("bench/vitest.config.ts");
    expect(script).toContain("--run");
  });
});

// ─── B98-R10 — CI workflow OR documented manual gate ─────────────────────────

describe("B98-R10 / CI step OR manual gate is documented", () => {
  it("B98-R10 / a workflow runs `pnpm --filter=@zod4-mock/site bench` OR baseline.md documents the manual gate", () => {
    const workflowMatch = findBenchInvocationInWorkflows();
    const manualMatch = findManualGateInBaselineMd();

    expect(
      workflowMatch || manualMatch,
      "Neither a CI workflow nor baseline.md documents the bench gate (B98-R5 / B98-R7)",
    ).toBe(true);
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findBenchInvocationInWorkflows(): boolean {
  if (!existsSync(workflowsDir)) return false;
  let names: string[] = [];
  try {
    names = readdirSync(workflowsDir);
  } catch {
    return false;
  }
  for (const name of names) {
    if (!/\.ya?ml$/i.test(name)) continue;
    const p = join(workflowsDir, name);
    try {
      if (!statSync(p).isFile()) continue;
      const content = readFileSync(p, "utf-8");
      if (/pnpm\s+--filter=@zod4-mock\/site\s+bench/.test(content)) return true;
      // Accept a generic shape too: `pnpm bench` invoked from the site
      // workspace root in a job's working-directory.
      if (/pnpm\s+(run\s+)?bench/.test(content) && /site/.test(content)) return true;
    } catch {
      // ignore unreadable file
    }
  }
  return false;
}

function findManualGateInBaselineMd(): boolean {
  if (!existsSync(baselineMdPath)) return false;
  const md = readFileSync(baselineMdPath, "utf-8");
  // Must reference the exact pnpm bench command AND the two threshold rule IDs.
  const hasCommand = /pnpm\s+--filter=@zod4-mock\/site\s+bench/.test(md);
  const hasR5 = /B98-?R5/i.test(md);
  const hasR7 = /B98-?R7/i.test(md);
  return hasCommand && hasR5 && hasR7;
}
