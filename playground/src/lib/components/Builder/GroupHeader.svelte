<script lang="ts">
	import TypeChip from '../Primitives/TypeChip.svelte';
	import { tick } from 'svelte';

	interface Props {
		id: string;
		name: string;
		type: string;
		isOpen?: boolean;
		indent?: number;
		onselect?: () => void;
		ontoggle?: () => void;
		onchangetype?: (e: MouseEvent | FocusEvent) => void;
		onupdatekey?: (val: string) => void;
	}

	let { 
		id, 
		name, 
		type, 
		isOpen = true, 
		indent = 0, 
		onselect,
		ontoggle, 
		onchangetype,
		onupdatekey
	}: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
	class="group-head t-code-sm" 
	data-testid="property-row" 
	data-field-id={id}
	style="--ind: {12 + indent * 20}px" 
	onclick={(e) => {
		if ((e.target as HTMLElement).closest('.type-chip, .gkey')) return;
		onselect?.();
	}}
>
	<span class="grip t-number">⋮⋮</span>
	<span 
		class="chev t-code-tight" 
		role="button" 
		tabindex="0"
		onclick={(e) => {
			e.stopPropagation();
			ontoggle?.();
		}}
	>
		{isOpen ? '▾' : '▶'}
	</span>
	<input
		class="gkey t-code"
		value={name}
		placeholder="object_name"
		oninput={(e) => onupdatekey?.(e.currentTarget.value)}
		data-key-input
		data-field-id={id}
	/>
	<span class="colon">:</span>
	<TypeChip 
		{type} 
		onclick={onchangetype}
		onfocus={(e) => {
			const prev = e.relatedTarget as HTMLElement;
			if (prev && prev.hasAttribute('data-key-input')) {
				tick().then(() => onchangetype?.(e));
			}
		}}
	/>
</div>

<style>
	.group-head {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-1) var(--space-4) var(--space-1) var(--ind, var(--space-4));
		color: var(--ink-2);
		border-bottom: 1px solid var(--line);
		background: var(--bg-2);
		height: var(--h-btn);
		cursor: pointer;
	}
	.group-head .chev {
		color: var(--ink-3);
		width: 10px;
	}
	.grip {
		cursor: grab;
		color: var(--ink-4);
		font-size: 10px;
		user-select: none;
		opacity: 0;
		transition: opacity var(--ease-quick);
	}
	.group-head:hover .grip {
		opacity: 1;
	}
	.gkey {
		background: transparent;
		border: none;
		color: var(--ink-1);
		font-weight: 500;
		width: 120px;
		padding: 2px 4px;
		border-radius: var(--r-sm);
	}
	.gkey:focus {
		outline: none;
		background: var(--bg-3);
		box-shadow: 0 0 0 1px var(--accent-edge);
	}
	.group-head .colon {
		color: var(--ink-3);
	}
</style>
