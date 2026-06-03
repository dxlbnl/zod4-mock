<script lang="ts">
	interface Props {
		label: string;
		ms: number | null;
	}

	let { label, ms }: Props = $props();
</script>

<div class="badge">
	<span class="t-caption">{label}</span>
	<span class="time t-num">{ms != null ? `${ms.toFixed(1)}ms` : '—'}</span>
</div>

<style>
	.badge {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-3);
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg-raised);
	}
	.time {
		font-family: var(--font-mono);
		font-size: 13px;
		color: var(--accent);
	}
</style>
