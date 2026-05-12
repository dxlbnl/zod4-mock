<script lang="ts">
	import type { SchemaDef } from "$lib/state.svelte";
	import Button from '$lib/components/Primitives/Button.svelte';
	import Input from '$lib/components/Primitives/Input.svelte';
	import FancySelect from "$lib/components/Primitives/FancySelect.svelte";

	interface Props {
		schema: SchemaDef;
		schemas: SchemaDef[];
		onadd: (target: string, name: string) => void;
		onremove: (name: string) => void;
	}

	let { schema, schemas, onadd, onremove }: Props = $props();

	let newRelName = $state("");
	let newRelTarget = $state("");

	function handleAdd() {
		if (newRelName && newRelTarget) {
			onadd(newRelTarget, newRelName);
			newRelName = "";
			newRelTarget = "";
		}
	}
</script>

<div class="relations-manager">
	<div class="tags">
		{#each schema.relations as rel}
			{@const target = schemas.find(s => s.id === rel.targetSchemaId)}
			<div class="rel-tag">
				<span class="name">{rel.name}</span>
				<span class="arrow">→</span>
				<span class="target">{target?.name ?? 'Unknown'}</span>
				<button class="remove" onclick={() => onremove(rel.name)}>×</button>
			</div>
		{/each}
	</div>

	<div class="add-form">
		<div class="field">
			<label class="t-eyebrow" for="rel-name">Relation Name</label>
			<Input 
				id="rel-name"
				placeholder="e.g. author" 
				bind:value={newRelName}
			/>
		</div>
		<div class="field">
			<label class="t-eyebrow" for="rel-target">Target Schema</label>
			<FancySelect 
				id="rel-target"
				placeholder="Select target..."
				options={schemas.filter(s => s.id !== schema.id).map(s => ({ label: s.name, value: s.id }))}
				value={newRelTarget}
				onchange={(v) => newRelTarget = v}
			/>
		</div>
		<Button 
			variant="primary" 
			onclick={handleAdd} 
			disabled={!newRelName || !newRelTarget} 
			style="height: var(--h-input);"
		>Add</Button>
	</div>
</div>

<style>
	.relations-manager {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-2);
		background: var(--bg-2);
		border-radius: var(--radius-md);
		border: 1px solid var(--line-strong);
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}

	.rel-tag {
		display: flex;
		align-items: center;
		height: var(--h-btn);
		padding: 0 10px;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-md);
		background: var(--bg-2);
		gap: 4px;
		font-size: 11px;
	}

	.rel-tag .name { color: var(--accent-bright); font-weight: 600; }
	.rel-tag .arrow { color: var(--ink-3); }
	.rel-tag .target { color: var(--ink-1); }

	.remove {
		background: transparent;
		border: 0;
		color: var(--ink-2);
		border-radius: var(--radius-sm);
		cursor: pointer;
		padding: 0 0 0 4px;
		font-size: 14px;
	}
	.remove:hover { color: var(--warn); }

	.add-form {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}

	.add-form :global(.btn) {
		margin-top: 18px; /* Align with inputs below labels */
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		flex: 1;
		min-width: 0;
	}
	
	.field :global(.input) {
		width: 100%;
		min-width: 120px;
	}
	
	.field :global(.fancy-select) {
		width: 140px;
		flex-shrink: 0;
	}
</style>
