<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { userEvent, within, expect } from 'storybook/test';
	import JsonTree from './JsonTree.svelte';
	import { generateWorld } from '../runners/ecommerce';

	const { Story } = defineMeta({
		title: 'Showcase/JsonTree',
		component: JsonTree,
		tags: ['autodocs']
	});

	// B110-R2: the reported failure reproduces against the real showcase `user` slice.
	const showcaseUser = generateWorld(42).users[0];
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
	<div style="padding:24px;font-family:var(--mono);font-size:12px">
		<JsonTree value={{ items: [{ id: 'a', qty: 2 }, { id: 'b', qty: 1 }], total: 49.99 }} />
	</div>
</Story>

<!-- B110-R1 / Date-field-leaf: a Date in an object renders as a quoted ISO string, not { } -->
<Story
	name="B110-R1 Date field renders as ISO string"
	args={{
		value: { createdAt: new Date('2024-01-15T00:00:00.000Z') }
	}}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// The Date leaf shows its quoted ISO-8601 string.
		await expect(canvas.getByText('"2024-01-15T00:00:00.000Z"')).toBeInTheDocument();
		// It is NOT rendered as an empty / "0 keys" object node.
		await expect(canvas.queryByText(/0 keys/)).not.toBeInTheDocument();
		// Only the top-level object has a collapse toggle; the Date field must not add one.
		await expect(canvas.getAllByRole('button')).toHaveLength(1);
	}}
/>

<!-- B110-R1 / top-level-Date-leaf: a bare Date value is a single leaf, not { } -->
<Story
	name="B110-R1 top-level Date is a leaf"
	args={{
		value: new Date('2024-01-15T00:00:00.000Z')
	}}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText('"2024-01-15T00:00:00.000Z"')).toBeInTheDocument();
		// No object node at all: no collapse toggle, no "0 keys" ellipsis.
		await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
		await expect(canvas.queryByText(/0 keys/)).not.toBeInTheDocument();
	}}
/>

<!-- B110-R2 / regression: the showcase `user` createdAt no longer renders as { } -->
<Story
	name="B110-R2 showcase user createdAt is a date string"
	args={{
		value: showcaseUser
	}}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// The createdAt key is shown, and its value is a quoted ISO-8601 date string.
		await expect(canvas.getByText('"createdAt"')).toBeInTheDocument();
		const isoLeaf = canvas.getByText(/^"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z"$/);
		await expect(isoLeaf).toBeInTheDocument();
		// The reported failure: createdAt must NOT collapse to an empty "0 keys" object.
		await expect(canvas.queryByText(/0 keys/)).not.toBeInTheDocument();
	}}
/>

<!-- B110-R3 / behaviour-neutral guard: a plain object still expands with its keys (green by design) -->
<Story
	name="B110-R3 plain object still expands"
	args={{
		value: { id: 'a', qty: 2, items: [{ sku: 'b' }] }
	}}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// Plain object renders as an expandable node showing its keys (unchanged by the Date fix).
		await expect(canvas.getByText('"id"')).toBeInTheDocument();
		await expect(canvas.getByText('"qty"')).toBeInTheDocument();
		await expect(canvas.getByText('"items"')).toBeInTheDocument();
		// The array child still renders as a nested object node (its key is visible).
		await expect(canvas.getByText('"sku"')).toBeInTheDocument();
		// Collapsing the top-level object hides the keys behind a "3 keys" ellipsis.
		const collapseBtn = canvas.getAllByRole('button')[0];
		await userEvent.click(collapseBtn);
		await expect(canvas.getByText(/3 keys/)).toBeInTheDocument();
		await expect(canvas.queryByText('"id"')).not.toBeInTheDocument();
	}}
/>
