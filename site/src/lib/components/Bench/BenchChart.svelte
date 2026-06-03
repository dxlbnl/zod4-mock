<script lang="ts">
	import { Bar } from 'svelte-chartjs';
	import { Chart, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';
	import type { TooltipItem } from 'chart.js';
	import type { BenchResult } from '$lib/bench';
	import { browser } from '$app/environment';

	Chart.register(BarElement, CategoryScale, LinearScale, Tooltip);

	function resolveColor(color: string): string {
		if (browser && color.startsWith('var(--')) {
			const prop = color.slice(4, -1);
			return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
		}
		return color;
	}

	interface LibResult {
		label: string;
		color: string;
		warm: BenchResult | null;
	}

	interface Props {
		results: LibResult[];
	}

	let { results }: Props = $props();

	const data = $derived({
		labels: results.map((r) => r.label),
		datasets: [
			{
				data: results.map((r) => (r.warm ? Math.round(r.warm.opsPerSec) : 0)),
				backgroundColor: results.map((r) => resolveColor(r.color) + 'cc'),
				borderColor: results.map((r) => resolveColor(r.color)),
				borderWidth: 1,
				borderRadius: 4
			}
		]
	});

	const options = {
		indexAxis: 'y' as const,
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: { display: false },
			tooltip: {
				callbacks: {
					label: (ctx: TooltipItem<'bar'>) =>
						` ${Math.round(ctx.parsed.x ?? 0).toLocaleString()} ops/sec`
				}
			}
		},
		scales: {
			x: {
				title: {
					display: true,
					text: 'ops/sec — higher is better',
					color: '#8888a0',
					font: { size: 11 }
				},
				ticks: { color: '#8888a0', font: { family: 'JetBrains Mono', size: 11 } },
				grid: { color: '#252533' }
			},
			y: {
				ticks: { color: '#e8e8f0', font: { size: 13 } },
				grid: { color: '#252533' }
			}
		}
	};
</script>

<div class="chart-wrap">
	<Bar {data} {options} />
</div>

<style>
	.chart-wrap {
		width: 100%;
		height: 160px;
	}
</style>
