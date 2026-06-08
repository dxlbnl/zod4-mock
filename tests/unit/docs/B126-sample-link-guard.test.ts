/**
 * B126-R6 — the build-time dangling-link guard extends to docs-sample type-links.
 *
 * Spec: wiki/specs/B126-twoslash-code-samples.md (B126-R6). Mirrors how B125's
 * api-link-guard test proves the guard is load-bearing (a mutation that points a link
 * at a missing anchor must make the guard exit non-zero; the clean tree passes).
 *
 * B125's guard (`site/scripts/api-link-guard.ts`) validates the /docs/api page's own
 * cross-references. B126 emits NEW links: twoslash-rendered type tokens in docs samples,
 * each an `<a href="/docs/api#anchor">`. Those sample type-links MUST also be guarded —
 * a twoslash-emitted dead type-link MUST NOT ship silently.
 *
 * INTENDED MECHANISM (pinned for the implementer): B126 records the set of emitted
 * sample type-links as a build artifact the guard checks against the B125 anchor set —
 * the recommended shape is a generated module
 *   `site/src/lib/docs/api/sample-links.generated.ts`
 * exporting `SAMPLE_LINKS: ReadonlyArray<{ text: string; anchor: string; sample: string }>`
 * (each `anchor` of the form `<Symbol>` / `<Symbol>.<member>`), which the guard
 * (`site/scripts/api-link-guard.ts`, extended) validates against the API_MODEL anchor set.
 * The implementer MAY choose a different artifact name; this test pins the OBSERVABLE
 * contract: the guard exits non-zero on a sample type-link whose anchor is missing, and
 * exits 0 on the clean tree.
 *
 * RED today: there is no sample-link artifact and the guard does not check sample links,
 * so a dead sample type-link cannot fail the guard.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const SITE_ROOT = join(REPO_ROOT, "site");
const GUARD = join(SITE_ROOT, "scripts", "api-link-guard.ts");
const SAMPLE_LINKS = join(SITE_ROOT, "src", "lib", "docs", "api", "sample-links.generated.ts");

/** Run the build-time guard via tsx; return its exit code + combined output. */
function runGuard(): { code: number; output: string } {
  try {
    const out = execFileSync("pnpm", ["--filter", "@zod4-mock/site", "exec", "tsx", GUARD], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, output: out };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, output: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

// Save/restore the sample-links artifact so the mutation test never leaves the tree dirty.
let savedSampleLinks: string | null = null;
afterEach(() => {
  if (savedSampleLinks !== null) {
    writeFileSync(SAMPLE_LINKS, savedSampleLinks, "utf8");
    savedSampleLinks = null;
  }
});

describe("B126-R6 / the dangling-link guard extends to docs-sample type-links", () => {
  it("the clean tree passes the guard (exit 0)", () => {
    // The standing tree's sample type-links all resolve to real /docs/api anchors.
    const { code, output } = runGuard();
    expect(code, `guard must exit 0 on the clean tree; output:\n${output}`).toBe(0);
  });

  it("a sample type-link pointing at a missing anchor makes the guard exit non-zero", () => {
    // RED today: the guard does not consult any sample-link artifact, so injecting a
    // dead sample type-link does NOT fail it. After B126 the guard MUST check the emitted
    // sample type-links and fail on a missing anchor.
    expect(
      existsSync(SAMPLE_LINKS),
      `B126 must emit a sample type-link artifact (recommended: ${SAMPLE_LINKS}) that the ` +
        `dangling-link guard validates against the /docs/api anchor set`,
    ).toBe(true);

    savedSampleLinks = readFileSync(SAMPLE_LINKS, "utf8");

    // Inject a sample type-link whose anchor does not exist in the API model. The exact
    // artifact shape is the implementer's, so mutate by appending an entry with a
    // guaranteed-missing anchor into the exported array. We rewrite the array's opening
    // bracket to prepend the bogus entry (works for `[ … ]` array literals).
    const bogus = `{ text: "NoSuchSymbol", anchor: "NoSuchSymbol__definitely_missing", sample: "b126-guard-test" }`;
    let mutated = savedSampleLinks;
    if (/SAMPLE_LINKS[^=]*=\s*\[/.test(mutated)) {
      mutated = mutated.replace(/(SAMPLE_LINKS[^=]*=\s*\[)/, `$1\n  ${bogus},`);
    } else {
      // Fallback: append as a standalone re-export the guard would still have to honour.
      mutated += `\n;(globalThis as unknown as { __b126: unknown }).__b126 = ${bogus};\n`;
    }
    expect(mutated, "the mutation must actually change the artifact").not.toBe(savedSampleLinks);
    writeFileSync(SAMPLE_LINKS, mutated, "utf8");

    const { code, output } = runGuard();
    expect(
      code,
      `guard must exit non-zero when a sample type-link points at a missing /docs/api ` +
        `anchor; output:\n${output}`,
    ).not.toBe(0);
    expect(output, "the guard must name the offending sample link / anchor").toMatch(
      /NoSuchSymbol|sample|anchor|dangling/i,
    );
  });
});
