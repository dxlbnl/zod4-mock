<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { within, expect } from 'storybook/test';
	import TimingBadge from './TimingBadge.svelte';

	const { Story } = defineMeta({
		title: 'Table/TimingBadge',
		component: TimingBadge,
		tags: ['autodocs']
	});
</script>

<Story
	name="Generate"
	args={{ label: 'Generated 10 000 rows in', ms: 42.3 }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('42.3ms')).toBeInTheDocument();
		await expect(canvas.getByText('Generated 10 000 rows in')).toBeInTheDocument();
	}}
>
	<div style="padding:24px"><TimingBadge label="Generated 10 000 rows in" ms={42.3} /></div>
</Story>

<Story
	name="Render"
	args={{ label: 'Render time', ms: 180.5 }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('180.5ms')).toBeInTheDocument();
	}}
>
	<div style="padding:24px"><TimingBadge label="Render time" ms={180.5} /></div>
</Story>

<Story
	name="No data"
	args={{ label: 'Not measured', ms: null }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('—')).toBeInTheDocument();
	}}
>
	<div style="padding:24px"><TimingBadge label="Not measured" ms={null} /></div>
</Story>

<Story name="Both badges">
	<div style="display:flex;gap:8px;padding:24px">
		<TimingBadge label="Generated 1 000 rows in" ms={12.4} />
		<TimingBadge label="Render time" ms={95.1} />
	</div>
</Story>
