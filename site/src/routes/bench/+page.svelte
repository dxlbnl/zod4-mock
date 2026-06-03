<script lang="ts">
	import SegmentedControl from '$lib/components/Primitives/SegmentedControl.svelte';
	import RangeSlider from '$lib/components/Primitives/RangeSlider.svelte';
	import Button from '$lib/components/Primitives/Button.svelte';
	import BenchChart from '$lib/components/Bench/BenchChart.svelte';
	import MetricBadge from '$lib/components/Bench/MetricBadge.svelte';
	import WinnerCallout from '$lib/components/Bench/WinnerCallout.svelte';
	import LibraryLegend from '$lib/components/Bench/LibraryLegend.svelte';
	import { onMount } from 'svelte';
	import { measure, type BenchResult } from '$lib/bench';
	import { runZod4Mock } from '$lib/runners/zod4mock';
	import { runZodMock } from '$lib/runners/zodmock';
	import { runFaker } from '$lib/runners/faker';

	type Schema = 'flat' | 'nested' | 'array';

	const schemaOptions = [
		{ value: 'flat', label: 'Flat' },
		{ value: 'nested', label: 'Nested' },
		{ value: 'array', label: 'Array' }
	];

	let schema = $state<Schema>('flat');
	let n = $state(100);
	let running = $state(false);

	interface Results {
		zod4mock: BenchResult | null;
		zodmock: BenchResult | null;
		faker: BenchResult | null;
	}

	let results = $state<Results>({ zod4mock: null, zodmock: null, faker: null });

	async function run() {
		running = true;
		results = { zod4mock: null, zodmock: null, faker: null };
		// yield to browser to update UI
		await new Promise((r) => setTimeout(r, 0));

		results.zod4mock = measure(() => runZod4Mock.batch(schema, n));
		await new Promise((r) => setTimeout(r, 0));
		results.zodmock = measure(() => runZodMock.batch(schema, n));
		await new Promise((r) => setTimeout(r, 0));
		results.faker = measure(() => runFaker.batch(schema, n));

		running = false;
	}

	const chartResults = $derived([
		{ label: 'zod4-mock', color: 'var(--lib-zod4mock)', warm: results.zod4mock },
		{ label: 'zod-mock', color: 'var(--lib-zodmock)', warm: results.zodmock },
		{ label: 'faker', color: 'var(--lib-faker)', warm: results.faker }
	]);

	onMount(() => run());

	const winnerRatio = $derived(
		results.zod4mock && results.zodmock
			? results.zod4mock.opsPerSec / results.zodmock.opsPerSec
			: null
	);
</script>

<div class="page">
	<header class="page-header">
		<h1 class="t-title">Live Benchmarks</h1>
		<p class="t-small" style="color:var(--text-muted)">
			Runs in the browser via <code>performance.now()</code>. Warm path ({5} warmup + {20} timed runs).
		</p>
	</header>

	<div class="controls">
		<SegmentedControl
			options={schemaOptions}
			bind:value={schema}
		/>
		<div class="slider-wrap">
			<span class="t-caption">N records: <strong>{n.toLocaleString()}</strong></span>
			<RangeSlider bind:value={n} min={10} max={10000} />
		</div>
		<Button label={running ? 'Running…' : 'Run'} variant="primary" disabled={running} onclick={run} />
	</div>

	<div class="results">
		<div class="chart-section">
			<div class="legend-row">
				<LibraryLegend />
				{#if winnerRatio}<WinnerCallout ratio={winnerRatio} />{/if}
			</div>
			<BenchChart results={chartResults} />
		</div>

		<div class="badges">
			{#each [
				{ key: 'zod4mock' as const, label: 'zod4-mock', color: 'var(--lib-zod4mock)' },
				{ key: 'zodmock' as const, label: 'zod-mock', color: 'var(--lib-zodmock)' },
				{ key: 'faker' as const, label: 'faker', color: 'var(--lib-faker)' }
			] as lib}
				<div class="badge-group">
					<span class="lib-name t-label" style="color:{lib.color}">{lib.label}</span>
					<MetricBadge
						value={results[lib.key]?.opsPerSec ?? null}
						unit="ops/sec"
						label="warm"
						color={lib.color}
					/>
					<MetricBadge
						value={results[lib.key]?.coldStart ?? null}
						unit="ms"
						label="cold start"
						color={lib.color}
					/>
				</div>
			{/each}
		</div>
	</div>

	<div class="note">
		<p class="t-caption">
			Schema scenarios: <strong>Flat</strong> — 10 primitive fields;
			<strong>Nested</strong> — 3-level object (order → customer → address);
			<strong>Array</strong> — 50-item variant array.
			zod-mock uses equivalent Zod v3 schemas.
		</p>
	</div>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}
	.page-header {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.controls {
		display: flex;
		align-items: flex-start;
		gap: var(--space-4);
		flex-wrap: wrap;
	}
	.slider-wrap {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 240px;
	}
	.results {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}
	.chart-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.legend-row {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		flex-wrap: wrap;
	}
	.badges {
		display: flex;
		gap: var(--space-6);
		flex-wrap: wrap;
	}
	.badge-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4);
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg-raised);
		min-width: 140px;
	}
	.lib-name {
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.note {
		padding: var(--space-3);
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg-raised);
	}
</style>
