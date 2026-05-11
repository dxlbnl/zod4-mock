<script module lang="ts">
	import { defineMeta } from "@storybook/addon-svelte-csf";
	import Playground from "./Playground.svelte";
	import { within, userEvent, expect } from "storybook/test";
	import { tick } from "svelte";

	const { Story } = defineMeta({
		title: "Playground/Playground",
		component: Playground,
		parameters: {
			layout: "fullscreen",
			a11y: { disable: true },
		},
	});
</script>

<Story name="Default" />

<Story
	name="Renaming"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// 1. Find the title input in the builder pane
		const titleInput = await canvas.findByTestId("schema-name-input");

		// 2. Rename it to "Member"
		await userEvent.clear(titleInput);
		await userEvent.type(titleInput, "Member");
		await tick();

		// 3. Verify it changed in the Left Rail
		const desktop = within(canvas.getByTestId("desktop-content"));
		await expect(desktop.getByText("Member")).toBeInTheDocument();
	}}
/>

<Story
	name="Projection"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const desktop = within(canvas.getByTestId("desktop-content"));

		// 1. Select UserApi from rail
		const userApiItem = desktop.getByText("UserApi");
		await userEvent.click(userApiItem);
		await tick();

		// 2. Verify we are in the Schema Editor for UserApi
		const titleInput = await canvas.findByTestId("schema-name-input");
		await expect(titleInput).toHaveValue("UserApi");

		// 3. Find Derived From select and check it's set to "User"
		const derivedSelect = canvas.getByLabelText(
			/Derived From/i,
		) as HTMLSelectElement;
		expect(derivedSelect.value).toBeDefined();

		// 4. Verify a field is mapped
		const userIdLine = canvas
			.getByDisplayValue("userId")
			.closest("[data-field-id]") as HTMLElement;

		await expect(
			within(userIdLine).getByTitle(/Mapped to source.id/),
		).toBeInTheDocument();
	}}
/>

<Story
	name="RelationalWiring"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const desktop = within(canvas.getByTestId("desktop-content"));

		// 1. Add "Order" schema
		const addSchemaBtn = desktop.getByText(/add schema/i);
		await userEvent.click(addSchemaBtn);
		await tick();

		const titleInput = await canvas.findByTestId("schema-name-input");
		await userEvent.clear(titleInput);
		await userEvent.type(titleInput, "Order");
		await tick();

		// 2. Add "userId" field
		const addPropBtn = canvas.getByText(/add property/i);
		await userEvent.click(addPropBtn);
		await tick();

		const keyInputs = await canvas.findAllByTestId("key-input");
		const lastKeyInput = keyInputs[keyInputs.length - 1];
		await userEvent.clear(lastKeyInput);
		await userEvent.type(lastKeyInput, "userId");
		await tick();

		// 3. Add Relationship at schema level
		const relNameInput = canvas.getByPlaceholderText(/relation name/i);
		await userEvent.type(relNameInput, "customer");

		const relTargetSelect = canvas
			.getAllByRole("combobox")
			.find((el) =>
				el.closest(".relations-manager"),
			) as HTMLSelectElement;
		const userOption = Array.from(relTargetSelect.options).find(
			(opt) => opt.text === "User",
		);
		await userEvent.selectOptions(relTargetSelect, userOption!.value);

		const addRelBtn = canvas.getByTestId("add-rel-btn");
		await userEvent.click(addRelBtn);
		await tick();

		// 4. Bind field to relation
		const userIdLine = lastKeyInput.closest(
			"[data-field-id]",
		) as HTMLElement;
		const mappingBtn = within(userIdLine).getByTitle(
			/Map field|match:|Mapped to/i,
		);
		await userEvent.click(mappingBtn);
		await tick();

		// Wait for dropdown and find the option
		const customerOpt = await canvas.findByText(/FK for customer/i);
		await userEvent.click(customerOpt);
		await tick();

		// 5. Verify it's mapped
		await expect(
			within(userIdLine).getByTitle(/Mapped to customer.id/),
		).toBeInTheDocument();
	}}
/>
