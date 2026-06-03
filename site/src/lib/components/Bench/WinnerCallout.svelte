<script lang="ts">
	interface Props {
		ratio: number | null;
		vsLabel?: string;
	}

	let { ratio, vsLabel = 'zod-mock' }: Props = $props();
</script>

{#if ratio != null && ratio > 1}
	<div class="callout">
		<span class="ratio t-num">{ratio.toFixed(1)}×</span>
		<span class="text t-small">faster than {vsLabel}</span>
	</div>
{/if}

<style>
	.callout {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-3);
		background: var(--accent-soft);
		border: 1px solid var(--accent);
		border-radius: 6px;
	}
	.ratio {
		font-size: 18px;
		font-weight: 700;
		color: var(--accent);
		font-family: var(--font-mono);
	}
	.text {
		color: var(--text-muted);
	}
</style>
