<script lang="ts">
	import Accordion from '../Primitives/Accordion.svelte';
	import SubjectItem from '../Builder/SubjectItem.svelte';

	interface Subject {
		name: string;
		count?: number;
		badge?: string;
		selected?: boolean;
	}

	interface Section {
		title: string;
		meta?: string;
		open: boolean;
		id: string;
	}

	interface Props {
		sections?: Section[];
		subjects?: Subject[];
		onselectsubject?: (name: string) => void;
		onaddsubject?: () => void;
		ontogglesection?: (id: string) => void;
	}

	let {
		sections = [
			{ title: 'World', meta: 'seed 42', open: false, id: 'world' },
			{ title: 'Subjects', meta: '3', open: true, id: 'subjects' },
			{ title: 'Schemas', meta: '2', open: false, id: 'schemas' }
		],
		subjects = [
			{ name: 'User', count: 6, selected: true },
			{ name: 'Order', count: 4, badge: 'FK→User' },
			{ name: 'Product', count: 5 }
		],
		onselectsubject,
		onaddsubject,
		ontogglesection
	}: Props = $props();
</script>

<aside class="rail">
	{#each sections as section}
		<Accordion
			title={section.title}
			meta={section.meta}
			open={section.open}
			ontoggle={() => ontogglesection?.(section.id)}
		>
			{#if section.id === 'subjects'}
				<div class="subj-list">
					{#each subjects as subj}
						<SubjectItem
							name={subj.name}
							count={subj.count}
							badge={subj.badge}
							selected={subj.selected}
							onclick={() => onselectsubject?.(subj.name)}
						/>
					{/each}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="add-row t-code-sm" onclick={onaddsubject}>
						<span class="plus">+</span> add subject
					</div>
				</div>
			{/if}
		</Accordion>
	{/each}
</aside>

<style>
	.rail {
		width: 264px;
		height: 100%;
		background: var(--bg-1);
		border-right: 1px solid var(--line);
		display: flex;
		flex-direction: column;
		user-select: none;
	}

	.subj-list {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.add-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-3);
		margin-top: 2px;
		border: 1px dashed var(--line-strong);
		border-radius: var(--r-sm);
		color: var(--ink-2);
		cursor: pointer;
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
</style>

