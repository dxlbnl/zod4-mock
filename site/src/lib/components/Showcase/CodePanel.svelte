<script lang="ts">
	import { codeToHtml } from 'shiki';

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
				class="tab seg-item {activeIndex === i ? 'active' : ''}"
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
			<pre class="t-mono">{tabs[activeIndex]?.code ?? ''}</pre>
		{/if}
	</div>
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border);
		border-radius: 8px;
		overflow: hidden;
		background: var(--bg-raised);
	}
	.tabs {
		display: flex;
		border-bottom: 1px solid var(--border);
		background: var(--bg-base);
	}
	.tab {
		border-radius: 0;
		border-right: 1px solid var(--border);
		height: 32px;
		font-size: 12px;
	}
	.tab:last-child {
		border-right: none;
	}
	.code {
		padding: var(--space-4);
		overflow: auto;
		max-height: 480px;
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.6;
	}
	.code :global(pre) {
		margin: 0;
		background: transparent !important;
	}
</style>
