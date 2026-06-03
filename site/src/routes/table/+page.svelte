<script lang="ts">
	import SegmentedControl from '$lib/components/Primitives/SegmentedControl.svelte';
	import Input from '$lib/components/Primitives/Input.svelte';
	import DataTable from '$lib/components/Table/DataTable.svelte';
	import TimingBadge from '$lib/components/Table/TimingBadge.svelte';
	import { generate } from 'zod4-mock';
	import { userSchema, type User } from '$lib/schemas/ecommerce';

	const rowCountOptions = [
		{ value: '100', label: '100' },
		{ value: '500', label: '500' },
		{ value: '1000', label: '1k' },
		{ value: '5000', label: '5k' }
	];

	let rowCountStr = $state('100');
	let filter = $state('');
	let rows = $state<User[]>([]);
	let genMs = $state<number | null>(null);
	let renderMs = $state<number | null>(null);

	const columns = [
		{ key: 'name' as const, label: 'Name' },
		{ key: 'email' as const, label: 'Email' },
		{ key: 'createdAt' as const, label: 'Created' }
	];

	async function generate_rows(n: number) {
		const t0 = performance.now();
		const data = Array.from({ length: n }, () => generate(userSchema));
		genMs = performance.now() - t0;

		// measure render time via microtask after DOM update
		rows = data;
		const t1 = performance.now();
		await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
		renderMs = performance.now() - t1;
	}

	$effect(() => {
		generate_rows(Number(rowCountStr));
	});
</script>

<div class="page">
	<header class="page-header">
		<h1 class="t-title">Raw DOM Stress Test</h1>
		<p class="t-small" style="color:var(--text-muted)">
			No virtual scrolling. Every row is in the DOM. Generation and render time measured separately.
		</p>
	</header>

	<div class="toolbar">
		<SegmentedControl options={rowCountOptions} bind:value={rowCountStr} />
		<Input placeholder="Filter rows…" bind:value={filter} />
		<div class="timings">
			<TimingBadge label="Generated {Number(rowCountStr).toLocaleString()} rows in" ms={genMs} />
			<TimingBadge label="Render time" ms={renderMs} />
		</div>
	</div>

	<DataTable {rows} {columns} {filter} />
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}
	.page-header {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.toolbar {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		flex-wrap: wrap;
	}
	.timings {
		display: flex;
		gap: var(--space-3);
		flex-wrap: wrap;
	}
</style>
