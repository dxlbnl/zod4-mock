<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import AddModPill from './AddModPill.svelte';

	const { Story } = defineMeta({
		title: 'Builder/AddModPill',
		component: AddModPill,
		tags: ['autodocs']
	});
</script>

<Story name="Default" />
<Story name="Active" args={{ active: true }} />
