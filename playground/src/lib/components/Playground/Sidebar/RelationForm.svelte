<script lang="ts">
	import { untrack } from 'svelte';
	import Button from '$lib/components/Primitives/Button.svelte';
	import Input from '$lib/components/Primitives/Input.svelte';
	import SegmentedControl from '$lib/components/Primitives/SegmentedControl.svelte';
	import { type RelationshipDef } from '$lib/state.svelte';

	interface Props {
		subjects: import('$lib/state.svelte').SubjectDef[];
		initialFrom?: string;
		initialData?: Partial<RelationshipDef>;
		onadd: (rel: Omit<RelationshipDef, 'id'>) => void;
		oncancel: () => void;
	}

	let { subjects, initialFrom, initialData, onadd, oncancel }: Props = $props();

	let from = $state(untrack(() => (initialData?.from ?? subjects.find(s => s.name !== initialFrom)?.name) || subjects[0]?.name || ''));
	let relationName = $state(untrack(() => initialData?.relationName ?? ''));
	let to = $state(untrack(() => (initialData?.to ?? initialFrom) || subjects[0]?.name || ''));
	let cardinality = $state<RelationshipDef['cardinality']>(untrack(() => initialData?.cardinality ?? '1'));
	let key = $state(untrack(() => initialData?.key ?? ''));

	let isUserDirty = $state(false);
	let lastAutoName = '';
	$effect(() => {
		if (from && !isUserDirty && (relationName === '' || relationName === lastAutoName)) {
			const auto = from.charAt(0).toLowerCase() + from.slice(1);
			relationName = auto;
			lastAutoName = auto;
		}
	});

	function handleNameInput(val: string) {
		relationName = val;
		isUserDirty = true;
	}

	// The 'to' subject is the RECEIVER (the one with the relations block)
	// The foreign key lives on the RECEIVER.
	const receiverSubject = $derived(subjects.find((s) => s.name === to));
	const availableFields = $derived(receiverSubject?.fields.filter((f) => f.key) ?? []);

	let lastAutoKey = '';
	$effect(() => {
		if (relationName && (key === '' || key === lastAutoKey)) {
			const possible = [relationName, relationName + 'Id', relationName + '_id'].map((k) =>
				k.toLowerCase()
			);
			const match = availableFields.find((f) => possible.includes(f.key.toLowerCase()));
			if (match) {
				key = match.key;
				lastAutoKey = match.key;
			}
		}
	});

	function handleSubmit() {
		if (!relationName || !to || !from) return;
		// In zod4-mock: defineSubjectType(TO, ..., { relations: { name: { type: FROM } } })
		onadd({
			from: to,    // The owner
			to: from,    // The identity source
			relationName,
			cardinality,
			key: key === '' ? undefined : key
		});
	}
</script>

<div class="relation-form">
	<header class="header">
		<h4 class="t-small">{initialData ? 'Edit' : 'Add'} Relationship</h4>
	</header>

	<div class="fields">
		<div class="field-row">
			<label class="t-code-sm" for="rel-from">Identity Source (Parent)</label>
			<select id="rel-from" class="select t-code-tight" bind:value={from}>
				{#each subjects as s}
					<option value={s.name}>{s.name}</option>
				{/each}
			</select>
			<p class="hint t-code-tight">The subject that provides the IDs.</p>
		</div>

		<div class="field-row">
			<label class="t-code-sm" for="rel-name">Relation Name</label>
			<Input 
				id="rel-name"
				placeholder="e.g. author, parent, items" 
				bind:value={relationName}
				autofocus
				selectOnFocus
				oninput={() => isUserDirty = true}
			/>
		</div>

		<div class="field-row">
			<label class="t-code-sm" for="rel-to">ID Receiver (Child)</label>
			<select id="rel-to" class="select t-code-tight" bind:value={to}>
				{#each subjects as s}
					<option value={s.name}>{s.name}</option>
				{/each}
			</select>
			<p class="hint t-code-tight">The subject that holds the foreign key.</p>
		</div>
		
		<div class="field-row">
			<label class="t-code-sm" for="rel-key">Foreign Key Field (on {to})</label>
			<select id="rel-key" class="select t-code-tight" bind:value={key}>
				<option value="">None (Random ID)</option>
				{#each availableFields as f}
					<option value={f.key}>{f.key}</option>
				{/each}
			</select>
			{#if key === ''}
				<p class="hint t-code-tight">Engine will guess or use random values.</p>
			{/if}
		</div>

		<div class="field-row">
			<span class="label-text t-code-sm">Cardinality</span>
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
		<Button variant="primary" onclick={handleSubmit} disabled={!relationName}>{initialData ? 'Update' : 'Add'} Relation</Button>
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

	.hint {
		font-size: 10px;
		color: var(--ink-3);
		margin-top: 2px;
		font-style: italic;
	}

	.footer {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
		padding-top: var(--space-2);
		border-top: 1px solid var(--line);
	}
</style>
