import adapter from "@sveltejs/adapter-vercel";
import { mdsvex, escapeSvelte } from "mdsvex";
import { codeToHtml } from "shiki";

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
          const html = await codeToHtml(code, {
            lang: lang ?? "text",
            theme: "github-dark-dimmed",
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
  },
};

export default config;
