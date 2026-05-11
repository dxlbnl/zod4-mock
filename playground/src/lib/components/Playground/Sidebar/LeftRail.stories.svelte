<script module lang="ts">
	import { defineMeta } from "@storybook/addon-svelte-csf";
	import { userEvent, within, expect } from "storybook/test";
	import LeftRail from "./LeftRail.svelte";
	import { createPlaygroundState } from "$lib/state.svelte";
	import { tick } from "svelte";

	const { Story } = defineMeta({
		title: "Playground/Sidebar/LeftRail",
		component: LeftRail,
		parameters: {
			docs: {
				description: {
					component:
						"264px wide sidebar. Two accordion sections: World and Schemas.",
				},
			},
		},
		tags: ["autodocs"],
	});
</script>

<script lang="ts">
	const storyStates = new Map();

	function getStoryStore(name: string, init?: (store: any) => void) {
		if (!storyStates.has(name)) {
			const store = createPlaygroundState();
			if (init) init(store);
			storyStates.set(name, store);
		}
		return storyStates.get(name);
	}
</script>

<Story name="Default">
	{#snippet template()}
		{@const store = getStoryStore("Default")}
		<div
			style="height: 600px; border: 1px solid var(--line); width: 264px;"
		>
			<LeftRail {store} />
		</div>
	{/snippet}
</Story>

<Story
	name="Interactions"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const desktop = within(await canvas.findByTestId("desktop-content"));

		// LR-1: Verify sections are present
		await expect(desktop.getByText("World")).toBeInTheDocument();
		await expect(desktop.getByText("Schemas")).toBeInTheDocument();

		// LR-2: Switch active schema
		const userSchema = desktop.getByText("User");
		await userEvent.click(userSchema);
		await tick();
		const userSchemaItem = userSchema.closest(".schema-item");
		await expect(userSchemaItem).toHaveClass("selected");

		// LR-3: Add a schema
		const addSchemaBtn = desktop.getByText(/add schema/i);
		await userEvent.click(addSchemaBtn);
		await tick();
		await expect(
			desktop.findByText("NewSchema"),
		).resolves.toBeInTheDocument();

		// LR-4: Toggle World to see details
		const worldItem = desktop.getByText("Global Config");
		await userEvent.click(worldItem);
		await tick();
		await expect(worldItem.closest(".world-item")).toHaveClass("selected");
	}}
>
	{#snippet template()}
		{@const store = getStoryStore("Interactions")}
		<div
			style="height: 600px; border: 1px solid var(--line); width: 264px;"
		>
			<LeftRail {store} />
		</div>
	{/snippet}
</Story>

<Story name="Many Items">
	{#snippet template()}
		{@const store = getStoryStore("ManyItems", (s) => {
			for (let i = 0; i < 15; i++) {
				s.addSchema(`ExtraSchema${i}`);
			}
		})}
		<div
			style="height: 600px; border: 1px solid var(--line); width: 264px;"
		>
			<LeftRail {store} />
		</div>
	{/snippet}
</Story>
