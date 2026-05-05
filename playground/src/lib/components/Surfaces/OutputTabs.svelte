<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Tab {
		label: string;
		id: string;
		meta?: string;
		status?: 'active' | 'inactive';
	}

	interface Props {
		tabs: Tab[];
		activeTab?: string;
		actions?: Snippet;
		onchange?: (id: string) => void;
	}

	let { tabs, activeTab = $bindable(), actions, onchange }: Props = $props();
</script>

<div class="output-tabs">
	{#each tabs as tab}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="output-tab"
			aria-selected={activeTab === tab.id}
			onclick={() => {
				activeTab = tab.id;
				onchange?.(tab.id);
			}}
		>
			<span class="dot" data-status={tab.status || 'inactive'}></span>
			{tab.label}
			{#if tab.meta}
				<span class="meta">{tab.meta}</span>
			{/if}
		</div>
	{/each}
	<div class="actions">
		{@render actions?.()}
	</div>
</div>

<style>
	.output-tabs {
		background: var(--bg-2);
		border-bottom: 1px solid var(--line);
		height: 32px;
		display: flex;
		align-items: stretch;
	}

	.output-tab {
		padding: 0 14px;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		border-right: 1px solid var(--line);
		color: var(--ink-2);
		font-size: 12px;
		cursor: pointer;
		user-select: none;
		transition:
			background var(--ease-quick),
			color var(--ease-quick);
	}

	.output-tab:hover {
		background: var(--bg-1);
		color: var(--ink-1);
	}

	.output-tab[aria-selected='true'] {
		background: var(--bg-1);
		color: var(--ink-0);
		box-shadow: inset 0 -1px 0 var(--accent);
	}

	.output-tab .dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--ink-3);
	}

	.output-tab .dot[data-status='active'] {
		background: var(--accent);
	}

	.output-tab[aria-selected='true'] .dot[data-status='active'] {
		box-shadow: 0 0 4px var(--accent);
	}

	.output-tab .meta {
		color: var(--ink-2);
		font-family: 'JetBrains Mono', monospace;
		font-size: 11px;
	}

	.actions {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0 10px;
	}
</style>
