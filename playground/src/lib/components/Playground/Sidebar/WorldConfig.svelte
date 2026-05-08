<script lang="ts">
	import Input from '$lib/components/Primitives/Input.svelte';

	interface Props {
		seed: number;
		optionalProbability: number;
		onupdateseed?: (val: number) => void;
		onupdateprob?: (val: number) => void;
	}

	let { 
		seed, 
		optionalProbability, 
		onupdateseed, 
		onupdateprob 
	}: Props = $props();
</script>

<div class="world-config">
	<div class="config-row">
		<span class="label t-small">Seed</span>
		<div class="input-wrap">
			<Input 
				type="number" 
				value={String(seed)} 
				oninput={(e) => onupdateseed?.(Number(e.currentTarget.value))}
			/>
		</div>
	</div>

	<div class="config-row">
		<span class="label t-small">Optionality</span>
		<div class="input-wrap">
			<Input 
				type="number" 
				step="0.1" 
				min="0" 
				max="1"
				value={String(optionalProbability)} 
				oninput={(e) => onupdateprob?.(Number(e.currentTarget.value))}
			/>
		</div>
	</div>
</div>

<style>
	.world-config {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4) var(--space-3);
	}

	.config-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
	}

	.label {
		color: var(--ink-2);
	}

	.input-wrap {
		width: 80px;
	}
</style>
