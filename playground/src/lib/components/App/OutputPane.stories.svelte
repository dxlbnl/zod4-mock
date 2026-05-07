<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { userEvent, within, expect, fn } from '@storybook/test';
	import OutputPane from './OutputPane.svelte';
	import { tick } from 'svelte';

	const { Story } = defineMeta({
		title: 'App/OutputPane',
		component: OutputPane,
		tags: ['autodocs'],
		args: {
			onchangetab: fn()
		}
	});

	const mockCodeLines = [
		{ lineNumber: 1, tokens: [{ kind: 'keyword' as const, text: 'const' }, { kind: 'plain' as const, text: ' ' }, { kind: 'variable' as const, text: 'UserSchema' }] },
		{ lineNumber: 2, tokens: [{ kind: 'plain' as const, text: '  = ' }, { kind: 'variable' as const, text: 'z' }, { kind: 'plain' as const, text: '.' }, { kind: 'function' as const, text: 'object' }, { kind: 'plain' as const, text: '({...})' }] }
	];

	const mockDataLines = [
		{ lineNumber: 1, tokens: [{ kind: 'plain' as const, text: '{' }] },
		{ lineNumber: 2, tokens: [{ kind: 'key' as const, text: '  "id"' }, { kind: 'plain' as const, text: ': ' }, { kind: 'string' as const, text: '"user_1"' }] },
		{ lineNumber: 3, tokens: [{ kind: 'plain' as const, text: '}' }] }
	];
</script>

<Story name="Interactions" args={{
	activeTab: 'code',
	codeLines: mockCodeLines,
	dataLines: mockDataLines,
	fullCode: 'const UserSchema = z.object({...})',
	fullData: '{\n  "id": "user_1"\n}'
}} play={async ({ canvasElement, args }) => {
	const canvas = within(canvasElement);

	// OP-1: Switch between code and data tabs
	const dataTab = canvas.getByRole('tab', { name: /mock data/i });
	await userEvent.click(dataTab);
	await tick();
	
	expect(args.onchangetab).toHaveBeenCalledWith('data');
	// Check if DataView content is visible
	await expect(canvas.getByText(/"id"/)).toBeInTheDocument();

	const codeTab = canvas.getByRole('tab', { name: /zod definition/i });
	await userEvent.click(codeTab);
	await tick();
	
	expect(args.onchangetab).toHaveBeenCalledWith('code');
	await expect(canvas.getByText(/UserSchema/)).toBeInTheDocument();

	// OP-2: Copy output to clipboard
	// We can't easily test navigator.clipboard in Vitest without mocking
	const copyBtn = canvas.getByRole('button', { name: /copy/i });
	await userEvent.click(copyBtn);
	// In a real hi-fi test, we'd check for a "Copied!" toast if it existed
}}>
	{#snippet template(args)}
		<div style="height: 400px; border: 1px solid var(--line);">
			<OutputPane {...args} />
		</div>
	{/snippet}
</Story>
