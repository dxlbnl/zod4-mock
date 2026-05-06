<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Colors from './Colors.svelte';

	const { Story } = defineMeta({
		title: 'Foundations/Color',
		component: Colors
	});
</script>

<Story name="Color" />
