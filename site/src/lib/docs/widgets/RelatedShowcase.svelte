<script lang="ts">
	// B100-R8 — <RelatedShowcase> embed a /showcase slice inline.
	// Takes an entity prop (review / order / user / product) and renders a
	// JsonTree slice for that entity plus a "see the full demo →" link
	// pointing to /showcase#<entity>.

	import JsonTree from '$lib/widgets/JsonTree.svelte';
	import { generateWorld } from '$lib/runners/ecommerce';

	type Entity = 'review' | 'order' | 'user' | 'product';

	interface Props {
		entity: Entity;
	}

	let { entity }: Props = $props();

	const world = generateWorld(42);

	function pickEntity(e: Entity): unknown {
		switch (e) {
			case 'review':
				return world.reviews[0] ?? null;
			case 'order':
				return world.orders?.[0] ?? null;
			case 'user':
				return world.users[0] ?? null;
			case 'product':
				return world.products[0] ?? null;
		}
	}

	const value = $derived(pickEntity(entity));
</script>

<div class="related-showcase">
	<div class="json-slice">
		<div class="json-tree">
			{#if value !== null}
				<JsonTree {value} />
			{/if}
		</div>
	</div>
	<a class="demo-link" href="/showcase#{entity}">see the full demo →</a>
</div>

<style>
	.related-showcase {
		border: 1px solid var(--rule);
		border-radius: 8px;
		padding: var(--u2);
		display: flex;
		flex-direction: column;
		gap: 12px;
		background: var(--bg-rail);
	}
	.json-slice {
		font-family: var(--mono);
		font-size: 12px;
		overflow: auto;
		max-height: 260px;
	}
	.demo-link {
		font-size: 13px;
		color: var(--amber);
		text-decoration: none;
	}
	.demo-link:hover {
		text-decoration: underline;
	}
</style>
