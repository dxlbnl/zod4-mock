<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { within, expect } from 'storybook/test';
	import MetricBadge from './MetricBadge.svelte';

	const { Story } = defineMeta({
		title: 'Bench/MetricBadge',
		component: MetricBadge,
		tags: ['autodocs']
	});
</script>

<Story
	name="High ops"
	args={{ value: 42300, unit: 'ops/sec', label: 'zod4-mock', color: 'var(--lib-zod4mock)' }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText(/42\.3k/)).toBeInTheDocument();
		await expect(canvas.getByText('ops/sec')).toBeInTheDocument();
		await expect(canvas.getByText('zod4-mock')).toBeInTheDocument();
	}}
/>

<Story
	name="Medium ops"
	args={{ value: 13200, unit: 'ops/sec', label: 'zod-mock', color: 'var(--lib-zodmock)' }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText(/13\.2k/)).toBeInTheDocument();
	}}
/>

<Story
	name="No data"
	args={{ value: null, unit: 'ops/sec', label: 'not run yet' }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('—')).toBeInTheDocument();
	}}
/>

<Story name="Row of badges">
	<div style="display:flex;gap:32px;padding:24px">
		<MetricBadge value={42300} unit="ops/sec" label="zod4-mock" color="var(--lib-zod4mock)" />
		<MetricBadge value={13200} unit="ops/sec" label="zod-mock" color="var(--lib-zodmock)" />
		<MetricBadge value={28900} unit="ops/sec" label="faker" color="var(--lib-faker)" />
	</div>
</Story>
