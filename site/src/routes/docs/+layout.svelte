<script lang="ts">
	// B100-R10 / B100-R15 — docs chrome.
	// Sidebar driven by the typed SIDEBAR manifest. data-pagefind-ignore
	// applied to the <aside> chrome so B104 search doesn't index nav.
	// Active link carries aria-current="page".

	import { page } from '$app/stores';
	import { SIDEBAR } from '$lib/docs/sidebar.js';

	let { children } = $props();

	// Defensive: in Storybook component-test renders, $page may be
	// undefined (no sveltekit_experimental.stores.page parameter set).
	const pathname = $derived($page?.url?.pathname ?? '/docs');

	// Find the SIDEBAR link with the longest href that's a prefix of the
	// current pathname (handles both /docs/getting-started exact match
	// and /docs landing falling back to the first link).
	const activeHref = $derived.by(() => {
		let best: string | null = null;
		for (const group of SIDEBAR) {
			for (const link of group.links) {
				if (pathname === link.href) return link.href;
				if (pathname.startsWith(link.href)) {
					if (best === null || link.href.length > best.length) best = link.href;
				}
			}
		}
		if (best !== null) return best;
		// Fallback so storybook chrome stories have a deterministic active link.
		for (const group of SIDEBAR) {
			if (group.links.length > 0 && group.links[0]) return group.links[0].href;
		}
		return null;
	});
</script>

<div class="docs-layout">
	<aside class="docs-sidebar" data-pagefind-ignore aria-label="Documentation navigation">
		{#each SIDEBAR as group}
			{#if group.links.length > 0}
				<div class="group">
					<p class="sidebar-heading t-label">{group.label}</p>
					{#each group.links as link}
						{#if link.href === activeHref}
							<a
								href={link.href}
								class="docs-nav-link active"
								aria-current="page"
							>
								{link.label}
							</a>
						{:else}
							<a href={link.href} class="docs-nav-link">{link.label}</a>
						{/if}
					{/each}
				</div>
			{/if}
		{/each}
	</aside>
	<div>
		{@render children()}
	</div>
</div>

<style>
	.docs-layout {
		display: grid;
		grid-template-columns: 220px 1fr;
		gap: var(--space-6);
		align-items: start;
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-bottom: var(--space-4);
	}
	.sidebar-heading {
		color: var(--ink-dim);
		padding: var(--space-1) var(--space-3);
		margin-bottom: var(--space-1);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 11px;
	}
</style>
