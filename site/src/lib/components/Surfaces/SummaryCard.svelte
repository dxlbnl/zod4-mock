<script lang="ts">
	interface Props {
		headline: string;
		unit?: string;
		description: string;
		color?: string;
	}

	let { headline, unit = '', description, color = 'var(--accent)' }: Props = $props();
</script>

<div class="card">
	<div class="headline">
		<span class="value t-num" style="color:{color}">{headline}</span>
		{#if unit}<span class="unit t-caption"> {unit}</span>{/if}
	</div>
	<p class="desc t-small">{description}</p>
</div>

<style>
	.card {
		padding: var(--space-4) var(--space-5);
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg-raised);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.headline {
		display: flex;
		align-items: baseline;
		gap: 4px;
	}
	.value {
		font-size: 32px;
		font-weight: 700;
		font-family: var(--font-mono);
		line-height: 1;
	}
	.unit {
		color: var(--text-muted);
	}
	.desc {
		color: var(--text-muted);
	}
</style>
