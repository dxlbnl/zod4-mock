<script lang="ts">
	import TypeChip from '../Primitives/TypeChip.svelte';
	import ModPill from './ModPill.svelte';
	import AddModPill from './AddModPill.svelte';

	interface Modifier {
		name: string;
		value?: string | number;
		warn?: boolean;
	}

	interface Props {
		keyName: string;
		type: string;
		mods?: Modifier[];
		selected?: boolean;
		warn?: boolean;
		indent?: number;
		onselect?: () => void;
		onchangekey?: (name: string) => void;
		onchangetype?: () => void;
		onaddmod?: () => void;
	}

	let {
		keyName = $bindable(),
		type,
		mods = [],
		selected = false,
		warn = false,
		indent = 0,
		onselect,
		onchangekey,
		onchangetype,
		onaddmod
	}: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="row"
	data-selected={selected}
	data-warn={warn}
	style="--ind: {12 + indent * 20}px"
	onclick={onselect}
>
	<span class="grip">⋮⋮</span>
	<input
		class="key mono"
		bind:value={keyName}
		size={keyName?.length || 1}
	/>
	<span class="colon">:</span>
	<TypeChip {type} active={selected} onclick={onchangetype} />

	{#each mods as mod}
		<ModPill name={mod.name} value={mod.value} warn={mod.warn} removable={true} />
	{/each}

	<AddModPill onclick={onaddmod} />
</div>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: var(--row-h);
		padding: 4px 12px 4px var(--ind, 12px);
		border-bottom: 1px solid var(--bg-2);
		position: relative;
		flex-wrap: wrap;
		transition: background var(--ease-quick);
	}
	.row:hover {
		background: var(--bg-2);
	}
	.row[data-selected='true'] {
		background: var(--accent-soft);
		box-shadow: inset 2px 0 0 var(--accent);
	}
	.row[data-warn='true'] {
		background: var(--warn-soft);
		box-shadow: inset 2px 0 0 var(--warn);
	}

	.row .grip {
		color: var(--ink-3);
		font-family: 'JetBrains Mono', monospace;
		font-size: 11px;
		cursor: grab;
		opacity: 0;
		transition: opacity var(--ease-quick);
	}
	.row:hover .grip {
		opacity: 1;
	}

	.row .key {
		background: transparent;
		border: 0;
		color: var(--ink-0);
		font-family: 'JetBrains Mono', monospace;
		font-size: 12px;
		padding: 2px 0;
		min-width: 0;
		width: auto;
	}
	.row .key:focus {
		outline: 0;
		color: var(--accent-bright);
	}
	.row .colon {
		color: var(--ink-3);
		font-family: 'JetBrains Mono', monospace;
	}
</style>
