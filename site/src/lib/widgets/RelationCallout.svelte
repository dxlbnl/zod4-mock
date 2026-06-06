<script lang="ts">
	import { Stack, Inline, Text } from '@dxlbnl/ui';

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
	<Text variant="eyebrow" class="heading">Cross-entity ID consistency</Text>
	<Stack gap="xs" as="ul" class="list">
		{#each proofs as p}
			<Inline gap="xs" as="li" class="item">
				<span class="field">{p.label}</span>
				<span class="eq">=</span>
				<span class="id highlight">{p.value.slice(0, 8)}…</span>
				<span class="check">✓</span>
				<span class="resolves">{p.resolves}</span>
			</Inline>
		{/each}
	</Stack>
</div>

<style>
	.callout {
		padding: 12px var(--u2);
		border: 1px solid var(--amber);
		border-radius: 8px;
		background: color-mix(in srgb, var(--amber) 20%, transparent);
	}
	:global(.heading) {
		display: block;
		color: var(--amber);
		margin-bottom: var(--u);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	:global(.list) {
		list-style: none;
	}
	:global(.item) {
		font-size: 12px;
	}
	.field {
		font-family: var(--mono);
		color: var(--shiki-token-keyword);
	}
	.eq {
		color: var(--ink-dim);
	}
	.id {
		font-family: var(--mono);
		color: var(--amber);
		font-size: 11px;
	}
	.check {
		color: var(--ok);
	}
	.resolves {
		color: var(--ink-dim);
		font-size: 11px;
	}
</style>
