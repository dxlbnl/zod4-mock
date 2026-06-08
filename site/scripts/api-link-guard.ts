/**
 * B125-R8 — build-time dangling-link guard for the /docs/api reference.
 *
 * Build-time only (D13-exempt: node:* + reads the generated model). Validates that
 * every cross-reference rendered on /docs/api resolves to a real on-page anchor — the
 * symbol anchors (`#<Symbol>`) and member anchors (`#<Symbol>.<member>`) the
 * `+page.svelte` emits from the API model. A type-reference link or `{@link}` whose
 * target anchor is absent is a B119-class dead link; this guard exits non-zero and
 * names the offending link so the build fails rather than shipping it silently.
 *
 * Run as part of `pnpm build` (site package.json), before `vite build` prerenders.
 */

import { API_MODEL, type ApiRef } from "../src/lib/docs/api/api-model.generated.js";

// The complete set of anchors the rendered page exposes:
//  - every symbol anchor
//  - every option/config field anchor (`<Symbol>.<field>`)
//  - every interface method anchor (`<Symbol>.<method>`)
const anchors = new Set<string>();
for (const sym of API_MODEL) {
  anchors.add(sym.anchor);
  for (const f of sym.fields ?? []) anchors.add(`${sym.anchor}.${f.name}`);
  for (const m of sym.methods ?? []) anchors.add(m.anchor);
}

interface Dangling {
  symbol: string;
  where: string;
  text: string;
  anchor: string;
}
const dangling: Dangling[] = [];

function checkRef(symbol: string, where: string, ref: ApiRef): void {
  if (ref.anchor === null) return; // external/un-anchored type — rendered as plain text
  if (!anchors.has(ref.anchor)) {
    dangling.push({ symbol, where, text: ref.text, anchor: ref.anchor });
  }
}

for (const sym of API_MODEL) {
  for (const link of sym.links) checkRef(sym.name, "@link", link);
  for (const p of sym.params ?? []) {
    for (const seg of p.type) checkRef(sym.name, `param ${p.name}`, seg);
    for (const f of p.expanded ?? []) {
      for (const seg of f.type) checkRef(sym.name, `option ${p.name}.${f.name}`, seg);
    }
  }
  for (const f of sym.fields ?? []) {
    for (const seg of f.type) checkRef(sym.name, `field ${f.name}`, seg);
  }
  for (const g of sym.inherited ?? []) {
    for (const inh of g.fields) {
      checkRef(sym.name, `inherited ${g.from}.${inh.name}`, { text: inh.name, anchor: inh.anchor });
    }
  }
}

if (dangling.length > 0) {
  // eslint-disable-next-line no-console -- build-time fatal
  console.error(
    `api-link-guard: ${dangling.length} dangling /docs/api cross-reference(s):\n` +
      dangling
        .map((d) => `  - ${d.symbol} (${d.where}) → "${d.text}" #${d.anchor} (no such anchor)`)
        .join("\n"),
  );
  process.exit(1);
}

// eslint-disable-next-line no-console -- build-time progress log
console.log(`api-link-guard: OK — ${anchors.size} anchors, 0 dangling cross-references`);
