<script lang="ts">
	import { Button, Stack, Inline, Card, Heading, Text } from '@dxlbnl/ui';
	import SegmentedControl from '$lib/widgets/SegmentedControl.svelte';
	import RangeSlider from '$lib/widgets/RangeSlider.svelte';
	import BenchChart from '$lib/widgets/BenchChart.svelte';
	import MetricBadge from '$lib/widgets/MetricBadge.svelte';
	import WinnerCallout from '$lib/widgets/WinnerCallout.svelte';
	import LibraryLegend from '$lib/widgets/LibraryLegend.svelte';
	import { onMount, onDestroy } from 'svelte';
	import type { BenchResult } from '$lib/bench';
	import type {
		BenchWorkerRequest,
		BenchWorkerResponse
	} from '$lib/bench-worker-protocol';

	type Schema = 'simple' | 'nestedOrder' | 'array';

	// B71-R4: time-budget bench measurement — see wiki/specs/B71-site-time-budget-bench.md
	const BUDGET_MS = 200;

	const schemaOptions = [
		{ value: 'simple', label: 'Simple' },
		{ value: 'nestedOrder', label: 'Nested order' },
		{ value: 'array', label: 'Array' }
	];

	let schema = $state<Schema>('simple');
	let n = $state(100);
	let running = $state(false);

	interface Results {
		zod4mock: BenchResult | null;
		zodmock: BenchResult | null;
		faker: BenchResult | null;
	}

	let results = $state<Results>({ zod4mock: null, zodmock: null, faker: null });

	// B69-R6 / R8: the Worker is constructed inside `onMount` (SSR-safe)
	// and terminated on unmount.
	let worker: Worker | null = null;

	function run() {
		if (!worker || running) return;
		running = true;
		results = { zod4mock: null, zodmock: null, faker: null };
		const req: BenchWorkerRequest = {
			kind: 'run',
			schema,
			n,
			budgetMs: BUDGET_MS
		};
		worker.postMessage(req);
	}

	const chartResults = $derived([
		{ label: 'zod4-mock', color: 'var(--lib-zod4mock)', warm: results.zod4mock },
		{ label: 'zod-mock', color: 'var(--lib-zodmock)', warm: results.zodmock },
		{ label: 'faker', color: 'var(--lib-faker)', warm: results.faker }
	]);

	onMount(() => {
		worker = new Worker(new URL('$lib/bench.worker.ts', import.meta.url), {
			type: 'module'
		});
		worker.onmessage = (e: MessageEvent<BenchWorkerResponse>) => {
			const msg = e.data;
			if (msg.kind === 'result') {
				results[msg.lib] = msg.result;
			} else if (msg.kind === 'done') {
				running = false;
			}
		};
		// Auto-run once on mount (preserves prior behaviour).
		run();
	});

	onDestroy(() => {
		worker?.terminate();
		worker = null;
	});

	const winnerRatio = $derived(
		results.zod4mock && results.zodmock
			? results.zod4mock.opsPerSec / results.zodmock.opsPerSec
			: null
	);
</script>

<Stack gap="lg">
	<Stack gap="xs">
		<Heading level={1} variant="title">Live Benchmarks</Heading>
		<Text variant="body" color="dim">
			Runs in the browser via <code>performance.now()</code>.
		</Text>
	</Stack>

	<Inline gap="lg" style="align-items: flex-start;">
		<SegmentedControl
			options={schemaOptions}
			bind:value={schema}
		/>
		<Stack gap="xs" style="min-width: 240px;">
			<Text variant="mono" color="dim">N records: <strong>{n.toLocaleString()}</strong></Text>
			<RangeSlider bind:value={n} min={10} max={10000} />
		</Stack>
		<Button variant="primary" disabled={running} onclick={run}>
			{running ? 'Running…' : 'Run'}
		</Button>
		<Text variant="mono" color="dim" class="budget-badge">budget: 200ms per cell</Text>
	</Inline>

	<Stack gap="xl">
		<Stack gap="sm">
			<Inline gap="lg">
				<LibraryLegend />
				{#if winnerRatio}<WinnerCallout ratio={winnerRatio} />{/if}
			</Inline>
			<BenchChart results={chartResults} />
		</Stack>

		<Inline gap="lg">
			{#each [
				{ key: 'zod4mock' as const, label: 'zod4-mock', color: 'var(--lib-zod4mock)' },
				{ key: 'zodmock' as const, label: 'zod-mock', color: 'var(--lib-zodmock)' },
				{ key: 'faker' as const, label: 'faker', color: 'var(--lib-faker)' }
			] as lib}
				<Card>
					<Stack gap="sm" class="badge-group">
						<Text variant="eyebrow" class="lib-name" style="color:{lib.color}">{lib.label}</Text>
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
					</Stack>
				</Card>
			{/each}
		</Inline>
	</Stack>

	<Card>
		<Text variant="mono" color="dim" class="note">
			Schema scenarios: <strong>Simple</strong> — 4 primitive fields;
			<strong>Nested order</strong> — 3-level object (order → customer → address);
			<strong>Array</strong> — 50-item variant array.
			zod-mock uses equivalent Zod v3 schemas.
		</Text>
	</Card>
</Stack>

<style>
	:global(.lib-name) {
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	:global(.budget-badge) {
		display: inline-flex;
		align-items: center;
		padding: 4px var(--u);
		border: 1px solid var(--rule);
		border-radius: 4px;
		background: var(--bg-rail);
		white-space: nowrap;
	}
	:global(.badge-group) {
		padding: var(--u2);
		min-width: 140px;
	}
	:global(.note) {
		padding: 12px;
	}
</style>
