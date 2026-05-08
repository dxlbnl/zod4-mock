<script lang="ts">
	interface Props {
		from: string;
		to: string;
		name: string;
		cardinality: string;
		onremove?: () => void;
		onclick?: () => void;
		key?: string;
	}

	let { from, to, name, cardinality, onremove, onclick, key }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="rel-item" onclick={onclick}>
	<div class="info">
		<div class="main t-code-sm">
			<span class="subj-name">{from}</span>
			<span class="arrow">→</span>
			<span class="rel-name">{name}</span>
			<span class="arrow">→</span>
			<span class="subj-name">{to}</span>
		</div>
		<div class="meta t-code-tight">
			{cardinality}
			{#if key}
				<span class="key-tag">via {key}</span>
			{/if}
		</div>
	</div>
	
	<button class="remove-btn" title="Remove relationship" onclick={onremove}>
		<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
	</button>
</div>

<style>
	.rel-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: var(--bg-1);
		border: 1px solid var(--line);
		border-radius: var(--r-sm);
		margin: 0 var(--space-2);
		transition: all var(--ease-quick);
	}
	.rel-item:hover {
		border-color: var(--line-strong);
		background: var(--bg-2);
	}

	.info {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.main {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		color: var(--ink-1);
	}

	.subj-name {
		font-weight: 600;
		color: var(--ink-0);
	}

	.rel-name {
		color: var(--accent-bright);
		font-style: italic;
	}

	.arrow {
		color: var(--ink-3);
		font-size: 10px;
	}

	.meta {
		color: var(--ink-3);
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.key-tag {
		color: var(--accent);
		opacity: 0.8;
		font-weight: 500;
	}

	.remove-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border: none;
		background: transparent;
		color: var(--ink-3);
		cursor: pointer;
		border-radius: var(--r-sm);
		transition: all var(--ease-quick);
		opacity: 0;
	}
	.rel-item:hover .remove-btn {
		opacity: 1;
	}
	.remove-btn:hover {
		background: var(--accent-soft);
		color: var(--accent-bright);
	}
</style>
