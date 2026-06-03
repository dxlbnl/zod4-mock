<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { within, expect } from 'storybook/test';
	import SummaryCard from './SummaryCard.svelte';

	const { Story } = defineMeta({
		title: 'Surfaces/SummaryCard',
		component: SummaryCard,
		tags: ['autodocs']
	});
</script>

<Story
	name="Speed"
	args={{ headline: '3.2×', description: 'faster than zod-mock on flat schemas' }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('3.2×')).toBeInTheDocument();
		await expect(canvas.getByText('faster than zod-mock on flat schemas')).toBeInTheDocument();
	}}
/>

<Story
	name="Relational"
	args={{ headline: '7', unit: 'entity types', description: 'with referentially consistent IDs', color: 'var(--success)' }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('7')).toBeInTheDocument();
		await expect(canvas.getByText('entity types')).toBeInTheDocument();
		await expect(canvas.getByText('with referentially consistent IDs')).toBeInTheDocument();
	}}
/>

<Story name="Row of cards">
	<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:24px;max-width:800px">
		<SummaryCard headline="3.2×" description="faster than zod-mock (flat schema)" />
		<SummaryCard headline="7" unit="entities" description="in the relational showcase" color="var(--success)" />
		<SummaryCard headline="Zod 4" description="full schema coverage — no feature gaps" color="var(--warning)" />
	</div>
</Story>
