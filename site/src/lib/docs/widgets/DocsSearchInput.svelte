<script lang="ts">
	// B128 — visible, styled docs search input (supersedes B104's button→Modal UI).
	//
	// A visible <input type="search"> mounted at the top of the docs sidebar; typing
	// queries the build-time Pagefind index and renders a styled results dropdown
	// beneath the input. The B104 Pagefind engine (index build + concept synonyms)
	// is KEPT unchanged — only the query surface changes.
	//
	// Per D22 the Pagefind bundle is loaded only after mount / in the browser, never
	// at module load / SSR. The widget carries data-pagefind-ignore so it is excluded
	// from the index it queries.

	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { PagefindApi } from '$lib/docs/pagefind.js';

	type Hit = { url: string; title: string; excerpt: string };
	type ConceptSummary = { term: string; pages: number };

	let query = $state('');
	let hits = $state<Hit[]>([]);
	let concepts = $state<ConceptSummary[]>([]);
	let dismissed = $state(false);
	let loadError = $state(false);

	let pagefind: PagefindApi | null = null;

	// Results show whenever there is a non-empty query that hasn't been dismissed
	// and the engine produced something to show (hits, concepts, or an error/empty
	// state). Escape sets `dismissed`; typing again clears it.
	const hasQuery = $derived(query.trim().length > 0);
	const showResults = $derived(hasQuery && !dismissed);

	async function loadPagefind(): Promise<PagefindApi | null> {
		if (pagefind) return pagefind;
		try {
			// /pagefind/pagefind.js is emitted by the build's index step and served
			// from the static root. The path is held in a variable + @vite-ignore so
			// neither Vite nor tsc try to resolve this runtime-only bundle at build time.
			const bundleUrl = '/pagefind/pagefind.js';
			const mod = (await import(/* @vite-ignore */ bundleUrl)) as PagefindApi;
			pagefind = mod;
			return mod;
		} catch {
			loadError = true;
			return null;
		}
	}

	onMount(() => {
		if (browser) void loadPagefind();
	});

	async function runSearch(term: string): Promise<void> {
		const api = await loadPagefind();
		if (!api) return;

		if (term.trim().length === 0) {
			hits = [];
			concepts = [];
			return;
		}

		const response = await api.search(term);
		const datas = await Promise.all(response.results.slice(0, 10).map((r) => r.data()));
		hits = datas.map((d) => ({
			url: d.url,
			title: d.meta.title ?? d.url,
			excerpt: d.excerpt
		}));

		// R3 (B104-R7) — concept-filter summary: per-term page counts for the
		// `concept` filter Pagefind built from the <DefRef data-pagefind-meta> tags.
		const counts = await api.filters();
		const conceptCounts = counts.concept ?? {};
		concepts = Object.entries(conceptCounts)
			.filter(([term2]) => term2.toLowerCase().includes(term.trim().toLowerCase()))
			.map(([term2, pages]) => ({ term: term2, pages }));
	}

	function onInput(event: Event): void {
		dismissed = false;
		query = (event.currentTarget as HTMLInputElement).value;
		void runSearch(query);
	}

	function onKeydown(event: KeyboardEvent): void {
		// Escape dismisses the open results list; the input stays focused + usable.
		if (event.key === 'Escape' && showResults) {
			event.preventDefault();
			dismissed = true;
		}
	}

	function dismiss(): void {
		dismissed = true;
	}

	function strip(url: string): string {
		// Normalise pagefind URLs to a site-rooted /docs path.
		return url.replace(/\.html$/, '').replace(/\/index$/, '');
	}
</script>

<svelte:window onkeydown={(e) => onKeydown(e)} />

<div class="docs-search" data-docs-search data-pagefind-ignore>
	<input
		type="search"
		class="docs-search-input"
		aria-label="Search docs"
		placeholder="Search the docs…"
		value={query}
		oninput={onInput}
		onfocus={() => {
			dismissed = false;
		}}
	/>

	{#if showResults}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="docs-search-results"
			data-docs-search-results
			role="listbox"
			aria-label="Search results"
		>
			{#if loadError}
				<p class="empty">Search index unavailable.</p>
			{:else}
				{#if concepts.length > 0}
					<div class="concepts">
						<p class="concepts-heading">Concepts</p>
						<ul>
							{#each concepts as c (c.term)}
								<li>{c.term} ({c.pages} {c.pages === 1 ? 'page' : 'pages'})</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if hits.length > 0}
					<ul class="results">
						{#each hits as hit (hit.url)}
							<li>
								<a href={strip(hit.url)} onclick={dismiss}>
									<span class="result-title">{hit.title}</span>
									<!-- eslint-disable-next-line svelte/no-at-html-tags -- Pagefind excerpt is build-time HTML highlight markup -->
									<span class="result-excerpt">{@html hit.excerpt}</span>
								</a>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="empty">No results for "{query}".</p>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	.docs-search {
		position: relative;
		width: 100%;
		margin-bottom: var(--u2);
	}
	.docs-search-input {
		width: 100%;
		height: auto;
		padding: var(--u) 10px;
		border: 1px solid var(--rule);
		border-radius: 6px;
		background: var(--bg-rail);
		color: var(--ink);
		font-family: inherit;
		font-size: 13px;
	}
	.docs-search-input::placeholder {
		color: var(--ink-dim);
	}
	.docs-search-input:focus-visible {
		outline: none;
		border-color: var(--amber);
		box-shadow: 0 0 0 1px var(--amber);
	}
	.docs-search-results {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		z-index: 20;
		max-height: 60vh;
		overflow-y: auto;
		padding: var(--u);
		border: 1px solid var(--rule);
		border-radius: 6px;
		background: var(--bg-rail);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
		display: flex;
		flex-direction: column;
		gap: var(--u);
	}
	.results {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--u);
	}
	.results a {
		display: flex;
		flex-direction: column;
		gap: 2px;
		text-decoration: none;
		color: var(--ink);
		padding: 4px 6px;
		border-radius: 4px;
	}
	.results a:hover,
	.results a:focus-visible {
		background: color-mix(in oklab, var(--amber) 12%, transparent);
		outline: none;
	}
	.result-title {
		color: var(--amber);
		font-weight: 600;
		font-size: 13px;
	}
	.result-excerpt {
		color: var(--ink-dim);
		font-size: 12px;
	}
	.concepts {
		font-size: 13px;
	}
	.concepts-heading {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ink-dim);
		margin-bottom: 4px;
	}
	.concepts ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.concepts li {
		color: var(--ink);
	}
	.empty {
		color: var(--ink-dim);
		font-size: 13px;
	}
</style>
