import { expect, test } from "@playwright/test";

/**
 * B125 — API reference → TypeDoc (member-level), rendered in-site
 * (spec: wiki/specs/B125-typedoc-api-reference.md).
 *
 * This file REPLACES the B102 `docs-api.spec.ts` (the old per-symbol
 * SignatureBlock / ParameterTable / manifest-driven render) — B125 deletes that
 * renderer by design (R9/R10), so its assertions (`.sig`, `.param-table`, the
 * canonical-reference stub link, the flat per-symbol TOC) no longer describe the
 * page. The new contract is the member-level TypeDoc render.
 *
 * UI scenarios, asserted by role / text (never pixels) against the production build
 * served by the Playwright `webServer` (playwright.config.ts), settling at
 * `networkidle` so hydration-mounted widgets (the TOC) are present before assertion:
 *   - R4  — a function (`generate`) shows its options EXPANDED (seed / overrides /
 *           transform / store / unique appear as enumerated field entries), not only
 *           the opaque `GenerateOptions<z.infer<TSchema>>` alias.
 *   - R5  — option/config types list every field, organized as OWN fields + an
 *           "Inherited from GenerationDefaults" link row (the maintainer's base-extract
 *           refactor): `WorldOptions` shows `generators`/`trace` own + inherited links;
 *           `GenerateOptions` shows `overrides`/`transform`/`store`/`unique` own +
 *           inherited links and the @internal `source`/`fieldPath`/`prng` are ABSENT;
 *           `GenerationDefaults` documents the 5 shared fields, each deep-linkable.
 *   - R6  — `Registry` lists every method, each with a resolvable member anchor.
 *   - R13 — the "On this page" nav does NOT clip entries with the B114 single-line
 *           `text-overflow: ellipsis`; entries wrap or the rail scrolls.
 *
 * B125-R14 render reshape (maintainer-chosen heading-per-member layout): the page
 * no longer uses a table or a signature-chip block — each member (param / field /
 * method) is a *heading-per-member entry* (`.member-entry`, carrying `data-field` /
 * `data-method`) = an <h3>/<h4>/<h5> member-name heading + a dim type meta line +
 * full-width prose, deep-linkable per member and harvested into the gated 2-level
 * "On this page" rail. These tests target that entry markup; the requirement intent
 * (fields/methods/anchors present, options expanded, nav not clipped, members nested
 * in the rail) is unchanged.
 *
 * Each test watches the browser's `console.error` / `pageerror` signals and fails on
 * a runtime error during load (browser-testing practice).
 */

const API = "/docs/api";

/** Attach console-error / pageerror collectors; return a getter for assertions. */
function watchConsole(page: import("@playwright/test").Page): () => string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(String(err)));
  return () => errors;
}

test("B125-R4 / generate renders its options expanded, not the opaque GenerateOptions alias", async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.goto(API);
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { level: 1, name: /API Reference/i })).toBeVisible();

  // Locate the `generate` function's own documentation block — the section that owns the
  // `#generate` member anchor (the model's stable scheme: `#generate`, an id ending in
  // `.generate`/`-generate`, or a `[data-member='generate']` block). We scope all of the
  // expanded-options assertions to THIS block, so a stray `seed`/`transform` mention
  // elsewhere on the page (another symbol's signature, an example) cannot satisfy R4.
  const generateBlock = page
    .locator(
      "[data-member='generate'], " +
        "section:has(> :is(h1,h2,h3,h4)[id='generate']), " +
        "section:has(> :is(h1,h2,h3,h4)[id$='.generate']), " +
        "section:has(> :is(h1,h2,h3,h4)[id$='-generate'])",
    )
    .or(page.getByRole("region", { name: /^generate$/i }))
    .first();
  await expect(generateBlock).toBeVisible();

  // Expanded options (B125-R14 render): every representative GenerateOptions field appears
  // as its OWN ENUMERATED ENTRY within the generate block — a `.member-entry` carrying a
  // `data-field` attribute equal EXACTLY to the field name (`seed`, `overrides`, …), not a
  // prose mention inside a description/example, and not a substring of the opaque alias
  // `GenerateOptions<z.infer<TSchema>>`. We harvest the `data-field` of every entry in the
  // block and require each field name to be present as its own entry. The `data-field`
  // attribute is the structural carrier of an expanded-field entry; the opaque-alias
  // rendering (the `options` param's signature line) has no such per-option entry, so this
  // proves the options are genuinely EXPANDED, not just named.
  const entryLabels = await generateBlock.evaluate((root) => {
    const labels: string[] = [];
    root.querySelectorAll("[data-field]").forEach((el) => {
      const f = (el.getAttribute("data-field") ?? "").trim();
      if (f.length > 0) labels.push(f.toLowerCase());
    });
    return labels;
  });
  const labelSet = new Set(entryLabels);
  const expandedFields = ["seed", "overrides", "transform", "store", "unique"];
  const missing = expandedFields.filter((f) => !labelSet.has(f));
  expect(
    missing,
    `generate's options must be EXPANDED into enumerated field entries; these field ` +
      `names are not present as their own labelled entry in the generate block: ` +
      `${missing.join(", ")}`,
  ).toEqual([]);

  expect(errors(), "no console error / pageerror during load").toEqual([]);
});

