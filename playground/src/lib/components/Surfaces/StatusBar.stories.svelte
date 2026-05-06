<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import StatusBar from './StatusBar.svelte';

	const { Story } = defineMeta({
		title: 'Surfaces/StatusBar',
		component: StatusBar,
		parameters: {
			docs: {
				description: {
					component: '24px tall. Pipe-separated mono labels. Left: validation + counts. Right: regen time + version.'
				}
			}
		},
		tags: ['autodocs'],
		args: {
			status: 'ok',
			statusLabel: 'valid',
			counts: ['3 subjects', '2 relationships'],
			seed: 42,
			meta: 'regenerated 240ms ago',
			version: 'z@4.0.1'
		}
	});
</script>

<Story name="Default" />

<Story
	name="Warning"
	args={{
		status: 'warn',
		statusLabel: 'unbound types',
		counts: ['1 error']
	}}
/>
