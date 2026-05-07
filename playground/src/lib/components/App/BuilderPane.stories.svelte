<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { userEvent, within, expect, fn } from '@storybook/test';
	import BuilderPane from './BuilderPane.svelte';
	import { createPlaygroundState } from '../../state.svelte';
	import { tick } from 'svelte';

	const { Story } = defineMeta({
		title: 'App/BuilderPane',
		component: BuilderPane,
		tags: ['autodocs'],
		args: {
			onselectfield: fn(),
			onaddfield: fn(),
			onupdatefield: fn(),
			onaddmodifier: fn(),
			onremovefield: fn(),
			onremovemodifier: fn()
		}
	});
</script>

<script lang="ts">
	const storyStates = new Map();

	function getStoryState(name: string, initialFields: any[] | null = null) {
		if (!storyStates.has(name)) {
			const store = createPlaygroundState();
			const subject = store.state.subjects[0];
			if (initialFields !== null && subject) {
				subject.fields = initialFields;
			}
			const selectedFieldId = $state({ value: null as string | null });
			storyStates.set(name, { store, selectedFieldId });
		}
		return storyStates.get(name);
	}
</script>

{#snippet storyHarness(name: string, args: any)}
	{@const { store, selectedFieldId } = getStoryState(name, args.initialFields)}
	{@const subject = store.state.subjects[0]}
	
	<BuilderPane 
		{...args}
		fields={subject?.fields || []}
		selectedFieldId={selectedFieldId.value}
		onaddfield={(parentId) => subject && store.addField('subject', subject.id, parentId)}
		onselectfield={(id) => selectedFieldId.value = id}
		onupdatefield={(id, patch) => subject && store.updateField('subject', subject.id, id, patch)}
		onaddmodifier={(id, mod) => subject && store.addModifier('subject', subject.id, id, mod)}
		onupdatemodifier={(id, idx, val) => subject && store.updateModifierValue('subject', subject.id, id, idx, val)}
		onremovefield={(id) => subject && store.removeField('subject', subject.id, id)}
		onremovemodifier={(fid, mid) => subject && store.removeModifier('subject', subject.id, fid, mid)}
		onupdateenumvalues={(id, vals) => subject && store.updateField('subject', subject.id, id, { enumValues: vals })}
	/>
{/snippet}

<Story name="User Stories" play={async ({ canvasElement }) => {
	const canvas = within(canvasElement);
	const body = within(document.body);
	
	// BP-1: Add a property
	const addBtn = await canvas.findByRole('button', { name: /\+ add property/i });
	await userEvent.click(addBtn);
	
	await tick();
	const rows = await canvas.findAllByTestId('property-row');
	expect(rows.length).toBe(7); // Default has 6
	
	const lastRow = rows[6];
	const nameInput = within(lastRow).getByRole('textbox');
	expect(nameInput).toHaveFocus();

	// BP-2: Rename a field key
	await userEvent.type(nameInput, 'username');
	await userEvent.tab();
	await tick();
	expect(nameInput).toHaveValue('username');

	// BP-4: Select a field row
	await userEvent.click(rows[0]);
	expect(rows[0]).toHaveAttribute('data-selected', 'true');

	// BP-3: Change a field's type
	const typeChip = within(rows[0]).getByRole('button', { name: /uuid|string|number/i });
	await userEvent.click(typeChip);
	
	const typeMenu = await body.findByRole('menu');
	const numberItem = await within(typeMenu).findByRole('menuitem', { name: /number/i });
	await userEvent.click(numberItem);
	
	await tick();
	expect(within(rows[0]).getByText(/number/i)).toBeInTheDocument();

	// BP-5: Add a modifier (with default value)
	const addModBtn = within(rows[0]).getByRole('button', { name: /\+ mod/i });
	await userEvent.click(addModBtn);
	
	const modMenu = await body.findByRole('menu');
	const minItem = await within(modMenu).findByRole('menuitem', { name: /.min/i });
	await userEvent.click(minItem);
	
	await tick();
	const pills = await canvas.findAllByTestId('modifier-pill');
	const minPill = pills.find(p => p.textContent.includes('.min'));
	expect(minPill).toBeInTheDocument();
	// Should have default value 0 for number.min
	expect(minPill).toHaveTextContent('.min=0');

	// BP-7: Edit a modifier's value
	if (minPill) {
		const modVal = minPill.querySelector('[contenteditable="true"]');
		
		if (modVal) {
			await userEvent.click(modVal);
			await userEvent.clear(modVal);
			await userEvent.type(modVal, '5{enter}');
			await tick();
			expect(modVal).toHaveTextContent('5');
		}

		// BP-6: Remove a modifier
		await userEvent.hover(minPill as HTMLElement);
		const removeModBtn = await within(minPill as HTMLElement).findByLabelText(/remove/i);
		await userEvent.click(removeModBtn);
		await tick();
		expect(canvas.queryByText('.min')).not.toBeInTheDocument();
	}

	// BP-10: Nested object fields
	const secondRow = rows[1];
	const secondTypeChip = within(secondRow).getByRole('button', { name: /string/i });
	await userEvent.click(secondTypeChip);
	const objItem = await body.findByRole('menuitem', { name: /object/i });
	await userEvent.click(objItem);
	
	await tick();
	// Should have auto-spawned a child
	const rowsAfterObj = await canvas.findAllByTestId('property-row');
	expect(rowsAfterObj.length).toBeGreaterThan(7);

	// BP-9: Remove a field
	const rowsBeforeRemove = await canvas.findAllByTestId('property-row');
	const rowToRemove = rowsBeforeRemove[rowsBeforeRemove.length - 1];
	await userEvent.click(rowToRemove);
	const removeFieldBtn = within(rowToRemove).getByRole('button', { name: /×/ });
	await userEvent.click(removeFieldBtn);
	await tick();
	expect(canvas.getAllByTestId('property-row').length).toBe(rowsBeforeRemove.length - 1);
}}>
	{#snippet template(args)}
		{@render storyHarness('UserStories', args)}
	{/snippet}
</Story>

<Story name="Keyboard Flow" play={async ({ canvasElement }) => {
	const canvas = within(canvasElement);
	const body = within(document.body);
	
	const addBtn = await canvas.findByRole('button', { name: /\+ add property/i });
	await userEvent.click(addBtn);
	await tick();
	
	const rows = await canvas.findAllByTestId('property-row');
	const newRow = rows[rows.length - 1];
	const nameInput = within(newRow).getByRole('textbox');
	
	// 1. Type name
	await userEvent.type(nameInput, 'age');
	
	// 2. Press Tab -> Opens Type Menu
	await userEvent.keyboard('{Tab}');
	const typeMenu = await body.findByRole('menu');
	expect(typeMenu).toBeVisible();
	
	// 3. Select type via keyboard
	await userEvent.keyboard('number');
	await userEvent.keyboard('{Enter}');
	await tick();
	
	// 4. Should transition to Modifier Menu
	const modMenu = await body.findByRole('menu');
	expect(modMenu).toBeVisible();
	
	// 5. Select modifier via keyboard
	await userEvent.keyboard('.int');
	await userEvent.keyboard('{Enter}');
	await tick();
	
	// 6. Menu should close, +mod button should be focused
	expect(body.queryByRole('menu')).not.toBeInTheDocument();
	const addModBtn = within(newRow).getByRole('button', { name: /\+ mod/i });
	expect(addModBtn).toHaveFocus();
	
	// 7. Press Enter on +mod button to start a new sibling
	await userEvent.keyboard('{Enter}');
	await tick();
	
	const finalRows = await canvas.findAllByTestId('property-row');
	expect(finalRows.length).toBe(8); // Started with 6 + 1 (age) + 1 (new)
	expect(within(finalRows[7]).getByRole('textbox')).toHaveFocus();
}}>
	{#snippet template(args)}
		{@render storyHarness('KeyboardFlow', args)}
	{/snippet}
</Story>

<Story name="Empty">
	{#snippet template(args)}
		<div style="padding: 2rem;">
			{@render storyHarness('Empty', { ...args, initialFields: [] })}
		</div>
	{/snippet}
</Story>
