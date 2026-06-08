/**
 * Build-time heading-id injection for the prerendered /docs HTML.
 *
 * The narrative docs pages (/docs/concepts, /docs/recipes, /docs/relational,
 * /docs/key-heuristics, /docs/getting-started, …) assign their <h2>/<h3>
 * heading ids CLIENT-SIDE in DocPage.svelte's onMount — so the prerendered HTML
 * ships with NO heading ids. That breaks two things on the prerendered output:
 *   1. Pagefind anchors nothing, so search-hit `sub_results` carry no `#heading`
 *      and clicking a hit can't scroll to the matched section.
 *   2. `#fragment` deep-links don't resolve on initial (pre-hydration) load.
 *
 * This step walks the prerendered docs HTML and, for each <h2>/<h3> inside the
 * docs prose body ([data-pagefind-body]) that lacks an id, injects
 * id="<slugify(text)>" using the SAME slug fn DocPage uses (src/lib/docs/slug.ts)
 * so the build-time ids, the "On this page" rail anchors, and the Pagefind
 * sub_result anchors all agree. Collisions get a `-2`, `-3`, … suffix.
 *
 * It runs BEFORE scripts/pagefind-index.ts (so the index gets the anchors) and
 * mutates the served HTML in place (so deep-links work). A real HTML parser
 * (node-html-parser) is used — no regex HTML hacking.
 *
 * Build-time only → D13-exempt (uses node:* + a build-time devDep).
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";
import { slugify } from "../src/lib/docs/slug.js";

const here = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(here, "..");

// The prerendered docs HTML that pagefind-index.ts indexes and `vite preview`
// serves; adapter-vercel copies the same files into .vercel/output/static, so
// patch that copy too when present (Vercel serves it, for deep-links in prod).
const DOCS_DIRS = [
  join(siteRoot, ".svelte-kit/output/prerendered/pages/docs"),
  join(siteRoot, ".vercel/output/static/docs"),
];

function injectFile(file: string): number {
  const html = readFileSync(file, "utf8");
  const root = parse(html);
  const body = root.querySelector("[data-pagefind-body]");
  if (!body) return 0;

  const seen = new Set<string>();
  // Pre-seed with ids already present so injected ids never collide with them.
  for (const h of body.querySelectorAll("[id]")) {
    const existing = h.getAttribute("id");
    if (existing) seen.add(existing);
  }

  let injected = 0;
  for (const h of body.querySelectorAll("h2, h3")) {
    if (h.getAttribute("id")) continue;
    const base = slugify(h.text);
    if (!base) continue;
    let id = base;
    let n = 2;
    while (seen.has(id)) {
      id = `${base}-${n}`;
      n += 1;
    }
    seen.add(id);
    h.setAttribute("id", id);
    injected += 1;
  }

  if (injected > 0) writeFileSync(file, root.toString());
  return injected;
}

function run(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) total += run(full);
    else if (entry.name.endsWith(".html")) total += injectFile(full);
  }
  return total;
}

let grandTotal = 0;
for (const dir of DOCS_DIRS) {
  if (!existsSync(dir)) continue;
  grandTotal += run(dir);
}

// eslint-disable-next-line no-console -- build-time progress log
console.log(
  `inject-heading-ids: injected ${grandTotal} heading id(s) across prerendered /docs HTML`,
);
