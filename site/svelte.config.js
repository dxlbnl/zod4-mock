import adapter from "@sveltejs/adapter-vercel";
import { mdsvex, escapeSvelte } from "mdsvex";
import { codeToHtml } from "shiki";
import { rendererRich, transformerTwoslash } from "@shikijs/twoslash";

// B126 — the Twoslash transformer slotted into the EXISTING Shiki call (a transformer
// add, not a new pipeline). It runs build-time only (D13-exempt). It is gated to fences
// that explicitly opt in with `twoslash` meta and is NEVER applied to a `playground`
// fence (D18 preserved — the playground branch below short-circuits first). The guide
// code samples that B126 type-checks + links are rendered by the build-time
// `<CodeSample>` (site/scripts/twoslash-highlight.ts); this wiring keeps the markdown
// fence path twoslash-capable through the same Shiki call.
const twoslashTransformer = transformerTwoslash({
  explicitTrigger: true,
  renderer: rendererRich(),
});

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: [".svelte", ".md"],
  preprocess: [
    mdsvex({
      extensions: [".md"],
      highlight: {
        highlighter: async (code, lang, meta) => {
          if (meta?.includes("playground")) {
            const encoded = Buffer.from(code).toString("base64");
            return `<div data-playground="${encoded}"></div>`;
          }
          // A `twoslash`-meta fence is type-checked + highlighted through the same
          // dual-theme Shiki call now carrying the twoslash transformer; every other
          // (non-playground) fence is highlighted as before. The transformer is never
          // applied to a playground fence (handled above).
          const useTwoslash = meta?.includes("twoslash");
          const html = await codeToHtml(code, {
            lang: lang ?? "text",
            themes: { light: "github-light", dark: "github-dark-dimmed" },
            defaultColor: false,
            transformers: useTwoslash ? [twoslashTransformer] : [],
          });
          return escapeSvelte(html);
        },
      },
    }),
  ],
  compilerOptions: {
    // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
    runes: ({ filename }) => (filename.split(/[/\\]/).includes("node_modules") ? undefined : true),
  },
  kit: {
    adapter: adapter({ runtime: "nodejs22.x" }),
    prerender: {
      // A dangling doc cross-reference anchor should warn, not hard-fail the
      // whole build/deploy.
      handleMissingId: "warn",
    },
  },
};

export default config;
