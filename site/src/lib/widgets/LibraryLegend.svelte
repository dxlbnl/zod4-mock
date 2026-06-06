<script lang="ts">
	import { Inline, Text } from '@dxlbnl/ui';

	export const LIBRARIES = [
		{ key: 'zod4mock', label: 'zod4-mock', color: 'var(--lib-zod4mock)' },
		{ key: 'zodmock', label: 'zod-mock', color: 'var(--lib-zodmock)' },
		{ key: 'faker', label: 'faker', color: 'var(--lib-faker)' }
	] as const;
</script>

<Inline gap="md" class="legend">
	{#each LIBRARIES as lib}
		<Inline gap="xs">
			<span class="dot" style="background:{lib.color}"></span>
			<Text variant="body" style="font-size: 13px;">{lib.label}</Text>
		</Inline>
	{/each}
</Inline>

<style>
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
</style>
