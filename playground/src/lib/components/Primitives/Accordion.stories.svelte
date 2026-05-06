<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { userEvent, within, expect } from '@storybook/test';
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

<Story name="Default" play={async ({ canvasElement }) => {
	const canvas = within(canvasElement);
	const head = canvas.getByText('Subjects');
	
	// Initial state is open (from meta args)
	await expect(canvas.getByText('Accordion content goes here...')).toBeVisible();
	
	// Click to close
	await userEvent.click(head);
	await expect(canvas.queryByText('Accordion content goes here...')).not.toBeInTheDocument();
	
	// Click to open
	await userEvent.click(head);
	await expect(canvas.getByText('Accordion content goes here...')).toBeVisible();
}}>
	<div style="padding: 12px; color: var(--ink-2); font-size: 11px;">
		Accordion content goes here...
	</div>
</Story>

<Story name="Closed" args={{ open: false }}>
	<div style="padding: 12px; color: var(--ink-2); font-size: 11px;">
		Accordion content goes here...
	</div>
</Story>
