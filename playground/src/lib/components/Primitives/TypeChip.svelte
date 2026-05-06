<script lang="ts">
	interface Props {
		type: string;
		active?: boolean;
		onclick?: () => void;
	}

	let { type, active = false, onclick }: Props = $props();
</script>

<button type="button" class="type-chip t-code-tight" data-active={active} {onclick}>
	{type}
	<span class="chev">▾</span>
</button>

<style>
	.type-chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		padding: 1px var(--space-2);
		background: var(--bg-3);
		border: 1px solid var(--line-strong);
		border-radius: var(--r-sm);
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
