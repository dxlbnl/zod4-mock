<script lang="ts">
	import PropertyRow from '../Builder/PropertyRow.svelte';
	import GroupHeader from '../Builder/GroupHeader.svelte';
	import FieldList from './FieldList.svelte';
	import type { FieldDef, ModifierDef } from '../../state.svelte';

	interface Props {
		fields: FieldDef[];
		selectedFieldId?: string | null;
		lastAddedId?: string | null;
		onselectfield?: (id: string) => void;
		onaddfield?: (parentId?: string) => void;
		onupdatefield?: (id: string, updates: Partial<FieldDef>) => void;
		onaddmod?: (id: string, e: MouseEvent | FocusEvent) => void;
		onchangetype?: (id: string, e: MouseEvent | FocusEvent) => void;
		onremovefield?: (id: string) => void;
		onremovemodifier?: (fieldId: string, index: number) => void;
		onaddprop?: () => void;
	}

	let {
		fields,
		selectedFieldId,
		lastAddedId,
		onselectfield,
		onaddfield,
		onupdatefield,
		onaddmod,
		onchangetype,
		onremovefield,
		onremovemodifier,
		onaddprop
	}: Props = $props();
</script>

{#each fields as field (field.id)}
	{#if field.kind === 'group'}
		<GroupHeader 
			id={field.id}
			name={field.key} 
			type={field.type} 
			indent={field.indent}
			isOpen={true}
			onselect={() => onselectfield?.(field.id)}
			onchangetype={(e) => onchangetype?.(field.id, e)}
			onupdatekey={(val) => onupdatefield?.(field.id, { key: val })}
		/>
		{#if field.children}
			<FieldList 
				fields={field.children} 
				{selectedFieldId} 
				{lastAddedId}
				{onselectfield} 
				{onaddfield}
				{onupdatefield}
				{onaddmod} 
				{onchangetype} 
				{onremovefield}
				{onremovemodifier}
				onaddprop={() => onaddfield?.(field.id)}
			/>
		{/if}
		<!-- Nested add button -->
		<div class="nested-add" style="--ind: {12 + (field.indent + 1) * 20}px">
			<button type="button" class="add-btn-small t-code-tight" onclick={() => onaddfield?.(field.id)}>
				+ add property
			</button>
		</div>
	{:else}
		<PropertyRow
			id={field.id}
			keyName={field.key}
			type={field.type}
			mods={field.modifiers}
			selected={selectedFieldId === field.id}
			autofocus={lastAddedId === field.id}
			indent={field.indent}
			onselect={() => onselectfield?.(field.id)}
			onupdatekey={(val) => onupdatefield?.(field.id, { key: val })}
			onaddmod={(e) => onaddmod?.(field.id, e)}
			onchangetype={(e) => onchangetype?.(field.id, e)}
			onremove={() => onremovefield?.(field.id)}
			onremovemodifier={(modId) => onremovemodifier?.(field.id, Number(modId))}
			{onaddprop}
		/>
	{/if}
{/each}

<style>
	.nested-add {
		padding: var(--space-1) var(--space-4) var(--space-1) var(--ind);
		border-bottom: 1px solid var(--bg-2);
	}
	.add-btn-small {
		background: transparent;
		border: 0;
		color: var(--ink-3);
		cursor: pointer;
		padding: 2px 0;
		transition: color var(--ease-quick);
	}
	.add-btn-small:hover {
		color: var(--accent);
	}
</style>
