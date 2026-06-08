// Shared heading → id slug function.
//
// Used by BOTH the client (DocPage.svelte's onMount TOC harvest) and the
// build-time id-injection step (scripts/inject-heading-ids.ts) so the ids in
// the prerendered HTML, the "On this page" rail anchors, and the Pagefind
// sub_result anchors all agree — a search hit's `#anchor` then lands on the
// right heading and `#fragment` deep-links work on initial load.

/** Lowercase, collapse whitespace runs to single hyphens. */
export function slugify(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, "-");
}
