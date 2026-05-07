<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { userEvent, within, expect, fn } from '@storybook/test';
	import Row from './PropertyRow.svelte';
	import { tick } from 'svelte';

	const { Story } = defineMeta({
		title: 'Builder/PropertyRow',
		component: Row,
		parameters: {
			docs: {
				description: {
					component: `
The atomic unit of the Builder. Holds one property: name, type, modifiers, and enum values.

### States
- **default**: No background.
- **hover**: \`--bg-2\` background, grip visible.
- **selected**: \`--bg-1\` bg, 2px accent stripe on left.
- **warn**: \`--warn-soft\` bg, 2px warn stripe on left.`
				}
			}
		},
		tags: ['autodocs'],
		args: {
			onselect: fn(),
			onremove: fn(),
			onupdatekey: fn(),
			onupdatemodifier: fn(),
			onremovemodifier: fn(),
			onaddmod: fn(),
			onupdateenumvalues: fn(),
			onchangetype: fn(),
			onaddprop: fn()
		}
	});	
</script>

<Story
	name="Simple Row"
	args={{
		id: '1',
		keyName: 'email',
		type: 'string',
		mods: [{ name: '.email()' }]
	}}
/>

<Story
	name="Enum with Values"
	args={{
		id: '2',
		keyName: 'role',
		type: 'enum',
		enumValues: ['admin', 'user']
	}}
	play={async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);
		
		// PR-1: Add enum value
		const addValBtn = canvas.getByText('+ val');
		await userEvent.click(addValBtn);
		await expect(args.onupdateenumvalues).toHaveBeenCalledWith(['admin', 'user', 'val3']);

		// PR-2: Remove enum value
		const removeBtns = canvas.getAllByLabelText('Remove');
		await userEvent.click(removeBtns[0]);
		await expect(args.onupdateenumvalues).toHaveBeenCalledWith(['user']);

		// PR-3: Edit enum value
		const enumVal = canvas.getByText('user');
		await userEvent.click(enumVal);
		await userEvent.clear(enumVal);
		await userEvent.type(enumVal, 'guest{enter}');
		await expect(args.onupdateenumvalues).toHaveBeenCalledWith(['admin', 'guest']);
	}}
/>

<Story
	name="Selected Row"
	args={{
		id: '3',
		keyName: 'age',
		type: 'number',
		selected: true,
		mods: [
			{ name: '.int()' },
			{ name: '.min', value: 18 },
			{ name: '.max', value: 99 },
			{ name: '.optional()' }
		]
	}}
/>

<Story
	name="Warn State"
	args={{
		id: '4',
		keyName: 'country',
		type: 'enum',
		warn: true,
		mods: [{ name: '.optional()', warn: true }]
	}}
/>

<Story
	name="Indented"
	args={{
		id: '5',
		keyName: 'street',
		type: 'string',
		indent: 1
	}}
/>
