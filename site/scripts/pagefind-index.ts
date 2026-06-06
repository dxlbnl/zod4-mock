/**
 * B104-R2/R3/R6 — Pagefind index step, run after `vite build`.
 *
 * Integration crux (preview vs Vercel share one index):
 *  - `vite preview` (SvelteKit) serves `.svelte-kit/output/client` (static assets)
 *    and `.svelte-kit/output/prerendered/pages` (prerendered HTML). It does NOT
 *    serve `.vercel/output/static`.
 *  - adapter-vercel copies `client` + `prerendered` into `.vercel/output/static`,
 *    which Vercel serves via `{ "handle": "filesystem" }`.
 *  So this step indexes the prerendered docs HTML and writes the `/pagefind/`
 *  bundle into BOTH served roots — `.svelte-kit/output/client/pagefind` (preview)
 *  and `.vercel/output/static/pagefind` (production) — so `/pagefind/pagefind.js`
 *  is 200 in both.
 *
 * Synonyms (R6): Pagefind v1 has no native synonym table, so the supported
 * mechanism is the Node API's `addCustomRecord` — one record per concept whose
 * content is the synonym phrases, pointing at the concept's canonical docs page,
 * so a synonym query routes to that page.
 *
 * Build-time only → D13-exempt (uses node:* + the pagefind binary).
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as pagefind from "pagefind";
import { CONCEPT_SYNONYMS } from "../src/lib/docs/concepts.js";

const here = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(here, "..");

// What `vite preview` serves: the prerendered docs HTML lives here.
const PRERENDERED_PAGES = join(siteRoot, ".svelte-kit/output/prerendered/pages");
// The two served static roots the `/pagefind/` bundle must land in.
const OUTPUT_ROOTS = [
  join(siteRoot, ".svelte-kit/output/client/pagefind"), // vite preview
  join(siteRoot, ".vercel/output/static/pagefind"), // Vercel production
];

// Canonical concept → the docs page that introduces it (a <DefRef term>).
// Used to point the synonym custom records at the right route.
const CONCEPT_PAGE: Record<string, string> = {
  matcher: "/docs/concepts/",
  world: "/docs/concepts/",
  registry: "/docs/concepts/",
  determinism: "/docs/concepts/",
};

async function main(): Promise<void> {
  if (!existsSync(PRERENDERED_PAGES)) {
    throw new Error(
      `Pagefind: prerendered pages not found at ${PRERENDERED_PAGES}. ` +
        `Run \`vite build\` (with the /docs subtree prerendered) before the index step.`,
    );
  }

  const { index, errors } = await pagefind.createIndex();
  if (!index) {
    throw new Error(`Pagefind: failed to create index: ${errors.join(", ")}`);
  }

  const indexed = await index.addDirectory({ path: PRERENDERED_PAGES });
  if (indexed.errors.length > 0) {
    throw new Error(`Pagefind: addDirectory errors: ${indexed.errors.join(", ")}`);
  }

  // R6 — emit synonym records so configured aliases route to the canonical concept.
  for (const entry of CONCEPT_SYNONYMS) {
    const url = CONCEPT_PAGE[entry.concept];
    if (!url) continue;
    const synonymText = entry.synonyms.join(" ");
    const record = await index.addCustomRecord({
      url,
      content: `${entry.concept} ${synonymText}`,
      language: "en",
      meta: { title: entry.concept, concept: entry.concept },
      filters: { concept: [entry.concept] },
    });
    if (record.errors.length > 0) {
      throw new Error(
        `Pagefind: addCustomRecord(${entry.concept}) errors: ${record.errors.join(", ")}`,
      );
    }
  }

  // Build the bundle once in memory, then write it to every served root.
  const { files, errors: fileErrors } = await index.getFiles();
  if (fileErrors.length > 0) {
    throw new Error(`Pagefind: getFiles errors: ${fileErrors.join(", ")}`);
  }

  for (const root of OUTPUT_ROOTS) {
    // Skip a root whose parent build dir does not exist (e.g. adapter-vercel
    // output absent in a client-only build), but always write the preview root.
    const parent = dirname(root);
    if (!existsSync(parent)) continue;
    for (const file of files) {
      const target = join(root, file.path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, file.content);
    }
  }

  await pagefind.close();
  // eslint-disable-next-line no-console -- build-time progress log
  console.log(
    `Pagefind: indexed ${indexed.page_count} pages + ${CONCEPT_SYNONYMS.length} concept records → ${OUTPUT_ROOTS.length} roots`,
  );
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console -- build-time fatal
  console.error(err);
  process.exit(1);
});
