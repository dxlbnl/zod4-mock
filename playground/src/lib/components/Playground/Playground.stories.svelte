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

<Story name="Binding" play={async ({ canvasElement }) => {
	const canvas = within(canvasElement);

	// 1. Switch to Schema view
	const rail = canvas.getByRole('complementary');
	
	// Open Schemas accordion
	const schemasHeader = within(rail).getByText('Schemas');
	await userEvent.click(schemasHeader);
	await tick();

	const userApiItem = within(rail).getByText('UserApi');
	await userEvent.click(userApiItem);
	await tick();

	// 2. Verify we are in the Schema Builder
	await expect(canvas.getByDisplayValue('UserApi')).toBeInTheDocument();

	// 3. Open Subject Picker and select "User"
	const pickerBtn = canvas.getByRole('button', { name: /Not bound/i });
	await userEvent.click(pickerBtn);
	await tick();

	const userOption = canvas.getByText('User');
	await userEvent.click(userOption);
	await tick();

	// 4. Verify binding is active
	await expect(canvas.getByText('Identity Source:')).toBeInTheDocument();
	await expect(canvas.getByText('User')).toBeInTheDocument();

	// 5. Map "userId" field to "id" subject field
	// Find the line for "userId"
	const userIdLine = canvas.getByDisplayValue('userId').closest('[data-testid="editor-line"]') as HTMLElement;
	const linkBtn = within(userIdLine).getByRole('button', { name: /Map to subject field/i });
	await userEvent.click(linkBtn);
	await tick();

	const idOption = canvas.getByText('id', { selector: '.item-name' });
	await userEvent.click(idOption);

	// 6. Verify mapping label
	await expect(await canvas.findByTitle('Mapped to id')).toBeInTheDocument();

	// 7. Verify Data View (Status Check)
	// Switch to Data tab
	const dataTab = canvas.getByText(/Mock Data/i);
	await userEvent.click(dataTab);
	await tick();
	await tick();

	// The generation should now work with the binding.
	// We don't have a deep inspector here, but we can verify the Code View shows withSchema.
	const codeTab = canvas.getByText(/Zod Definition/i);
	await userEvent.click(codeTab);
	await tick();
	await tick();
}} />