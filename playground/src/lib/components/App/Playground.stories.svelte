<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Playground from './Playground.svelte';

	const { Story } = defineMeta({
		title: 'App/Playground',
		component: Playground,
		parameters: {
			layout: 'fullscreen',
			a11y: { disable: true }
		},
	});

	
</script> 


<Story name="Default" args={{}} />