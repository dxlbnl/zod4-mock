<script lang="ts">
	interface Option {
		label: string;
		value: string;
	}

	interface Props {
		id?: string;
		options: Option[];
		value: string;
		placeholder?: string;
		disabled?: boolean;
		onchange?: (value: string) => void;
	}

	let { id, options, value, placeholder, disabled = false, onchange }: Props = $props();

	function handleInput(e: Event) {
		const target = e.target as HTMLSelectElement;
		onchange?.(target.value);
	}
</script>

<div class="select-wrapper" class:disabled>
	<select 
		{id} 
		{disabled} 
		bind:value 
		onchange={handleInput}
		class="t-code-tight"
	>
		{#if placeholder}
			<option value="" disabled selected>{placeholder}</option>
		{/if}
		{#each options as opt}
			<option value={opt.value}>{opt.label}</option>
		{/each}
	</select>
	<div class="chevron">
		<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
			<path d="m6 9 6 6 6-6"/>
		</svg>
	</div>
</div>

<style>
	.select-wrapper {
		position: relative;
		display: flex;
		align-items: center;
		width: 100%;
		background: var(--bg-1);
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
		transition: all 0.15s ease;
		overflow: hidden;
	}

	.select-wrapper:hover:not(.disabled) {
		border-color: var(--ink-3);
		background: var(--bg-0);
	}

	.select-wrapper:focus-within {
		border-color: var(--accent-bright);
		box-shadow: 0 0 0 2px var(--accent-dim);
	}

	select {
		appearance: none;
		background: transparent;
		border: none;
		padding: 0 var(--space-8) 0 var(--space-3);
		height: var(--h-input);
		width: 100%;
		color: var(--ink-1);
		cursor: pointer;
		outline: none;
	}

	select:disabled {
		cursor: not-allowed;
		color: var(--ink-3);
	}

	.chevron {
		position: absolute;
		right: var(--space-3);
		pointer-events: none;
		color: var(--ink-3);
		display: flex;
		align-items: center;
	}

	.disabled {
		opacity: 0.6;
		background: var(--bg-2);
	}
</style>
