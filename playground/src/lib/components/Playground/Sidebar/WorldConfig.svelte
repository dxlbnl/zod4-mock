<script lang="ts">
	interface Props {
		seed: number;
		optionalProbability: number;
		onupdateseed?: (val: number) => void;
		onupdateprob?: (val: number) => void;
		isCompact?: boolean;
	}

	let { 
		seed, 
		optionalProbability, 
		onupdateseed, 
		onupdateprob,
		isCompact = false
	}: Props = $props();
</script>

<div class="world-config" class:is-compact={isCompact}>
	<div class="config-section">
		<label>
			<span class="t-small">Generation Seed</span>
			<div class="control">
				<input 
					type="number" 
					value={seed} 
					oninput={(e) => onupdateseed?.(Number(e.currentTarget.value))}
					class="t-code-sm"
				/>
				{#if !isCompact}
					<p class="help t-code-tight">Deterministic results for the same seed.</p>
				{/if}
			</div>
		</label>
	</div>

	<div class="config-section">
		<label>
			<span class="t-small">Optionality</span>
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
</div>

<style>
	.world-config {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
		padding: var(--space-4);
	}

	.is-compact {
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
	}

	.config-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.is-compact .config-section {
		gap: var(--space-1);
	}

	label {
		font-weight: 700;
		text-transform: uppercase;
		color: var(--ink-3);
		letter-spacing: 0.05em;
	}

	.control {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	input[type="number"] {
		background: var(--bg-1);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		padding: var(--space-1) var(--space-2);
		color: var(--ink-1);
		width: 100%;
		max-width: 120px;
	}

	.is-compact input[type="number"] {
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
