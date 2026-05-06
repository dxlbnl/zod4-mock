<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Row from './PropertyRow.svelte';

	const { Story } = defineMeta({
		title: 'Builder/PropertyRow',
		component: Row,
		parameters: {
			docs: {
				description: {
					component: `
The atomic unit of the Builder. Holds one property: name, type, modifiers, and an add-mod slot. Modifiers wrap to a second line if they overflow.

### States
- **default**: No background.
- **hover**: \`--bg-2\` background, grip visible.
- **selected**: \`--accent-soft\` bg, 2px accent stripe on left.
- **warn**: \`--warn-soft\` bg, 2px warn stripe on left.`
				}
			}
		},
		tags: ['autodocs']
	});	
</script>

<Story
	name="Simple Row"
	args={{
		keyName: 'email',
		type: 'Email',
		mods: [{ name: '.email()' }]
	}}
/>

<Story
	name="Selected Row"
	args={{
		keyName: 'age',
		type: 'Number',
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
		keyName: 'country',
		type: 'Enum',
		warn: true,
		mods: [{ name: '"US"', warn: true }, { name: '"CA"', warn: true }]
	}}
/>

<Story
	name="Indented"
	args={{
		keyName: 'street',
		type: 'String',
		indent: 1
	}}
/>
