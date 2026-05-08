<script module lang="ts">
	import { defineMeta } from "@storybook/addon-svelte-csf";
	import Playground from "./Playground.svelte";
	import { within, userEvent, expect } from "@storybook/test";
	import { tick } from "svelte";
	import { makeDefaultState } from "$lib/state.svelte";

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
		// The active subject is "User" by default
		const titleInput = canvas.getByDisplayValue("User");

		// 2. Rename it to "Member"
		await userEvent.clear(titleInput);
		await userEvent.type(titleInput, "Member");
		await tick();

		// 3. Verify it changed in the Left Rail
		const rail = canvas.getByRole("complementary"); // The <aside> in LeftRail
		await expect(within(rail).getByText("Member")).toBeInTheDocument();
		await expect(within(rail).queryByText("User")).toBeNull();

		// 4. Verify builder title is updated
		await expect(canvas.getByDisplayValue("Member")).toBeInTheDocument();
	}}
/>

<Story
	name="Binding"
	args={{ initialState: { ...makeDefaultState(), bindings: [] } }}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// 1. Switch to Schema view
		const rail = canvas.getByRole("complementary");

		// Open Schemas accordion
		const schemasHeader = within(rail).getByText("Schemas");
		await userEvent.click(schemasHeader);
		await tick();

		const userApiItem = within(rail).getByText("UserApi");
		await userEvent.click(userApiItem);
		await tick();

		// 2. Verify we are in the Schema Builder
		await expect(canvas.getByDisplayValue("UserApi")).toBeInTheDocument();

		// 3. Open Subject Picker and select "User"
		const pickerBtn = canvas.getByRole("button", { name: /Not bound/i });
		await userEvent.click(pickerBtn);
		await tick();

		const userOption = canvas.getByRole("option", { name: /^User$/ });
		await userEvent.click(userOption);
		await tick();

		// 4. Verify binding is active
		const identityArea = canvas.getByText("Identity Source:")
			.parentElement as HTMLElement;
		await expect(
			within(identityArea).getByRole("button", { name: /User/i }),
		).toBeInTheDocument();

		// 5. Map "userId" field to "id" subject field
		// Find the line for "userId"
		const userIdLine = canvas
			.getByDisplayValue("userId")
			.closest('[data-testid="editor-line"]') as HTMLElement;
		const linkBtn = userIdLine.querySelector(".mapping-btn") as HTMLElement;
		await userEvent.click(linkBtn);
		await tick();

		const idOption = canvas.getByText("id", { selector: ".item-name" });
		await userEvent.click(idOption);

		// 6. Verify mapping label
		await expect(
			await canvas.findByTitle("Mapped to id"),
		).toBeInTheDocument();

		// 7. Verify Data View (Status Check)
		// Switch to Data tab
		const dataTab = canvas.getByText(/Mock Data/i);
		await userEvent.click(dataTab);
		await tick();
		await tick();

		// The generation should now work with the binding.
		// We don't have a deep inspector here, but we can verify the Code View shows withSchema.
		const codeTab = canvas.getByText(/Zod Definition/i);
		await userEvent.click(codeTab);
		await tick();
		await tick();
	}}
/>

