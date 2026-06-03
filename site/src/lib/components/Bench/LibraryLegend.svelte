<script lang="ts">
	export const LIBRARIES = [
		{ key: 'zod4mock', label: 'zod4-mock', color: 'var(--lib-zod4mock)' },
		{ key: 'zodmock', label: 'zod-mock', color: 'var(--lib-zodmock)' },
		{ key: 'faker', label: 'faker', color: 'var(--lib-faker)' }
	] as const;
</script>

<div class="legend">
	{#each LIBRARIES as lib}
		<div class="item">
			<span class="dot" style="background:{lib.color}"></span>
			<span class="t-small">{lib.label}</span>
		</div>
	{/each}
</div>

<style>
	.legend {
		display: flex;
		gap: var(--space-4);
	}
	.item {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
</style>
