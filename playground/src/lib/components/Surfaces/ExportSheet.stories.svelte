<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import ExportSheet from './ExportSheet.svelte';
	import SegmentedControl from '../Primitives/SegmentedControl.svelte';

	const { Story } = defineMeta({
		title: 'Surfaces/ExportSheet',
		component: ExportSheet,
		parameters: {
			docs: {
				description: {
					component: 'Centered modal with backdrop blur. 960px × 720px max, capped to 92vw × 88vh. Has head, two-column body, and footer options.'
				}
			}
		},
		tags: ['autodocs']
	});
</script>

{#snippet content()}
	<div style="display: grid; grid-template-columns: 200px 1fr; width: 100%; height: 100%;">
		<div style="border-right: 1px solid var(--line); background: var(--bg-2); padding: 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-2);">
			// File map...
		</div>
		<div style="padding: 20px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink-1);">
			<span style="color: var(--syn-keyword)">const</span> world = ...
		</div>
	</div>
{/snippet}

{#snippet footer()}
	<span style="color: var(--ink-2); font-size: 11px">Include</span>
	<SegmentedControl
		options={[
			{ label: 'Schemas', value: 'schemas' },
			{ label: 'Generated world', value: 'world' }
		]}
		value="schemas"
	/>
{/snippet}

<Story name="Default" args={{ open: true, preview: true, children: content, footer: footer }} />
