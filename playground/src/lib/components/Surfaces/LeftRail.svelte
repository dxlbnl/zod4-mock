<script lang="ts">
	import Accordion from '../Primitives/Accordion.svelte';
	import SubjectItem from '../Builder/SubjectItem.svelte';
	import SchemaItem from '../App/SchemaItem.svelte';
	import WorldConfig from '../App/WorldConfig.svelte';
	import RelationForm from '../Builder/RelationForm.svelte';
	import RelationshipItem from '../Builder/RelationshipItem.svelte';
	import type { PlaygroundStore } from '../../state.svelte';

	interface Props {
		store: PlaygroundStore;
	}

	let { store }: Props = $props();

	// Local UI state
	let linkingSubjectId = $state<string | null>(null);
	const linkingSubject = $derived(subjects.find(s => s.id === linkingSubjectId));

	// Derived lists and states
	const subjects = $derived(store.state.subjects);
	const schemas = $derived(store.state.schemas);
	const world = $derived(store.state.world);
	const activeEntityType = $derived(store.state.activeEntityType);
	const activeSubjectId = $derived(store.state.activeSubjectId);
	const activeSchemaId = $derived(store.state.activeSchemaId);

	function getSectionMeta(id: string): string {
		if (id === 'world') return `seed ${world.seed}`;
		if (id === 'subjects') return String(subjects.length);
		if (id === 'schemas') return String(schemas.length);
		return '';
	}
</script>

<aside class="rail">
	<Accordion
		title="World"
		meta={getSectionMeta('world')}
		open={store.state.ui.sectionStates['world']}
		ontoggle={() => store.toggleSection('world')}
	>
		<WorldConfig 
			seed={world.seed}
			optionalProbability={world.optionalProbability}
			onupdateseed={(val) => store.setWorldSeed(val)}
			onupdateprob={(val) => store.setOptionalProbability(val)}
		/>
	</Accordion>

	<Accordion
		title="Subjects"
		meta={getSectionMeta('subjects')}
		open={store.state.ui.sectionStates['subjects']}
		ontoggle={() => store.toggleSection('subjects')}
	>
		<div class="list">
			{#each subjects as subj}
				<SubjectItem
					name={subj.name}
					count={subj.count}
					selected={activeEntityType === 'subject' && activeSubjectId === subj.id}
					onclick={() => store.setActiveSubject(subj.id)}
					onlink={() => linkingSubjectId = subj.id}
					onupdatecount={(val) => store.setSubjectCount(subj.id, val)}
				/>
			{/each}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="add-row t-code-sm" onclick={() => store.addSubject('NewSubject')}>
				<span class="plus">+</span> add subject
			</div>
		</div>
	</Accordion>

	<Accordion
		title="Relationships"
		meta={String(store.state.relationships.length)}
		open={store.state.ui.sectionStates['relationships'] ?? false}
		ontoggle={() => store.toggleSection('relationships')}
	>
		<div class="list">
			{#each store.state.relationships as rel}
				<RelationshipItem
					from={rel.from}
					to={rel.to}
					name={rel.relationName}
					cardinality={rel.cardinality}
					onremove={() => store.removeRelationship(rel.id)}
				/>
			{/each}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="add-row t-code-sm" onclick={() => linkingSubjectId = 'global'}>
				<span class="plus">+</span> add relationship
			</div>
		</div>
	</Accordion>

	<Accordion
		title="Schemas"
		meta={getSectionMeta('schemas')}
		open={store.state.ui.sectionStates['schemas']}
		ontoggle={() => store.toggleSection('schemas')}
	>
		<div class="list">
			{#each schemas as schema}
				<SchemaItem
					name={schema.name}
					selected={activeEntityType === 'schema' && activeSchemaId === schema.id}
					onclick={() => store.setActiveSchema(schema.id)}
				/>
			{/each}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="add-row t-code-sm" onclick={() => store.addSchema('NewSchema')}>
				<span class="plus">+</span> add schema
			</div>
		</div>
	</Accordion>
</aside>

{#if linkingSubjectId}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="overlay" onclick={() => linkingSubjectId = null}>
		<div class="form-container" onclick={(e) => e.stopPropagation()}>
			<RelationForm
				subjects={subjects.map(s => s.name)}
				initialFrom={linkingSubject?.name}
				onadd={(rel) => {
					store.addRelationship(rel);
					linkingSubjectId = null;
				}}
				oncancel={() => linkingSubjectId = null}
			/>
		</div>
	</div>
{/if}

<style>
	.rail {
		width: 264px;
		height: 100%;
		background: var(--bg-1);
		border-right: 1px solid var(--line);
		display: flex;
		flex-direction: column;
		user-select: none;
		overflow-y: auto;
		position: relative;
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 1px;
		padding-bottom: var(--space-2);
	}

	.add-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		margin: var(--space-2) var(--space-2) 0 var(--space-2);
		border: 1px dashed var(--line-strong);
		border-radius: var(--r-sm);
		color: var(--ink-2);
		cursor: pointer;
		transition: all var(--ease-quick);
	}
	.add-row:hover {
		color: var(--ink-0);
		border-color: var(--accent-edge);
		background: var(--accent-soft);
	}
	.add-row .plus {
		font-size: 14px;
		line-height: 1;
		margin-bottom: 2px;
	}

	.overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(2px);
		z-index: 2000;
		display: grid;
		place-items: center;
	}

	.form-container {
		animation: pop var(--ease-out) 0.2s;
	}

	@keyframes pop {
		from { transform: scale(0.9) translateY(10px); opacity: 0; }
		to { transform: scale(1) translateY(0); opacity: 1; }
	}
</style>

