<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { within, expect } from 'storybook/test';
	import RangeSlider from './RangeSlider.svelte';

	const { Story } = defineMeta({
		title: 'Primitives/RangeSlider',
		component: RangeSlider,
		tags: ['autodocs']
	});
</script>

<Story
	name="Default"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const slider = canvas.getByRole('slider');
		await expect(slider).toBeInTheDocument();
		await expect(slider).toHaveAttribute('type', 'range');
	}}
>
	<div style="width:320px;padding:24px">
		<RangeSlider value={100} min={10} max={10000} />
	</div>
</Story>

<Story
	name="Shows stop labels"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('10')).toBeInTheDocument();
		await expect(canvas.getByText('1k')).toBeInTheDocument();
		await expect(canvas.getByText('10k')).toBeInTheDocument();
	}}
>
	<div style="width:320px;padding:24px">
		<RangeSlider value={100} min={10} max={10000} />
	</div>
</Story>
