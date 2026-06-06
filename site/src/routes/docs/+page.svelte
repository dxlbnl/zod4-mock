<script lang="ts">
	// B100-R11 — /docs landing page.
	// Replaces the previous 307 redirect with a card-grid of the four
	// SIDEBAR groups; each card links into its first entry.

	import DocPage from '$lib/docs/widgets/DocPage.svelte';
	import { SIDEBAR } from '$lib/docs/sidebar.js';
	import { Card } from '@dxlbnl/ui';

	const groups = SIDEBAR.filter((g) => g.links.length > 0);
</script>

<DocPage title="Documentation" sidebarGroup="concepts" order={0}>
	<p>Pick a section to start exploring zod4-mock.</p>

	<div class="card-grid">
		{#each groups as group}
			{@const first = group.links[0]}
			{#if first}
				<Card>
					<a href={first.href} class="group-card" aria-label={group.label}>
						<p class="group-label">{group.label}</p>
						<p class="group-first">{first.label} →</p>
					</a>
				</Card>
			{/if}
		{/each}
	</div>
</DocPage>

<style>
	.card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: var(--u2);
		margin-top: var(--u2);
	}
	.group-card {
		display: flex;
		flex-direction: column;
		gap: var(--u);
		padding: var(--u2);
		text-decoration: none;
		color: inherit;
	}
	.group-label {
		font-size: 11px;
		color: var(--ink-dim);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.group-first {
		font-size: 16px;
		color: var(--amber);
		font-weight: 600;
	}
</style>
