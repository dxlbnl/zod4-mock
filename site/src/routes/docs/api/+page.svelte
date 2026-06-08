<script lang="ts">
	// B125 — member-level /docs/api rendered from the TypeDoc JSON model.
	//
	// The model (`api-model.generated.ts`) is produced at build time by
	// `site/scripts/build-api-model.ts` from TypeDoc's JSON output. Each symbol
	// renders member-level: functions show their signature + parameters (a param
	// that is an options/config object expands into a nested field list, not the
	// opaque alias); option/config types list every field; interfaces list every
	// method, each with a resolvable `#<Symbol>.<member>` anchor.
	//
	// B125-R14 (maintainer-chosen layout): heading-per-member, the React.dev /
	// TanStack style — densified. Each symbol stays an <h2> with its full
	// signature + prose; each member is its OWN sub-heading (<h3>, the member name
	// in mono) carrying its deep-link anchor so it is harvested into the "On this
	// page" rail. The member name + its type/optional render on a SINGLE line (the
	// `.member-line`); the description sits directly beneath as full-width prose.
	// Two visual rows per member, tight `--u`-scale rhythm — a config type's fields
	// read as a dense scannable list, not one screen per option. The type tokens
	// link to other documented symbols' on-page anchor (B125-R7) and scroll within
	// the line rather than force page overflow; the build-time dangling-link guard
	// (site/scripts/api-link-guard.ts) fails the build on a dead anchor.

	import DocPage from '$lib/docs/widgets/DocPage.svelte';
	import { API_MODEL, type ApiRef } from '$lib/docs/api/api-model.generated.js';

	// A type rendered as a sequence of segments; documented ones link to their anchor.
	function refHref(ref: ApiRef): string | null {
		return ref.anchor ? `#${ref.anchor}` : null;
	}

	// A method's meta line shows its return-type-bearing signature (the type/return
	// display the layout asks for). We render the literal signature fragment.
</script>

