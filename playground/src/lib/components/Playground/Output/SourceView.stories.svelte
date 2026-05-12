<script module lang="ts">
	import { defineMeta } from "@storybook/addon-svelte-csf";
	import SourceView from "./SourceView.svelte";
	import { within, expect, userEvent } from "storybook/test";

	const { Story } = defineMeta({
		title: "Playground/Output/SourceView",
		component: SourceView,
		tags: ["autodocs"],
		args: {
			lines: [
				{
					lineNumber: 1,
					depth: 0,
					isFoldable: true,
					tokens: [
						{ kind: "keyword", text: "const" },
						{ kind: "plain", text: " " },
						{ kind: "plain", text: "UserSchema" },
						{ kind: "plain", text: " " },
						{ kind: "punct", text: "=" },
						{ kind: "plain", text: " " },
						{ kind: "type", text: "z" },
						{ kind: "punct", text: "." },
						{ kind: "fn", text: "object" },
						{ kind: "punct", text: "({" },
					],
				},
				{
					lineNumber: 2,
					depth: 1,
					isFoldable: false,
					fieldId: "f1",
					tokens: [
						{ kind: "plain", text: "  " },
						{ kind: "property", text: "id" },
						{ kind: "punct", text: ":" },
						{ kind: "plain", text: " " },
						{ kind: "type", text: "z" },
						{ kind: "punct", text: "." },
						{ kind: "fn", text: "uuid" },
						{ kind: "punct", text: "()" },
						{ kind: "punct", text: "," },
					],
				},
				{
					lineNumber: 3,
					depth: 0,
					isFoldable: false,
					tokens: [{ kind: "punct", text: "});" }],
				},
			],
		},
	});
</script>

<Story name="Default" />

<Story
	name="Folding Interaction"
	play={async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// SV-1: Check initial state (unfolded)
		await expect(canvas.getByText("id")).toBeVisible();

		// SV-2: Click fold toggle
		const foldToggle = canvasElement.querySelector(".fold-toggle");
		await userEvent.click(foldToggle!);

		// SV-3: Check folded state (inline)
		await expect(canvas.queryByText("id")).not.toBeInTheDocument();
		await expect(canvas.getByText("...")).toBeVisible();

		// The closing bracket should be on the same line now
		const content = canvasElement.querySelector(".content");
		await expect(content?.textContent).toContain("({...});");

		// SV-4: Click placeholder to expand
		const placeholder = canvas.getByText("...");
		await userEvent.click(placeholder);

		// SV-5: Verify expanded
		await expect(canvas.getByText("id")).toBeVisible();
	}}
/>

<Story
	name="Nested Folding"
	args={{
		lines: [
			{
				lineNumber: 1,
				depth: 0,
				isFoldable: true,
				tokens: [{ kind: "punct", text: "{" }],
			},
			{
				lineNumber: 2,
				depth: 1,
				isFoldable: true,
				tokens: [
					{ kind: "plain", text: "  " },
					{ kind: "property", text: "inner" },
					{ kind: "punct", text: ": {" },
				],
			},
			{
				lineNumber: 3,
				depth: 2,
				isFoldable: false,
				tokens: [
					{ kind: "plain", text: "    " },
					{ kind: "property", text: "leaf" },
					{ kind: "punct", text: ": 1" },
				],
			},
			{
				lineNumber: 4,
				depth: 1,
				isFoldable: false,
				tokens: [
					{ kind: "plain", text: "  " },
					{ kind: "punct", text: "}" },
				],
			},
			{
				lineNumber: 5,
				depth: 0,
				isFoldable: false,
				tokens: [{ kind: "punct", text: "}" }],
			},
		],
	}}
/>
