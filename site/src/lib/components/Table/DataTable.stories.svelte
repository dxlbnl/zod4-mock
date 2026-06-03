<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { userEvent, within, expect } from 'storybook/test';
	import DataTable from './DataTable.svelte';

	const { Story } = defineMeta({ title: 'Table/DataTable', component: DataTable, tags: ['autodocs'] });

	const rows = Array.from({ length: 20 }, (_, i) => ({
		id: `user-${i + 1}`,
		name: ['Alice Smith', 'Bob Jones', 'Carol White', 'Dave Brown'][i % 4],
		email: `user${i}@example.com`,
		city: ['Amsterdam', 'Berlin', 'London', 'Paris'][i % 4]
	}));

	const columns = [
		{ key: 'id', label: 'ID' },
		{ key: 'name', label: 'Name' },
		{ key: 'email', label: 'Email' },
		{ key: 'city', label: 'City' }
	];
</script>

<Story
	name="Twenty rows"
	args={{ rows, columns }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const allRows = canvas.getAllByRole('row');
		await expect(allRows).toHaveLength(21);
		await userEvent.click(canvas.getByText('Name'));
		const firstDataRow = canvas.getAllByRole('row')[1];
		await expect(within(firstDataRow).getByText('Alice Smith')).toBeInTheDocument();
	}}
/>

<Story
	name="Filtered"
	args={{ rows, columns, filter: 'Alice' }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const allRows = canvas.getAllByRole('row');
		await expect(allRows).toHaveLength(6);
		const names = canvas.getAllByText('Alice Smith');
		await expect(names).toHaveLength(5);
	}}
/>
