<script lang="ts">
	interface Props {
		value: number | null;
		unit: string;
		label: string;
		color?: string;
	}

	let { value, unit, label, color = 'var(--ink)' }: Props = $props();

	const formatted = $derived(
		value == null ? '—' : value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(0)
	);
</script>

<div class="badge">
	<span class="value" style="color:{color}">{formatted}<span class="unit"> {unit}</span></span>
	<span class="label">{label}</span>
</div>

<style>
	.badge {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.value {
		font-size: 22px;
		font-weight: 600;
		font-family: var(--mono);
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}
	.unit {
		font-size: 13px;
		font-weight: 400;
		color: var(--ink-dim);
	}
	.label {
		font-size: 11px;
		color: var(--ink-dim);
	}
</style>
