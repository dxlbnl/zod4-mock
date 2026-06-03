<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { userEvent, within, expect } from 'storybook/test';
	import JsonTree from './JsonTree.svelte';

	const { Story } = defineMeta({
		title: 'Showcase/JsonTree',
		component: JsonTree,
		tags: ['autodocs']
	});
</script>

<Story
	name="Simple object"
	args={{
		value: {
			id: '3f6e1a2b-0000-0000-0000-000000000001',
			name: 'Alice Smith',
			email: 'alice@example.com',
			rating: 4,
			userId: '3f6e1a2b-0000-0000-0000-000000000002',
			productId: '3f6e1a2b-0000-0000-0000-000000000003',
			body: 'Great product!',
			createdAt: '2024-01-15'
		}
	}}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('"name"')).toBeInTheDocument();
		await expect(canvas.getByText('"Alice Smith"')).toBeInTheDocument();
		const collapseBtn = canvas.getByRole('button');
		await userEvent.click(collapseBtn);
		await expect(canvas.getByText(/8 keys/)).toBeInTheDocument();
		await expect(canvas.queryByText('"name"')).not.toBeInTheDocument();
	}}
/>

<Story
	name="With highlighted IDs"
	args={{
		value: {
			id: '3f6e1a2b-0000-0000-0000-000000000001',
			name: 'Alice Smith',
			userId: '3f6e1a2b-0000-0000-0000-000000000002',
			productId: '3f6e1a2b-0000-0000-0000-000000000003'
		},
		highlightIds: [
			'3f6e1a2b-0000-0000-0000-000000000002',
			'3f6e1a2b-0000-0000-0000-000000000003'
		]
	}}
	play={async ({ canvasElement }) => {
		const highlighted = canvasElement.querySelectorAll('.value.highlight');
		await expect(highlighted.length).toBe(2);
	}}
/>

<Story name="Nested array">
	<div style="padding:24px;font-family:var(--font-mono);font-size:12px">
		<JsonTree value={{ items: [{ id: 'a', qty: 2 }, { id: 'b', qty: 1 }], total: 49.99 }} />
	</div>
</Story>
