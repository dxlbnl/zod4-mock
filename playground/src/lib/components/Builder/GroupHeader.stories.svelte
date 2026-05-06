<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import GroupHeader from './GroupHeader.svelte';

	const { Story } = defineMeta({
		title: 'Builder/GroupHeader',
		component: GroupHeader,
		tags: ['autodocs']
	});
</script>

<Story name="Object" args={{ name: 'address', type: 'Object' }} />
<Story name="Array" args={{ name: 'orders', type: 'Array<Order>' }} />
<Story name="Closed" args={{ name: 'metadata', type: 'Object', isOpen: false }} />
<Story name="Indented" args={{ name: 'details', type: 'Object', indent: 1 }} />
