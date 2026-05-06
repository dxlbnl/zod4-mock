<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Pane from './Pane.svelte';
	import Button from '../Primitives/Button.svelte';

	const { Story } = defineMeta({
		title: 'Surfaces/Pane',
		component: Pane,
		parameters: {
			docs: {
				description: {
					component: 'Generic surface used by Builder, Output, and any future content area. `.pane-head` is 32px tall; `.pane-body` scrolls.'
				}
			}
		},
		tags: ['autodocs'],
		args: {
			title: 'Builder',
			accentTitle: 'User',
			subtitle: 'z.object()'
		}
	});
</script>

<Story name="Default">
	<div style="padding: 14px; color: var(--ink-2);">pane content goes here</div>
</Story>

<Story name="Custom Actions">
	<Pane title="Output" subtitle="JSON">
		{#snippet actions()}
			<Button variant="default">Copy</Button>
		{/snippet}
		<div style="padding: 14px; color: var(--ink-2);">custom content</div>
	</Pane>
</Story>
