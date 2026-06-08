<script lang="ts" module>
	// B132 — Schema-coverage status matrix as a quiet pip-list (no <table>, no
	// bordered chips). Each row = a small colored status pip + the schema (mono) +
	// the note inline (dim, after an em-dash) when present. The list flows into
	// multiple CSS columns on wider viewports and collapses to one column on mobile.
	export type CoverageStatus = 'supported' | 'unsupported' | 'partial';

	export interface CoverageItem {
		/** The schema / validator, e.g. `z.string()` or `.min(n)`. Rendered mono. */
		schema: string;
		/** Support status — drives the pip colour and [data-status]. */
		status: CoverageStatus;
		/** Optional caveat/note, surfaced inline after the schema. */
		note?: string;
	}
</script>

<script lang="ts">
	interface Props {
		items: CoverageItem[];
	}

	let { items }: Props = $props();
</script>

<!-- B132 — quiet pip-list. SSR-safe (no window/document at load). Container
     carries [data-coverage]; each row [data-coverage-item] with [data-status];
     rows with a note also carry [data-coverage-notes]. -->
<ul class="coverage" data-coverage>
	{#each items as item (item.schema)}
		<li
			class="row"
			data-coverage-item
			data-status={item.status}
			class:has-note={item.note}
			{...item.note ? { 'data-coverage-notes': '' } : {}}
		>
			<span class="pip" aria-hidden="true"></span>
			<code class="schema">{item.schema}</code>
			{#if item.note}<span class="note">— {item.note}</span>{/if}
		</li>
	{/each}
</ul>

<style>
	/* Compose @dxlbnl/ui tokens in @layer site (D21). Status colours use the
	   palette tokens --ok / --amber / --ink-dim, defined in BOTH the default
	   (phosphor) and [data-palette="paper"] palettes. */
	@layer site {
		.coverage {
			list-style: none;
			margin: 12px 0 0;
			padding: 0;
			min-width: 0;
			/* Multi-column on wider viewports so long sections (e.g. ~13 primitives,
			   the ~47 unsupported rows) flow into 2+ columns instead of an endless
			   single-column scroll. Collapses to 1 column on mobile (see below). */
			column-width: 17rem;
			column-gap: 28px;
		}
		.row {
			display: flex;
			align-items: baseline;
			gap: 8px;
			padding: 2px 0;
			min-width: 0;
			/* Keep noted rows (which can wrap to two lines) intact across columns. */
			break-inside: avoid;
		}
		.row.has-note {
			flex-wrap: wrap;
		}
		/* Custom status pip — a small round marker, not a glyph in a box. */
		.pip {
			flex: none;
			width: 8px;
			height: 8px;
			border-radius: 50%;
			/* baseline-align the dot with the text row */
			align-self: center;
			background: var(--ink-dim);
		}
		/* supported — quiet green. */
		.row[data-status='supported'] .pip {
			background: var(--ok);
		}
		/* partial / caveat — amber. */
		.row[data-status='partial'] .pip {
			background: var(--amber);
		}
		/* unsupported — calm, NOT alarming, but unambiguous now that the schema
		   text reads at full contrast. A hollow ring in a muted --danger: the
		   ring shape distinguishes it from the filled supported/partial dots, and
		   the muted-danger hue (not saturated red) reads as "not supported" in
		   both phosphor and paper without a wall-of-errors feel. */
		.row[data-status='unsupported'] .pip {
			background: transparent;
			border: 1.5px solid color-mix(in srgb, var(--danger) 70%, var(--ink-dim));
		}
		.schema {
			font-family: var(--mono);
			font-size: 12px;
			color: var(--ink);
			/* a long schema string wraps within the row rather than overflowing */
			overflow-wrap: anywhere;
			word-break: break-word;
			min-width: 0;
		}
		.note {
			font-size: 12px;
			color: var(--ink-dim);
			overflow-wrap: anywhere;
			min-width: 0;
		}

		/* Mobile (≤600px): single clean column. */
		@media (max-width: 600px) {
			.coverage {
				column-width: auto;
				columns: 1;
			}
		}
	}
</style>
