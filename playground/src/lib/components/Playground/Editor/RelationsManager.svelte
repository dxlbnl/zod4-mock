<script lang="ts">
	import type { SchemaDef } from "$lib/state.svelte";
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
		<input 
			type="text" 
			placeholder="relation name" 
			bind:value={newRelName}
		/>
		<FancySelect 
			placeholder="Target..."
			options={schemas.filter(s => s.id !== schema.id).map(s => ({ label: s.name, value: s.id }))}
			value={newRelTarget}
			onchange={(v) => newRelTarget = v}
		/>
		<button type="button" onclick={handleAdd} disabled={!newRelName || !newRelTarget} data-testid="add-rel-btn">Add</button>
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
		gap: 4px;
		background: var(--bg-1);
		border: 1px solid var(--line);
		padding: 2px 8px;
		border-radius: var(--radius-sm);
		font-size: 11px;
	}

	.rel-tag .name { color: var(--accent-bright); font-weight: 600; }
	.rel-tag .arrow { color: var(--ink-3); }
	.rel-tag .target { color: var(--ink-1); }

	.remove {
		background: transparent;
		border: none;
		color: var(--ink-3);
		cursor: pointer;
		padding: 0 0 0 4px;
		font-size: 14px;
	}
	.remove:hover { color: var(--red); }

	.add-form {
		display: flex;
		gap: 4px;
	}

	input {
		background: var(--bg-1);
		border: 1px solid var(--line);
		color: var(--ink-1);
		font-size: 11px;
		padding: 2px 4px;
		border-radius: 4px;
	}

	input { flex: 1; }

	button {
		background: var(--accent-bright);
		color: white;
		border: none;
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 11px;
		cursor: pointer;
	}
	button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