<DocPage title="API Reference" sidebarGroup="reference" order={1} memberToc>
	<div class="api-root">
		{#each API_MODEL as sym (sym.name)}
			<section class="api-symbol" aria-label={sym.name} data-member={sym.name}>
				<h2 id={sym.anchor} class="api-symbol-heading">{sym.name}</h2>

				<!-- eslint-disable-next-line svelte/no-at-html-tags -- build-time Shiki HTML from trusted TypeDoc output (B125) -->
				<div class="signature code-block">{@html sym.signatureHtml}</div>

				{#if sym.description}
					<p class="description">{sym.description}</p>
				{/if}

				<!-- Functions: each parameter is its own heading-per-member entry; an
				     options/config param expands into nested member entries beneath it. -->
				{#if sym.params && sym.params.length > 0}
					<h3 class="group-heading" id={`${sym.anchor}--parameters`}>Parameters</h3>
					{#each sym.params as p (p.name)}
						<div class="member-entry" data-field={p.name}>
							<div class="member-line">
								<h4 class="member-name" id={`${sym.anchor}.${p.name}`}>{p.name}</h4>
								<span class="member-type"
									>{#each p.type as seg}{#if refHref(seg)}<a class="type-link" href={refHref(seg)}
												>{seg.text}</a
											>{:else}{seg.text}{/if}{/each}</span
								>{#if p.optional}<span class="member-opt"> · optional</span>{/if}
							</div>
							{#if p.description}
								<p class="member-desc">{p.description}</p>
							{/if}

							{#if p.expanded && p.expanded.length > 0}
								<div class="expanded">
									{#each p.expanded as f (f.name)}
										<div class="member-entry nested" data-field={f.name}>
											<div class="member-line">
												<h5 class="member-name" id={`${sym.anchor}.${p.name}.${f.name}`}>{f.name}</h5>
												<span class="member-type"
													>{#each f.type as seg}{#if refHref(seg)}<a
																class="type-link"
																href={refHref(seg)}>{seg.text}</a
															>{:else}{seg.text}{/if}{/each}</span
												>{#if f.optional}<span class="member-opt"> · optional</span>{/if}
											</div>
											{#if f.description}
												<p class="member-desc">{f.description}</p>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				{/if}

				<!-- Option/config types: every OWN field, each a heading-per-member entry. -->
				{#if sym.fields && sym.fields.length > 0}
					{#each sym.fields as f (f.name)}
						<div class="member-entry" data-field={f.name}>
							<div class="member-line">
								<h3 class="member-name" id={`${sym.anchor}.${f.name}`}>{f.name}</h3>
								<span class="member-type"
									>{#each f.type as seg}{#if refHref(seg)}<a class="type-link" href={refHref(seg)}
												>{seg.text}</a
											>{:else}{seg.text}{/if}{/each}</span
								>{#if f.optional}<span class="member-opt"> · optional</span>{/if}
							</div>
							{#if f.description}
								<p class="member-desc">{f.description}</p>
							{/if}
						</div>
					{/each}
				{/if}

				<!-- Inherited fields: a compact row of links to the base type's entry (the
				     full descriptions live once on that base type, not duplicated here). -->
				{#if sym.inherited && sym.inherited.length > 0}
					{#each sym.inherited as group (group.from)}
						<p class="inherited-row">
							<span class="inherited-label"
								>Inherited from {#if group.fromAnchor}<a
										class="type-link"
										href={`#${group.fromAnchor}`}>{group.from}</a
									>{:else}{group.from}{/if}:</span
							>
							{#each group.fields as inh, i (inh.name)}{#if i > 0}<span class="inherited-sep"
										> · </span
									>{/if}<a class="type-link inherited-field" href={`#${inh.anchor}`}>{inh.name}</a
								>{/each}
						</p>
					{/each}
				{/if}

				<!-- Interfaces: every method, each a heading-per-member entry with a
				     resolvable member anchor. -->
				{#if sym.methods && sym.methods.length > 0}
					{#each sym.methods as m (m.name)}
						<div class="member-entry" data-method={m.name}>
							<div class="member-line">
								<h3 class="member-name" id={m.anchor}>{m.name}</h3>
							</div>
							<!-- eslint-disable-next-line svelte/no-at-html-tags -- build-time Shiki HTML from trusted TypeDoc output (B125) -->
							<div class="member-sig code-block">{@html m.signatureHtml}</div>
							{#if m.description}
								<p class="member-desc">{m.description}</p>
							{/if}
						</div>
					{/each}
				{/if}

				{#if sym.examples.length > 0}
					<div class="examples">
						<p class="examples-label">Example</p>
						{#each sym.examplesHtml as exampleHtml}
							<!-- eslint-disable-next-line svelte/no-at-html-tags -- build-time Shiki HTML from trusted TypeDoc output (B125) -->
							<div class="example code-block">{@html exampleHtml}</div>
						{/each}
					</div>
				{/if}
			</section>
		{/each}
	</div>
</DocPage>

<style>
	.api-root {
		min-width: 0;
	}
	.api-symbol {
		margin-bottom: var(--u3);
		min-width: 0;
	}
	.api-symbol-heading {
		font-family: var(--mono);
		scroll-margin-top: var(--u3);
	}
	/* Shiki-highlighted code blocks (signature / method signature / example). The
	   model pre-highlights each fragment to HTML with the SAME theme as the site's
	   markdown code blocks (github-dark-dimmed, lang ts), so these read consistently.
	   The wrapping container owns the border/radius; Shiki's own <pre> carries the
	   theme background + token colours and is made to WRAP (no horizontal scroll). */
	.code-block {
		margin: 0 0 var(--u);
		border-radius: 6px;
		border: 1px solid var(--rule);
		overflow: hidden;
		min-width: 0;
	}
	.code-block :global(pre.shiki) {
		margin: 0;
		padding: 10px 12px;
		font-family: var(--mono);
		font-size: 13px;
		/* WRAP long lines instead of scrolling horizontally (B114-R6: no page-level
		   horizontal overflow). Break on word boundaries; only break inside a token
		   when it is genuinely unbreakable. */
		white-space: pre-wrap;
		word-break: normal;
		overflow-wrap: anywhere;
	}
	.code-block :global(pre.shiki code) {
		font-family: inherit;
		white-space: inherit;
	}
	.member-sig {
		margin: 2px 0 0;
	}
	.description {
		color: var(--ink);
		margin: 0 0 var(--u2);
	}

	/* A small uppercase group label ("Parameters") set above a function's
	   parameter entries. Sits between the symbol <h2> and the member <h3>/<h4>s. */
	.group-heading {
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ink-dim);
		margin: var(--u2) 0 0;
		font-family: inherit;
	}

	/* Densified heading-per-member entry (B125-R14): the member NAME and its
	   TYPE/optional render on a single line (.member-line); the description sits
	   directly beneath as full-width prose. Two visual rows per member on a tight
	   `--u`-scale rhythm — a config type's 7 fields read as a dense scannable list,
	   not one screen per option. A thin top rule separates entries without spending
	   `--u2`/`--u3` of gap. */
	.member-entry {
		min-width: 0;
		margin: 0;
		padding: var(--u) 0;
		border-top: 1px solid var(--rule);
	}
	/* Name + type on ONE line. The whole line is a single horizontal scroll
	   container (like the old meta line that never overflowed the page): the name
	   heading and the type render inline, `white-space: nowrap` keeps them on one
	   row, and a genuinely long type scrolls within this box rather than widening
	   the page (B114-R6: no page-level horizontal overflow at any width). */
	.member-line {
		min-width: 0;
		overflow-x: auto;
		white-space: nowrap;
	}
	.member-name {
		display: inline-block;
		font-family: var(--mono);
		font-size: 14px;
		color: var(--ink);
		margin: 0 var(--u) 0 0;
		scroll-margin-top: var(--u3);
	}
	/* Member names are case-sensitive API identifiers (`pick`, `recursionLimit`):
	   they must render mixed-case. The global `.doc-prose-body h3` rule (specificity
	   (0,1,1), in @layer site) forces `text-transform: uppercase` onto the member-name
	   headings (h3/h4/h5). This `.api-root`-scoped selector is (0,2,0) > (0,1,1) and,
	   being unlayered component CSS, also beats the layered global rule — so the
	   identifiers stay mixed-case across every member heading on this page. */
	.api-root .member-name {
		text-transform: none;
	}
	.member-type {
		font-family: var(--mono);
		font-size: 13px;
		color: var(--ink-dim);
	}
	.member-opt {
		color: var(--ink-faint, var(--ink-dim));
		font-style: normal;
		font-family: var(--mono);
		font-size: 13px;
	}
	.type-link {
		color: var(--amber);
		text-decoration: none;
	}
	.type-link:hover {
		text-decoration: underline;
	}
	.member-desc {
		margin: 2px 0 0;
		color: var(--ink);
		/* Full-width prose: wraps on word boundaries. Reset any inherited per-char
		   break so a long token (`world.generate`) wraps as a word, not per char;
		   overflow-wrap: anywhere still lets a genuinely unbreakable token break
		   rather than force horizontal overflow. */
		word-break: normal;
		overflow-wrap: anywhere;
	}

	/* Expanded options of a function parameter: the option fields render as nested
	   member entries, indented under the parameter and set off by a left rule. The
	   nested entries share the same tight rhythm so the options block isn't sparse. */
	.expanded {
		margin: var(--u) 0 0;
		padding-left: var(--u2);
		border-left: 2px solid var(--rule);
	}
	.member-entry.nested {
		padding: 6px 0;
	}
	.member-entry.nested:first-child {
		border-top: 0;
		padding-top: 0;
	}
	.member-entry.nested .member-name {
		font-size: 13px;
	}

	/* A compact one-line row listing the fields inherited from a base type as links.
	   The fields are documented once on the base type's own entry, so we only link
	   them here rather than re-rendering their descriptions. */
	.inherited-row {
		margin: var(--u) 0 0;
		padding: var(--u) 0 0;
		border-top: 1px solid var(--rule);
		font-family: var(--mono);
		font-size: 13px;
		color: var(--ink-dim);
		word-break: normal;
		overflow-wrap: anywhere;
	}
	.inherited-label {
		color: var(--ink-dim);
		margin-right: var(--u);
	}
	.inherited-sep {
		color: var(--ink-dim);
	}

	.examples {
		margin-top: var(--u2);
		min-width: 0;
	}
	.examples-label {
		font-size: 11px;
		color: var(--ink-dim);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: var(--u);
	}
	.example {
		margin: 0 0 12px;
	}

	/* B125-R13: this member-dense reference must not single-line-ellipsis-clip its
	   "On this page" entries (the B114 treatment). Scope the override to /docs/api:
	   let rail entries wrap so every member is readable, and make the rail scroll. */
	:global(.doc-grid:has(.api-root) .toc-disclosure a) {
		white-space: normal;
		overflow: visible;
		text-overflow: clip;
	}
	@media (min-width: 1024px) {
		:global(.doc-grid:has(.api-root) .on-this-page) {
			max-height: calc(100vh - 2 * var(--u3));
			overflow-y: auto;
		}
	}
</style>
