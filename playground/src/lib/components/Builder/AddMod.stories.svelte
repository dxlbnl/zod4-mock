<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import AddMod from './AddMod.svelte';

	const { Story } = defineMeta({
		title: 'Builder/AddMod',
		component: AddMod,
		parameters: {
			docs: {
				description: {
					component: `
The trigger for the floating menu. Looks like a dashed-outline modifier slot.

### Rules
- Always last child of a row; never floats free.
- \`data-active="true"\` when the floating menu is anchored to it.`
				}
			}
		},
		tags: ['autodocs']
	});
</script>

<Story name="Default" />
<Story name="Active" args={{ active: true }} />
