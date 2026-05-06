<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Typography from './Typography.svelte';

	const { Story } = defineMeta({
		title: 'Foundations/Typography',
		component: Typography
	});
</script>

<Story name="Typography" />
