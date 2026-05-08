<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from '$lib/components/Primitives/Button.svelte';

	interface Props {
		title: string;
		accentTitle?: string;
		subtitle?: string;
		children?: Snippet;
		actions?: Snippet;
		onupdatetitle?: (val: string) => void;
	}

	let { title, accentTitle, subtitle, children, actions, onupdatetitle }: Props = $props();

	function handleInput(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		onupdatetitle?.(val);
	}
</script>

<section class="pane">
	<div class="pane-head">
		<div class="pane-title-container">
			{#if onupdatetitle}
				<input 
					type="text" 
					class="pane-title-input t-title" 
					value={title}
					oninput={handleInput}
				/>
			{:else}
				<span class="pane-title t-title">{title}</span>
			{/if}
			{#if accentTitle}
				<span class="pane-title t-title">
					· <span class="accent">{accentTitle}</span>
				</span>
			{/if}
		</div>
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
	.pane-title-container {
		display: flex;
		align-items: center;
		min-width: 0;
		flex: 1;
	}
	.pane-title-input {
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--r-sm);
		color: var(--ink-0);
		padding: 2px 4px;
		margin-left: -4px;
		width: auto;
		min-width: 50px;
		max-width: 300px;
		transition: all var(--ease-quick);
		flex: 1;
	}
	.pane-title-input:hover {
		background: var(--bg-2);
	}
	.pane-title-input:focus {
		background: var(--bg-0);
		border-color: var(--accent-edge);
		outline: none;
		box-shadow: 0 0 0 2px var(--accent-soft);
	}
	.pane-title {
		color: var(--ink-0);
		white-space: nowrap;
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
