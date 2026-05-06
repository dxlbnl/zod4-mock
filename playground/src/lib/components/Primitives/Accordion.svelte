<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		meta?: string;
		open?: boolean;
		children?: Snippet;
		ontoggle?: () => void;
	}

	let { title, meta, open = $bindable(false), children, ontoggle }: Props = $props();
</script>

<section class="accordion-section" data-open={open}>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="accordion-head" onclick={() => { open = !open; ontoggle?.(); }}>
		<span class="chev">▶</span>
		<span class="accordion-title t-small">{title}</span>
		{#if meta}
			<span class="accordion-meta t-code-tight">{meta}</span>
		{/if}
	</div>

	{#if open && children}
		<div class="accordion-body">
			{@render children()}
		</div>
	{/if}
</section>

<style>
	.accordion-section {
		display: flex;
		flex-direction: column;
		border-bottom: 1px solid var(--line);
	}

	.accordion-section[data-open='true'] {
		flex: 1;
		min-height: 0;
	}

	.accordion-head {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		cursor: pointer;
		user-select: none;
		background: var(--bg-1);
	}

	.accordion-head:hover {
		background: var(--bg-2);
	}

	.accordion-section[data-open='true'] > .accordion-head {
		background: var(--bg-2);
		color: var(--ink-0);
	}

	.accordion-head .chev {
		color: var(--ink-2);
		font-size: 9px;
		width: 10px;
		transition: transform 0.15s;
		display: flex;
		justify-content: center;
	}

	.accordion-section[data-open='true'] .chev {
		transform: rotate(90deg);
	}

	.accordion-title {
		font-weight: 600;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--ink-1);
	}

	.accordion-section[data-open='true'] .accordion-title {
		color: var(--ink-0);
	}

	.accordion-meta {
		margin-left: auto;
		color: var(--ink-2);
		padding: 1px var(--space-2);
		border: 1px solid var(--line);
		border-radius: var(--r-lg);
	}

	.accordion-body {
		flex: 1;
		overflow-y: auto;
		min-height: 0;
		padding: var(--space-1) var(--space-2) var(--space-3);
	}
</style>
