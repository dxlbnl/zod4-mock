<script lang="ts">
	import TypeChip from '../Primitives/TypeChip.svelte';

	interface Props {
		name: string;
		type: string;
		isOpen?: boolean;
		indent?: number;
		ontoggle?: () => void;
	}

	let { name, type, isOpen = true, indent = 0, ontoggle }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="group-head t-code-sm" style="padding-left: {12 + indent * 20}px" onclick={ontoggle}>
	<span class="chev t-code-tight">{isOpen ? '▾' : '▶'}</span>
	<span class="gname">{name}</span>
	<span class="colon">:</span>
	<TypeChip {type} />
</div>

<style>
	.group-head {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-1) var(--space-4);
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
	.group-head .gname {
		color: var(--ink-1);
		font-weight: 500;
	}
	.group-head .colon {
		color: var(--ink-3);
	}
</style>
