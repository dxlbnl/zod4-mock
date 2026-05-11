<script module lang="ts">
	import { defineMeta } from "@storybook/addon-svelte-csf";
	import { within, expect } from "storybook/test";
	import StatusBar from "./StatusBar.svelte";

	const { Story } = defineMeta({
		title: "Surfaces/StatusBar",
		component: StatusBar,
		parameters: {
			docs: {
				description: {
					component:
						"24px tall. Pipe-separated mono labels. Left: validation + counts. Right: regen time + version.",
				},
			},
		},
		tags: ["autodocs"],
		args: {
			status: "ok",
			statusLabel: "valid",
			counts: ["3 subjects", "2 relationships"],
			seed: 42,
			meta: "regenerated 240ms ago",
			version: "z@4.0.1",
		},
	});
</script>

<Story
	name="Default"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// SB-1: Validation status
		await expect(canvas.getByText(/valid/i)).toBeInTheDocument();

		// SB-2: World summary metrics
		await expect(canvas.getByText(/3 subjects/i)).toBeInTheDocument();
		await expect(canvas.getByText(/2 relationships/i)).toBeInTheDocument();
		await expect(canvas.getByText(/seed 42/i)).toBeInTheDocument();

		await expect(canvas.getByText(/z@4.0.1/i)).toBeInTheDocument();
	}}
/>

<Story
	name="Warning"
	args={{
		status: "warn",
		statusLabel: "unbound types",
		counts: ["1 error"],
	}}
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(canvas.getByText(/unbound types/i)).toBeInTheDocument();
		await expect(canvas.getByText(/1 error/i)).toBeInTheDocument();
	}}
/>
