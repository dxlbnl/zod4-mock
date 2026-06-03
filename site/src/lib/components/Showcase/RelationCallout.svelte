<script lang="ts">
	interface Proof {
		label: string;
		value: string;
		resolves: string;
	}

	interface Props {
		proofs: Proof[];
	}

	let { proofs }: Props = $props();
</script>

<div class="callout">
	<p class="heading t-label">Cross-entity ID consistency</p>
	<ul class="list">
		{#each proofs as p}
			<li class="item">
				<span class="field t-mono">{p.label}</span>
				<span class="eq t-caption">=</span>
				<span class="id t-mono highlight">{p.value.slice(0, 8)}…</span>
				<span class="check">✓</span>
				<span class="resolves t-caption">{p.resolves}</span>
			</li>
		{/each}
	</ul>
</div>

<style>
	.callout {
		padding: var(--space-3) var(--space-4);
		border: 1px solid var(--accent);
		border-radius: 8px;
		background: var(--accent-soft);
	}
	.heading {
		color: var(--accent);
		margin-bottom: var(--space-2);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: 12px;
	}
	.field {
		color: var(--syn-keyword);
	}
	.eq {
		color: var(--text-muted);
	}
	.id {
		color: var(--accent);
		font-size: 11px;
	}
	.check {
		color: var(--success);
	}
	.resolves {
		color: var(--text-muted);
	}
</style>
