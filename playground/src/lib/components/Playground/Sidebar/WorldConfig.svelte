<script lang="ts">
	import FancySelect from '$lib/components/Primitives/FancySelect.svelte';
	import NumberInput from '$lib/components/Primitives/NumberInput.svelte';

	interface Props {
		seed: number;
		optionalProbability: number;
		onupdateseed?: (val: number) => void;
		onupdateprob?: (val: number) => void;
		
		zodVersion?: string;
		availableZodVersions?: string[];
		onchangezod?: (v: string) => void;

		isCompact?: boolean;
	}

	let { 
		seed, 
		optionalProbability, 
		onupdateseed, 
		onupdateprob,
		zodVersion = '',
		availableZodVersions = [],
		onchangezod,
		isCompact = false
	}: Props = $props();
</script>

<div class="world-config" class:is-compact={isCompact}>
	<div class="config-section">
		<label>
			<span class="section-label">Generation Seed</span>
			<div class="control">
				<NumberInput 
					value={seed} 
					onchange={onupdateseed}
				/>
				{#if !isCompact}
					<p class="help t-code-tight">Deterministic results for the same seed.</p>
				{/if}
			</div>
		</label>
	</div>

	<div class="config-section">
		<label>
			<span class="section-label">Optionality</span>
			<div class="control">
				<div class="slider-row">
					<input 
						type="range" 
						min="0" 
						max="1" 
						step="0.1"
						value={optionalProbability} 
						oninput={(e) => onupdateprob?.(Number(e.currentTarget.value))}
					/>
					<span class="val t-code-sm">{Math.round(optionalProbability * 100)}%</span>
				</div>
				{#if !isCompact}
					<p class="help t-code-tight">Chance of an optional field being generated.</p>
				{/if}
			</div>
		</label>
	</div>

	{#if zodVersion && availableZodVersions.length > 0}
		<div class="config-section">
			<label>
				<span class="section-label">Zod Version</span>
				<div class="control">
					<FancySelect
						options={availableZodVersions.map(v => ({ label: `zod@${v}`, value: v }))}
						value={zodVersion}
						onchange={onchangezod}
					/>
					{#if !isCompact}
						<p class="help t-code-tight">Changing version reloads the Zod library.</p>
					{/if}
				</div>
			</label>
		</div>
	{/if}
</div>

<style>
	.world-config {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	.is-compact {
		gap: var(--space-3);
	}

	.config-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.is-compact .config-section {
		gap: var(--space-1);
	}

	.section-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		color: var(--ink-3);
		letter-spacing: 0.05em;
		margin-bottom: var(--space-1);
		display: block;
	}

	label {
		display: block;
	}

	.control {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	:global(.number-input) {
		max-width: 120px;
	}

	.is-compact :global(.number-input) {
		max-width: 80px;
	}

	.slider-row {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	input[type="range"] {
		flex: 1;
		height: 4px;
		background: var(--line-strong);
		border-radius: 2px;
		appearance: none;
		cursor: pointer;
	}

	input[type="range"]::-webkit-slider-thumb {
		appearance: none;
		width: 12px;
		height: 12px;
		background: var(--accent-bright);
		border-radius: 50%;
		transition: transform 0.1s ease;
	}

	input[type="range"]::-webkit-slider-thumb:hover {
		transform: scale(1.2);
	}

	.val {
		min-width: 3ch;
		color: var(--ink-2);
	}

	.help {
		color: var(--ink-3);
		opacity: 0.8;
	}
</style>
