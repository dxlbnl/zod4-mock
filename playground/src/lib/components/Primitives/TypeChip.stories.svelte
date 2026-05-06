<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import TypeChip from './TypeChip.svelte';

	const { Story } = defineMeta({
		title: 'Primitives/TypeChip',
		component: TypeChip,
		parameters: {
			docs: {
				description: {
					component: 'Represents the schema type of a property (String, Number, Enum, etc). Click to open a type-picker. Inactive uses neutral; active uses accent.'
				}
			}
		},
		tags: ['autodocs']
	});
</script>

<Story name="String" args={{ type: 'String' }} />
<Story name="Number" args={{ type: 'Number' }} />
<Story name="Active Enum" args={{ type: 'Enum', active: true }} />
<Story name="Array" args={{ type: 'Array<Order>' }} />
