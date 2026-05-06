<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from '../Primitives/Button.svelte';

	interface Props {
		title: string;
		accentTitle?: string;
		subtitle?: string;
		children?: Snippet;
		actions?: Snippet;
	}

	let { title, accentTitle, subtitle, children, actions }: Props = $props();
</script>

<section class="pane">
	<div class="pane-head">
		<span class="pane-title t-title">
			{title}
			{#if accentTitle}
				· <span class="accent">{accentTitle}</span>
			{/if}
		</span>
		{#if subtitle}
			<span class="pane-sub t-code-sm">{subtitle}</span>
		{/if}
		<div class="pane-actions">
			{#if actions}
				{@render actions()}
			{:else}
				<Button variant="ghost" class="icon-btn" aria-label="Settings">⚙</Button>
			{/if}
		</div>
	</div>
	<div class="pane-body">
		{@render children?.()}
	</div>
</section>

<style>
	.pane {
		display: flex;
		flex-direction: column;
		min-height: 0;
		min-width: 0;
		border-right: 1px solid var(--line);
		background: var(--bg-1);
		height: 100%;
	}
	.pane:last-child {
		border-right: 0;
	}
	.pane-head {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		height: var(--h-pane-head);
		padding: 0 var(--space-4);
		border-bottom: 1px solid var(--line);
		background: var(--bg-1);
		flex-shrink: 0;
	}
	.pane-title {
		color: var(--ink-0);
	}
	.pane-title .accent {
		color: var(--accent-bright);
	}
	.pane-sub {
		color: var(--ink-2);
	}
	.pane-actions {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.pane-body {
		flex: 1;
		overflow: auto;
		min-height: 0;
		min-width: 0;
	}
</style>
