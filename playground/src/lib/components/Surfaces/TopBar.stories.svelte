<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import TopBar from './TopBar.svelte';

	const { Story } = defineMeta({
		title: 'Surfaces/TopBar',
		component: TopBar,
		tags: ['autodocs'],
		args: {
			version: 'v0.4.2',
			workspace: 'workspace',
			project: 'user-service'
		}
	});
</script>

<Story name="Default" />
