/**
 * B115 — Group the /docs/api reference by category.
 *
 * Spec: wiki/specs/B115-docs-api-grouped-by-category.md.
 *
 * These are the ROOT-level (library) tests for the requirements that bind to the
 * generated manifest (B115-R1) and the generated `docs/api-reference.md`
 * (B115-R5). The /docs/api site-view + TOC scenarios (B115-R2/R3/R4) live in
 * `site/e2e/docs-api-grouped.spec.ts` (Playwright). B115-R6 rides this file's R5
 * content check + the B102 idempotency/parity guards; B115-R7 rides the existing
 * B102 overlap guard + B114 responsive specs — no new test for either.
 *
 * RED expectation:
 *   - R1: the curation layer still carries the OLD fine-grained 11-group taxonomy
 *     (`Entry points`, `PRNG`, `Generators`, `Localization`, `Core types`,
 *     `Generation types`, `Schema registration`, `Override / transform`, `Explain`,
 *     `World Explorer`, `Localization types`). The "every symbol carries a
 *     non-empty curated group, none is `Other`" half ALREADY passes (the data
 *     exists — see spec Context "Ground truth"). The genuine RED is the
 *     CONSOLIDATION the card mandates: a *small* set of clearly-labelled groups
 *     (the spec proposes 8). `distinctGroups.size <= 8` is RED today (11 > 8).
 *   - R5: `docs/api-reference.md` is a flat per-symbol list — it carries NO group
 *     heading sections, so the per-group-heading assertion fails. The per-symbol
 *     `## <Name>` sections + the full Exports-overview survive (they must, so the
 *     B102 symbol-localised parity diff keeps working).
 *
 * Both failures trace to "grouping/taxonomy absent", not a broken harness.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const CURATION_MODULE = join(REPO_ROOT, "scripts", "docs", "curation.ts");
const EXTRACT_MODULE = join(REPO_ROOT, "scripts", "docs", "extract.ts");
const API_REFERENCE = join(REPO_ROOT, "docs", "api-reference.md");

interface ManifestSymbol {
  name: string;
  group: string;
}

interface CurationEntry {
  name: string;
  group: string;
}

async function loadManifest(): Promise<ReadonlyArray<ManifestSymbol>> {
  const mod = (await import(EXTRACT_MODULE)) as {
    buildManifest: () => ReadonlyArray<ManifestSymbol>;
  };
  return mod.buildManifest();
}

async function loadCuration(): Promise<ReadonlyArray<CurationEntry>> {
  const mod = (await import(CURATION_MODULE)) as { CURATION: ReadonlyArray<CurationEntry> };
  return mod.CURATION;
}

// ── B115-R1: every manifest symbol carries a non-empty curated group ──────────

describe("B115-R1 / every manifest symbol carries a non-empty curated group", () => {
  it("every symbol's group is non-empty, no symbol falls through to `Other`, and the group set is the consolidated curated taxonomy", async () => {
    const manifest = await loadManifest();
    const curation = await loadCuration();

    expect(manifest.length, "manifest must contain symbols").toBeGreaterThan(0);

    // (a) Every symbol carries a non-empty group string.
    const emptyGroup = manifest.filter((s) => !s.group || s.group.trim().length === 0);
    expect(
      emptyGroup.map((s) => s.name),
      "symbols with an empty group",
    ).toEqual([]);

    // (b) No symbol fell through to the extractor's default `Other` bucket —
    // every public export is curated into a real group.
    const otherBucket = manifest.filter((s) => s.group === "Other").map((s) => s.name);
    expect(otherBucket, "symbols left in the default `Other` bucket").toEqual([]);

    // (c) The distinct group set drawn from the manifest equals the set of group
    // labels declared in the curation layer (no group invented by the render path,
    // none orphaned). Binds to "the groups the curation layer defines" per spec.
    const manifestGroups = new Set(manifest.map((s) => s.group));
    const curationGroups = new Set(curation.map((e) => e.group));
    expect(manifestGroups).toEqual(curationGroups);

    // (d) RED today: the card mandates a CONSOLIDATED taxonomy — "a small set of
    // clearly-labelled groups" (the spec proposes 8). The committed curation still
    // carries the OLD fine-grained 11 groups, so this fails until the taxonomy is
    // consolidated. Bound to "small" (≤ 8), not to literal group names, so a
    // reviewer/designer may rename/reorder without breaking this assertion.
    expect(
      manifestGroups.size,
      `expected a consolidated taxonomy (≤ 8 groups); found ${manifestGroups.size}: ` +
        `${[...manifestGroups].join(", ")}`,
    ).toBeLessThanOrEqual(8);
  });
});

// ── B115-R5: docs/api-reference.md is generated with the same grouping ────────

describe("B115-R5 / docs/api-reference.md is generated grouped", () => {
  let md: string;
  let manifest: ReadonlyArray<ManifestSymbol>;

  beforeAll(async () => {
    // Regenerate so the assertions run against the script's current output.
    execFileSync("pnpm", ["docs:generate"], { cwd: REPO_ROOT, stdio: "pipe" });
    md = readFileSync(API_REFERENCE, "utf8");
    manifest = await loadManifest();
  });

  it("emits a heading for each curated group label, keeps every per-symbol section, and the Exports overview still lists every symbol once", async () => {
    const curation = await loadCuration();
    const groupLabels = [...new Set(curation.map((e) => e.group))];

    // (a) RED today: the flat markdown contains NO group heading sections. After
    // B115 every curated group label must appear as a markdown heading (any level
    // ≥ 2). The Exports-overview table cell text is excluded so a label that also
    // happens to be a word in a summary doesn't give a false positive — we require
    // the label on a heading line.
    const headingLines = md.split("\n").filter((l) => /^#{2,}\s+/.test(l));
    const missingGroupHeadings = groupLabels.filter(
      (g) => !headingLines.some((l) => l.replace(/^#{2,}\s+/, "").trim() === g),
    );
    expect(
      missingGroupHeadings,
      `group labels with no heading in api-reference.md: ${missingGroupHeadings.join(", ")}`,
    ).toEqual([]);

    // (b) Per-symbol `## <Name>` sections must survive the grouping — the B102
    // parity diff localises drift to a changed symbol via these `## <Name>`
    // sections, so grouping MUST NOT collapse them away.
    const perSymbolHeadings = new Set(
      md
        .split("\n")
        .map((l) => l.match(/^##\s+(.+)$/)?.[1]?.trim())
        .filter((x): x is string => x !== undefined),
    );
    const missingSymbolSections = manifest
      .map((s) => s.name)
      .filter((name) => !perSymbolHeadings.has(name));
    expect(
      missingSymbolSections,
      `symbols with no per-symbol \`## <Name>\` section after grouping: ${missingSymbolSections.join(", ")}`,
    ).toEqual([]);

    // (c) The Exports overview still lists every manifest symbol exactly once
    // (no symbol dropped or duplicated by the grouping).
    const overviewRows = parseExportsOverview(md);
    expect(new Set(overviewRows)).toEqual(new Set(manifest.map((s) => s.name)));
    expect(overviewRows.length, "no duplicate Exports-overview rows").toBe(
      new Set(overviewRows).size,
    );
  });
});

/** Parse the `Export` column of the `## Exports overview` markdown table → names. */
function parseExportsOverview(md: string): string[] {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => /^##\s+Exports overview/i.test(l));
  if (start < 0) return [];
  const names: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^##\s/.test(line)) break;
    const m = line.match(/^\|\s*`([^`]+)`\s*\|/);
    if (m) names.push(m[1]!);
  }
  return names;
}
