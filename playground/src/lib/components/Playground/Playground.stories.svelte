<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Playground from './Playground.svelte';
	import { within, userEvent, expect } from '@storybook/test';
	import { tick } from 'svelte';

	const { Story } = defineMeta({
		title: 'Playground/Playground',
		component: Playground,
		parameters: {
			layout: 'fullscreen',
			a11y: { disable: true }
		}
	});
</script> 

<Story name="Default" />

<Story name="Renaming" play={async ({ canvasElement }) => {
	const canvas = within(canvasElement);

	// 1. Find the title input in the builder pane
	// The active subject is "User" by default
	const titleInput = canvas.getByDisplayValue('User');
	
	// 2. Rename it to "Member"
	await userEvent.clear(titleInput);
	await userEvent.type(titleInput, 'Member');
	await tick();

	// 3. Verify it changed in the Left Rail
	const rail = canvas.getByRole('complementary'); // The <aside> in LeftRail
	await expect(within(rail).getByText('Member')).toBeInTheDocument();
	await expect(within(rail).queryByText('User')).toBeNull();

	// 4. Verify builder title is updated
	await expect(canvas.getByDisplayValue('Member')).toBeInTheDocument();
}} />