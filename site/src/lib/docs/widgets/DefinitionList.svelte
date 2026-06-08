<script lang="ts" module>
	import type { Snippet } from 'svelte';

	// A non-table, heading-per-member entry (B121). Mirrors the /docs/api
	// `.member-entry` look: the term (mono) + an optional type/value on ONE line,
	// the description as full-width prose beneath. `description` is a Snippet so a
	// Concepts cell's rich content (inline <code>, links, <em>) renders as-is.
	export interface DefinitionEntry {
		/** The term — a code identifier, e.g. `seed`, `ctx.gen`. Rendered mono. */
		term: string;
		/** Optional type/value shown inline after the term, e.g. `number` · `[1, 5]`. */
		type?: string;
		/** Default/value note shown inline after the type, e.g. `(required)`. */
		value?: string;
		/** Full-width prose beneath the term; supports inline code, links, emphasis. */
		description: Snippet;
	}
</script>

<script lang="ts">
	interface Props {
		entries: DefinitionEntry[];
	}

	let { entries }: Props = $props();
</script>

<!-- B121 — non-table definition list. SSR-safe (no window/document at load).
     The container carries [data-deflist]; each term carries [data-term]. -->
<div class="deflist" data-deflist>
	{#each entries as entry (entry.term)}
		<div class="entry">
			<div class="entry-line">
				<span class="term" data-term={entry.term}>{entry.term}</span>
				{#if entry.type}<span class="type">{entry.type}</span>{/if}
				{#if entry.value}<span class="value"> · {entry.value}</span>{/if}
			</div>
			<div class="desc">{@render entry.description()}</div>
		</div>
	{/each}
</div>

<style>
	/* Compose @dxlbnl/ui tokens in @layer site (D21). */
	@layer site {
		.deflist {
			min-width: 0;
		}
		/* Heading-per-member entry: term + type on one line, description beneath.
		   A thin top rule separates entries on a tight --u rhythm (matches /docs/api
		   `.member-entry`). */
		.entry {
			min-width: 0;
			margin: 0;
			padding: var(--u) 0;
			border-top: 1px solid var(--rule);
		}
		.entry:first-child {
			border-top: 0;
		}
		/* Term + type on ONE line. The whole line is a single horizontal-scroll
		   container: a genuinely long type scrolls WITHIN this box rather than
		   widening the page (B114-R6 / B121-R3: no page-level horizontal overflow). */
		.entry-line {
			min-width: 0;
			overflow-x: auto;
			white-space: nowrap;
		}
		/* Term: a case-sensitive code identifier — render mono, mixed-case, never
		   per-char broken (mirrors `.api-root .member-name`). */
		.term {
			font-family: var(--mono);
			font-size: 14px;
			color: var(--ink);
			text-transform: none;
			word-break: normal;
			margin-right: var(--u);
		}
		.type {
			font-family: var(--mono);
			font-size: 13px;
			color: var(--ink-dim);
		}
		.value {
			font-family: var(--mono);
			font-size: 13px;
			color: var(--ink-faint, var(--ink-dim));
		}
		/* Full-width prose: wraps on word boundaries; a genuinely unbreakable token
		   breaks rather than force horizontal overflow (mirrors `.member-desc`). */
		.desc {
			margin: 2px 0 0;
			color: var(--ink);
			word-break: normal;
			overflow-wrap: anywhere;
		}
		.desc :global(code) {
			word-break: normal;
			overflow-wrap: anywhere;
		}
	}
</style>
