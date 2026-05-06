<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Accordion from './Accordion.svelte';

	const { Story } = defineMeta({
		title: 'Primitives/Accordion',
		component: Accordion,
		parameters: {
			docs: {
				description: {
					component: 'A collapsible section used primarily in the LeftRail for grouping subjects or schema settings.'
				}
			}
		},
		tags: ['autodocs'],
		args: {
			title: 'Subjects',
			meta: '3',
			open: true
		}
	});
</script>

<Story name="Default">
	<Accordion title="Subjects" meta="3" open={true}>
		<div style="padding: 12px; color: var(--ink-2); font-size: 11px;">
			Accordion content goes here...
		</div>
	</Accordion>
</Story>

<Story name="Closed" args={{ open: false }} />
