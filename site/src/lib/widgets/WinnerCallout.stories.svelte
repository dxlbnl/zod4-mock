<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { within, expect } from 'storybook/test';
	import WinnerCallout from './WinnerCallout.svelte';

	const { Story } = defineMeta({
		title: 'Bench/WinnerCallout',
		component: WinnerCallout,
		tags: ['autodocs']
	});
</script>

<Story
	name="Three x faster"
	args={{ ratio: 3.2, vsLabel: 'zod-mock' }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('3.2×')).toBeInTheDocument();
		await expect(canvas.getByText('faster than zod-mock')).toBeInTheDocument();
	}}
>
	<div style="padding:24px"><WinnerCallout ratio={3.2} vsLabel="zod-mock" /></div>
</Story>

<Story
	name="No result yet"
	args={{ ratio: null }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.queryByText(/faster than/)).not.toBeInTheDocument();
	}}
>
	<div style="padding:24px"><WinnerCallout ratio={null} /></div>
</Story>
