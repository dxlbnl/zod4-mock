<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { userEvent, within, expect, fn } from 'storybook/test';
	import Input from './Input.svelte';

	const oninputfn = fn();

	const { Story } = defineMeta({
		title: 'Primitives/Input',
		component: Input,
		tags: ['autodocs'],
		args: { oninput: oninputfn }
	});
</script>

<Story
	name="Default"
	args={{ placeholder: 'Filter rows…' }}
	play={async ({ canvasElement }) => {
		oninputfn.mockClear();
		const canvas = within(canvasElement);
		const input = canvas.getByPlaceholderText('Filter rows…');
		await userEvent.type(input, 'alice');
		await expect(input).toHaveValue('alice');
		await expect(oninputfn).toHaveBeenCalled();
	}}
/>

<Story
	name="Clears value"
	args={{ placeholder: 'Filter rows…' }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const input = canvas.getByPlaceholderText('Filter rows…');
		await userEvent.type(input, 'hello');
		await userEvent.clear(input);
		await expect(input).toHaveValue('');
	}}
/>

<Story name="Search type" args={{ placeholder: 'Search…', type: 'search' }} />
