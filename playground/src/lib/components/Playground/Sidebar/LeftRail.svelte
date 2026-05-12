<script lang="ts">
	import Accordion from '$lib/components/Primitives/Accordion.svelte';
	import SchemaItem from './SchemaItem.svelte';
	import WorldConfig from './WorldConfig.svelte';
	import { getContext } from 'svelte';
	import type { PlaygroundStore } from '$lib/state.svelte';

	const store = getContext<PlaygroundStore>('playground-store');

	const schemas = $derived(store?.state?.schemas || []);
	const world = $derived(store?.state?.world || { seed: 0, optionalProbability: 0 });
	const activeSchemaId = $derived(store?.state?.activeSchemaId || null);

	function getSectionMeta(id: string): string {
		if (id === 'world') return `seed ${world?.seed ?? 0}`;
		if (id === 'schemas') return String(schemas?.length ?? 0);
		return '';
	}

	function handleAddSchema() {
		store?.addSchema('NewSchema');
		store?.setMobileTab('editor');
	}

	function handleSelectSchema(id: string | null) {
		store?.setActiveSchema(id);
	}
</script>

<aside class="rail">
	<!-- Desktop Rail Content -->
	<div class="desktop-content" data-testid="desktop-content">
		<Accordion
			title="World"
			meta={getSectionMeta('world')}
			open={true}
		>
			<WorldConfig 
				seed={world.seed}
				optionalProbability={world.optionalProbability}
				onupdateseed={(v) => store.setWorldSeed(v)}
				onupdateprob={(v) => store.setOptionalProbability(v)}
				isCompact={true}
			/>
		</Accordion>

		<Accordion
			title="Schemas"
			meta={getSectionMeta('schemas')}
			open={true}
		>
			<div class="list">
				{#each schemas as schema}
					<SchemaItem
						name={schema.name}
						selected={activeSchemaId === schema.id}
						populateCount={schema.populateCount}
						isDerived={!!schema.derivedFrom}
						onclick={() => handleSelectSchema(schema.id)}
					/>
				{/each}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="add-row t-code-sm" onclick={handleAddSchema}>
					<span class="plus">+</span> add schema
				</div>
			</div>
		</Accordion>
	</div>
</aside>

<style>
	.rail {
		width: 100%;
		height: 100%;
		background: var(--bg-1);
		display: flex;
		flex-direction: column;
		user-select: none;
		overflow-y: auto;
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding-bottom: var(--space-2);
	}

	.add-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		margin: var(--space-2) var(--space-2) 0 var(--space-2);
		border: 1px dashed var(--line-strong);
		border-radius: var(--radius-sm);
		color: var(--ink-2);
		cursor: pointer;
		transition: all var(--ease-quick);
	}
	.add-row:hover {
		color: var(--ink-0);
		border-color: var(--accent-edge);
		background: var(--accent-soft);
	}

	@media (max-width: 768px) {
		.rail {
			display: none;
		}
	}
</style>
