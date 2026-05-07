<script lang="ts">
	interface Props {
		name: string;
		selected?: boolean;
		onclick?: () => void;
	}

	let { name, selected = false, onclick }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
	class="schema-item" 
	data-selected={selected}
	onclick={onclick}
>
	<span class="icon">⬚</span>
	<span class="name t-small">{name}</span>
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

	.schema-item[data-selected='true'] {
		background: var(--accent-soft);
		color: var(--accent-bright);
	}

	.icon {
		font-size: 14px;
		color: var(--ink-3);
	}

	.schema-item[data-selected='true'] .icon {
		color: var(--accent);
	}
</style>
