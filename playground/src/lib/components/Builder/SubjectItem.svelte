<script lang="ts">
	interface Props {
		name: string;
		count?: number;
		badge?: string;
		selected?: boolean;
		onclick?: () => void;
	}

	let { name, count, badge, selected = false, onclick }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="subj" aria-selected={selected} {onclick}>
	<span class="grip t-number">⋮⋮</span>
	<span class="name t-small">{name}</span>
	{#if count !== undefined}
		<span class="count t-code-tight">{count}</span>
	{/if}
	{#if badge}
		<span class="badge t-code-tight">{badge}</span>
	{/if}
</div>

<style>
	.subj {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-1) var(--space-3);
		border-radius: var(--r-sm);
		cursor: pointer;
		user-select: none;
		border: 1px solid transparent;
		transition: background var(--ease-quick);
	}

	.subj:hover {
		background: var(--bg-2);
	}

	.subj[aria-selected='true'] {
		background: var(--accent-soft);
		border-color: var(--accent-edge);
	}

	.subj .grip {
		color: var(--ink-3);
		cursor: grab;
	}

	.subj .name {
		font-weight: 500;
		color: var(--ink-0);
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.subj[aria-selected='true'] .name {
		color: var(--accent-bright);
	}

	.subj .count {
		color: var(--ink-2);
	}

	.subj .badge {
		color: var(--ink-2);
		padding: 1px 5px;
		border: 1px solid var(--line);
		border-radius: var(--r-lg);
	}
</style>
