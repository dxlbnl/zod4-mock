<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Motion from './Motion.svelte';

	const { Story } = defineMeta({
		title: 'Foundations/Motion',
		component: Motion
	});
</script>

<Story name="Motion" />
