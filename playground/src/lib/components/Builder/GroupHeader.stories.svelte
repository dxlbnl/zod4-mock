<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import GroupHeader from './GroupHeader.svelte';

	const { Story } = defineMeta({
		title: 'Builder/GroupHeader',
		component: GroupHeader,
		parameters: {
			docs: {
				description: {
					component: 'Marks the start of a nested object or array. Renders inline above its children.'
				}
			}
		},
		tags: ['autodocs']
	});
</script>

<Story name="Object" args={{ name: 'address', type: 'Object' }} />
<Story name="Array" args={{ name: 'orders', type: 'Array<Order>' }} />
<Story name="Closed" args={{ name: 'metadata', type: 'Object', isOpen: false }} />
<Story name="Indented" args={{ name: 'details', type: 'Object', indent: 1 }} />
