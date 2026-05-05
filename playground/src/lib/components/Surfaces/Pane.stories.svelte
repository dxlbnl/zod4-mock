<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Pane from './Pane.svelte';

	const { Story } = defineMeta({
		title: 'Surfaces/Pane',
		component: Pane,
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

<Story name="Custom Actions" args={{ title: 'Output', accentTitle: undefined, subtitle: 'JSON' }}>
	{#snippet actions()}
		<button class="btn">Copy</button>
	{/snippet}
	<div style="padding: 14px; color: var(--ink-2);">custom content</div>
</Story>
