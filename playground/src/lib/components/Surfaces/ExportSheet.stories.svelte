<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { userEvent, within, expect, fn } from '@storybook/test';
	import ExportSheet from './ExportSheet.svelte';
	import SegmentedControl from '../Primitives/SegmentedControl.svelte';
	import { tick } from 'svelte';

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
		tags: ['autodocs'],
		args: {
			onclose: fn(),
			oncopy: fn(),
			ondownload: fn()
		}
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

<Story name="Interactions" args={{ open: true, preview: true, children: content, footer: footer }} play={async ({ canvasElement, args }) => {
	const canvas = within(canvasElement);
	const body = within(document.body);

	// EX-4: Copy export
	const copyBtn = body.getByRole('button', { name: /copy/i });
	await userEvent.click(copyBtn);
	expect(args.oncopy).toHaveBeenCalled();

	// EX-5: Download export
	const downloadBtn = body.getByRole('button', { name: /download/i });
	await userEvent.click(downloadBtn);
	expect(args.ondownload).toHaveBeenCalled();

	// EX-1: Close export sheet
	const closeBtn = body.getByRole('button', { name: /×/i }); // Assuming there's a close button with ×
	await userEvent.click(closeBtn);
	expect(args.onclose).toHaveBeenCalled();
}} />
