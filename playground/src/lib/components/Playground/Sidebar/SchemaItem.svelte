<script lang="ts">
	interface Props {
		name: string;
		selected?: boolean;
		populateCount?: number;
		isDerived?: boolean;
		onclick?: () => void;
	}

	let { 
		name, 
		selected = false, 
		populateCount = 0, 
		isDerived = false,
		onclick 
	}: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
	class="schema-item" 
	class:selected
	onclick={onclick}
	data-testid="schema-item"
>
	<span class="icon">
		{#if isDerived}
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
		{:else if populateCount > 0}
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><line x1="3" x2="21" y1="9" y2="9"></line><line x1="9" x2="9" y1="21" y2="9"></line></svg>
		{:else}
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
		{/if}
	</span>
	
	<span class="name t-small">{name}</span>

	{#if populateCount > 0}
		<span class="count-badge">{populateCount}</span>
	{/if}
</div>

<style>
	.schema-item {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-4);
		cursor: pointer;
		color: var(--ink-2);
		transition: all var(--ease-quick);
		border-radius: var(--r-sm);
		margin: 0 var(--space-1);
	}

	.schema-item:hover {
		background: var(--bg-hover);
		color: var(--ink-0);
	}

	.schema-item.selected {
		background: var(--accent-soft);
		color: var(--accent-bright);
	}

	.icon {
		display: flex;
		align-items: center;
		color: var(--ink-3);
	}

	.selected .icon {
		color: var(--accent);
	}

	.name {
		flex: 1;
		font-weight: 500;
	}

	.count-badge {
		font-size: 10px;
		background: var(--bg-3);
		color: var(--ink-3);
		padding: 1px 6px;
		border-radius: 10px;
		font-family: var(--font-mono);
	}

	.selected .count-badge {
		background: var(--accent-bright);
		color: white;
	}
</style>
