<script lang="ts">
	interface Props {
		status?: 'ok' | 'warn';
		statusLabel?: string;
		counts?: string[];
		seed?: string | number;
		meta?: string;
		version?: string;
	}

	let {
		status = 'ok',
		statusLabel = 'valid',
		counts = [],
		seed,
		meta,
		version
	}: Props = $props();
</script>

<div class="statusbar">
	<span class={status}>● {statusLabel}</span>

	{#each counts as count}
		<span class="seg-mark">│</span>
		<span>{count}</span>
	{/each}

	{#if seed !== undefined}
		<span class="seg-mark">│</span>
		<span>seed {seed}</span>
	{/if}

	<div class="grow"></div>

	{#if meta}
		<span>{meta}</span>
	{/if}

	{#if version}
		<span class="seg-mark">│</span>
		<span>{version}</span>
	{/if}
</div>

<style>
	.statusbar {
		display: flex;
		align-items: center;
		height: 24px;
		padding: 0 12px;
		background: var(--bg-1);
		border-top: 1px solid var(--line);
		font-family: 'JetBrains Mono', monospace;
		font-size: 11px;
		color: var(--ink-2);
		gap: 8px;
	}
	.statusbar .ok {
		color: var(--ok);
	}
	.statusbar .warn {
		color: var(--warn);
	}
	.statusbar .seg-mark {
		color: var(--ink-3);
		font-weight: 300;
	}
	.statusbar .grow {
		flex: 1;
	}
</style>
