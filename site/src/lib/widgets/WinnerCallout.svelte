<script lang="ts">
	import { Inline, Text } from '@dxlbnl/ui';

	interface Props {
		ratio: number | null;
		vsLabel?: string;
	}

	let { ratio, vsLabel = 'zod-mock' }: Props = $props();
</script>

{#if ratio != null && ratio > 1}
	<Inline gap="xs" class="callout">
		<span class="ratio">{ratio.toFixed(1)}×</span>
		<Text variant="body" color="dim" class="text">faster than {vsLabel}</Text>
	</Inline>
{/if}

<style>
	:global(.callout) {
		padding: 4px 12px;
		background: color-mix(in srgb, var(--amber) 20%, transparent);
		border: 1px solid var(--amber);
		border-radius: 6px;
	}
	.ratio {
		font-size: 18px;
		font-weight: 700;
		color: var(--amber);
		font-family: var(--mono);
		font-variant-numeric: tabular-nums;
	}
	:global(.text) {
		font-size: 13px;
	}
</style>
