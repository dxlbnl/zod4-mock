<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import TypeChip from './TypeChip.svelte';

	const { Story } = defineMeta({
		title: 'Primitives/TypeChip',
		component: TypeChip,
		tags: ['autodocs']
	});
</script>

<Story name="String" args={{ type: 'String' }} />
<Story name="Number" args={{ type: 'Number' }} />
<Story name="Active Enum" args={{ type: 'Enum', active: true }} />
<Story name="Array" args={{ type: 'Array<Order>' }} />
