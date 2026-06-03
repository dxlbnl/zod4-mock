<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { within, expect, userEvent } from 'storybook/test';
	import SchemaPlayground from './SchemaPlayground.svelte';

	const { Story } = defineMeta({
		title: 'Docs/SchemaPlayground',
		component: SchemaPlayground,
		tags: ['autodocs']
	});
</script>

<Story
	name="Default"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvasElement.querySelector('.cm-editor')).toBeInTheDocument();
		await userEvent.click(canvas.getByRole('button', { name: 'Randomize' }));
		await expect(canvasElement.querySelector('.output')).toBeInTheDocument();
	}}
/>

<Story
	name="Custom initial code"
	args={{ initialCode: 'z.string().email()' }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole('button', { name: 'Randomize' }));
		await expect(canvasElement.querySelector('.output')).toBeInTheDocument();
	}}
/>

<Story
	name="Shows error on invalid schema"
	args={{ initialCode: 'this is not valid' }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole('button', { name: 'Randomize' }));
		await expect(canvas.getByText(/SyntaxError|Error|not a function/i)).toBeInTheDocument();
	}}
/>
