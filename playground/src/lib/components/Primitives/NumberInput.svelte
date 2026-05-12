<script lang="ts">
	interface Props {
		id?: string;
		value: number;
		min?: number;
		max?: number;
		step?: number;
		onchange?: (val: number) => void;
	}

	let { 
		id, 
		value = $bindable(), 
		min = 0, 
		max = 9999, 
		step = 1,
		onchange 
	}: Props = $props();

	function handleIncrement() {
		const newVal = Math.min(max, value + step);
		if (newVal !== value) {
			value = newVal;
			onchange?.(value);
		}
	}

	function handleDecrement() {
		const newVal = Math.max(min, value - step);
		if (newVal !== value) {
			value = newVal;
			onchange?.(value);
		}
	}

	function handleInput(e: Event & { currentTarget: HTMLInputElement }) {
		const val = parseInt(e.currentTarget.value);
		if (!isNaN(val)) {
			value = Math.max(min, Math.min(max, val));
			onchange?.(value);
		}
	}
</script>

<div class="number-input">
	<input
		{id}
		type="number"
		{value}
		{min}
		{max}
		{step}
		oninput={handleInput}
	/>
	<div class="controls">
		<button class="control-btn" onclick={handleIncrement} type="button" aria-label="Increase">
			<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
		</button>
		<button class="control-btn" onclick={handleDecrement} type="button" aria-label="Decrease">
			<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
		</button>
	</div>
</div>

<style>
	.number-input {
		display: flex;
		align-items: center;
		background: var(--bg-2);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		overflow: hidden;
		width: 100%;
		height: var(--h-input);
	}

	.number-input:focus-within {
		border-color: var(--accent-bright);
		box-shadow: 0 0 0 2px var(--accent-soft);
	}

	input {
		flex: 1;
		background: transparent;
		border: none;
		padding: 0 var(--space-2);
		color: var(--ink-1);
		font-family: var(--t-number);
		font-size: 11px;
		min-width: 0;
		outline: none;
		appearance: textfield;
	}

	input::-webkit-outer-spin-button,
	input::-webkit-inner-spin-button {
		appearance: none;
		margin: 0;
	}

	.controls {
		display: flex;
		flex-direction: column;
		border-left: 1px solid var(--line);
		height: 100%;
		width: 20px;
	}

	.control-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		color: var(--ink-3);
		cursor: pointer;
		padding: 0;
		transition: all var(--ease-quick);
	}

	.control-btn:hover {
		background: var(--bg-3);
		color: var(--ink-1);
	}

	.control-btn:first-child {
		border-bottom: 1px solid var(--line);
	}
</style>
