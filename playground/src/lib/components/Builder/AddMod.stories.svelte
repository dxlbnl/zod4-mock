<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import AddMod from './AddMod.svelte';

	const { Story } = defineMeta({
		title: 'Builder/AddMod',
		component: AddMod,
		tags: ['autodocs']
	});
</script>

<Story name="Default" />
<Story name="Active" args={{ active: true }} />
