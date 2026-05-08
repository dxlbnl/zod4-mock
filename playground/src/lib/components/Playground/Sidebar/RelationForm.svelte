<script lang="ts">
	import Button from '$lib/components/Primitives/Button.svelte';
	import Input from '$lib/components/Primitives/Input.svelte';
	import SegmentedControl from '$lib/components/Primitives/SegmentedControl.svelte';
	import { type RelationshipDef } from '$lib/state.svelte';

	interface Props {
		subjects: string[];
		initialFrom?: string;
		onadd: (rel: Omit<RelationshipDef, 'id'>) => void;
		oncancel: () => void;
	}

	let { subjects, initialFrom, onadd, oncancel }: Props = $props();

	let from = $state(initialFrom || subjects[0] || '');
	let relationName = $state('');
	let to = $state(subjects.find(s => s !== from) || subjects[0] || '');
	let cardinality = $state<RelationshipDef['cardinality']>('1');

	// Smart UX: Auto-populate relation name based on target subject
	let lastAutoName = '';
	$effect(() => {
		if (to && (relationName === '' || relationName === lastAutoName)) {
			const auto = to.charAt(0).toLowerCase() + to.slice(1);
			relationName = auto;
			lastAutoName = auto;
		}
	});

	function handleSubmit() {
		if (!relationName || !to || !from) return;
		onadd({
			from,
			to,
			relationName,
			cardinality
		});
	}
</script>

<div class="relation-form">
	<header class="header">
		<h4 class="t-small">Add Relationship</h4>
	</header>

	<div class="fields">
		<div class="field-row">
			<label class="t-code-sm">From Subject</label>
			<select class="select t-code-tight" bind:value={from}>
				{#each subjects as s}
					<option value={s}>{s}</option>
				{/each}
			</select>
		</div>

		<div class="field-row">
			<label class="t-code-sm">Relation Name</label>
			<Input 
				placeholder="e.g. author, parent, items" 
				bind:value={relationName}
				autofocus
			/>
		</div>

		<div class="field-row">
			<label class="t-code-sm">Target Subject</label>
			<select class="select t-code-tight" bind:value={to}>
				{#each subjects as s}
					<option value={s}>{s}</option>
				{/each}
			</select>
		</div>

		<div class="field-row">
			<label class="t-code-sm">Cardinality</label>
			<SegmentedControl
				options={[
					{ label: '1', value: '1' },
					{ label: '0..1', value: '0..1' },
					{ label: '0..n', value: '0..n' },
					{ label: '1..n', value: '1..n' }
				]}
				bind:value={cardinality}
			/>
		</div>
	</div>

	<footer class="footer">
		<Button variant="default" onclick={oncancel}>Cancel</Button>
		<Button variant="primary" onclick={handleSubmit} disabled={!relationName}>Add Relation</Button>
	</footer>
</div>

<style>
	.relation-form {
		padding: var(--space-4);
		background: var(--bg-1);
		border: 1px solid var(--line-strong);
		border-radius: var(--r-md);
		box-shadow: var(--shadow-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		width: 280px;
	}

	.header h4 {
		margin: 0;
		color: var(--ink-2);
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.field-row {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.field-row label {
		color: var(--ink-3);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.select {
		width: 100%;
		height: var(--h-input);
		background: var(--bg-2);
		border: 1px solid var(--line);
		border-radius: var(--r-sm);
		padding: 0 var(--space-2);
		color: var(--ink-1);
		outline: none;
		transition: all var(--ease-quick);
	}
	.select:focus {
		border-color: var(--accent-edge);
		background: var(--bg-1);
	}

	.footer {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
		padding-top: var(--space-2);
		border-top: 1px solid var(--line);
	}
</style>
