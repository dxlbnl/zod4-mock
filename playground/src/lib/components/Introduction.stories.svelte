<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Introduction from './Introduction.svelte';

	const { Story } = defineMeta({
		title: 'Introduction',
		component: Introduction,
		parameters: {
			options: { showPanel: false }
		}
	});
</script>

<Story name="Welcome" />
