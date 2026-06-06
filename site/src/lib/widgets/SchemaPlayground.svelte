<script lang="ts">
	import { untrack } from 'svelte';
	import * as z from 'zod';
	import { generate } from 'zod4-mock';
	import { Button } from '@dxlbnl/ui';
	import Editor from './Editor.svelte';
	import JsonTree from './JsonTree.svelte';

	interface Props {
		initialCode?: string;
	}

	const DEFAULT_CODE = `z.object({
  name: z.string(),
  age: z.number().int().min(0).max(120),
  email: z.string().email()
})`;

	let { initialCode = DEFAULT_CODE }: Props = $props();

	let code = $state(untrack(() => initialCode));
	let seed = $state(Math.floor(Math.random() * 65536));
	let output = $state<unknown>(null);
	let error = $state<string | null>(null);
	let first = true;

	function buildExecutable(code: string): string {
		const lines = code.split('\n').filter((l) => !l.trim().startsWith('import '));
		while (lines.length && !lines.at(-1)!.trim()) lines.pop();
		if (!lines.length) throw new Error('No code to run');

		const lastLine = lines.at(-1)!.trim();

		// Variable declaration → run all, return the named var
		const varMatch = lastLine.match(/^(?:const|let|var)\s+(\w+)\s*=/);
		if (varMatch) {
			return `"use strict";\n${lines.join('\n')}\nreturn ${varMatch[1]};`;
		}

		// Closing bracket on last line means the whole block is one multi-line expression
		if (/^[)\]},]/.test(lastLine)) {
			return `"use strict";\nreturn (\n${lines.join('\n')}\n);`;
		}

		// Single-line or last-line expression
		const body = lines.slice(0, -1).join('\n');
		const expr = lastLine.replace(/;$/, '');
		return `"use strict";\n${body}\nreturn (${expr});`;
	}

	function isZodSchema(val: unknown): boolean {
		return (
			val !== null &&
			typeof val === 'object' &&
			'_def' in val &&
			typeof (val as Record<string, unknown>).parse === 'function'
		);
	}

	function evaluate(currentCode: string, currentSeed: number) {
		try {
			// Wrap generate so all calls in user code are automatically seeded
			const seededGenerate: typeof generate = (schema, opts) =>
				generate(schema, { seed: currentSeed, ...opts });

			const fn = new Function('z', 'generate', buildExecutable(currentCode));
			const result = fn(z, seededGenerate);

			// Auto-generate if the result is a Zod schema (bare schema expression)
			output = isZodSchema(result)
				? generate(result as Parameters<typeof generate>[0], { seed: currentSeed })
				: result;
			error = null;
		} catch (e) {
			error = String(e);
			// keep previous output visible
		}
	}

	$effect(() => {
		const currentCode = code;
		if (first) {
			first = false;
			evaluate(currentCode, untrack(() => seed));
			return;
		}
		const timer = setTimeout(() => {
			evaluate(currentCode, untrack(() => seed));
		}, 400);
		return () => clearTimeout(timer);
	});

	function randomize() {
		seed = Math.floor(Math.random() * 65536);
		evaluate(code, seed);
	}
</script>

<div class="playground">
	<div class="editor-area">
		<Editor bind:value={code} />
	</div>
	<div class="toolbar">
		<Button variant="ghost" onclick={randomize}>Randomize</Button>
		{#if error}
			<span class="error">{error}</span>
		{/if}
	</div>
	{#if output !== null}
		<div class="output">
			<JsonTree value={output} />
		</div>
	{/if}
</div>

<style>
	.playground {
		border: 1px solid #373e47;
		border-radius: 8px;
		overflow: hidden;
		margin: 12px 0;
	}

	.editor-area {
		border-bottom: 1px solid #373e47;
	}

	.toolbar {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: var(--u) 12px;
		background: #1c2128;
		border-bottom: 1px solid #373e47;
	}

	.error {
		color: var(--danger);
		font-family: var(--mono);
		font-size: 11px;
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.output {
		padding: var(--u2);
		font-family: var(--mono);
		font-size: 12px;
		overflow: auto;
		background: #22272e;
	}
</style>
