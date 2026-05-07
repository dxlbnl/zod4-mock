<script lang="ts">
	import Pane from '../Surfaces/Pane.svelte';
	import SourceView from './SourceView.svelte';
	import type { CodeLine } from '../../codegen';

	interface Props {
		title?: string;
		accentTitle?: string;
		lines: CodeLine[];
		selectedFieldId?: string | null;
	}

	let { 
		title = 'Output', 
		accentTitle = 'Zod', 
		lines = [],
		selectedFieldId = null
	}: Props = $props();
</script>

<Pane {title} {accentTitle}>
	<SourceView {lines} {selectedFieldId} />
</Pane>
