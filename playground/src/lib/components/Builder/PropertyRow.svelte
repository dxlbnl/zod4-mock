<script lang="ts">
	import TypeChip from '../Primitives/TypeChip.svelte';
	import { tick } from 'svelte';
	import ModifierPill from './ModifierPill.svelte';
	import AddMod from './AddMod.svelte';

	interface Modifier {
		name: string;
		value?: string | number | boolean;
		warn?: boolean;
	}

	interface Props {
		id: string;
		keyName: string;
		type: string;
		indent?: number;
		selected?: boolean;
		warn?: boolean;
		mods?: Modifier[];
		enumValues?: string[];
		
		onselect?: () => void;
		onremove?: () => void;
		onaddprop?: () => void;
		onupdatekey?: (val: string) => void;
		onupdatemodifier?: (index: number, val: string | number | boolean) => void;
		onremovemodifier?: (index: number) => void;
		onaddmod?: (e: MouseEvent | FocusEvent) => void;
		onupdateenumvalues?: (values: string[]) => void;
		onchangetype?: (e: MouseEvent | FocusEvent) => void;
		autofocus?: boolean;
	}

	let { 
		id, 
		keyName, 
		type, 
		indent = 0, 
		selected = false, 
		warn = false, 
		mods = [],
		enumValues = [],
		onselect,
		onremove,
		onaddprop,
		onupdatekey,
		onupdatemodifier,
		onremovemodifier,
		onaddmod,
		onupdateenumvalues,
		onchangetype,
		autofocus = false
	}: Props = $props();

	function handleKeyChange(e: Event) {
		const target = e.target as HTMLInputElement;
		onupdatekey?.(target.value);
	}

	function focusNode(node: HTMLElement) {
		if (selected) node.focus();
	}

	let inputEl = $state<HTMLInputElement>();

	$effect(() => {
		if ((selected || autofocus) && inputEl) {
			inputEl.focus();
		}
	});

	function handleEnumChange(index: number, val: string) {
		const newVals = [...enumValues];
		newVals[index] = val;
		onupdateenumvalues?.(newVals);
	}

	function handleRemoveEnum(index: number) {
		const newVals = [...enumValues];
		newVals.splice(index, 1);
		onupdateenumvalues?.(newVals);
	}

	function handleAddEnum() {
		onupdateenumvalues?.([...enumValues, `val${enumValues.length + 1}`]);
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="row"
	data-selected={selected}
	data-warn={warn}
	data-testid="property-row"
	style="--ind: {12 + indent * 20}px"
	onclick={(e) => {
		if ((e.target as HTMLElement).closest('.type-chip, .add-mod, .modifier-pill, .add-enum-val')) return;
		onselect?.();
	}}
>
	<span class="grip t-number">⋮⋮</span>
	<input
		bind:this={inputEl}
		use:focusNode
		class="key t-code"
		value={keyName}
		placeholder="property_name"
		oninput={handleKeyChange}
		data-key-input
		data-field-id={id}
		onkeydown={(e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				e.stopPropagation();
				onaddprop?.();
			}
		}}
	/>
	<span class="colon t-code">:</span>
	
	<TypeChip 
		{type} 
		active={selected} 
		onclick={onchangetype} 
		onfocus={(e) => {
			const prev = e.relatedTarget as HTMLElement;
			if (prev && prev.hasAttribute('data-key-input')) {
				tick().then(() => onchangetype?.(e));
			}
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				e.stopPropagation();
				onaddprop?.();
			}
		}}
	/>

	<div class="actions">
		{#if type === 'enum'}
			{#each enumValues as val, i}
				<ModifierPill 
					name={val} 
					kind="enum"
					removable={true}
					onremove={() => handleRemoveEnum(i)}
					onchange={(newVal) => handleEnumChange(i, newVal)}
				/>
			{/each}
			<button class="add-enum-val t-code-tight" onclick={handleAddEnum}>+ val</button>
		{/if}

		{#each mods as mod, i}
			<ModifierPill 
				name={mod.name} 
				value={mod.value} 
				warn={mod.warn} 
				removable={true} 
				onremove={() => onremovemodifier?.(i)}
				onchange={(newVal) => onupdatemodifier?.(i, newVal)}
			/>
		{/each}

		<AddMod 
			fieldId={id}
			onclick={onaddmod}
			onfocus={(e) => {
				const prev = e.relatedTarget as HTMLElement;
				if (!prev) return;
				
				const target = e.currentTarget as HTMLElement;
				const sameRow = prev.closest('[data-testid="property-row"]') === target.closest('[data-testid="property-row"]');
				if (sameRow && prev.hasAttribute('data-type-chip')) {
					tick().then(() => onaddmod?.(e));
				}
			}}
			onkeydown={(e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					e.stopPropagation();
					onaddprop?.();
				}
			}}
		/>
	</div>
	
	<button class="remove-row-btn" onclick={(e) => { e.stopPropagation(); onremove?.(); }}>×</button>
</div>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--h-row);
		padding: var(--space-1) var(--space-4) var(--space-1) var(--ind, var(--space-4));
		border-bottom: 1px solid var(--bg-2);
		position: relative;
		flex-wrap: wrap;
		transition: background var(--ease-quick);
	}
	.row:hover {
		background: var(--bg-2);
	}
	.row[data-selected='true'] {
		background: var(--bg-1);
		box-shadow: inset 2px 0 0 var(--accent);
	}
	.row[data-selected='true'] .remove-row-btn,
	.row:hover .remove-row-btn {
		opacity: 1;
	}
	.row .grip {
		cursor: grab;
		color: var(--ink-4);
		font-size: 10px;
		user-select: none;
		opacity: 0;
		transition: opacity var(--ease-quick);
	}
	.row:hover .grip {
		opacity: 1;
	}
	.key {
		background: transparent;
		border: none;
		color: var(--syn-key);
		width: 120px;
		padding: 2px 4px;
		border-radius: var(--r-sm);
	}
	.key:focus {
		outline: none;
		background: var(--bg-3);
		box-shadow: 0 0 0 1px var(--accent-edge);
	}
	.colon {
		color: var(--ink-3);
		margin-right: var(--space-1);
	}
	.actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.remove-row-btn {
		position: absolute;
		right: var(--space-2);
		top: 50%;
		transform: translateY(-50%);
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: none;
		background: transparent;
		color: var(--ink-3);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity var(--ease-quick);
	}

	.remove-row-btn:hover {
		background: var(--red-soft);
		color: var(--red-bright);
	}
</style>
