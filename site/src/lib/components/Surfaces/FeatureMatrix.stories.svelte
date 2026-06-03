<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { within, expect } from 'storybook/test';
	import FeatureMatrix from './FeatureMatrix.svelte';

	const { Story } = defineMeta({
		title: 'Surfaces/FeatureMatrix',
		component: FeatureMatrix,
		tags: ['autodocs']
	});
</script>

<Story
	name="Full matrix"
	args={{
		features: [
			{ label: 'Zod v4 schemas', zod4mock: 'yes', zodmock: 'no', faker: 'na' },
			{ label: 'Relational / cross-entity IDs', zod4mock: 'yes', zodmock: 'no', faker: 'no' },
			{ label: 'Type-safe output', zod4mock: 'yes', zodmock: 'yes', faker: 'no' },
			{ label: 'Seeded / deterministic', zod4mock: 'yes', zodmock: 'no', faker: 'yes' },
			{ label: 'No schema required', zod4mock: 'no', zodmock: 'no', faker: 'yes' },
			{ label: 'Handles .refine()', zod4mock: 'partial', zodmock: 'no', faker: 'na' },
			{ label: 'Handles discriminated unions', zod4mock: 'yes', zodmock: 'partial', faker: 'na' }
		]
	}}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('Zod v4 schemas')).toBeInTheDocument();
		await expect(canvas.getByText('zod4-mock')).toBeInTheDocument();
		const checkmarks = canvas.getAllByText('✓');
		await expect(checkmarks.length).toBeGreaterThan(0);
		const crosses = canvas.getAllByText('✗');
		await expect(crosses.length).toBeGreaterThan(0);
		const partials = canvas.getAllByText('~');
		await expect(partials.length).toBeGreaterThan(0);
	}}
/>
