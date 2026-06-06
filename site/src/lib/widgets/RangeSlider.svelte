<script lang="ts">
	interface Props {
		value?: number;
		min?: number;
		max?: number;
		step?: number;
		onchange?: (value: number) => void;
	}

	// Log-scale slider: internal position maps to 10^x
	let { value = $bindable(100), min = 10, max = 10000, onchange }: Props = $props();

	const logMin = $derived(Math.log10(min));
	const logMax = $derived(Math.log10(max));

	let position = $derived(
		Math.round(((Math.log10(value) - logMin) / (logMax - logMin)) * 100)
	);

	const stops = $derived(
		[min, 100, 1000, max].filter((v, i, a) => a.indexOf(v) === i).map((v) => ({
			label: v >= 1000 ? `${v / 1000}k` : String(v),
			pct: Math.round(((Math.log10(v) - logMin) / (logMax - logMin)) * 100)
		}))
	);

	function onInput(e: Event) {
		const pos = Number((e.target as HTMLInputElement).value);
		const newVal = Math.round(10 ** (logMin + (pos / 100) * (logMax - logMin)));
		value = newVal;
		onchange?.(newVal);
	}
</script>

<div class="range-slider">
	<div class="track-row">
		<input
			type="range"
			min="0"
			max="100"
			value={position}
			oninput={onInput}
			class="slider"
		/>
	</div>
	<div class="stops">
		{#each stops as stop}
			<span class="stop" style="left:{stop.pct}%">{stop.label}</span>
		{/each}
	</div>
</div>

<style>
	.range-slider {
		position: relative;
		width: 100%;
		padding-bottom: 20px;
	}
	.track-row {
		width: 100%;
	}
	.slider {
		width: 100%;
		accent-color: var(--amber);
		cursor: pointer;
	}
	.stops {
		position: relative;
		height: 16px;
	}
	.stop {
		position: absolute;
		transform: translateX(-50%);
		color: var(--ink-dim);
		font-size: 10px;
	}
</style>
