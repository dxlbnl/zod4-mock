<script module>
	import { defineMeta } from "@storybook/addon-svelte-csf";
	import { userEvent, within, expect, fn } from "storybook/test";
	import Input from "./Input.svelte";

	const { Story } = defineMeta({
		title: "Primitives/Input",
		component: Input,
		parameters: {
			docs: {
				description: {
					component:
						"Single utility input used in left-rail fields and search boxes. Mono 11px, 22px tall.",
				},
			},
		},
		tags: ["autodocs"],
		args: {
			oninput: fn(),
		},
	});
</script>

<Story
	name="Default"
	args={{ value: "seed_42", placeholder: "Enter seed…" }}
	play={async ({ args, canvasElement }) => {
		args.oninput.mockClear();
		const canvas = within(canvasElement);
		const input = canvas.getByPlaceholderText("Enter seed…");

		await userEvent.clear(input);
		await userEvent.type(input, "new_seed");

		await expect(input).toHaveValue("new_seed");
		await expect(args.oninput).toHaveBeenCalled();
	}}
/>

<Story name="With Label" args={{ label: "seed", value: "seed_42" }} />

<Story
	name="Focus State"
	args={{ label: "active", value: "active", autofocus: true }}
/>
