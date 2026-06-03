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

	// github-dark-dimmed token colors
	const highlighting = HighlightStyle.define([
		{ tag: [tags.keyword, tags.operatorKeyword, tags.modifier, tags.controlKeyword], color: '#f47067' },
		{ tag: [tags.string, tags.regexp, tags.special(tags.string)], color: '#96d0ff' },
		{ tag: [tags.number, tags.integer, tags.float], color: '#6cb6ff' },
		{ tag: [tags.bool, tags.null], color: '#6cb6ff' },
		{ tag: tags.comment, color: '#768390', fontStyle: 'italic' },
		{ tag: [tags.propertyName, tags.attributeName], color: '#6cb6ff' },
		{ tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: '#dcbdfb' },
		{ tag: [tags.className, tags.typeName, tags.self], color: '#dcbdfb' },
		{ tag: [tags.operator, tags.punctuation, tags.separator], color: '#adbac7' },
		{ tag: [tags.variableName, tags.definition(tags.variableName)], color: '#adbac7' },
		{ tag: [tags.bracket, tags.squareBracket, tags.paren, tags.angleBracket], color: '#adbac7' },
		{ tag: tags.meta, color: '#768390' },
		{ tag: tags.invalid, color: '#f47067' }
	]);

	const theme = EditorView.theme(
		{
			'&': {
				background: '#22272e',
				color: '#adbac7',
				fontFamily: "'JetBrains Mono', monospace",
				fontSize: '13px'
			},
			'.cm-content': { caretColor: '#adbac7', padding: '12px 0' },
			'.cm-cursor': { borderLeftColor: '#adbac7' },
			'.cm-activeLine': { background: 'rgba(173,186,199,0.05)' },
			'&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
				background: 'rgba(108,182,255,0.2) !important'
			},
			'.cm-gutters': {
				background: '#1c2128',
				color: '#768390',
				border: 'none',
				borderRight: '1px solid #373e47'
			},
			'.cm-lineNumbers .cm-gutterElement': { padding: '0 8px' },
			'.cm-scroller': { overflow: 'visible' },
			'.cm-editor': { height: 'auto' }
		},
		{ dark: true }
	);

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
		background: #22272e;
		overflow: hidden;
	}

	.editor-wrap :global(.cm-editor) {
		height: auto;
	}

	.editor-wrap :global(.cm-scroller) {
		overflow: visible !important;
	}
</style>
