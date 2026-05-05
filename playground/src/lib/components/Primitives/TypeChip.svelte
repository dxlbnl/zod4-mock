<script lang="ts">
	interface Props {
		type: string;
		active?: boolean;
		onclick?: () => void;
	}

	let { type, active = false, onclick }: Props = $props();
</script>

<button type="button" class="type-chip" data-active={active} {onclick}>
	{type}
	<span class="chev">▾</span>
</button>

<style>
	.type-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 1px 6px;
		background: var(--bg-3);
		border: 1px solid var(--line-strong);
		border-radius: var(--r-sm);
		font-family: 'JetBrains Mono', monospace;
		font-size: 11px;
		color: var(--syn-type);
		cursor: pointer;
		transition:
			background var(--ease-quick),
			border-color var(--ease-quick);
	}
	.type-chip[data-active='true'] {
		border-color: var(--accent-edge);
		background: var(--accent-soft);
		color: var(--accent-bright);
	}
	.type-chip .chev {
		color: var(--ink-3);
		font-size: 8px;
	}
</style>
