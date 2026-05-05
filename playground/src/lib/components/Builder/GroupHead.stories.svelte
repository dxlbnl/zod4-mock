<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import GroupHead from './GroupHead.svelte';

	const { Story } = defineMeta({
		title: 'Builder/GroupHead',
		component: GroupHead,
		tags: ['autodocs']
	});
</script>

<Story name="Object" args={{ name: 'address', type: 'Object' }} />
<Story name="Array" args={{ name: 'orders', type: 'Array<Order>' }} />
<Story name="Closed" args={{ name: 'metadata', type: 'Object', isOpen: false }} />
<Story name="Indented" args={{ name: 'details', type: 'Object', indent: 1 }} />
