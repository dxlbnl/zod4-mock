<script lang="ts">
	// B100-R7 — <DefRef> concept tooltip / inline glossary.
	// Emits `data-pagefind-meta="concept:<term>"` on its rendered element
	// for B104's concept index. Element is a focusable <button> so
	// keyboard users can reach the tooltip.

	import type { Snippet } from 'svelte';

	interface Props {
		term: string;
		children?: Snippet;
	}

	let { term, children }: Props = $props();
</script>

<button
	type="button"
	class="def-ref"
	data-pagefind-meta="concept:{term}"
	aria-label={term}
>
	{#if children}{@render children()}{:else}{term}{/if}
</button>

<style>
	.def-ref {
		appearance: none;
		background: none;
		border: none;
		padding: 0;
		font: inherit;
		color: var(--amber);
		border-bottom: 1px dotted var(--amber);
		cursor: help;
	}
	.def-ref:hover,
	.def-ref:focus-visible {
		color: var(--ink);
		outline: none;
		border-bottom-style: solid;
	}
</style>
