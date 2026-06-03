<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { within, expect } from 'storybook/test';
	import LibraryLegend from './LibraryLegend.svelte';

	const { Story } = defineMeta({
		title: 'Bench/LibraryLegend',
		component: LibraryLegend,
		tags: ['autodocs']
	});
</script>

<Story
	name="Default"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('zod4-mock')).toBeInTheDocument();
		await expect(canvas.getByText('zod-mock')).toBeInTheDocument();
		await expect(canvas.getByText('faker')).toBeInTheDocument();
	}}
>
	<div style="padding:24px">
		<LibraryLegend />
	</div>
</Story>
