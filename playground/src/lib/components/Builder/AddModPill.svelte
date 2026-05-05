<script lang="ts">
	interface Props {
		active?: boolean;
		onclick?: () => void;
	}

	let { active = false, onclick }: Props = $props();
</script>

<button type="button" class="add-mod" data-active={active} {onclick}>
	+ mod
</button>

<style>
	.add-mod {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 0 6px;
		height: 18px;
		border: 1px dashed var(--line-strong);
		border-radius: var(--r-sm);
		background: transparent;
		color: var(--ink-2);
		font-family: 'JetBrains Mono', monospace;
		font-size: 10.5px;
		cursor: pointer;
		white-space: nowrap;
		position: relative;
		transition:
			background var(--ease-quick),
			border-color var(--ease-quick);
	}
	.add-mod:hover {
		color: var(--ink-0);
		border-color: var(--accent-edge);
		background: var(--accent-soft);
	}
	.add-mod[data-active='true'] {
		background: var(--accent-dim);
		border-color: var(--accent-dim);
		color: #fff;
	}
</style>
