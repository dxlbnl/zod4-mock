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
			chromatic: { viewports: [1200] }
		},
	});
</script>

<Story name="Default" />

<Story
	name="Renaming"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// 1. Open settings
		const settingsBtn = await canvas.findByRole("button", { name: /Settings/i });
		await userEvent.click(settingsBtn);
		await tick();

		// 2. Find the title input in the builder pane
		const titleInput = await canvas.findByLabelText(/Schema Name/i);

		// 3. Rename it to "Member"
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

		// 1. Open settings
		const settingsBtn = await canvas.findByRole("button", { name: /Settings/i });
		await userEvent.click(settingsBtn);
		await tick();

		// 3. Verify we are in the Schema Editor for UserApi
		const titleInput = await canvas.findByLabelText(/Schema Name/i);
		await expect(titleInput).toHaveValue("UserApi");

		// 4. Find Derived From select and check it's set to "User"
		const derivedSelect = (await canvas.findByLabelText(
			/Derived From/i,
		)) as HTMLSelectElement;
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

		// Open settings to rename schema
		const settingsBtn = await canvas.findByRole("button", { name: /Settings/i });
		await userEvent.click(settingsBtn);
		await tick();

		const titleInput = await canvas.findByLabelText(/Schema Name/i);
		await userEvent.clear(titleInput);
		await userEvent.type(titleInput, "Order");
		await tick();

		// 2. Add "userId" field
		const addPropBtn = canvas.getByText(/add property/i);
		await userEvent.click(addPropBtn);
		await tick();

		const keyInputs = await canvas.findAllByLabelText(/Field name/i);
		const lastKeyInput = keyInputs[keyInputs.length - 1];
		await userEvent.clear(lastKeyInput);
		await userEvent.type(lastKeyInput, "userId");
		await tick();

		// 3. Open settings again to see Relationship manager
		const settingsBtnAgain = await canvas.findByRole("button", { name: /Settings/i });
		await userEvent.click(settingsBtnAgain);
		await tick();

		// 4. Add Relationship at schema level
		const relNameInput = await canvas.findByLabelText(/Relation Name/i);
		await userEvent.type(relNameInput, "customer");

		const relTargetTrigger = await canvas.findByLabelText(/Target Schema/i);
		await userEvent.click(relTargetTrigger);
		await tick();

		const userOption = await canvas.findByRole("option", { name: /^User$/ });
		await userEvent.click(userOption);
		await tick();

		const addRelBtn = await canvas.findByRole("button", { name: /^Add$/ });
		await userEvent.click(addRelBtn);
		await tick();

		// Wait for the relationship to appear in the manager
		await canvas.findByText("customer");

		// 4. Bind field to relation
		// Re-find the line after re-renders
		const userIdLine = (await canvas.findAllByTestId("editor-line")).find(line => 
			within(line).queryByDisplayValue("userId")
		) as HTMLElement;
		
		const mappingBtn = await within(userIdLine).findByTitle(
			/Map field|match:|Mapped to/i,
		);
		await userEvent.click(mappingBtn);
		await tick();

		// Wait for dropdown and find the specific relationship option
		const customerOpt = await canvas.findByRole("option", { name: /rel:customer:id/ });
		await userEvent.click(customerOpt);
		await tick();

		// 5. Verify it's mapped
		await expect(
			within(userIdLine).getByTitle(/Mapped to customer.id/),
		).toBeInTheDocument();
	}}
/>
