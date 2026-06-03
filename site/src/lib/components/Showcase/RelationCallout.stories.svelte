<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { within, expect } from 'storybook/test';
	import RelationCallout from './RelationCallout.svelte';

	const { Story } = defineMeta({
		title: 'Showcase/RelationCallout',
		component: RelationCallout,
		tags: ['autodocs']
	});
</script>

<Story
	name="Default"
	args={{
		proofs: [
			{ label: 'review.userId', value: '3f6e1a2b-c3d4-5e6f-7a8b-9c0d1e2f3a4b', resolves: 'User #3' },
			{ label: 'review.productId', value: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', resolves: 'Product #7' },
			{ label: 'order.userId', value: '3f6e1a2b-c3d4-5e6f-7a8b-9c0d1e2f3a4b', resolves: 'User #3' }
		]
	}}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('review.userId')).toBeInTheDocument();
		await expect(canvas.getByText('review.productId')).toBeInTheDocument();
		await expect(canvas.getAllByText('User #3')).toHaveLength(2);
		await expect(canvas.getByText('Product #7')).toBeInTheDocument();
		const checks = canvas.getAllByText('✓');
		await expect(checks).toHaveLength(3);
	}}
/>
