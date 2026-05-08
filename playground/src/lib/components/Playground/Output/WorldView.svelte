<script lang="ts">
	import Pane from '$lib/components/Surfaces/Pane.svelte';
	import SourceView from './SourceView.svelte';
	import type { CodeLine } from '$lib/codegen';

	interface Props {
		title?: string;
		accentTitle?: string;
		lines: CodeLine[];
	}

	let { 
		title = 'Registry', 
		accentTitle = 'World', 
		lines = []
	}: Props = $props();
</script>

<Pane {title} {accentTitle}>
	<SourceView {lines} />
</Pane>
