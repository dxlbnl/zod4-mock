<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Row from './Row.svelte';

	const { Story } = defineMeta({
		title: 'Builder/Row',
		component: Row,
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
