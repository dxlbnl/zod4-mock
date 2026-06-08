<script lang="ts">
	import { onMount } from 'svelte';
	import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
	import { EditorState } from '@codemirror/state';
	import { javascript } from '@codemirror/lang-javascript';
	import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
	import { indentOnInput, bracketMatching, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
	import { tags } from '@lezer/highlight';

	interface Props {
		value?: string;
		onchange?: (v: string) => void;
		minHeight?: string;
		readonly?: boolean;
	}

	let { value = $bindable(''), onchange, minHeight = '80px', readonly = false }: Props = $props();

	// eslint-disable-next-line no-unassigned-vars -- assigned by Svelte bind:this
	let container: HTMLDivElement;
	let view: EditorView | undefined;

	// B109 (item 2): palette-reactive token colours via site CSS vars (mirrors the
	// static Shiki theme — same @dxlbnl/ui palette). CodeMirror accepts CSS custom
	// properties as colour values, so these recolour automatically when `data-palette`
	// flips — no editor reconfiguration needed.
	const highlighting = HighlightStyle.define([
		{
			tag: [tags.keyword, tags.controlKeyword, tags.moduleKeyword, tags.definitionKeyword],
			color: 'var(--amber)'
		},
		{ tag: [tags.number, tags.bool, tags.null, tags.atom], color: 'var(--amber)' },
		{
			tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
			color: 'var(--cyan)'
		},
		{ tag: [tags.string, tags.special(tags.string)], color: 'var(--code-string)' },
		{ tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--ink-faint)' },
		{ tag: [tags.punctuation, tags.bracket, tags.operator], color: 'var(--ink-dim)' },
		{ tag: [tags.variableName, tags.propertyName], color: 'var(--ink)' }
	]);

	const theme = EditorView.theme({
		'&': {
			background: 'var(--bg-sunken)',
			color: 'var(--ink)',
			fontFamily: "'JetBrains Mono', monospace",
			fontSize: '13px'
		},
		'.cm-content': { caretColor: 'var(--amber)', padding: '12px 0' },
		'.cm-cursor': { borderLeftColor: 'var(--amber)' },
		'.cm-activeLine': { background: 'color-mix(in srgb, var(--ink-dim) 6%, transparent)' },
		'&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
			background: 'color-mix(in srgb, var(--amber) 22%, transparent) !important'
		},
		'.cm-gutters': {
			background: 'var(--bg-sunken)',
			color: 'var(--ink-faint)',
			border: 'none',
			borderRight: '1px solid var(--rule)'
		},
		'.cm-lineNumbers .cm-gutterElement': { padding: '0 8px' },
		'.cm-scroller': { overflow: 'visible' },
		'.cm-editor': { height: 'auto' }
	});

	onMount(() => {
		const state = EditorState.create({
			doc: value,
			extensions: [
				history(),
				javascript(),
				theme,
				syntaxHighlighting(highlighting),
				lineNumbers(),
				highlightActiveLine(),
				bracketMatching(),
				indentOnInput(),
				keymap.of([...defaultKeymap, ...historyKeymap]),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						value = update.state.doc.toString();
						onchange?.(value);
					}
				}),
				EditorView.editable.of(!readonly)
			]
		});

		view = new EditorView({ state, parent: container });

		return () => view?.destroy();
	});

	$effect(() => {
		if (view && value !== view.state.doc.toString()) {
			view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
		}
	});
</script>

<div bind:this={container} class="editor-wrap" style="min-height:{minHeight}"></div>

<style>
	.editor-wrap {
		background: var(--bg-sunken);
		overflow: hidden;
	}

	.editor-wrap :global(.cm-editor) {
		height: auto;
	}

	.editor-wrap :global(.cm-scroller) {
		overflow: visible !important;
	}
</style>