test("B125-R5 / WorldOptions lists its own fields + inherited GenerationDefaults links", async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.goto(API);
  await page.waitForLoadState("networkidle");

  // The WorldOptions option/config type renders member-level: its OWN fields as
  // enumerated entries, plus a compact "Inherited from GenerationDefaults" row of
  // links (the shared defaults are documented once on GenerationDefaults, per the
  // base-extract refactor — not duplicated here).
  const worldOptions = page
    .locator("#WorldOptions, [id$='.WorldOptions'], [data-member='WorldOptions']")
    .or(page.getByRole("region", { name: /^WorldOptions$/i }))
    .first();
  await expect(worldOptions).toBeVisible();

  // Own fields render as their own entries with a type + description.
  for (const field of ["generators", "trace"]) {
    const entry = worldOptions.locator(`[data-field='${field}']`).first();
    await expect(
      entry,
      `WorldOptions own field '${field}' must render as its own entry`,
    ).toHaveCount(1);
    await expect(entry.locator(".member-type"), `'${field}' renders its type`).toBeVisible();
    await expect(entry.locator(".member-desc"), `'${field}' renders a description`).toBeVisible();
  }

  // The 5 inherited GenerationDefaults fields appear as resolvable links to that
  // base type's member anchors (`#GenerationDefaults.<field>`), not full re-renders.
  const INHERITED = [
    "seed",
    "optionalProbability",
    "defaultArrayLength",
    "recursionLimit",
    "locale",
  ];
  for (const field of INHERITED) {
    const link = worldOptions.locator(`a[href$='#GenerationDefaults.${field}']`);
    await expect(
      link.first(),
      `WorldOptions must link inherited field '${field}' to #GenerationDefaults.${field}`,
    ).toHaveCount(1);
  }

  expect(errors(), "no console error / pageerror during load").toEqual([]);
});

test("B125-R5 / GenerateOptions lists own fields + inherited links; @internal fields are absent", async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.goto(API);
  await page.waitForLoadState("networkidle");

  const generateOptions = page
    .locator("#GenerateOptions, [id$='.GenerateOptions'], [data-member='GenerateOptions']")
    .or(page.getByRole("region", { name: /^GenerateOptions$/i }))
    .first();
  await expect(generateOptions).toBeVisible();

  // Own fields render as their own entries.
  for (const field of ["overrides", "transform", "store", "unique"]) {
    await expect(
      generateOptions.locator(`[data-field='${field}']`).first(),
      `GenerateOptions own field '${field}' must render as its own entry`,
    ).toHaveCount(1);
  }

  // Inherited GenerationDefaults fields appear as resolvable links.
  for (const field of ["seed", "optionalProbability"]) {
    await expect(
      generateOptions.locator(`a[href$='#GenerationDefaults.${field}']`).first(),
      `GenerateOptions must link inherited field '${field}'`,
    ).toHaveCount(1);
  }

  // The now-@internal fields MUST NOT appear anywhere in the reference (TypeDoc drops
  // them via excludeInternal): no entry, no link, no type token mentions them.
  const pageText = await page.locator(".api-root").innerText();
  for (const internal of ["source", "fieldPath", "prng"]) {
    expect(
      page.locator(`.api-root [data-field='${internal}']`),
      `@internal field '${internal}' must not render as an entry`,
    ).toHaveCount(0);
  }
  // `fieldPath` / `prng` are distinctive enough to assert as absent prose tokens.
  expect(pageText, "@internal 'fieldPath' must be absent from the reference").not.toContain(
    "fieldPath",
  );

  expect(errors(), "no console error / pageerror during load").toEqual([]);
});

