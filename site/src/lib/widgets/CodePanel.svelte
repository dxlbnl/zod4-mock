<script lang="ts">
	import { codeToHtml } from 'shiki';
	import { Text } from '@dxlbnl/ui';

	interface Tab {
		label: string;
		code: string;
	}

	interface Props {
		tabs: Tab[];
	}

	let { tabs }: Props = $props();
	let activeIndex = $state(0);

	let rendered = $state<string[]>([]);

	$effect(() => {
		Promise.all(
			tabs.map((t) =>
				codeToHtml(t.code, {
					lang: 'typescript',
					theme: 'github-dark-dimmed'
				})
			)
		).then((r) => {
			rendered = r;
		});
	});
</script>

<div class="panel">
	<div class="tabs">
		{#each tabs as tab, i}
			<button
				class="tab {activeIndex === i ? 'active' : ''}"
				onclick={() => (activeIndex = i)}
				type="button"
			>
				{tab.label}
			</button>
		{/each}
	</div>
	<div class="code">
		{#if rendered[activeIndex]}
			{@html rendered[activeIndex]}
		{:else}
			<Text variant="mono" as="pre">{tabs[activeIndex]?.code ?? ''}</Text>
		{/if}
	</div>
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--rule);
		border-radius: 8px;
		overflow: hidden;
		background: var(--bg-rail);
	}
	.tabs {
		display: flex;
		border-bottom: 1px solid var(--rule);
		background: var(--bg);
	}
	.tab {
		height: 32px;
		padding: 0 12px;
		border: none;
		border-right: 1px solid var(--rule);
		border-radius: 0;
		background: transparent;
		color: var(--ink-dim);
		font-family: var(--mono);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition:
			background var(--transition),
			color var(--transition);
	}
	.tab:last-child {
		border-right: none;
	}
	.tab:hover:not(.active) {
		background: var(--bg-elev);
		color: var(--ink);
	}
	.tab.active {
		background: color-mix(in srgb, var(--amber) 20%, transparent);
		color: var(--amber);
	}
	.code {
		padding: var(--u2);
		overflow: auto;
		max-height: 480px;
		font-family: var(--mono);
		font-size: 12px;
		line-height: 1.6;
	}
	.code :global(pre) {
		margin: 0;
		background: transparent !important;
	}
</style>
