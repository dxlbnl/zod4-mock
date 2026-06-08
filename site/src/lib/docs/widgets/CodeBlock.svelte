<script lang="ts">
	// B109 (item 1) — a build-time PLAIN-highlighted (Shiki-only) static guide code block.
	//
	// Renders the PRE-HIGHLIGHTED HTML produced at BUILD time by
	// `site/scripts/build-code-blocks.ts` (Shiki dual-theme, NO twoslash). Unlike
	// <CodeSample> there are no `[data-sample]` / twoslash type-link semantics — these are
	// illustrative fragments that reference schemas defined elsewhere, so they cannot be
	// type-checked. The HTML is plain serializable markup imported from the generated
	// module, so nothing from twoslash ships in the client bundle (D13). SSR-safe: no
	// window/document at module load (D22).
	//
	// The block is keyed by `id` into `code-blocks.generated.ts`. Its tokens are coloured
	// Shiki spans carrying `--shiki-light` / `--shiki-dark` so the site palette switch
	// recolours them (the `.shiki` / `[data-palette]` rules in app.css).
	import { CODE_BLOCKS } from '$lib/docs/api/code-blocks.generated.js';

	interface Props {
		/** The block id, matching an entry in src/lib/docs/code-blocks.ts. */
		id: string;
	}

	let { id }: Props = $props();

	const html = $derived(CODE_BLOCKS[id] ?? '');
</script>

{#if html}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- build-time Shiki HTML from a trusted generated module (B109) -->
	<div class="code-block">{@html html}</div>
{:else}
	<div class="code-block">
		<pre><code>{`/* code block "${id}" not found */`}</code></pre>
	</div>
{/if}

<style>
	/* Compose @dxlbnl/ui tokens in @layer site (D21). The wrapper owns the frame; Shiki's
	   own <pre> carries the theme background + token colours (palette-switched globally in
	   app.css via the `.shiki` / `[data-palette]` rules). */
	@layer site {
		.code-block {
			margin: 12px 0;
			border-radius: 8px;
			border: 1px solid var(--rule);
			overflow: hidden;
			min-width: 0;
		}
		.code-block :global(pre.shiki) {
			margin: 0;
			padding: var(--u2);
			font-family: var(--mono);
			font-size: 13px;
			line-height: 1.65;
			/* Wrap long lines rather than overflow the page (B114-R6). */
			white-space: pre-wrap;
			word-break: normal;
			overflow-wrap: anywhere;
		}
		.code-block :global(pre.shiki code) {
			font-family: inherit;
			white-space: inherit;
		}
	}
</style>