<Story
	name="RelationalWiring"
	args={{
		initialState: {
			world: {
				seed: 123,
				optionalProbability: 0,
				defaultArrayLengthMin: 1,
				defaultArrayLengthMax: 1,
				zodVersion: "4.4.3",
			},
			subjects: [
				{
					id: "user-1",
					name: "User",
					count: 1,
					fields: [
						{
							id: "f-1",
							kind: "field",
							key: "id",
							type: "uuid",
							modifiers: [],
							indent: 0,
							enumValues: [],
							children: [],
						},
						{
							id: "f-2",
							kind: "field",
							key: "name",
							type: "string",
							modifiers: [],
							indent: 0,
							enumValues: [],
							children: [],
						},
					],
				},
			],
			activeSubjectId: null,
			schemas: [],
			activeSchemaId: null,
			activeEntityType: "subject",
			relationships: [],
			bindings: [],
			ui: {
				exportOpen: false,
				outputTab: "code",
				sectionStates: { world: false, subjects: true, schemas: false },
			},
			z: null,
			availableZodVersions: [],
			isZodLoading: false,
		},
	}}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const rail = within(canvas.getByRole("complementary"));

		// 1. Add "Order" subject
		const addSubjBtn = rail.getByText(/add subject/i);
		await userEvent.click(addSubjBtn);
		await tick();

		const orderItem = rail.getByText("NewSubject");
		await userEvent.click(orderItem);
		await tick();

		const titleInput = canvas.getByDisplayValue("NewSubject");
		await userEvent.clear(titleInput);
		await userEvent.type(titleInput, "Order");
		await tick();

		// 2. Add "userId" field
		const addPropBtn = canvas.getByText(/add property/i);
		await userEvent.click(addPropBtn);
		await tick();

		const keyInputs = canvas.getAllByTestId("key-input");
		const lastKeyInput = keyInputs[keyInputs.length - 1];
		await userEvent.clear(lastKeyInput);
		await userEvent.type(lastKeyInput, "userId");
		await tick();

		// 3. Open Relationship Modal for Order
		const orderRailItem = rail
			.getByText("Order", { selector: ".name" })
			.closest(".subj") as HTMLElement;
		const linkBtn = within(orderRailItem).getByRole("button", {
			name: /Add relationship/i,
		});
		await userEvent.click(linkBtn);
		await tick();

		// 4. Fill RelationForm
		const form = within(
			canvasElement.querySelector(".relation-form") as HTMLElement,
		);
		const nameInput = form.getByPlaceholderText(/e.g. author/i);
		await userEvent.clear(nameInput);
		await userEvent.type(nameInput, "customer");

		const fromSelect = form.getByLabelText(/Identity Source/i);
		await userEvent.selectOptions(fromSelect, "User");

		const keySelect = form.getByLabelText(/Foreign Key Field/i);
		await userEvent.selectOptions(keySelect, "userId");

		const submitBtn = form.getByRole("button", { name: /Add Relation/i });
		await userEvent.click(submitBtn);
		await tick();

		// 5. Verify Sidebar entry
		const relsHeader = rail.getByText(/Relationships/i);
		// If not open, click it
		if (!canvasElement.querySelector(".list .rel-item")) {
			await userEvent.click(relsHeader);
			await tick();
		}
		await expect(
			rail.getAllByText("customer").find((el) => el.closest(".rel-item")),
		).toBeInTheDocument();
		await rail.findByText("Order", { selector: ".subj-name" });
		await rail.findByText("User", { selector: ".subj-name" });
		await rail.findByText(/via userId/i);

		// 6. Verify Builder Icon (Should be Green/Explicit)
		await tick();
		const userIdInputRel = canvas
			.getAllByDisplayValue("userId")
			.find((el) =>
				el.closest('[data-testid="editor-line"]'),
			) as HTMLElement;
		const userIdLineRel = userIdInputRel.closest(
			'[data-testid="editor-line"]',
		) as HTMLElement;
		const icon = within(userIdLineRel).getByTitle("Mapped to customer");
		await expect(icon).toHaveClass("is-mapped");

		// 7. Verify Heuristics (Add customerId field)
		await userEvent.click(addPropBtn);
		await tick();
		const keyInputs2 = canvas.getAllByTestId("key-input");
		const lastKeyInput2 = keyInputs2[keyInputs2.length - 1];
		await userEvent.type(lastKeyInput2, "customerId");
		await tick();
		await tick();

		const customerIdInput = canvas.getByDisplayValue("customerId");
		const customerIdLine = customerIdInput.closest(
			'[data-testid="editor-line"]',
		) as HTMLElement;
		const magicIcon =
			within(customerIdLine).getByTitle("Mapped to customer");
		await expect(magicIcon).toHaveClass("is-magic");

		// 8. Verify Code tab shows 'relations'
		const codeTab = canvas.getByText(/Zod Definition/i);
		await userEvent.click(codeTab);
		await tick();
		// Wait for tokenization
		const sourceView = within(canvas.getByTestId("source-view"));
		await sourceView.findByText(/relations/);
		await sourceView.findByText(/^customer$/);
	}}
/>
