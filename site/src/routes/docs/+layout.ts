// B104-R1 — opt the whole /docs subtree into static prerendering so the
// adapter emits one HTML file per docs route. Pagefind indexes prerendered
// HTML on disk; an SSR function's runtime output is invisible to it.
//
// The Playground code fences (D18/D22) mount client-side after hydration, so
// prerendering the docs HTML is safe — the interactive widgets still hydrate.
export const prerender = true;
