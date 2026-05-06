<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import TopBar from './TopBar.svelte';

	const { Story } = defineMeta({
		title: 'Surfaces/TopBar',
		component: TopBar,
		parameters: {
			docs: {
				description: {
					component: '40px tall, lives at the top of the app. Brand → workspace name → spacer → actions.'
				}
			}
		},
		tags: ['autodocs'],
		args: {
			version: 'v0.4.2',
			workspace: 'workspace',
			project: 'user-service'
		}
	});
</script>

<Story name="Default" />
