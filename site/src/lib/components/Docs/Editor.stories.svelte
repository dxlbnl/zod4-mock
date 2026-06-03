<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect } from 'storybook/test';
	import Editor from './Editor.svelte';

	const { Story } = defineMeta({
		title: 'Docs/Editor',
		component: Editor,
		tags: ['autodocs']
	});

	const sampleCode = 'z.object({ name: z.string(), age: z.number() })';
</script>

<Story
	name="Default"
	args={{ value: sampleCode, minHeight: '120px' }}
	play={async ({ canvasElement }) => {
		await expect(canvasElement.querySelector('.cm-editor')).toBeInTheDocument();
		await expect(canvasElement.querySelector('.cm-content')).toBeInTheDocument();
	}}
>
	<div style="padding:24px;max-width:600px">
		<Editor value={sampleCode} minHeight="120px" />
	</div>
</Story>

<Story
	name="Readonly"
	play={async ({ canvasElement }) => {
		await expect(canvasElement.querySelector('.cm-editor')).toBeInTheDocument();
	}}
>
	<div style="padding:24px;max-width:600px">
		<Editor value="z.string().email()" minHeight="60px" readonly />
	</div>
</Story>
