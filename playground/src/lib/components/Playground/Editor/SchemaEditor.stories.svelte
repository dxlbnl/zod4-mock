<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { expect, within, userEvent, waitFor } from 'storybook/test';
	import { tick } from 'svelte';
	import SchemaEditor from './index.svelte';
	import { createPlaygroundState, makeField } from '$lib/state.svelte';
	import TestProvider from '../TestProvider.svelte';

	const { Story } = defineMeta({
		title: 'Playground/Editor',
		component: SchemaEditor,
		tags: ['autodocs'],
		parameters: {
			layout: 'fullscreen'
		}
	});
</script>

<script lang="ts">
	import type { FieldDef } from '$lib/state.svelte';

	const storyStates = new Map<string, { store: ReturnType<typeof createPlaygroundState> }>();

	function getState(name: string, initialFields?: FieldDef[]) {
		if (!storyStates.has(name)) {
			const store = createPlaygroundState();
			const schema = store.state.schemas[0];
			if (initialFields !== undefined && schema) {
				schema.fields = initialFields;
			}
			storyStates.set(name, { store });
		}
		return storyStates.get(name)!;
	}
</script>

{#snippet harness(name: string, fields?: FieldDef[])}
	{@const { store } = getState(name, fields)}
	{@const schema = store.state.schemas[0]}
	<div style="display: grid; grid-template-columns: 1fr; height: 100vh; background: var(--bg-0)">
		<TestProvider {store}>
			<SchemaEditor
				title="Schema Editor"
				{schema}
				schemas={store.state.schemas}
			/>
		</TestProvider>
	</div>
{/snippet}

<Story name="Empty State">
	{#snippet template()}
		{@render harness('Empty', [])}
	{/snippet}
</Story>

<Story name="Pre-populated">
	{#snippet template()}
		{@render harness('PrePopulated', [
			makeField({ key: 'id', type: 'uuid' }),
			makeField({ key: 'username', type: 'string', modifiers: [{ name: '.min', value: 3 }, { name: '.max', value: 32 }] }),
			makeField({ key: 'email', type: 'email' }),
			makeField({ key: 'age', type: 'number', modifiers: [{ name: '.int()' }, { name: '.min', value: 0 }] }),
			makeField({ key: 'role', type: 'enum', enumValues: ['admin', 'member', 'viewer'] }),
			makeField({ key: 'active', type: 'boolean', modifiers: [{ name: '.default', value: 'true' }] }),
			makeField({ key: 'createdAt', type: 'date' }),
		])}
	{/snippet}
</Story>
<Story name="Interactions" play={async ({ canvasElement }) => {
	const canvas = within(canvasElement);
	
	// 1. Settings should be hidden initially
	await expect(canvas.queryByText("Schema Name")).not.toBeInTheDocument();

	// 2. Click the cog to show settings
	const cog = canvas.getByRole("button", { name: "Settings" });
	await userEvent.click(cog);
	await tick();

	// 3. Settings should be visible and cog active
	await expect(canvas.getByText("Schema Name")).toBeInTheDocument();
	await expect(cog).toHaveClass("active");

	// 4. Click outside to close (e.g. on the editor body)
	const paneBody = canvasElement.querySelector(".pane-body") as HTMLElement;
	await userEvent.click(paneBody!);
	await tick();

	// 5. Settings should be hidden and cog no longer active
	await waitFor(() => {
		expect(canvas.queryByText("Schema Name")).not.toBeInTheDocument();
		expect(cog).not.toHaveClass("active");
	}, { timeout: 2000 });

	// 6. Test Toggling Off via Cog
	await userEvent.click(cog);
	await tick();
	await expect(canvas.getByText("Schema Name")).toBeInTheDocument();
	
	await userEvent.click(cog);
	await tick();
	await waitFor(() => {
		expect(canvas.queryByText("Schema Name")).not.toBeInTheDocument();
	}, { timeout: 2000 });
}}>
	{#snippet template()}
		{@render harness('Interactions', [
			makeField({ key: 'id', type: 'uuid' })
		])}
	{/snippet}
</Story>
