<script lang="ts">
	interface Props {
		options: { value: string; label: string }[];
		value?: string;
		onchange?: (value: string) => void;
	}

	let { options, value = $bindable(options[0]?.value ?? ''), onchange }: Props = $props();

	function select(v: string) {
		value = v;
		onchange?.(v);
	}
</script>

<div class="seg" role="tablist">
	{#each options as opt}
		<button
			class="seg-item {value === opt.value ? 'active' : ''}"
			role="tab"
			aria-selected={value === opt.value}
			onclick={() => select(opt.value)}
			type="button"
		>
			{opt.label}
		</button>
	{/each}
</div>

<style>
	.seg {
		display: inline-flex;
		border: 1px solid var(--rule);
		border-radius: 6px;
		overflow: hidden;
		background: var(--bg-rail);
	}
	.seg-item {
		height: 26px;
		padding: 0 12px;
		border: none;
		border-right: 1px solid var(--rule);
		background: transparent;
		color: var(--ink-dim);
		font-family: var(--sans);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition:
			background var(--transition),
			color var(--transition);
	}
	.seg-item:last-child {
		border-right: none;
	}
	.seg-item:hover:not(.active) {
		background: var(--bg-elev);
		color: var(--ink);
	}
	.seg-item.active {
		background: color-mix(in srgb, var(--amber) 20%, transparent);
		color: var(--amber);
	}
</style>
