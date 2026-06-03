<script lang="ts">
	import { page } from '$app/stores';

	let { children } = $props();

	const nav = [
		{ href: '/docs/getting-started', label: 'Getting Started' },
		{ href: '/docs/api', label: 'API Reference' },
		{ href: '/docs/relational', label: 'Relational Guide' },
		{ href: '/docs/comparison', label: 'Library Comparison' }
	];

	const pathname = $derived($page.url.pathname);

	function isActive(href: string): boolean {
		return pathname === href;
	}
</script>

<div class="docs-layout">
	<aside class="docs-sidebar">
		<p class="sidebar-heading t-label">Documentation</p>
		{#each nav as item}
			<a
				href={item.href}
				class="docs-nav-link {isActive(item.href) ? 'active' : ''}"
			>
				{item.label}
			</a>
		{/each}
	</aside>
	<div>
		{@render children()}
	</div>
</div>

<style>
	.sidebar-heading {
		color: var(--text-muted);
		padding: var(--space-1) var(--space-3);
		margin-bottom: var(--space-1);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
</style>
