<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SegmentedControl from './SegmentedControl.svelte';

	const { Story } = defineMeta({
		title: 'Primitives/SegmentedControl',
		component: SegmentedControl,
		tags: ['autodocs'],
		args: {
			options: [
				{ label: 'auto-run', value: 'auto' },
				{ label: 'manual', value: 'manual' }
			],
			value: 'auto'
		}
	});
</script>

<Story name="Default" />

<Story
	name="Three Options"
	args={{
		options: [
			{ label: 'JSON', value: 'json' },
			{ label: 'Table', value: 'table' },
			{ label: 'Tree', value: 'tree' }
		],
		value: 'json'
	}}
/>

<Story
	name="Multi Select"
	args={{
		multi: true,
		options: [
			{ label: 'Schemas', value: 'schemas' },
			{ label: 'Generated world', value: 'world' }
		],
		value: ['schemas', 'world']
	}}
/>
