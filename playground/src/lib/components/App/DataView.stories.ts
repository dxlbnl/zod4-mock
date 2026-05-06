import type { Meta, StoryObj } from '@storybook/svelte';
import DataView from './DataView.svelte';

const meta = {
	title: 'App/DataView',
	component: DataView,
	tags: ['autodocs'],
	argTypes: {
		data: { control: 'object' }
	}
} satisfies Meta<DataView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		data: {
			id: "user_123",
			username: "johndoe",
			email: "john@example.com",
			role: "admin",
			profile: {
				firstName: "John",
				lastName: "Doe",
				avatar: "https://i.pravatar.cc/150"
			},
			tags: ["beta", "priority"],
			createdAt: "2024-05-06T12:00:00Z"
		}
	}
};

export const ArrayData: Story = {
	args: {
		data: [
			{ id: 1, name: "Product A", price: 100 },
			{ id: 2, name: "Product B", price: 200 }
		]
	}
};
