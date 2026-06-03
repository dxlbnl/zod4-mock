<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import BenchChart from './BenchChart.svelte';

	const { Story } = defineMeta({
		title: 'Bench/BenchChart',
		component: BenchChart,
		tags: ['autodocs']
	});
</script>

<Story
	name="With results"
	args={{
		results: [
			{ label: 'zod4-mock', color: '#a78bfa', warm: { avg: 0.024, min: 0.02, max: 0.03, opsPerSec: 41667, coldStart: 0.1 } },
			{ label: 'zod-mock', color: '#fbbf24', warm: { avg: 0.075, min: 0.06, max: 0.09, opsPerSec: 13333, coldStart: 0.3 } },
			{ label: 'faker', color: '#34d399', warm: { avg: 0.035, min: 0.03, max: 0.045, opsPerSec: 28571, coldStart: 0.15 } }
		]
	}}
	play={async ({ canvasElement }) => {
		await expect(canvasElement.querySelector('canvas')).toBeInTheDocument();
	}}
/>

<Story
	name="Empty"
	args={{
		results: [
			{ label: 'zod4-mock', color: '#a78bfa', warm: null },
			{ label: 'zod-mock', color: '#fbbf24', warm: null },
			{ label: 'faker', color: '#34d399', warm: null }
		]
	}}
	play={async ({ canvasElement }) => {
		await expect(canvasElement.querySelector('canvas')).toBeInTheDocument();
	}}
/>
