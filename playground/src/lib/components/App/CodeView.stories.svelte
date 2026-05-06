<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import CodeView from './CodeView.svelte';
	import { within, expect } from '@storybook/test';

	const { Story } = defineMeta({
		title: 'App/CodeView',
		component: CodeView,
		tags: ['autodocs'],
		args: {
			title: 'Output',
			accentTitle: 'Zod',
			lines: [
				{ lineNumber: 1, tokens: [{ kind: 'keyword', text: 'import' }, { kind: 'plain', text: ' ' }, { kind: 'punct', text: '{' }, { kind: 'plain', text: ' z ' }, { kind: 'punct', text: '}' }, { kind: 'plain', text: ' ' }, { kind: 'keyword', text: 'from' }, { kind: 'plain', text: ' ' }, { kind: 'string', text: '"zod"' }, { kind: 'punct', text: ';' }] },
				{ lineNumber: 2, tokens: [] },
				{ lineNumber: 3, tokens: [{ kind: 'keyword', text: 'export' }, { kind: 'plain', text: ' ' }, { kind: 'keyword', text: 'const' }, { kind: 'plain', text: ' ' }, { kind: 'plain', text: 'UserSchema' }, { kind: 'plain', text: ' ' }, { kind: 'punct', text: '=' }, { kind: 'plain', text: ' ' }, { kind: 'type', text: 'z' }, { kind: 'punct', text: '.' }, { kind: 'fn', text: 'object' }, { kind: 'punct', text: '(' }, { kind: 'punct', text: '{' }] },
				{ lineNumber: 4, fieldId: 'f1', tokens: [{ kind: 'plain', text: '  ' }, { kind: 'plain', text: 'id' }, { kind: 'punct', text: ':' }, { kind: 'plain', text: ' ' }, { kind: 'type', text: 'z' }, { kind: 'punct', text: '.' }, { kind: 'fn', text: 'uuid' }, { kind: 'punct', text: '(' }, { kind: 'punct', text: ')' }, { kind: 'punct', text: ',' }] },
				{ lineNumber: 5, fieldId: 'f2', tokens: [{ kind: 'plain', text: '  ' }, { kind: 'plain', text: 'name' }, { kind: 'punct', text: ':' }, { kind: 'plain', text: ' ' }, { kind: 'type', text: 'z' }, { kind: 'punct', text: '.' }, { kind: 'fn', text: 'string' }, { kind: 'punct', text: '(' }, { kind: 'punct', text: ')' }, { kind: 'punct', text: '.' }, { kind: 'fn', text: 'min' }, { kind: 'punct', text: '(' }, { kind: 'number', text: '1' }, { kind: 'punct', text: ')' }, { kind: 'punct', text: ',' }] },
				{ lineNumber: 6, tokens: [{ kind: 'punct', text: '}' }, { kind: 'punct', text: ')' }, { kind: 'punct', text: ';' }] }
			]
		}
	});
</script>

<Story name="Default" />

<Story name="With Selection" args={{ selectedFieldId: 'f1' }} />

<Story name="Interactions" play={async ({ canvasElement }) => {
	const canvas = within(canvasElement);
	
	// CV-1: Verify syntax highlighting and line numbers
	const keywords = canvasElement.querySelectorAll('.t-keyword');
	expect(keywords.length).toBeGreaterThan(0);
	
	const lineNumbers = canvas.getAllByText(/^\d+$/);
	expect(lineNumbers.length).toBeGreaterThan(0);

	// CV-2: Verify selection highlight
	const selectedLine = canvasElement.querySelector('.line.selected');
	expect(selectedLine).toBeVisible();
	expect(selectedLine?.textContent).toContain('id');
}} args={{ selectedFieldId: 'f1' }} />

<Story name="Empty" args={{ lines: [] }} />
