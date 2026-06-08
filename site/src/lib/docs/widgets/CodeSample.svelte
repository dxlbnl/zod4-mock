<script lang="ts">
	// B126 — a build-time-highlighted docs code sample (Q1 option b).
	//
	// Renders the PRE-HIGHLIGHTED, twoslash-linked HTML produced at BUILD time by
	// `site/scripts/build-samples.ts` (Shiki + Twoslash) — NOT a client-side highlighter
	// and NOT the interactive <Playground>/CodeMirror editor. The HTML is plain
	// serializable markup imported from the generated module, so nothing from twoslash
	// ships in the client bundle (D13). SSR-safe: no window/document at module load (D22).
	//
	// The sample is keyed by `id` into `samples.generated.ts`. Its type tokens render as
	// `<a href="/docs/api#…">` links into the API reference (B126-R3); its tokens are
	// coloured Shiki spans carrying `--shiki-light` / `--shiki-dark` so the site palette
	// switch recolours them (B126-R5).
	import { SAMPLES } from '$lib/docs/api/samples.generated.js';

	interface Props {
		/** The sample id, matching an entry in src/lib/docs/samples.ts. */
		id: string;
	}

	let { id }: Props = $props();

	const html = $derived(SAMPLES[id] ?? '');
</script>

{#if html}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- build-time Shiki+Twoslash HTML from a trusted generated module (B126) -->
	<figure class="code-sample" data-sample={id}>{@html html}</figure>
{:else}
	<figure class="code-sample" data-sample={id}>
		<pre><code>{`/* sample "${id}" not found */`}</code></pre>
	</figure>
{/if}

<style>
	/* Compose @dxlbnl/ui tokens in @layer site (D21). The wrapper owns the frame; Shiki's
	   own <pre> carries the theme background + token colours (palette-switched globally in
	   app.css via the `.shiki` / `[data-palette]` rules). */
	@layer site {
		.code-sample {
			margin: 12px 0;
			border-radius: 8px;
			border: 1px solid var(--rule);
			overflow: hidden;
			min-width: 0;
		}
		.code-sample :global(pre.shiki) {
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
		.code-sample :global(pre.shiki code) {
			font-family: inherit;
			white-space: inherit;
		}
		.code-sample :global(a.twoslash-type-link) {
			color: inherit;
			text-decoration: underline;
			text-decoration-color: var(--amber);
			text-underline-offset: 2px;
		}
	}
</style>
