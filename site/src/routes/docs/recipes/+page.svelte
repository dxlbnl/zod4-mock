<script lang="ts">
	// B103 — Recipes, rebuilt on the B100 doc primitives.
	// Prose ported verbatim from docs/recipes.md (the §6 hand-authored
	// convention; parity is human-policed). docs/recipes.md stays canonical.
	import DocPage from '$lib/docs/widgets/DocPage.svelte';
	import CodeBlock from '$lib/docs/widgets/CodeBlock.svelte';
	import Playground from '$lib/docs/widgets/Playground.svelte';

	// A bare z.object(...) expression — the SchemaPlayground DEFAULT_CODE contract
	// (a single valid expression buildExecutable evaluates and auto-generates from).
	const adHocCode = `z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.email(),
  role: z.enum(["admin", "user", "viewer"]),
})`;
</script>

<DocPage title="Recipes" sidebarGroup="how-to" order={1}>
	<p>Copy-pasteable patterns for common scenarios.</p>

	<hr />

	<h2>Ad-hoc generation</h2>
	<p>No world needed. Great for one-off fixtures or test helpers:</p>

	<CodeBlock id="recipes-ad-hoc" />

	<p>Run an ad-hoc schema live — edit it and the output regenerates:</p>

	<Playground initialCode={adHocCode} />

	<hr />

	<h2>Reproducible test data</h2>
	<p>
		Wrap world creation in a factory. Every call with the same seed produces identical data:
	</p>

	<CodeBlock id="recipes-reproducible" />

	<hr />

	<h2>Custom field values with <code>ctx.gen</code></h2>
	<p>Use <code>ctx.gen</code> to plug in generators directly — the PRNG is already applied:</p>

	<CodeBlock id="recipes-ctx-gen" />

	<hr />

	<h2>Invoicing domain</h2>
	<p>
		Customers, products, invoices with mathematically correct line totals, and customer summaries —
		all referentially consistent.
	</p>

	<CodeBlock id="recipes-invoicing" />

	<hr />

	<h2>Document corpus</h2>
	<p>
		A hierarchy of authors → documents → sentences → annotations with referential integrity
		throughout.
	</p>

	<CodeBlock id="recipes-document-corpus" />

	<hr />

	<h2>Multi-API entity with several file types</h2>
	<p>
		One entity (person) owns multiple types of files (text, audio, bank). Each file type has its own
		API schema. A separate "entity API" aggregates all file IDs per person.
	</p>

	<CodeBlock id="recipes-media-library" />

	<hr />

	<h2>Force a specific field value</h2>
	<CodeBlock id="recipes-force-field" />

	<p>Arrays in overrides <strong>replace</strong> rather than merge:</p>

	<CodeBlock id="recipes-override-replace-array" />

	<hr />

	<h2>Fix one item in an array</h2>
	<p>Use <code>transform</code> for array-index edits — <code>overrides</code> replaces arrays entirely:</p>

	<CodeBlock id="recipes-fix-array-item" />

	<hr />

	<h2>Control optional field probability</h2>
	<p>
		By default, <code>z.optional()</code> / <code>z.nullable()</code> fields are omitted 20% of the
		time. Fix this globally or per-call:
	</p>

	<CodeBlock id="recipes-optional-probability" />

	<hr />

	<h2>Opt out of realistic numeric distributions</h2>
	<p>
		Money / scale-free measurement keys default to <strong>log-uniform</strong> (Benford-conforming)
		and shaped keys (<code>age</code>, <code>year</code>, <code>quantity</code>, <code>count</code>)
		default to their real-world distributions. To replace any of these with a uniform draw (or any
		other custom distribution), register a per-key generator via <code>withGenerators</code>:
	</p>

	<CodeBlock id="recipes-opt-out-numeric" />

	<p>
		<code>withGenerators</code> overrides win over the built-in key heuristics — see the pipeline
		order in <a href="/docs/concepts">Concepts</a>.
	</p>

	<hr />

	<h2>Derive one schema from another</h2>
	<p>
		When two API shapes represent the same entity, bind one to the other with <code>from</code>.
		The source entity's data is available as <code>ctx.source</code>, so the derived record stays
		consistent with its source:
	</p>

	<CodeBlock id="recipes-derive" />

	<hr />

	<h2>Localize the output</h2>
	<p>
		By default, generators draw from a <strong>minimal built-in English locale</strong> — short
		curated name/word lists, no Markov generation. For realistic, Markov-generated data or a
		different language, install a locale package and pass it via <code>locale</code>:
	</p>

	<CodeBlock id="recipes-localize-install" />

	<CodeBlock id="recipes-localize-use" />

	<p>
		Locales are plain objects implementing the <code>LocaleData</code> interface — every section
		(names, words, currencies, addresses, phone formats, …) is overridable. For variants like
		British English or <code>nl-BE</code>, use the <code>extend()</code> helper:
	</p>

	<CodeBlock id="recipes-localize-extend" />

	<p>
		See <a href="/docs/api">Localization in the API reference</a> for the full interface.
	</p>
</DocPage>
