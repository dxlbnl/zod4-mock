<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { userEvent, within, expect, fn } from '@storybook/test';
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
			version: '0.1.2',
			workspace: 'dxlbnl',
			project: 'zod4-mock',
			zodVersion: '4.4.3',
			availableZodVersions: ['4.4.3', '4.4.2'],
			onexport: fn()
		}
	});
</script>

<Story name="Interactions" play={async ({ canvasElement, args }) => {
	const canvas = within(canvasElement);

	// TB-2: Export button
	const exportBtn = canvas.getByRole('button', { name: /^⬇ Export$/ });
	await userEvent.click(exportBtn);
	expect(args.onexport).toHaveBeenCalled();
}} />
