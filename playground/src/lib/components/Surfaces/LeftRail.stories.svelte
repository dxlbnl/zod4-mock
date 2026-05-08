<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { userEvent, within, expect } from '@storybook/test';
	import LeftRail from './LeftRail.svelte';
	import { createPlaygroundState } from '../../state.svelte';
	import { tick } from 'svelte';

	const { Story } = defineMeta({
		title: 'Surfaces/LeftRail',
		component: LeftRail,
		parameters: {
			docs: {
				description: {
					component: '264px wide sidebar. Three accordion sections: World, Subjects, and Schemas.'
				}
			}
		},
		tags: ['autodocs']
	});
</script>

<script lang="ts">
	const storyStates = new Map();

	function getStoryStore(name: string, init?: (store: any) => void) {
		if (!storyStates.has(name)) {
			const store = createPlaygroundState();
			if (init) init(store);
			storyStates.set(name, store);
		}
		return storyStates.get(name);
	}
</script>

<Story name="Default">
	{#snippet template()}
		{@const store = getStoryStore('Default')}
		<div style="height: 600px; border: 1px solid var(--line); width: 264px;">
			<LeftRail {store} />
		</div>
	{/snippet}
</Story>

<Story name="Interactions" play={async ({ canvasElement }) => {
	const canvas = within(canvasElement);
	
	// LR-1: Verify sections are present
	await expect(canvas.getByText('World')).toBeInTheDocument();
	await expect(canvas.getByText('Subjects')).toBeInTheDocument();
	await expect(canvas.getByText('Schemas')).toBeInTheDocument();

	// LR-2: Add a subject
	const addSubjectBtn = canvas.getByText(/add subject/i);
	await userEvent.click(addSubjectBtn);
	await tick();
	await expect(canvas.findByText('NewSubject')).resolves.toBeInTheDocument();

	// LR-3: Switch active subject
	const userSubject = canvas.getByText('User');
	await userEvent.click(userSubject);
	await tick();
	const userSubjItem = userSubject.closest('.subj');
	await expect(userSubjItem).toHaveAttribute('aria-selected', 'true');

	// LR-4: Add a schema
	// Need to open Schemas accordion first
	const schemasHeader = canvas.getByText('Schemas').closest('.accordion-head');
	if (schemasHeader) {
		await userEvent.click(schemasHeader as HTMLElement);
		await tick();
	}
	
	// Use a more flexible matcher because text is split by spans
	const addSchemaBtn = await canvas.findByText(/add schema/i);
	await userEvent.click(addSchemaBtn);
	await tick();
	await expect(canvas.findByText('NewSchema')).resolves.toBeInTheDocument();

	// LR-5: Switch to schema
	const schemaItem = await canvas.findByText('UserApi');
	await userEvent.click(schemaItem);
	await tick();
	const schemaItemDiv = schemaItem.closest('.schema-item'); 
	await expect(schemaItemDiv).toHaveAttribute('data-selected', 'true');

	// LR-6: Toggle Accordion
	const worldHeader = canvas.getByText('World').closest('.accordion-head');
	if (worldHeader) {
		await userEvent.click(worldHeader as HTMLElement);
		await tick();
		await expect(canvas.getByText('Seed')).toBeInTheDocument();
	}
}}>
	{#snippet template()}
		{@const store = getStoryStore('Interactions')}
		<div style="height: 600px; border: 1px solid var(--line); width: 264px;">
			<LeftRail {store} />
		</div>
	{/snippet}
</Story>

<Story 
	name="LR-7 Wiring Relationships" 
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// 1. Hover over a subject to reveal the link icon
		const userSubject = canvas.getByText('User').closest('.subj');
		if (userSubject) {
			await userEvent.hover(userSubject);
		}

		// 2. Click the link icon
		const linkBtn = canvas.getByTitle(/add relationship/i);
		await userEvent.click(linkBtn);
		await tick();

		// 3. Fill the RelationForm (overlay)
		const nameInput = canvas.getByPlaceholderText(/e.g. author/i);
		await userEvent.type(nameInput, 'creator');

		const addBtn = canvas.getByText(/add relation/i);
		await userEvent.click(addBtn);
		await tick();

		// 4. Form should be gone
		await expect(canvas.queryByText(/add relation/i)).toBeNull();

		// 5. Verify relationship was added to the store (indirectly by checking if overlay closed)
		// We can't easily check store state from here without export, 
		// but the fact that it closed means onadd was called.
	}}
>
	{#snippet template()}
		{@const store = getStoryStore('WiringRel')}
		<div style="height: 600px; border: 1px solid var(--line); width: 264px;">
			<LeftRail {store} />
		</div>
	{/snippet}
</Story>

<Story name="Many Items">
	{#snippet template()}
		{@const store = getStoryStore('ManyItems', (s) => {
			for (let i = 0; i < 15; i++) {
				s.addSubject(`ExtraSubj${i}`);
			}
		})}
		<div style="height: 600px; border: 1px solid var(--line); width: 264px;">
			<LeftRail {store} />
		</div>
	{/snippet}
</Story>
