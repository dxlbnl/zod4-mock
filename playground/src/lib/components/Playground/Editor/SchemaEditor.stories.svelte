<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import SchemaEditor from './index.svelte';
	import { createPlaygroundState, makeField } from '$lib/state.svelte';

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
		<SchemaEditor
			title="Schema Editor"
			{schema}
			schemas={store.state.schemas}
			onaddfield={(pid) => schema ? (store.addField(schema.id, pid) ?? undefined) : undefined}
			onupdatefield={(id, p) => schema && store.updateField(schema.id, id, p)}
			onremovefield={(id) => schema && store.removeField(schema.id, id)}
			onaddmodifier={(id, m) => schema && store.addModifier(schema.id, id, m)}
			onupdatemodifier={(id, idx, val) => schema && store.updateModifierValue(schema.id, id, idx, val)}
			onremovemodifier={(fid, mid) => schema && store.removeModifier(schema.id, fid, mid)}
			onupdateenumvalues={(id, vals) => schema && store.updateField(schema.id, id, { enumValues: vals })}
			onupdatepopulate={(val) => schema && store.setPopulateCount(schema.id, val)}
			onupdatederived={(val) => schema && store.setDerivedFrom(schema.id, val)}
			onaddrelation={(target, name) => schema && store.addSchemaRelation(schema.id, target, name)}
			onremoverelation={(name) => schema && store.removeSchemaRelation(schema.id, name)}
		/>
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
