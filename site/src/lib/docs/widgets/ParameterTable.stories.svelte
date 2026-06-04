<script module lang="ts">
	// B100-R4 — <ParameterTable> typed parameter rows.
	// Maps to wiki/specs/B100-docs-primitive-library-chrome-landing.md
	// (Scenarios: rows render in declared order; missing default
	// renders an em-dash; ParameterTable story present).
	//
	// Accessibility: the four column headers Name / Type / Default /
	// Description MUST be discoverable by accessible name through
	// getAllByRole('columnheader').

	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { within, expect } from 'storybook/test';
	import ParameterTable from './ParameterTable.svelte';

	const { Story } = defineMeta({
		title: 'Docs/ParameterTable',
		component: ParameterTable,
		tags: ['autodocs']
	});

	const rows = [
		{ name: 'seed', type: 'number', default: 'undefined', description: 'Deterministic seed.' },
		{ name: 'store', type: 'boolean', default: 'true', description: 'Store in registry.' }
	] as const;
</script>

<Story
	name="B100-R4 / rows render in declared order with accessible column headers"
	args={{ rows }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// Accessible table with the four named column headers.
		await expect(canvas.getByRole('table')).toBeInTheDocument();
		const headers = canvas.getAllByRole('columnheader');
		const headerNames = headers.map((h) => (h.textContent ?? '').trim());
		await expect(headerNames).toEqual(['Name', 'Type', 'Default', 'Description']);

		// First body row has "seed"; second body row has "store" (declared order).
		const bodyRows = canvas.getAllByRole('row').slice(1); // drop header row
		await expect(bodyRows.length).toBeGreaterThanOrEqual(2);
		await expect((bodyRows[0]?.textContent ?? '').includes('seed')).toBe(true);
		await expect((bodyRows[1]?.textContent ?? '').includes('store')).toBe(true);
	}}
/>

<Story
	name="B100-R4 / missing default renders an em-dash"
	args={{
		rows: [
			{ name: 'flag', type: 'boolean', description: 'No default supplied.' }
		]
	}}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// The Default cell for the single body row must render "—" so SRs don't skip an empty <td>.
		const bodyRow = canvas.getAllByRole('row')[1];
		await expect(bodyRow, 'expected one body row').toBeTruthy();
		await expect((bodyRow?.textContent ?? '').includes('—')).toBe(true);
	}}
/>
