<script lang="ts">
	import OutputTabs from '../Surfaces/OutputTabs.svelte';
	import CodeView from './CodeView.svelte';
	import DataView from './DataView.svelte';
	import Button from '../Primitives/Button.svelte';
	import type { CodeLine } from '../../codegen';

	interface Props {
		activeTab: 'code' | 'data';
		codeLines: CodeLine[];
		dataLines: CodeLine[];
		fullCode: string;
		fullData: string;
		selectedFieldId?: string | null;
		onchangetab?: (tab: 'code' | 'data') => void;
	}

	let { 
		activeTab = $bindable('code'), 
		codeLines = [], 
		dataLines = [],
		fullCode = '',
		fullData = '',
		selectedFieldId = null,
		onchangetab 
	}: Props = $props();

	const tabs = [
		{ id: 'code', label: 'Zod Definition', status: 'active' as const },
		{ id: 'data', label: 'Mock Data', status: 'active' as const }
	];

	async function handleCopy() {
		const text = activeTab === 'code' ? fullCode : fullData;
		try {
			await navigator.clipboard.writeText(text);
			// For hi-fi, we'd add a "Copied!" toast/state
		} catch (err) {
			console.error('Failed to copy: ', err);
		}
	}
</script>

<div class="output-pane">
	<OutputTabs 
		{tabs} 
		bind:activeTab 
		onchange={(id) => onchangetab?.(id as 'code' | 'data')}
	>
		{#snippet actions()}
			<Button variant="ghost" label="Copy" onclick={handleCopy} />
		{/snippet}
	</OutputTabs>

	<div class="content">
		{#if activeTab === 'code'}
			<CodeView lines={codeLines} {selectedFieldId} title="" />
		{:else}
			<DataView lines={dataLines} {selectedFieldId} title="" />
		{/if}
	</div>
</div>

<style>
	.output-pane {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg-0);
	}

	.content {
		flex: 1;
		overflow: hidden;
	}
</style>
