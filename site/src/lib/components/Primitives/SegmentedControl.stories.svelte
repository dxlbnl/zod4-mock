<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { userEvent, within, expect, fn } from 'storybook/test';
	import SegmentedControl from './SegmentedControl.svelte';

	const onchangefn = fn();

	const { Story } = defineMeta({
		title: 'Primitives/SegmentedControl',
		component: SegmentedControl,
		tags: ['autodocs'],
		args: { onchange: onchangefn }
	});

	const schemaOptions = [
		{ value: 'flat', label: 'Flat' },
		{ value: 'nested', label: 'Nested' },
		{ value: 'array', label: 'Array' }
	];
</script>

<Story
	name="Schema selector"
	args={{ options: schemaOptions, value: 'flat' }}
	play={async ({ canvasElement }) => {
		onchangefn.mockClear();
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByText('Nested'));
		await expect(onchangefn).toHaveBeenCalledWith('nested');
	}}
/>

<Story
	name="Stays on selection"
	args={{ options: schemaOptions, value: 'flat' }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const flatBtn = canvas.getByText('Flat');
		const nestedBtn = canvas.getByText('Nested');
		await userEvent.click(nestedBtn);
		await expect(flatBtn).not.toHaveClass('active');
		await expect(nestedBtn).toHaveClass('active');
	}}
/>

<Story
	name="Row count"
	args={{
		options: [
			{ value: '100', label: '100' },
			{ value: '500', label: '500' },
			{ value: '1000', label: '1k' },
			{ value: '5000', label: '5k' }
		],
		value: '100'
	}}
/>
