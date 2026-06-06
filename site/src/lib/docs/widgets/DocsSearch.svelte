<script lang="ts">
	// B104-R4/R5/R7 — docs search widget.
	//
	// A thin custom overlay built from @dxlbnl/ui primitives over the Pagefind JS
	// API (Open question 2's recommendation). Per D22 the Pagefind bundle is loaded
	// only after mount / in the browser — never at module load / SSR. The widget
	// carries data-pagefind-ignore so it is excluded from the index it queries.

	import { onMount, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { Modal, Button, Input, Stack } from '@dxlbnl/ui';
	import type { PagefindApi } from '$lib/docs/pagefind.js';

	// The runtime-only Pagefind bundle lives at /pagefind/pagefind.js in the built
	// site; it is not resolvable at build time, so it is imported dynamically behind
	// onMount/browser (D22) and typed via the PagefindApi shape above.

	type Hit = { url: string; title: string; excerpt: string };
	type ConceptSummary = { term: string; pages: number };

	let open = $state(false);
	let query = $state('');
	let hits = $state<Hit[]>([]);
	let concepts = $state<ConceptSummary[]>([]);

	let pagefind: PagefindApi | null = null;
	let loadError = $state(false);

	let inputWrap = $state<HTMLElement | undefined>();

	async function openOverlay(): Promise<void> {
		open = true;
		// BLOCKER fix (B104 designer pass): @dxlbnl/ui's Modal does not move focus
		// into the panel on open, so a keyboard user never lands in the searchbox.
		// The Modal mounts the panel via a client $effect, so wait two ticks for the
		// inner <input> to exist, then focus it. The @dxlbnl/ui Input does not expose
		// a bindable ref, so reach the inner element through the wrapper.
		await tick();
		await tick();
		inputWrap?.querySelector('input')?.focus();
	}

	function closeOverlay(): void {
		open = false;
	}

	function onKeydown(event: KeyboardEvent): void {
		// BLOCKER fix (B104 designer pass): the Modal's native cancel/Escape is not
		// dismissing the overlay here (× + backdrop do work), so close on Escape
		// from a site-side handler. Does not interfere with typing in the input.
		if (event.key === 'Escape' && open) {
			event.preventDefault();
			closeOverlay();
		}
	}

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

		// R7 — concept-filter summary: pull the per-term page counts for the
		// `concept` filter Pagefind built from the <DefRef data-pagefind-meta> tags.
		const counts = await api.filters();
		const conceptCounts = counts.concept ?? {};
		concepts = Object.entries(conceptCounts)
			.filter(([term2]) => term2.toLowerCase().includes(term.trim().toLowerCase()))
			.map(([term2, pages]) => ({ term: term2, pages }));
	}

	function onInput(event: Event): void {
		query = (event.currentTarget as HTMLInputElement).value;
		void runSearch(query);
	}

	function strip(url: string): string {
		// Normalise pagefind URLs to a site-rooted /docs path.
		return url.replace(/\.html$/, '').replace(/\/index$/, '');
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="docs-search" data-pagefind-ignore>
	<Button variant="ghost" aria-label="Search docs" onclick={openOverlay}>Search</Button>

	<Modal {open} title="Search docs" onclose={closeOverlay}>
		<Stack gap="md">
			<div class="input-wrap" bind:this={inputWrap}>
				<Input
					type="search"
					role="searchbox"
					aria-label="Search docs"
					placeholder="Search the docs…"
					value={query}
					oninput={onInput}
				/>
			</div>

			{#if loadError}
				<p class="empty">Search index unavailable.</p>
			{/if}

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
							<a href={strip(hit.url)}>
								<span class="result-title">{hit.title}</span>
								<!-- eslint-disable-next-line svelte/no-at-html-tags -- Pagefind excerpt is built-time HTML highlight markup -->
								<span class="result-excerpt">{@html hit.excerpt}</span>
							</a>
						</li>
					{/each}
				</ul>
			{:else if query.trim().length > 0 && !loadError}
				<p class="empty">No results for "{query}".</p>
			{/if}
		</Stack>
	</Modal>
</div>

<style>
	.docs-search {
		display: inline-flex;
	}
	.input-wrap {
		display: contents;
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
	}
	.result-title {
		color: var(--amber);
		font-weight: 600;
	}
	.result-excerpt {
		color: var(--ink-dim);
		font-size: 13px;
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
	.empty {
		color: var(--ink-dim);
		font-size: 13px;
	}
</style>
