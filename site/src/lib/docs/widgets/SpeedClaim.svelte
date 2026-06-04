<script lang="ts">
	// B100-R6 — <SpeedClaim> honest-framing primitive (D17/D20).
	// All four props are REQUIRED including `source` — TypeScript will
	// reject any <SpeedClaim> usage missing `source`. Renders a StatCard
	// with a visible citation line.

	import { StatCard } from '@dxlbnl/ui';

	interface Props {
		tier: 'simple' | 'user' | 'nested' | 'matcher';
		value: string;
		vs: string;
		source: string;
	}

	let { tier, value, vs, source }: Props = $props();
</script>

<div class="speed-claim">
	<StatCard label={`${tier} tier`} value={value} sublabel={vs} />
	<p class="source"><span class="src-label">source:</span> {source}</p>
</div>

<style>
	.speed-claim {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.source {
		font-family: var(--mono);
		font-size: 11px;
		color: var(--ink-dim);
	}
	.src-label {
		color: var(--ink-faint, var(--ink-dim));
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
</style>
