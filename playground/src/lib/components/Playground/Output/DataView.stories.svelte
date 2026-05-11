<script module lang="ts">
	import { defineMeta } from "@storybook/addon-svelte-csf";
	import { within, expect } from "storybook/test";
	import DataView from "./DataView.svelte";

	function tokenize(data: any) {
		const json = JSON.stringify(data, null, 2);
		return json.split("\n").map((text, i) => ({
			lineNumber: i + 1,
			tokens: [{ kind: "plain" as const, text }],
		}));
	}

	const { Story } = defineMeta({
		title: "Playground/Output/DataView",
		component: DataView,
		tags: ["autodocs"],
	});
</script>

<Story
	name="Default"
	args={{
		lines: tokenize({
			id: "user_123",
			username: "johndoe",
			email: "john@example.com",
			role: "admin",
			profile: {
				firstName: "John",
				lastName: "Doe",
				avatar: "https://i.pravatar.cc/150",
			},
			tags: ["beta", "priority"],
			createdAt: "2024-05-06T12:00:00Z",
		}),
	}}
/>

<Story
	name="ArrayData"
	args={{
		lines: tokenize([
			{ id: 1, name: "Product A", price: 100 },
			{ id: 2, name: "Product B", price: 200 },
		]),
	}}
/>

<Story
	name="Highlighted"
	args={{
		lines: [
			{ lineNumber: 1, tokens: [{ kind: "plain", text: "{" }] },
			{
				lineNumber: 2,
				fieldId: "id",
				tokens: [
					{ kind: "property", text: '  "id"' },
					{ kind: "plain", text: ': "user_123"' },
				],
			},
			{ lineNumber: 3, tokens: [{ kind: "plain", text: "}" }] },
		],
		selectedFieldId: "id",
	}}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		// In DataView, highlighted lines get the .selected class
		const activeLine = canvasElement.querySelector(".line.selected");
		expect(activeLine).toBeInTheDocument();
		expect(activeLine).toHaveTextContent(/"id"/);
	}}
/>
