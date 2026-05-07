<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { userEvent, within, expect, fn } from '@storybook/test';
	import SchemaItem from './SchemaItem.svelte';
	import { tick } from 'svelte';

	const { Story } = defineMeta({
		title: 'App/SchemaItem',
		component: SchemaItem,
		tags: ['autodocs'],
		args: {
			onclick: fn()
		}
	});
</script>

<Story name="Default" args={{
	name: 'UserApi',
	selected: false
}} play={async ({ canvasElement, args }) => {
	const canvas = within(canvasElement);
	const item = canvas.getByText('UserApi').closest('.schema-item');
	
	await userEvent.click(item as HTMLElement);
	expect(args.onclick).toHaveBeenCalled();
}} />

<Story name="Selected" args={{
	name: 'OrderApi',
	selected: true
}} />
