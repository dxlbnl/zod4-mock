<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import OutputTabs from './OutputTabs.svelte';
	import Kbd from '../Primitives/Kbd.svelte';

	const { Story } = defineMeta({
		title: 'Surfaces/OutputTabs',
		component: OutputTabs,
		parameters: {
			docs: {
				description: {
					component: 'The tab strip at the top of the right output pane. Two tabs (Code / Data) plus action affordances on the right.'
				}
			}
		},
		tags: ['autodocs'],
		args: {
			tabs: [
				{ label: 'Code', id: 'code', meta: 'user.schema.ts', status: 'active' },
				{ label: 'Data', id: 'data', meta: '3 of 6' }
			],
			activeTab: 'code'
		}
	});
</script>

<Story name="Default">
	{#snippet actions()}
		<Kbd keys="⌘ 1" />
		<Kbd keys="⌘ 2" />
	{/snippet}
</Story>