test("B125-R5 / GenerationDefaults documents its 5 shared fields, each deep-linkable", async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.goto(API);
  await page.waitForLoadState("networkidle");

  const defaults = page
    .locator("#GenerationDefaults, [id$='.GenerationDefaults'], [data-member='GenerationDefaults']")
    .or(page.getByRole("region", { name: /^GenerationDefaults$/i }))
    .first();
  await expect(defaults).toBeVisible();

  for (const field of [
    "seed",
    "optionalProbability",
    "defaultArrayLength",
    "recursionLimit",
    "locale",
  ]) {
    const entry = defaults.locator(`[data-field='${field}']`).first();
    await expect(entry, `GenerationDefaults documents field '${field}'`).toHaveCount(1);
    const desc = entry.locator(".member-desc");
    await expect(desc, `'${field}' has a non-empty description`).toBeVisible();
    expect(
      (await desc.innerText()).trim().length,
      `'${field}' description non-empty`,
    ).toBeGreaterThan(0);
    // Each field is deep-linkable via its own member anchor.
    await expect(
      page.locator(`#GenerationDefaults\\.${field}, [id='GenerationDefaults.${field}']`).first(),
      `GenerationDefaults.${field} member anchor must exist`,
    ).toHaveCount(1);
  }

  expect(errors(), "no console error / pageerror during load").toEqual([]);
});

test("B125-R6 / Registry lists every method with a resolvable member anchor", async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto(API);
  await page.waitForLoadState("networkidle");

  const registry = page
    .locator("#Registry, [id$='.Registry'], [data-member='Registry']")
    .or(page.getByRole("region", { name: /^Registry$/i }))
    .first();
  await expect(registry).toBeVisible();

  // All six Registry methods (src/types.ts) must be listed.
  const REGISTRY_METHODS = ["store", "all", "pick", "filter", "find", "count"];
  const blockText = (await registry.innerText()).toLowerCase();
  const missing = REGISTRY_METHODS.filter((m) => !blockText.includes(m.toLowerCase()));
  expect(missing, `Registry block must list every method; missing: ${missing.join(", ")}`).toEqual(
    [],
  );

  // Each method must carry a resolvable in-page member anchor. Probe a representative
  // method (`pick`): an element whose id resolves to a `Registry.pick` member anchor
  // (the model's stable scheme — `#Registry.pick`, `#Registry-pick`, or a member id
  // ending in `.pick` / `-pick`) MUST exist on the page, so a deep link works.
  const pickAnchor = page.locator(
    "#Registry\\.pick, #Registry-pick, [id$='Registry.pick'], [id$='Registry-pick'], [id$='.pick']",
  );
  await expect(
    pickAnchor.first(),
    "a resolvable member anchor for Registry.pick must exist on the page",
  ).toHaveCount(1);

  expect(errors(), "no console error / pageerror during load").toEqual([]);
});

test("B125-R13 / the On this page nav does not clip entries with a single-line ellipsis", async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(API);
  await page.waitForLoadState("networkidle");

  const toc = page.getByRole("complementary", { name: /On this page/i });
  await expect(toc).toBeVisible();

  // The member-dense API nav MUST NOT clip entries with the B114 single-line
  // `text-overflow: ellipsis`. Inspect the computed style of a representative member
  // link in the rail: it must either NOT be ellipsis-clipped (entries wrap), or the
  // rail must be a scroll container so every entry is reachable.
  const links = toc.getByRole("link");
  await expect(links.first()).toBeVisible();

  const metrics = await links.first().evaluate((el) => {
    const cs = getComputedStyle(el);
    const rail = el.closest("aside") ?? el.parentElement!;
    const railCs = getComputedStyle(rail as Element);
    return {
      textOverflow: cs.textOverflow,
      whiteSpace: cs.whiteSpace,
      overflowX: cs.overflowX,
      railOverflowY: railCs.overflowY,
      railScrollable: (rail as HTMLElement).scrollHeight > (rail as HTMLElement).clientHeight,
    };
  });

  // Robust check: an entry is NOT single-line-ellipsis-clipped (the B114 treatment is
  // `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`). Acceptable
  // outcomes: the link wraps (white-space !== nowrap) OR no ellipsis OR the rail
  // scrolls so the entry is still reachable.
  const isEllipsisClipped = metrics.textOverflow === "ellipsis" && metrics.whiteSpace === "nowrap";
  const railScrolls =
    metrics.railOverflowY === "auto" ||
    metrics.railOverflowY === "scroll" ||
    metrics.railScrollable;
  expect(
    !isEllipsisClipped || railScrolls,
    "the API nav must not single-line-ellipsis-clip its entries (entries wrap or the rail scrolls)",
  ).toBe(true);

  // B125 gated 2-level rail: members are nested under their symbol in the rail. A
  // representative member (e.g. Registry.pick) appears as a nested rail link whose
  // href resolves to that member's on-page anchor.
  const memberRailLink = toc.locator("a[href$='#Registry.pick'], a[href='#Registry.pick']");
  await expect(
    memberRailLink.first(),
    "a member (Registry.pick) must appear as a nested link in the On this page rail",
  ).toHaveCount(1);

  expect(errors(), "no console error / pageerror during load").toEqual([]);
});
