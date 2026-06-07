/**
 * B119 — regression test for `renderInline` member-link anchor resolution.
 *
 * Build break: a `{@link World.trace}` member cross-reference resolved to
 * `href="#World.trace"`, but `/docs/api/+page.svelte` only emits top-level
 * symbol anchors (`<h2 id={sym.name}>` → `#World`). SvelteKit's prerender
 * then hard-failed on the dangling `#World.trace` id.
 *
 * A member target `{@link X.y(.z…)}` MUST resolve its href to the
 * top-level symbol anchor `#X`; a bare `{@link X}` stays `#X`.
 */

import { describe, it, expect } from "vitest";
import { renderInline } from "./inline.js";

describe("renderInline {@link} anchor resolution", () => {
  it("resolves a member target to the top-level symbol anchor (#World, not #World.trace)", () => {
    const out = renderInline("{@link World.trace}");
    expect(out).toContain('href="#World"');
    expect(out).not.toContain('href="#World.trace"');
  });

  it("keeps the member path as the visible link text", () => {
    const out = renderInline("{@link World.trace}");
    expect(out).toContain(">World.trace</a>");
  });

  it("keeps a bare symbol target linking to #Symbol", () => {
    const out = renderInline("{@link World}");
    expect(out).toContain('href="#World"');
    expect(out).toContain(">World</a>");
  });
});
